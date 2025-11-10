// MCP-DSL Parser & Compiler Tests - Go Implementation
// Comprehensive test suite based on MCP specification

package main

import (
	"encoding/json"
	"reflect"
	"testing"
)

func TestSimplePing(t *testing.T) {
	dsl := `> ping#2`
	result := ParseMCPDSL(dsl)

	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("Expected map, got %T", result)
	}

	if m["jsonrpc"] != "2.0" {
		t.Errorf("Expected jsonrpc 2.0, got %v", m["jsonrpc"])
	}
	if m["id"] != 2 {
		t.Errorf("Expected id 2, got %v", m["id"])
	}
	if m["method"] != "ping" {
		t.Errorf("Expected method ping, got %v", m["method"])
	}
}

func TestInitializeRequest(t *testing.T) {
	dsl := `> initialize#1 {
		v: "2025-03-26"
	}`

	result := ParseMCPDSL(dsl)
	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("Expected map, got %T", result)
	}

	if m["jsonrpc"] != "2.0" {
		t.Errorf("Expected jsonrpc 2.0, got %v", m["jsonrpc"])
	}
	if m["id"] != 1 {
		t.Errorf("Expected id 1, got %v", m["id"])
	}
	if m["method"] != "initialize" {
		t.Errorf("Expected method initialize, got %v", m["method"])
	}

	params, ok := m["params"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected params to be a map")
	}
	if params["protocolVersion"] != "2025-03-26" {
		t.Errorf("Expected protocolVersion 2025-03-26, got %v", params["protocolVersion"])
	}
}

func TestToolDefinition(t *testing.T) {
	dsl := `T search {
		desc: "Search tool"
		in: {query: str!}
	}`

	result := ParseMCPDSL(dsl)
	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("Expected map, got %T", result)
	}

	if m["name"] != "search" {
		t.Errorf("Expected name search, got %v", m["name"])
	}
	if m["description"] != "Search tool" {
		t.Errorf("Expected description 'Search tool', got %v", m["description"])
	}

	inputSchema, ok := m["inputSchema"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected inputSchema to be a map")
	}
	if inputSchema["type"] != "object" {
		t.Errorf("Expected inputSchema type object, got %v", inputSchema["type"])
	}
}

func TestNotification(t *testing.T) {
	dsl := `! initialized`
	result := ParseMCPDSL(dsl)

	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("Expected map, got %T", result)
	}

	if m["jsonrpc"] != "2.0" {
		t.Errorf("Expected jsonrpc 2.0, got %v", m["jsonrpc"])
	}
	if m["method"] != "initialized" {
		t.Errorf("Expected method initialized, got %v", m["method"])
	}
	if _, exists := m["id"]; exists {
		t.Errorf("Notification should not have id field")
	}
}

func TestToolsCallRequest(t *testing.T) {
	dsl := `> tools/call#4 {
		name: "get_weather"
		args: {location: "New York"}
	}`

	result := ParseMCPDSL(dsl)
	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("Expected map, got %T", result)
	}

	if m["jsonrpc"] != "2.0" {
		t.Errorf("Expected jsonrpc 2.0, got %v", m["jsonrpc"])
	}
	if m["id"] != 4 {
		t.Errorf("Expected id 4, got %v", m["id"])
	}
	if m["method"] != "tools/call" {
		t.Errorf("Expected method tools/call, got %v", m["method"])
	}

	params, ok := m["params"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected params to be a map")
	}
	if params["name"] != "get_weather" {
		t.Errorf("Expected name get_weather, got %v", params["name"])
	}

	args, ok := params["arguments"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected arguments to be a map")
	}
	if args["location"] != "New York" {
		t.Errorf("Expected location 'New York', got %v", args["location"])
	}
}

