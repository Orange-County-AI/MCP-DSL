import { describe, test, expect } from "bun:test";
import { parseMCPDSL, MCPDSLLexer, MCPDSLParser, MCPDSLCompiler, decompileMCPJSON } from "./mcp-dsl-implementation";

describe("MCP-DSL Parser & Compiler - Real MCP Spec Tests", () => {
  test("should parse simple ping", () => {
    const dsl = `> ping#2`;
    const result = parseMCPDSL(dsl);

    expect(result.jsonrpc).toBe("2.0");
    expect(result.id).toBe(2);
    expect(result.method).toBe("ping");
  });

  test("should parse initialize request", () => {
    const dsl = `> initialize#1 {
      v: "2025-03-26"
    }`;

    const result = parseMCPDSL(dsl);

    expect(result.jsonrpc).toBe("2.0");
    expect(result.id).toBe(1);
    expect(result.method).toBe("initialize");
    expect(result.params.protocolVersion).toBe("2025-03-26");
  });

  test("should compile Tool definition", () => {
    const dsl = `T search {
      desc: "Search tool"
      in: {query: str!}
    }`;

    const lexer = new MCPDSLLexer(dsl);
    const tokens = lexer.tokenize();
    const parser = new MCPDSLParser(tokens);
    const ast = parser.parse();
    const compiler = new MCPDSLCompiler();
    const result = compiler.compile(ast);

    expect(result.name).toBe("search");
    expect(result.description).toBe("Search tool");
    expect(result.inputSchema).toBeDefined();
  });

  test("should parse notification without id", () => {
    const dsl = `! initialized`;
    const result = parseMCPDSL(dsl);

    expect(result.jsonrpc).toBe("2.0");
    expect(result.method).toBe("initialized");
    expect(result.id).toBeUndefined();
  });

  test("should parse tools/call request", () => {
    const dsl = `> tools/call#4 {
      name: "get_weather"
      args: {location: "New York"}
    }`;

    const result = parseMCPDSL(dsl);

    expect(result.jsonrpc).toBe("2.0");
    expect(result.id).toBe(4);
    expect(result.method).toBe("tools/call");
    expect(result.params.name).toBe("get_weather");
    expect(result.params.arguments.location).toBe("New York");
  });

  test("should parse resources/read request", () => {
    const dsl = `> resources/read#6 {
      uri: "file:///project/src/main.rs"
    }`;

    const result = parseMCPDSL(dsl);

    expect(result.jsonrpc).toBe("2.0");
    expect(result.id).toBe(6);
    expect(result.method).toBe("resources/read");
    expect(result.params.uri).toBe("file:///project/src/main.rs");
  });

  test("should parse error response", () => {
    const dsl = `x #10 -32601:"Method not found"`;

    const result = parseMCPDSL(dsl);

    expect(result.jsonrpc).toBe("2.0");
    expect(result.id).toBe(10);
    expect(result.error).toBeDefined();
    expect(result.error.code).toBe(-32601);
    expect(result.error.message).toBe("Method not found");
  });

  test("should compile Resource definition with annotations", () => {
    const dsl = `R main_file {
      uri: "file:///project/src/main.rs"
      mime: "text/x-rust"
      desc: "Primary application entry point"
      @priority: 1.0
    }`;

    const lexer = new MCPDSLLexer(dsl);
    const tokens = lexer.tokenize();
    const parser = new MCPDSLParser(tokens);
    const ast = parser.parse();
    const compiler = new MCPDSLCompiler();
    const result = compiler.compile(ast);

    expect(result.name).toBe("main_file");
    expect(result.uri).toBe("file:///project/src/main.rs");
    expect(result.mimeType).toBe("text/x-rust");
    expect(result.description).toBe("Primary application entry point");
    expect(result.annotations).toBeDefined();
    expect(result.annotations.priority).toBe(1.0);
  });

  test("should handle required fields in tool schema", () => {
    const dsl = `T weather {
      in: {
        location: str!
        days: int
      }
    }`;

    const lexer = new MCPDSLLexer(dsl);
    const tokens = lexer.tokenize();
    const parser = new MCPDSLParser(tokens);
    const ast = parser.parse();
    const compiler = new MCPDSLCompiler();
    const result = compiler.compile(ast);

    expect(result.inputSchema.required).toContain("location");
    expect(result.inputSchema.required).not.toContain("days");
  });

  test("should map DSL types to JSON Schema types", () => {
    const dsl = `T test_types {
      in: {
        text: str!
        count: int!
        amount: num!
        active: bool!
      }
    }`;

    const lexer = new MCPDSLLexer(dsl);
    const tokens = lexer.tokenize();
    const parser = new MCPDSLParser(tokens);
    const ast = parser.parse();
    const compiler = new MCPDSLCompiler();
    const result = compiler.compile(ast);

    expect(result.inputSchema.properties.text.type).toBe("string");
    expect(result.inputSchema.properties.count.type).toBe("integer");
    expect(result.inputSchema.properties.amount.type).toBe("number");
    expect(result.inputSchema.properties.active.type).toBe("boolean");
  });

  test("should compile @readonly annotation on tools", () => {
    const dsl = `T search {
      desc: "Search tool"
      in: {query: str!}
      @readonly
    }`;

    const lexer = new MCPDSLLexer(dsl);
    const tokens = lexer.tokenize();
    const parser = new MCPDSLParser(tokens);
    const ast = parser.parse();
    const compiler = new MCPDSLCompiler();
    const result = compiler.compile(ast);

    expect(result.annotations).toBeDefined();
    expect(result.annotations.readOnlyHint).toBe(true);
  });

  test("MCP spec: responses must have result, not error", () => {
    const dsl = `< #100 {status: "ok"}`;
    const result = parseMCPDSL(dsl);

    expect(result.id).toBe(100);
    expect(result.result).toBeDefined();
    expect(result.error).toBeUndefined();
    expect(result.method).toBeUndefined();
  });

  test("MCP spec: errors must have error, not result", () => {
    const dsl = `x #100 -32601:"Method not found"`;
    const result = parseMCPDSL(dsl);

    expect(result.id).toBe(100);
    expect(result.error).toBeDefined();
    expect(result.result).toBeUndefined();
    expect(result.method).toBeUndefined();
  });

  test("MCP spec: protocol version 2025-03-26", () => {
    const dsl = `> initialize#1 {v: "2025-03-26"}`;
    const result = parseMCPDSL(dsl);

    expect(result.params.protocolVersion).toBe("2025-03-26");
  });

  test("Token efficiency: DSL should be more compact than JSON", () => {
    const dsl = `> tools/call#42 {name: "search", args: {q: "test"}}`;

    const jsonEquivalent = JSON.stringify({
      jsonrpc: "2.0",
      id: 42,
      method: "tools/call",
      params: {
        name: "search",
        arguments: { q: "test" }
      }
    });

    // DSL should be significantly shorter
    expect(dsl.length).toBeLessThan(jsonEquivalent.length);
  });
});

