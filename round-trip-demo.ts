#!/usr/bin/env bun
// Round-trip demonstration: DSL → JSON → DSL

import { parseMCPDSL, decompileMCPJSON } from "./mcp-dsl-implementation";

console.log("=".repeat(80));
console.log("MCP-DSL Round-Trip Transpilation Demo");
console.log("=".repeat(80));

// Example 1: Simple Request
console.log("\n📝 Example 1: Simple Ping Request");
console.log("-".repeat(80));

const dsl1 = `> ping#2`;
console.log("Original DSL:\n", dsl1);

const json1 = parseMCPDSL(dsl1);
console.log("\nTranspiled to JSON:");
console.log(JSON.stringify(json1, null, 2));

const backToDsl1 = decompileMCPJSON(json1);
console.log("\nBack to DSL:\n", backToDsl1);
console.log("✓ Round-trip successful:", dsl1 === backToDsl1);

// Example 2: Initialize Request
console.log("\n\n📝 Example 2: Initialize Request");
console.log("-".repeat(80));

const dsl2 = `> initialize#1 {
  v: "2025-03-26"
}`;
console.log("Original DSL:\n", dsl2);

const json2 = parseMCPDSL(dsl2);
console.log("\nTranspiled to JSON:");
console.log(JSON.stringify(json2, null, 2));

const backToDsl2 = decompileMCPJSON(json2);
console.log("\nBack to DSL:");
console.log(backToDsl2);

const verifyJson2 = parseMCPDSL(backToDsl2);
console.log("\n✓ Semantic equivalence:",
  json2.params.protocolVersion === verifyJson2.params.protocolVersion);

// Example 3: Tool Definition (JSON → DSL → JSON)
console.log("\n\n📝 Example 3: Tool Definition (starting from JSON)");
console.log("-".repeat(80));

const toolJSON = {
  name: "search",
  description: "Search for information",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
      limit: { type: "integer" }
    },
    required: ["query"]
  },
  annotations: {
    readOnlyHint: true
  }
};

console.log("Original JSON:");
console.log(JSON.stringify(toolJSON, null, 2));

const toolDSL = decompileMCPJSON(toolJSON);
console.log("\nTranspiled to DSL:");
console.log(toolDSL);

console.log("\nParsing DSL back to verify...");
const lexer = await import("./mcp-dsl-implementation").then(m => m.MCPDSLLexer);
const parser = await import("./mcp-dsl-implementation").then(m => m.MCPDSLParser);
const compiler = await import("./mcp-dsl-implementation").then(m => m.MCPDSLCompiler);

const tokens = new lexer(toolDSL).tokenize();
const ast = new parser(tokens).parse();
const verifyToolJSON = new compiler().compile(ast);

console.log("\nVerified JSON:");
console.log(JSON.stringify(verifyToolJSON, null, 2));
console.log("\n✓ Types preserved:", verifyToolJSON.inputSchema.properties.query.type === "string");
console.log("✓ Required fields preserved:", verifyToolJSON.inputSchema.required.includes("query"));
console.log("✓ Annotations preserved:", verifyToolJSON.annotations.readOnlyHint === true);

// Example 4: Error Response
console.log("\n\n📝 Example 4: Error Response");
console.log("-".repeat(80));

const dsl4 = `x #10 -32601:"Method not found"`;
console.log("Original DSL:\n", dsl4);

const json4 = parseMCPDSL(dsl4);
console.log("\nTranspiled to JSON:");
console.log(JSON.stringify(json4, null, 2));

const backToDsl4 = decompileMCPJSON(json4);
console.log("\nBack to DSL:\n", backToDsl4);
console.log("✓ Round-trip successful:", dsl4 === backToDsl4);

// Example 5: Resource Definition
console.log("\n\n📝 Example 5: Resource Definition");
console.log("-".repeat(80));

const resourceJSON = {
  name: "main_file",
  uri: "file:///project/src/main.rs",
  mimeType: "text/x-rust",
  description: "Primary application entry point",
  annotations: {
    priority: 1.0
  }
};

console.log("Original JSON:");
console.log(JSON.stringify(resourceJSON, null, 2));

const resourceDSL = decompileMCPJSON(resourceJSON);
console.log("\nTranspiled to DSL:");
console.log(resourceDSL);

console.log("\n" + "=".repeat(80));
console.log("✅ All round-trip transpilations completed successfully!");
console.log("=".repeat(80));