func TestResourcesReadRequest(t *testing.T) {
	dsl := `> resources/read#6 {
		uri: "file:///project/src/main.rs"
	}`

	result := ParseMCPDSL(dsl)
	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("Expected map, got %T", result)
	}

	if m["jsonrpc"] != "2.0" {
		t.Errorf("Expected jsonrpc 2.0, got %v", m["jsonrpc"])
	}
	if m["id"] != 6 {
		t.Errorf("Expected id 6, got %v", m["id"])
	}
	if m["method"] != "resources/read" {
		t.Errorf("Expected method resources/read, got %v", m["method"])
	}

	params, ok := m["params"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected params to be a map")
	}
	if params["uri"] != "file:///project/src/main.rs" {
		t.Errorf("Expected uri, got %v", params["uri"])
	}
}

func TestErrorResponse(t *testing.T) {
	dsl := `x #10 -32601:"Method not found"`

	result := ParseMCPDSL(dsl)
	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("Expected map, got %T", result)
	}

	if m["jsonrpc"] != "2.0" {
		t.Errorf("Expected jsonrpc 2.0, got %v", m["jsonrpc"])
	}
	if m["id"] != 10 {
		t.Errorf("Expected id 10, got %v", m["id"])
	}

	errObj, ok := m["error"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected error to be a map")
	}
	if errObj["code"] != -32601 {
		t.Errorf("Expected error code -32601, got %v", errObj["code"])
	}
	if errObj["message"] != "Method not found" {
		t.Errorf("Expected error message 'Method not found', got %v", errObj["message"])
	}
}

func TestResourceDefinitionWithAnnotations(t *testing.T) {
	dsl := `R main_file {
		uri: "file:///project/src/main.rs"
		mime: "text/x-rust"
		desc: "Primary application entry point"
		@priority: 1.0
	}`

	result := ParseMCPDSL(dsl)
	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("Expected map, got %T", result)
	}

	if m["name"] != "main_file" {
		t.Errorf("Expected name main_file, got %v", m["name"])
	}
	if m["uri"] != "file:///project/src/main.rs" {
		t.Errorf("Expected uri, got %v", m["uri"])
	}
	if m["mimeType"] != "text/x-rust" {
		t.Errorf("Expected mimeType text/x-rust, got %v", m["mimeType"])
	}
	if m["description"] != "Primary application entry point" {
		t.Errorf("Expected description, got %v", m["description"])
	}
}

func TestComplexToolDefinition(t *testing.T) {
	dsl := `T analyze_code {
		desc: "Analyzes code for issues"
		in: {
			code: str!
			language: str!
		}
	}`

	result := ParseMCPDSL(dsl)
	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("Expected map, got %T", result)
	}

	if m["name"] != "analyze_code" {
		t.Errorf("Expected name analyze_code, got %v", m["name"])
	}
	if m["description"] != "Analyzes code for issues" {
		t.Errorf("Expected description, got %v", m["description"])
	}

	inputSchema, ok := m["inputSchema"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected inputSchema to be a map")
	}

	props, ok := inputSchema["properties"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected properties to be a map")
	}

	if len(props) != 2 {
		t.Errorf("Expected 2 properties, got %d", len(props))
	}

	required, ok := inputSchema["required"].([]string)
	if !ok {
		t.Fatalf("Expected required to be a string slice")
	}
	if len(required) != 2 {
		t.Errorf("Expected 2 required fields, got %d", len(required))
	}
}

func TestResponseMessage(t *testing.T) {
	dsl := `< #1 {
		v: "2025-03-26"
	}`

	result := ParseMCPDSL(dsl)
	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("Expected map, got %T", result)
	}

	if m["jsonrpc"] != "2.0" {
		t.Errorf("Expected jsonrpc 2.0, got %v", m["jsonrpc"])
	}
	if m["id"] != 1 {
		t.Errorf("Expected id 1, got %v", m["id"])
	}

	resultData, ok := m["result"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected result to be a map")
	}
	if resultData["protocolVersion"] != "2025-03-26" {
		t.Errorf("Expected protocolVersion 2025-03-26, got %v", resultData["protocolVersion"])
	}
}