describe("MCP-DSL Round-Trip Tests (DSL → JSON → DSL)", () => {
  test("should round-trip simple ping request", () => {
    const originalDSL = `> ping#2`;

    // DSL → JSON
    const json = parseMCPDSL(originalDSL);

    // JSON → DSL
    const reconstructedDSL = decompileMCPJSON(json);

    // Verify JSON is correct
    expect(json.jsonrpc).toBe("2.0");
    expect(json.id).toBe(2);
    expect(json.method).toBe("ping");

    // Verify reconstructed DSL matches original semantics
    expect(reconstructedDSL).toBe(originalDSL);
  });

  test("should round-trip initialize request with params", () => {
    const originalDSL = `> initialize#1 {
  v: "2025-03-26"
}`;

    // DSL → JSON
    const json = parseMCPDSL(originalDSL);

    // JSON → DSL
    const reconstructedDSL = decompileMCPJSON(json);

    // Verify JSON is correct
    expect(json.params.protocolVersion).toBe("2025-03-26");

    // Parse reconstructed DSL back to JSON for semantic comparison
    const roundTripJSON = parseMCPDSL(reconstructedDSL);
    expect(roundTripJSON.params.protocolVersion).toBe(json.params.protocolVersion);
  });

  test("should round-trip notification", () => {
    const originalDSL = `! initialized`;

    // DSL → JSON
    const json = parseMCPDSL(originalDSL);

    // JSON → DSL
    const reconstructedDSL = decompileMCPJSON(json);

    // Verify
    expect(json.method).toBe("initialized");
    expect(json.id).toBeUndefined();
    expect(reconstructedDSL).toBe(originalDSL);
  });

  test("should round-trip error response", () => {
    const originalDSL = `x #10 -32601:"Method not found"`;

    // DSL → JSON
    const json = parseMCPDSL(originalDSL);

    // JSON → DSL
    const reconstructedDSL = decompileMCPJSON(json);

    // Verify JSON structure
    expect(json.error.code).toBe(-32601);
    expect(json.error.message).toBe("Method not found");

    // Verify DSL reconstruction
    expect(reconstructedDSL).toBe(originalDSL);
  });

  test("should round-trip response with result", () => {
    const originalJSON = {
      jsonrpc: "2.0",
      id: 100,
      result: { status: "ok" }
    };

    // JSON → DSL
    const dsl = decompileMCPJSON(originalJSON);

    // DSL → JSON
    const reconstructedJSON = parseMCPDSL(dsl);

    // Verify semantic equivalence
    expect(reconstructedJSON.id).toBe(originalJSON.id);
    expect(reconstructedJSON.result.status).toBe(originalJSON.result.status);
  });

  test("should round-trip tool definition", () => {
    const originalJSON = {
      name: "search",
      description: "Search tool",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" }
        },
        required: ["query"]
      }
    };

    // JSON → DSL
    const dsl = decompileMCPJSON(originalJSON);

    // Verify DSL contains key elements
    expect(dsl).toContain("T search");
    expect(dsl).toContain("desc:");
    expect(dsl).toContain("query: str!");

    // Parse back to verify structure
    const lexer = new MCPDSLLexer(dsl);
    const tokens = lexer.tokenize();
    const parser = new MCPDSLParser(tokens);
    const ast = parser.parse();
    const compiler = new MCPDSLCompiler();
    const reconstructedJSON = compiler.compile(ast);

    // Verify semantic equivalence
    expect(reconstructedJSON.name).toBe(originalJSON.name);
    expect(reconstructedJSON.description).toBe(originalJSON.description);
    expect(reconstructedJSON.inputSchema.required).toContain("query");
  });

  test("should round-trip resource definition with annotations", () => {
    const originalJSON = {
      name: "main_file",
      uri: "file:///project/src/main.rs",
      mimeType: "text/x-rust",
      description: "Primary application entry point",
      annotations: {
        priority: 1.0
      }
    };

    // JSON → DSL
    const dsl = decompileMCPJSON(originalJSON);

    // Verify DSL contains key elements
    expect(dsl).toContain("R main_file");
    expect(dsl).toContain("uri:");
    expect(dsl).toContain("@priority:");

    // Parse back
    const lexer = new MCPDSLLexer(dsl);
    const tokens = lexer.tokenize();
    const parser = new MCPDSLParser(tokens);
    const ast = parser.parse();
    const compiler = new MCPDSLCompiler();
    const reconstructedJSON = compiler.compile(ast);

    // Verify semantic equivalence
    expect(reconstructedJSON.name).toBe(originalJSON.name);
    expect(reconstructedJSON.uri).toBe(originalJSON.uri);
    expect(reconstructedJSON.annotations.priority).toBe(1.0);
  });

  test("should round-trip tools/call request", () => {
    const originalDSL = `> tools/call#4 {
  name: "get_weather",
  args: {
    location: "New York"
  }
}`;

    // DSL → JSON
    const json = parseMCPDSL(originalDSL);

    // JSON → DSL
    const reconstructedDSL = decompileMCPJSON(json);

    // DSL → JSON again
    const roundTripJSON = parseMCPDSL(reconstructedDSL);

    // Verify semantic equivalence
    expect(roundTripJSON.method).toBe(json.method);
    expect(roundTripJSON.id).toBe(json.id);
    expect(roundTripJSON.params.name).toBe(json.params.name);
    expect(roundTripJSON.params.arguments.location).toBe(json.params.arguments.location);
  });

  test("should round-trip complex tool with multiple type annotations", () => {
    const originalJSON = {
      name: "analyze",
      description: "Analyze data",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string" },
          count: { type: "integer" },
          amount: { type: "number" },
          active: { type: "boolean" }
        },
        required: ["text", "count"]
      },
      annotations: {
        readOnlyHint: true
      }
    };

    // JSON → DSL
    const dsl = decompileMCPJSON(originalJSON);

    // Parse back
    const lexer = new MCPDSLLexer(dsl);
    const tokens = lexer.tokenize();
    const parser = new MCPDSLParser(tokens);
    const ast = parser.parse();
    const compiler = new MCPDSLCompiler();
    const reconstructedJSON = compiler.compile(ast);

    // Verify all types are preserved
    expect(reconstructedJSON.inputSchema.properties.text.type).toBe("string");
    expect(reconstructedJSON.inputSchema.properties.count.type).toBe("integer");
    expect(reconstructedJSON.inputSchema.properties.amount.type).toBe("number");
    expect(reconstructedJSON.inputSchema.properties.active.type).toBe("boolean");

    // Verify required fields
    expect(reconstructedJSON.inputSchema.required).toContain("text");
    expect(reconstructedJSON.inputSchema.required).toContain("count");
    expect(reconstructedJSON.inputSchema.required).not.toContain("amount");

    // Verify annotations
    expect(reconstructedJSON.annotations.readOnlyHint).toBe(true);
  });

  test("should maintain semantic equivalence across full round-trip", () => {
    // Test multiple message types in sequence
    const testCases = [
      `> ping#1`,
      `! initialized`,
      `x #5 -32600:"Invalid Request"`,
    ];

    for (const originalDSL of testCases) {
      // DSL → JSON → DSL → JSON
      const json1 = parseMCPDSL(originalDSL);
      const dsl = decompileMCPJSON(json1);
      const json2 = parseMCPDSL(dsl);

      // Both JSON representations should be semantically equivalent
      expect(JSON.stringify(json1)).toBe(JSON.stringify(json2));
    }
  });
});
