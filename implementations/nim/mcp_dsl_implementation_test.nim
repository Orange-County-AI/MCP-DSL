import std/[unittest, json, strutils]
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

suite "MCP-DSL Round-Trip Tests (DSL → JSON → DSL)":
  test "should round-trip simple ping request":
    let originalDSL = "> ping#2"

    # DSL → JSON
    let jsonData = parseMCPDSL(originalDSL)

    # JSON → DSL
    let reconstructedDSL = decompileMCPJSON(jsonData)

    # Verify JSON is correct
    check jsonData["jsonrpc"].getStr == "2.0"
    check jsonData["id"].getInt == 2
    check jsonData["method"].getStr == "ping"

    # Verify reconstructed DSL matches original
    check reconstructedDSL == originalDSL

  test "should round-trip initialize request with params":
    let originalDSL = """> initialize#1 {
  v: "2025-03-26"
}"""

    # DSL → JSON
    let jsonData = parseMCPDSL(originalDSL)

    # JSON → DSL
    let reconstructedDSL = decompileMCPJSON(jsonData)

    # Verify JSON is correct
    check jsonData["params"]["protocolVersion"].getStr == "2025-03-26"

    # Parse reconstructed DSL back to JSON for semantic comparison
    let roundTripJSON = parseMCPDSL(reconstructedDSL)
    check roundTripJSON["params"]["protocolVersion"].getStr == jsonData["params"]["protocolVersion"].getStr

  test "should round-trip notification":
    let originalDSL = "! initialized"

    # DSL → JSON
    let jsonData = parseMCPDSL(originalDSL)

    # JSON → DSL
    let reconstructedDSL = decompileMCPJSON(jsonData)

    # Verify
    check jsonData["method"].getStr == "initialized"
    check not jsonData.hasKey("id")
    check reconstructedDSL == originalDSL

  test "should round-trip error response":
    let originalDSL = """x #10 -32601:"Method not found""""

    # DSL → JSON
    let jsonData = parseMCPDSL(originalDSL)

    # JSON → DSL
    let reconstructedDSL = decompileMCPJSON(jsonData)

    # Verify JSON structure
    check jsonData["error"]["code"].getInt == -32601
    check jsonData["error"]["message"].getStr == "Method not found"

    # Verify DSL reconstruction
    check reconstructedDSL == originalDSL

  test "should round-trip response with result":
    let originalJSON = %*{
      "jsonrpc": "2.0",
      "id": 100,
      "result": {"status": "ok"}
    }

    # JSON → DSL
    let dsl = decompileMCPJSON(originalJSON)

    # DSL → JSON
    let reconstructedJSON = parseMCPDSL(dsl)

    # Verify semantic equivalence
    check reconstructedJSON["id"].getInt == originalJSON["id"].getInt
    check reconstructedJSON["result"]["status"].getStr == originalJSON["result"]["status"].getStr

  test "should round-trip tool definition":
    let originalJSON = %*{
      "name": "search",
      "description": "Search tool",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": {"type": "string"}
        },
        "required": ["query"]
      }
    }

    # JSON → DSL
    let dsl = decompileMCPJSON(originalJSON)

    # Verify DSL contains key elements
    check dsl.contains("T search")
    check dsl.contains("desc:")
    check dsl.contains("query: str!")

    # Parse back to verify structure
    let reconstructedJSON = parseMCPDSL(dsl)

    # Verify semantic equivalence
    check reconstructedJSON["name"].getStr == originalJSON["name"].getStr
    check reconstructedJSON["description"].getStr == originalJSON["description"].getStr
    var foundQuery = false
    for item in reconstructedJSON["inputSchema"]["required"]:
      if item.getStr == "query":
        foundQuery = true
    check foundQuery

  test "should round-trip resource definition with annotations":
    let originalJSON = %*{
      "name": "main_file",
      "uri": "file:///project/src/main.rs",
      "mimeType": "text/x-rust",
      "description": "Primary application entry point",
      "annotations": {
        "priority": 1.0
      }
    }

    # JSON → DSL
    let dsl = decompileMCPJSON(originalJSON)

    # Verify DSL contains key elements
    check dsl.contains("R main_file")
    check dsl.contains("uri:")
    check dsl.contains("@priority:")

    # Parse back
    let reconstructedJSON = parseMCPDSL(dsl)

    # Verify semantic equivalence
    check reconstructedJSON["name"].getStr == originalJSON["name"].getStr
    check reconstructedJSON["uri"].getStr == originalJSON["uri"].getStr
    check reconstructedJSON["annotations"]["priority"].getFloat == 1.0

  test "should round-trip tools/call request":
    let originalDSL = """> tools/call#4 {
  name: "get_weather",
  args: {
    location: "New York"
  }
}"""

    # DSL → JSON
    let jsonData = parseMCPDSL(originalDSL)

    # JSON → DSL
    let reconstructedDSL = decompileMCPJSON(jsonData)

    # DSL → JSON again
    let roundTripJSON = parseMCPDSL(reconstructedDSL)

    # Verify semantic equivalence
    check roundTripJSON["method"].getStr == jsonData["method"].getStr
    check roundTripJSON["id"].getInt == jsonData["id"].getInt
    check roundTripJSON["params"]["name"].getStr == jsonData["params"]["name"].getStr
    check roundTripJSON["params"]["arguments"]["location"].getStr == jsonData["params"]["arguments"]["location"].getStr

  test "should round-trip complex tool with multiple type annotations":
    let originalJSON = %*{
      "name": "analyze",
      "description": "Analyze data",
      "inputSchema": {
        "type": "object",
        "properties": {
          "text": {"type": "string"},
          "count": {"type": "integer"},
          "amount": {"type": "number"},
          "active": {"type": "boolean"}
        },
        "required": ["text", "count"]
      },
      "annotations": {
        "readOnlyHint": true
      }
    }

    # JSON → DSL
    let dsl = decompileMCPJSON(originalJSON)

    # Parse back
    let reconstructedJSON = parseMCPDSL(dsl)

    # Verify all types are preserved
    check reconstructedJSON["inputSchema"]["properties"]["text"]["type"].getStr == "string"
    check reconstructedJSON["inputSchema"]["properties"]["count"]["type"].getStr == "integer"
    check reconstructedJSON["inputSchema"]["properties"]["amount"]["type"].getStr == "number"
    check reconstructedJSON["inputSchema"]["properties"]["active"]["type"].getStr == "boolean"

    # Verify required fields
    var foundText = false
    var foundCount = false
    var foundAmount = false
    for item in reconstructedJSON["inputSchema"]["required"]:
      let name = item.getStr
      if name == "text": foundText = true
      if name == "count": foundCount = true
      if name == "amount": foundAmount = true
    check foundText
    check foundCount
    check not foundAmount

    # Verify annotations
    check reconstructedJSON["annotations"]["readOnlyHint"].getBool == true

  test "should maintain semantic equivalence across full round-trip":
    # Test multiple message types in sequence
    let testCases = [
      "> ping#1",
      "! initialized",
      """x #5 -32600:"Invalid Request""""
    ]

    for originalDSL in testCases:
      # DSL → JSON → DSL → JSON
      let json1 = parseMCPDSL(originalDSL)
      let dsl = decompileMCPJSON(json1)
      let json2 = parseMCPDSL(dsl)

      # Both JSON representations should be semantically equivalent
      check $json1 == $json2