func TestMultipleMessages(t *testing.T) {
	dsl := `> initialize#1 {v: "2025-06-18"}
< #1 {v: "2025-06-18"}
! initialized
> tools/list#2
> tools/call#3 {name: "search", args: {q: "MCP protocol"}}`

	result := ParseMCPDSL(dsl)
	results, ok := result.([]interface{})
	if !ok {
		t.Fatalf("Expected slice, got %T", result)
	}

	if len(results) != 5 {
		t.Errorf("Expected 5 messages, got %d", len(results))
	}

	// Check first message (request)
	msg1, ok := results[0].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected first message to be a map")
	}
	if msg1["method"] != "initialize" {
		t.Errorf("Expected first message method initialize, got %v", msg1["method"])
	}

	// Check second message (response)
	msg2, ok := results[1].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected second message to be a map")
	}
	if _, hasResult := msg2["result"]; !hasResult {
		t.Error("Expected second message to have result field")
	}

	// Check third message (notification)
	msg3, ok := results[2].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected third message to be a map")
	}
	if msg3["method"] != "initialized" {
		t.Errorf("Expected third message method initialized, got %v", msg3["method"])
	}
}

func TestToolsListRequest(t *testing.T) {
	dsl := `> tools/list#2`
	result := ParseMCPDSL(dsl)

	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("Expected map, got %T", result)
	}

	if m["jsonrpc"] != "2.0" {
		t.Errorf("Expected jsonrpc 2.0, got %v", m["jsonrpc"])
	}
	if m["id"] != 2 {
		t.Errorf("Expected id 2, got %v", m["id"])
	}
	if m["method"] != "tools/list" {
		t.Errorf("Expected method tools/list, got %v", m["method"])
	}
}

func TestJSONSerialization(t *testing.T) {
	dsl := `> ping#1`
	result := ParseMCPDSL(dsl)

	jsonBytes, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("Failed to marshal to JSON: %v", err)
	}

	var unmarshaled map[string]interface{}
	err = json.Unmarshal(jsonBytes, &unmarshaled)
	if err != nil {
		t.Fatalf("Failed to unmarshal JSON: %v", err)
	}

	if unmarshaled["jsonrpc"] != "2.0" {
		t.Errorf("Expected jsonrpc 2.0 after round-trip, got %v", unmarshaled["jsonrpc"])
	}
}

func TestLexerTokenization(t *testing.T) {
	lexer := NewMCPDSLLexer(`> ping#42`)
	tokens := lexer.Tokenize()

	// Should be: >, ping, #, 42
	if len(tokens) != 4 {
		t.Errorf("Expected 4 tokens, got %d", len(tokens))
	}

	if tokens[0].Type != TokenOperator || tokens[0].Value != ">" {
		t.Errorf("Expected first token to be operator '>', got %v", tokens[0])
	}
	if tokens[1].Type != TokenIdentifier || tokens[1].Value != "ping" {
		t.Errorf("Expected second token to be identifier 'ping', got %v", tokens[1])
	}
	if tokens[2].Type != TokenOperator || tokens[2].Value != "#" {
		t.Errorf("Expected third token to be operator '#', got %v", tokens[2])
	}
	if tokens[3].Type != TokenNumber || tokens[3].Value != "42" {
		t.Errorf("Expected fourth token to be number '42', got %v", tokens[3])
	}
}

func TestParserAST(t *testing.T) {
	lexer := NewMCPDSLLexer(`> ping#1`)
	tokens := lexer.Tokenize()
	parser := NewMCPDSLParser(tokens)
	ast := parser.Parse()

	if len(ast) != 1 {
		t.Errorf("Expected 1 AST node, got %d", len(ast))
	}

	if ast[0].Kind != ASTRequest {
		t.Errorf("Expected AST node to be Request, got %v", ast[0].Kind)
	}
	if ast[0].ReqMethod != "ping" {
		t.Errorf("Expected method ping, got %v", ast[0].ReqMethod)
	}
	if ast[0].ReqID == nil || *ast[0].ReqID != 1 {
		t.Errorf("Expected id 1, got %v", ast[0].ReqID)
	}
}

// Benchmark helper
func BenchmarkParseMCPDSL(b *testing.B) {
	dsl := `> initialize#1 {
		v: "2025-03-26"
		caps: {}
		info: {}
	}`

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ParseMCPDSL(dsl)
	}
}

