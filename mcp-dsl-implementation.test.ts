import { describe, test, expect } from "bun:test";
import { parseMCPDSL, MCPDSLLexer, MCPDSLParser, MCPDSLCompiler } from "./mcp-dsl-implementation";

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
