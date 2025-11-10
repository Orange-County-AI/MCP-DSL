import std/[unittest, json]
import mcp_dsl_implementation

suite "MCP-DSL Parser & Compiler - Real MCP Spec Tests":
  test "should parse simple ping":
    let dsl = "> ping#2"
    let result = parseMCPDSL(dsl)

    check result["jsonrpc"].getStr == "2.0"
    check result["id"].getInt == 2
    check result["method"].getStr == "ping"

  test "should parse initialize request":
    let dsl = """
> initialize#1 {
  v: "2025-03-26"
}
    """

    let result = parseMCPDSL(dsl)

    check result["jsonrpc"].getStr == "2.0"
    check result["id"].getInt == 1
    check result["method"].getStr == "initialize"
    check result["params"]["protocolVersion"].getStr == "2025-03-26"

  test "should compile Tool definition":
    let dsl = """
T search {
  desc: "Search tool"
  in: {query: str!}
}
    """

    let result = parseMCPDSL(dsl)

    check result["name"].getStr == "search"
    check result["description"].getStr == "Search tool"
    check result.hasKey("inputSchema")

  test "should parse notification without id":
    let dsl = "! initialized"
    let result = parseMCPDSL(dsl)

    check result["jsonrpc"].getStr == "2.0"
    check result["method"].getStr == "initialized"
    check not result.hasKey("id")

  test "should parse tools/call request":
    let dsl = """
> tools/call#4 {
  name: "get_weather"
  args: {location: "New York"}
}
    """

    let result = parseMCPDSL(dsl)

    check result["jsonrpc"].getStr == "2.0"
    check result["id"].getInt == 4
    check result["method"].getStr == "tools/call"
    check result["params"]["name"].getStr == "get_weather"
    check result["params"]["arguments"]["location"].getStr == "New York"

  test "should parse resources/read request":
    let dsl = """
> resources/read#6 {
  uri: "file:///project/src/main.rs"
}
    """

    let result = parseMCPDSL(dsl)

    check result["jsonrpc"].getStr == "2.0"
    check result["id"].getInt == 6
    check result["method"].getStr == "resources/read"
    check result["params"]["uri"].getStr == "file:///project/src/main.rs"

  test "should parse error response":
    let dsl = """x #10 -32601:"Method not found""""

    let result = parseMCPDSL(dsl)

    check result["jsonrpc"].getStr == "2.0"
    check result["id"].getInt == 10
    check result.hasKey("error")
    check result["error"]["code"].getInt == -32601
    check result["error"]["message"].getStr == "Method not found"

  test "should compile Resource definition with annotations":
    let dsl = """
R main_file {
  uri: "file:///project/src/main.rs"
  mime: "text/x-rust"
  desc: "Primary application entry point"
  @priority: 1.0
}
    """

    let result = parseMCPDSL(dsl)

    check result["name"].getStr == "main_file"
    check result["uri"].getStr == "file:///project/src/main.rs"
    check result["mimeType"].getStr == "text/x-rust"
    check result["description"].getStr == "Primary application entry point"
    check result.hasKey("annotations")
    check result["annotations"]["priority"].getFloat == 1.0

  test "should handle required fields in tool schema":
    let dsl = """
T weather {
  in: {
    location: str!
    days: int
  }
}
    """

    let result = parseMCPDSL(dsl)

    var hasLocation = false
    var hasDays = false
    for item in result["inputSchema"]["required"]:
      if item.getStr == "location":
        hasLocation = true
      elif item.getStr == "days":
        hasDays = true

    check hasLocation
    check not hasDays

  test "should map DSL types to JSON Schema types":
    let dsl = """
T test_types {
  in: {
    text: str!
    count: int!
    amount: num!
    active: bool!
  }
}
    """

    let result = parseMCPDSL(dsl)

    check result["inputSchema"]["properties"]["text"]["type"].getStr == "string"
    check result["inputSchema"]["properties"]["count"]["type"].getStr == "integer"
    check result["inputSchema"]["properties"]["amount"]["type"].getStr == "number"
    check result["inputSchema"]["properties"]["active"]["type"].getStr == "boolean"

  test "should compile @readonly annotation on tools":
    let dsl = """
T search {
  desc: "Search tool"
  in: {query: str!}
  @readonly
}
    """

    let result = parseMCPDSL(dsl)

    check result.hasKey("annotations")
    check result["annotations"]["readOnlyHint"].getBool == true

  test "MCP spec: responses must have result, not error":
    let dsl = """< #100 {status: "ok"}"""
    let result = parseMCPDSL(dsl)

    check result["id"].getInt == 100
    check result.hasKey("result")
    check not result.hasKey("error")
    check not result.hasKey("method")

  test "MCP spec: errors must have error, not result":
    let dsl = """x #100 -32601:"Method not found""""
    let result = parseMCPDSL(dsl)

    check result["id"].getInt == 100
    check result.hasKey("error")
    check not result.hasKey("result")
    check not result.hasKey("method")

  test "MCP spec: protocol version 2025-03-26":
    let dsl = """> initialize#1 {v: "2025-03-26"}"""
    let result = parseMCPDSL(dsl)

    check result["params"]["protocolVersion"].getStr == "2025-03-26"

  test "Token efficiency: DSL should be more compact than JSON":
    let dsl = """> tools/call#42 {name: "search", args: {q: "test"}}"""

    let jsonEquivalent = $(%*{
      "jsonrpc": "2.0",
      "id": 42,
      "method": "tools/call",
      "params": {
        "name": "search",
        "arguments": {"q": "test"}
      }
    })

    # DSL should be significantly shorter
    check dsl.len < jsonEquivalent.len