// Helper function to compare maps (for testing)
func mapsEqual(a, b map[string]interface{}) bool {
	return reflect.DeepEqual(a, b)
}

// Round-Trip Tests

func TestRoundTripSimplePing(t *testing.T) {
	originalDSL := "> ping#2"

	// DSL → JSON
	json := ParseMCPDSL(originalDSL)

	// JSON → DSL
	reconstructedDSL := DecompileMCPJSON(json)

	// Verify
	if reconstructedDSL != originalDSL {
		t.Errorf("Round-trip failed:\nOriginal: %s\nReconstructed: %s", originalDSL, reconstructedDSL)
	}
}

func TestRoundTripInitializeRequest(t *testing.T) {
	originalDSL := `> initialize#1 {
  v: "2025-03-26"
}`

	// DSL → JSON
	json := ParseMCPDSL(originalDSL)

	// JSON → DSL
	reconstructedDSL := DecompileMCPJSON(json)

	// Parse reconstructed DSL back to JSON for semantic comparison
	roundTripJSON := ParseMCPDSL(reconstructedDSL)

	// Verify semantic equivalence
	origMap := json.(map[string]interface{})
	roundMap := roundTripJSON.(map[string]interface{})

	origParams := origMap["params"].(map[string]interface{})
	roundParams := roundMap["params"].(map[string]interface{})

	if origParams["protocolVersion"] != roundParams["protocolVersion"] {
		t.Errorf("Protocol version mismatch: %v != %v",
			origParams["protocolVersion"], roundParams["protocolVersion"])
	}
}

func TestRoundTripNotification(t *testing.T) {
	originalDSL := "! initialized"

	// DSL → JSON
	json := ParseMCPDSL(originalDSL)

	// JSON → DSL
	reconstructedDSL := DecompileMCPJSON(json)

	// Verify
	if reconstructedDSL != originalDSL {
		t.Errorf("Round-trip failed:\nOriginal: %s\nReconstructed: %s", originalDSL, reconstructedDSL)
	}
}

func TestRoundTripErrorResponse(t *testing.T) {
	originalDSL := `x #10 -32601:"Method not found"`

	// DSL → JSON
	json := ParseMCPDSL(originalDSL)

	// JSON → DSL
	reconstructedDSL := DecompileMCPJSON(json)

	// Verify
	if reconstructedDSL != originalDSL {
		t.Errorf("Round-trip failed:\nOriginal: %s\nReconstructed: %s", originalDSL, reconstructedDSL)
	}
}

func TestRoundTripResponse(t *testing.T) {
	originalJSON := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      float64(100),
		"result": map[string]interface{}{
			"status": "ok",
		},
	}

	// JSON → DSL
	dsl := DecompileMCPJSON(originalJSON)

	// DSL → JSON
	reconstructedJSON := ParseMCPDSL(dsl)
	m, ok := reconstructedJSON.(map[string]interface{})
	if !ok {
		t.Fatalf("Expected map, got %T", reconstructedJSON)
	}

	// Verify semantic equivalence
	// Compare as int since ParseMCPDSL may return int instead of float64
	idVal := m["id"]
	var id int
	switch v := idVal.(type) {
	case int:
		id = v
	case float64:
		id = int(v)
	default:
		t.Fatalf("Unexpected ID type: %T", idVal)
	}

	if id != 100 {
		t.Errorf("ID mismatch: expected 100, got %v", id)
	}

	result, ok := m["result"].(map[string]interface{})
	if !ok {
		t.Fatalf("Expected result to be map, got %T", m["result"])
	}
	if result["status"] != "ok" {
		t.Errorf("Status mismatch: expected ok, got %v", result["status"])
	}
}

func TestRoundTripToolDefinition(t *testing.T) {
	originalJSON := map[string]interface{}{
		"name":        "search",
		"description": "Search tool",
		"inputSchema": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"query": map[string]interface{}{
					"type": "string",
				},
			},
			"required": []interface{}{"query"},
		},
	}

	// JSON → DSL
	dsl := DecompileMCPJSON(originalJSON)

	// Verify DSL contains key elements
	if !contains(dsl, "T search") {
		t.Error("DSL should contain 'T search'")
	}
	if !contains(dsl, "desc:") {
		t.Error("DSL should contain 'desc:'")
	}
	if !contains(dsl, "query: str!") {
		t.Error("DSL should contain 'query: str!'")
	}
}

func TestRoundTripResourceDefinition(t *testing.T) {
	originalJSON := map[string]interface{}{
		"name":        "main_file",
		"uri":         "file:///project/src/main.rs",
		"mimeType":    "text/x-rust",
		"description": "Primary application entry point",
		"annotations": map[string]interface{}{
			"priority": 1.0,
		},
	}

	// JSON → DSL
	dsl := DecompileMCPJSON(originalJSON)

	// Verify DSL contains key elements
	if !contains(dsl, "R main_file") {
		t.Error("DSL should contain 'R main_file'")
	}
	if !contains(dsl, "uri:") {
		t.Error("DSL should contain 'uri:'")
	}
	if !contains(dsl, "@priority:") {
		t.Error("DSL should contain '@priority:'")
	}
}

func TestRoundTripToolsCallRequest(t *testing.T) {
	originalDSL := `> tools/call#4 {
  name: "get_weather",
  args: {
    location: "New York"
  }
}`

	// DSL → JSON
	json := ParseMCPDSL(originalDSL)

	// JSON → DSL
	reconstructedDSL := DecompileMCPJSON(json)

	// DSL → JSON again
	roundTripJSON := ParseMCPDSL(reconstructedDSL)

	// Verify semantic equivalence
	origMap := json.(map[string]interface{})
	roundMap := roundTripJSON.(map[string]interface{})

	if origMap["method"] != roundMap["method"] {
		t.Errorf("Method mismatch: %v != %v", origMap["method"], roundMap["method"])
	}

	if origMap["id"] != roundMap["id"] {
		t.Errorf("ID mismatch: %v != %v", origMap["id"], roundMap["id"])
	}
}

func TestRoundTripComplexTool(t *testing.T) {
	originalJSON := map[string]interface{}{
		"name":        "analyze",
		"description": "Analyze data",
		"inputSchema": map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"text":   map[string]interface{}{"type": "string"},
				"count":  map[string]interface{}{"type": "integer"},
				"amount": map[string]interface{}{"type": "number"},
				"active": map[string]interface{}{"type": "boolean"},
			},
			"required": []interface{}{"text", "count"},
		},
		"annotations": map[string]interface{}{
			"readOnlyHint": true,
		},
	}

	// JSON → DSL
	dsl := DecompileMCPJSON(originalJSON)

	// Verify DSL contains required markers
	if !contains(dsl, "text: str") {
		t.Error("DSL should contain 'text: str'")
	}
	if !contains(dsl, "count: int") {
		t.Error("DSL should contain 'count: int'")
	}
	if !contains(dsl, "@readonly") {
		t.Error("DSL should contain '@readonly'")
	}
}

func TestSemanticEquivalenceRoundTrip(t *testing.T) {
	testCases := []string{
		"> ping#1",
		"! initialized",
		`x #5 -32600:"Invalid Request"`,
	}

	for _, originalDSL := range testCases {
		// DSL → JSON → DSL → JSON
		json1 := ParseMCPDSL(originalDSL)
		dsl := DecompileMCPJSON(json1)
		json2 := ParseMCPDSL(dsl)

		// Both JSON representations should be semantically equivalent
		json1Bytes, _ := json.Marshal(json1)
		json2Bytes, _ := json.Marshal(json2)

		if string(json1Bytes) != string(json2Bytes) {
			t.Errorf("Semantic equivalence failed for: %s\nJSON1: %s\nJSON2: %s",
				originalDSL, string(json1Bytes), string(json2Bytes))
		}
	}
}

// Helper function for string contains check
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) && containsAt(s, substr))
}

func containsAt(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
