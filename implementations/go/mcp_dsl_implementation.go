// MCP-DSL Parser & Compiler - Go Implementation
// Demonstrates core parsing and compilation logic

package main

import (
	"encoding/json"
	
	"strconv"
	"strings"
	"unicode"
)

// TokenType represents the type of token
type TokenType int

const (
	TokenSymbol TokenType = iota
	TokenString
	TokenNumber
	TokenIdentifier
	TokenOperator
)

// Token represents a lexical token
type Token struct {
	Type   TokenType
	Value  string
	Line   int
	Column int
}

// MCPDSLLexer tokenizes MCP-DSL input
type MCPDSLLexer struct {
	input    string
	position int
	line     int
	column   int
}

// NewMCPDSLLexer creates a new lexer
func NewMCPDSLLexer(input string) *MCPDSLLexer {
	return &MCPDSLLexer{
		input:    input,
		position: 0,
		line:     1,
		column:   1,
	}
}

// advance moves the lexer position forward
func (l *MCPDSLLexer) advance() {
	if l.position < len(l.input) && l.input[l.position] == '\n' {
		l.line++
		l.column = 1
	} else {
		l.column++
	}
	l.position++
}

// skipWhitespace skips whitespace characters
func (l *MCPDSLLexer) skipWhitespace() {
	for l.position < len(l.input) && unicode.IsSpace(rune(l.input[l.position])) {
		l.advance()
	}
}

// readString reads a string literal
func (l *MCPDSLLexer) readString() Token {
	startLine := l.line
	startCol := l.column
	l.advance() // Skip opening quote

	var value strings.Builder
	for l.position < len(l.input) && l.input[l.position] != '"' {
		if l.input[l.position] == '\\' {
			l.advance()
			if l.position < len(l.input) {
				value.WriteByte(l.input[l.position])
			}
		} else {
			value.WriteByte(l.input[l.position])
		}
		l.advance()
	}

	l.advance() // Skip closing quote
	return Token{Type: TokenString, Value: value.String(), Line: startLine, Column: startCol}
}

// readNumber reads a number literal
func (l *MCPDSLLexer) readNumber() Token {
	startLine := l.line
	startCol := l.column
	var value strings.Builder

	for l.position < len(l.input) && (unicode.IsDigit(rune(l.input[l.position])) || l.input[l.position] == '.' || l.input[l.position] == '-') {
		value.WriteByte(l.input[l.position])
		l.advance()
	}

	return Token{Type: TokenNumber, Value: value.String(), Line: startLine, Column: startCol}
}

// readIdentifier reads an identifier or keyword
func (l *MCPDSLLexer) readIdentifier() Token {
	startLine := l.line
	startCol := l.column
	var value strings.Builder

	for l.position < len(l.input) {
		ch := l.input[l.position]
		if unicode.IsLetter(rune(ch)) || unicode.IsDigit(rune(ch)) || ch == '_' || ch == '/' || ch == '!' {
			value.WriteByte(ch)
			l.advance()
		} else if ch == ':' && l.position+1 < len(l.input) && l.input[l.position+1] == '/' {
			// Include ':' only if part of URI scheme (e.g., file://)
			value.WriteByte(ch)
			l.advance()
		} else {
			break
		}
	}

	return Token{Type: TokenIdentifier, Value: value.String(), Line: startLine, Column: startCol}
}

// Tokenize converts input string to tokens
func (l *MCPDSLLexer) Tokenize() []Token {
	var tokens []Token

	for l.position < len(l.input) {
		l.skipWhitespace()
		if l.position >= len(l.input) {
			break
		}

		char := l.input[l.position]

		// Operators and symbols
		if strings.ContainsRune("><!x#@?:=|&-", rune(char)) {
			tokens = append(tokens, Token{
				Type:   TokenOperator,
				Value:  string(char),
				Line:   l.line,
				Column: l.column,
			})
			l.advance()
		} else if char == '"' {
			// String literals
			tokens = append(tokens, l.readString())
		} else if unicode.IsDigit(rune(char)) || (char == '-' && l.position+1 < len(l.input) && unicode.IsDigit(rune(l.input[l.position+1]))) {
			// Numbers
			tokens = append(tokens, l.readNumber())
		} else if unicode.IsLetter(rune(char)) || char == '_' {
			// Identifiers and keywords
			tokens = append(tokens, l.readIdentifier())
		} else if strings.ContainsRune("{}[](),", rune(char)) {
			// Braces, brackets, parens, comma
			tokens = append(tokens, Token{
				Type:   TokenSymbol,
				Value:  string(char),
				Line:   l.line,
				Column: l.column,
			})
			l.advance()
		} else {
			l.advance() // Skip unknown characters
		}
	}

	return tokens
}

// ASTNodeKind represents the type of AST node
type ASTNodeKind int

const (
	ASTRequest ASTNodeKind = iota
	ASTResponse
	ASTNotification
	ASTError
	ASTResource
	ASTTool
	ASTPrompt
	ASTBlock
	ASTValue
)

// ASTNode represents a node in the abstract syntax tree
type ASTNode struct {
	Kind ASTNodeKind

	// Request fields
	ReqMethod string
	ReqID     *int
	ReqParams *ASTNode

	// Response fields
	RespID     int
	RespResult *ASTNode

	// Notification fields
	NotifMethod string
	NotifParams *ASTNode

	// Error fields
	ErrID      int
	ErrCode    int
	ErrMessage string

	// Definition fields (Resource, Tool, Prompt)
	DefName   string
	DefFields map[string]*ASTNode

	// Block fields
	BlockFields map[string]*ASTNode

	// Value fields
	Val interface{}
}

// MCPDSLParser parses tokens into an AST
type MCPDSLParser struct {
	tokens   []Token
	position int
}

// NewMCPDSLParser creates a new parser
func NewMCPDSLParser(tokens []Token) *MCPDSLParser {
	return &MCPDSLParser{
		tokens:   tokens,
		position: 0,
	}
}

// peek returns the current token without consuming it
func (p *MCPDSLParser) peek() *Token {
	if p.position < len(p.tokens) {
		return &p.tokens[p.position]
	}
	return nil
}

// consume consumes and returns the current token
func (p *MCPDSLParser) consume() *Token {
	if p.position < len(p.tokens) {
		token := &p.tokens[p.position]
		p.position++
		return token
	}
	return nil
}

// Parse parses tokens into an AST
func (p *MCPDSLParser) Parse() []*ASTNode {
	var nodes []*ASTNode

	for p.peek() != nil {
		node := p.parseMessage()
		if node != nil {
			nodes = append(nodes, node)
		}
	}

	return nodes
}

// parseMessage parses a single message
func (p *MCPDSLParser) parseMessage() *ASTNode {
	token := p.peek()
	if token == nil {
		return nil
	}

	switch token.Value {
	case ">":
		return p.parseRequest()
	case "<":
		return p.parseResponse()
	case "!":
		return p.parseNotification()
	case "x":
		return p.parseError()
	case "T":
		return p.parseToolDefinition()
	case "R":
		return p.parseResourceDefinition()
	case "P":
		return p.parsePromptDefinition()
	default:
		p.consume() // Skip unknown token
		return nil
	}
}

// parseRequest parses a request message
func (p *MCPDSLParser) parseRequest() *ASTNode {
	p.consume() // consume '>'

	methodToken := p.consume()
	if methodToken == nil {
		return nil
	}

	node := &ASTNode{
		Kind:      ASTRequest,
		ReqMethod: methodToken.Value,
	}

	// Check for #id
	if p.peek() != nil && p.peek().Value == "#" {
		p.consume() // consume '#'
		idToken := p.consume()
		if idToken != nil && idToken.Type == TokenNumber {
			id, _ := strconv.Atoi(idToken.Value)
			node.ReqID = &id
		}
	}

	// Check for params block
	if p.peek() != nil && p.peek().Value == "{" {
		node.ReqParams = p.parseBlock()
	}

	return node
}

// parseResponse parses a response message
func (p *MCPDSLParser) parseResponse() *ASTNode {
	p.consume() // consume '<'

	// Expect #id
	if p.peek() != nil && p.peek().Value == "#" {
		p.consume() // consume '#'
		idToken := p.consume()
		if idToken == nil || idToken.Type != TokenNumber {
			return nil
		}

		id, _ := strconv.Atoi(idToken.Value)
		node := &ASTNode{
			Kind:   ASTResponse,
			RespID: id,
		}

		// Check for result block
		if p.peek() != nil && p.peek().Value == "{" {
			node.RespResult = p.parseBlock()
		}

		return node
	}

	return nil
}

// parseNotification parses a notification message
func (p *MCPDSLParser) parseNotification() *ASTNode {
	p.consume() // consume '!'

	methodToken := p.consume()
	if methodToken == nil {
		return nil
	}

	node := &ASTNode{
		Kind:        ASTNotification,
		NotifMethod: methodToken.Value,
	}

	// Check for params block
	if p.peek() != nil && p.peek().Value == "{" {
		node.NotifParams = p.parseBlock()
	}

	return node
}

// parseError parses an error message
func (p *MCPDSLParser) parseError() *ASTNode {
	p.consume() // consume 'x'

	// Expect #id
	if p.peek() != nil && p.peek().Value == "#" {
		p.consume() // consume '#'
		idToken := p.consume()
		if idToken == nil || idToken.Type != TokenNumber {
			return nil
		}

		id, _ := strconv.Atoi(idToken.Value)

		// Check for negative error code
		code := 0
		if p.peek() != nil && p.peek().Value == "-" {
			p.consume() // consume '-'
			codeToken := p.consume()
			if codeToken != nil && codeToken.Type == TokenNumber {
				codeVal, _ := strconv.Atoi(codeToken.Value)
				code = -codeVal
			}
		} else {
			// Positive error code
			codeToken := p.consume()
			if codeToken == nil || codeToken.Type != TokenNumber {
				return nil
			}
			code, _ = strconv.Atoi(codeToken.Value)
		}

		// Expect ':'
		if p.peek() != nil && p.peek().Value == ":" {
			p.consume() // consume ':'
		}

		// Expect error message
		msgToken := p.consume()
		message := ""
		if msgToken != nil {
			message = msgToken.Value
		}

		return &ASTNode{
			Kind:       ASTError,
			ErrID:      id,
			ErrCode:    code,
			ErrMessage: message,
		}
	}

	return nil
}

// parseToolDefinition parses a tool definition
func (p *MCPDSLParser) parseToolDefinition() *ASTNode {
	p.consume() // consume 'T'

	nameToken := p.consume()
	if nameToken == nil {
		return nil
	}

	node := &ASTNode{
		Kind:      ASTTool,
		DefName:   nameToken.Value,
		DefFields: make(map[string]*ASTNode),
	}

	// Check for definition block
	if p.peek() != nil && p.peek().Value == "{" {
		block := p.parseBlock()
		if block != nil {
			node.DefFields = block.BlockFields
		}
	}

	return node
}

// parseResourceDefinition parses a resource definition
func (p *MCPDSLParser) parseResourceDefinition() *ASTNode {
	p.consume() // consume 'R'

	nameToken := p.consume()
	if nameToken == nil {
		return nil
	}

	node := &ASTNode{
		Kind:      ASTResource,
		DefName:   nameToken.Value,
		DefFields: make(map[string]*ASTNode),
	}

	// Check for definition block
	if p.peek() != nil && p.peek().Value == "{" {
		block := p.parseBlock()
		if block != nil {
			node.DefFields = block.BlockFields
		}
	}

	return node
}

// parsePromptDefinition parses a prompt definition
func (p *MCPDSLParser) parsePromptDefinition() *ASTNode {
	p.consume() // consume 'P'

	nameToken := p.consume()
	if nameToken == nil {
		return nil
	}

	node := &ASTNode{
		Kind:      ASTPrompt,
		DefName:   nameToken.Value,
		DefFields: make(map[string]*ASTNode),
	}

	// Check for definition block
	if p.peek() != nil && p.peek().Value == "{" {
		block := p.parseBlock()
		if block != nil {
			node.DefFields = block.BlockFields
		}
	}

	return node
}

// parseBlock parses a block of key-value pairs
func (p *MCPDSLParser) parseBlock() *ASTNode {
	p.consume() // consume '{'

	node := &ASTNode{
		Kind:        ASTBlock,
		BlockFields: make(map[string]*ASTNode),
	}

	for p.peek() != nil && p.peek().Value != "}" {
		// Skip annotations
		if p.peek().Value == "@" {
			p.consume() // consume '@'
			keyToken := p.consume()
			if keyToken == nil {
				break
			}
			// Expect ':'
			if p.peek() != nil && p.peek().Value == ":" {
				p.consume() // consume ':'
				p.parseValue() // consume value
			}
			continue
		}

		// Parse key
		keyToken := p.consume()
		if keyToken == nil {
			break
		}

		// Expect ':'
		if p.peek() == nil || p.peek().Value != ":" {
			break
		}
		p.consume() // consume ':'

		// Parse value
		value := p.parseValue()
		if value != nil {
			node.BlockFields[keyToken.Value] = value
		}

		// Optional comma
		if p.peek() != nil && p.peek().Value == "," {
			p.consume()
		}
	}

	if p.peek() != nil && p.peek().Value == "}" {
		p.consume() // consume '}'
	}

	return node
}

// parseValue parses a value
func (p *MCPDSLParser) parseValue() *ASTNode {
	token := p.peek()
	if token == nil {
		return nil
	}

	switch token.Type {
	case TokenString:
		p.consume()
		return &ASTNode{Kind: ASTValue, Val: token.Value}
	case TokenNumber:
		p.consume()
		num, _ := strconv.ParseFloat(token.Value, 64)
		return &ASTNode{Kind: ASTValue, Val: num}
	case TokenIdentifier:
		p.consume()
		// Handle boolean values
		if token.Value == "true" {
			return &ASTNode{Kind: ASTValue, Val: true}
		} else if token.Value == "false" {
			return &ASTNode{Kind: ASTValue, Val: false}
		}
		return &ASTNode{Kind: ASTValue, Val: token.Value}
	case TokenSymbol:
		if token.Value == "{" {
			return p.parseBlock()
		} else if token.Value == "[" {
			return p.parseArray()
		}
	}

	return nil
}

// parseArray parses an array
func (p *MCPDSLParser) parseArray() *ASTNode {
	p.consume() // consume '['

	var items []interface{}

	for p.peek() != nil && p.peek().Value != "]" {
		value := p.parseValue()
		if value != nil {
			items = append(items, value.Val)
		}

		// Optional comma
		if p.peek() != nil && p.peek().Value == "," {
			p.consume()
		}
	}

	if p.peek() != nil && p.peek().Value == "]" {
		p.consume() // consume ']'
	}

	return &ASTNode{Kind: ASTValue, Val: items}
}

// MCPDSLCompiler compiles AST to JSON-RPC
type MCPDSLCompiler struct{}

// NewMCPDSLCompiler creates a new compiler
func NewMCPDSLCompiler() *MCPDSLCompiler {
	return &MCPDSLCompiler{}
}

// Compile compiles AST nodes to JSON-RPC
func (c *MCPDSLCompiler) Compile(nodes []*ASTNode) interface{} {
	if len(nodes) == 1 {
		return c.compileNode(nodes[0])
	}

	var results []interface{}
	for _, node := range nodes {
		results = append(results, c.compileNode(node))
	}
	return results
}

// compileNode compiles a single AST node
func (c *MCPDSLCompiler) compileNode(node *ASTNode) interface{} {
	switch node.Kind {
	case ASTRequest:
		return c.compileRequest(node)
	case ASTResponse:
		return c.compileResponse(node)
	case ASTNotification:
		return c.compileNotification(node)
	case ASTError:
		return c.compileError(node)
	case ASTTool:
		return c.compileTool(node)
	case ASTResource:
		return c.compileResource(node)
	case ASTPrompt:
		return c.compilePrompt(node)
	case ASTBlock:
		return c.compileBlock(node)
	case ASTValue:
		return node.Val
	}
	return nil
}

// compileRequest compiles a request node
func (c *MCPDSLCompiler) compileRequest(node *ASTNode) map[string]interface{} {
	result := map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  node.ReqMethod,
	}

	if node.ReqID != nil {
		result["id"] = *node.ReqID
	}

	if node.ReqParams != nil {
		params := c.compileBlock(node.ReqParams)

		// Create new params map with transformed keys
		transformedParams := make(map[string]interface{})

		for key, val := range params {
			switch key {
			case "v":
				transformedParams["protocolVersion"] = val
			case "caps":
				transformedParams["capabilities"] = val
			case "info":
				if node.ReqMethod == "initialize" {
					transformedParams["clientInfo"] = val
				} else {
					transformedParams["serverInfo"] = val
				}
			case "args":
				transformedParams["arguments"] = val
			default:
				transformedParams[key] = val
			}
		}

		result["params"] = transformedParams
	}

	return result
}

// compileResponse compiles a response node
func (c *MCPDSLCompiler) compileResponse(node *ASTNode) map[string]interface{} {
	result := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      node.RespID,
	}

	if node.RespResult != nil {
		resultData := c.compileBlock(node.RespResult)

		// Create new result map with transformed keys
		transformedResult := make(map[string]interface{})

		for key, val := range resultData {
			switch key {
			case "v":
				transformedResult["protocolVersion"] = val
			case "caps":
				transformedResult["capabilities"] = val
			case "info":
				transformedResult["serverInfo"] = val
			case "ok":
				if boolVal, ok := val.(bool); ok {
					transformedResult["isError"] = !boolVal
				}
			default:
				transformedResult[key] = val
			}
		}

		result["result"] = transformedResult
	}

	return result
}

// compileNotification compiles a notification node
func (c *MCPDSLCompiler) compileNotification(node *ASTNode) map[string]interface{} {
	result := map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  node.NotifMethod,
	}

	if node.NotifParams != nil {
		result["params"] = c.compileBlock(node.NotifParams)
	}

	return result
}

// compileError compiles an error node
func (c *MCPDSLCompiler) compileError(node *ASTNode) map[string]interface{} {
	return map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      node.ErrID,
		"error": map[string]interface{}{
			"code":    node.ErrCode,
			"message": node.ErrMessage,
		},
	}
}

// compileTool compiles a tool definition
func (c *MCPDSLCompiler) compileTool(node *ASTNode) map[string]interface{} {
	result := map[string]interface{}{
		"name": node.DefName,
	}

	if desc, ok := node.DefFields["desc"]; ok {
		result["description"] = c.compileNode(desc)
	}

	if inSchema, ok := node.DefFields["in"]; ok {
		schema := c.compileSchema(inSchema)
		result["inputSchema"] = schema
	}

	return result
}

// compileResource compiles a resource definition
func (c *MCPDSLCompiler) compileResource(node *ASTNode) map[string]interface{} {
	result := map[string]interface{}{
		"name": node.DefName,
	}

	for key, value := range node.DefFields {
		switch key {
		case "uri":
			result["uri"] = c.compileNode(value)
		case "mime":
			result["mimeType"] = c.compileNode(value)
		case "desc":
			result["description"] = c.compileNode(value)
		}
	}

	return result
}

// compilePrompt compiles a prompt definition
func (c *MCPDSLCompiler) compilePrompt(node *ASTNode) map[string]interface{} {
	result := map[string]interface{}{
		"name": node.DefName,
	}

	for key, value := range node.DefFields {
		result[key] = c.compileNode(value)
	}

	return result
}

// compileBlock compiles a block node
func (c *MCPDSLCompiler) compileBlock(node *ASTNode) map[string]interface{} {
	result := make(map[string]interface{})

	for key, value := range node.BlockFields {
		result[key] = c.compileNode(value)
	}

	return result
}

// compileSchema compiles a schema definition
func (c *MCPDSLCompiler) compileSchema(node *ASTNode) map[string]interface{} {
	if node.Kind != ASTBlock {
		return nil
	}

	schema := map[string]interface{}{
		"type":       "object",
		"properties": make(map[string]interface{}),
	}

	var required []string

	for key, value := range node.BlockFields {
		// Check if value contains type info (e.g., "str!")
		var fieldName string
		var isRequired bool

		if value.Kind == ASTValue {
			typeStr, ok := value.Val.(string)
			if ok {
				fieldName = key
				// Check if the type ends with ! (required)
				if strings.HasSuffix(typeStr, "!") {
					isRequired = true
					typeStr = strings.TrimSuffix(typeStr, "!")
				}

				propSchema := make(map[string]interface{})
				switch {
				case strings.HasPrefix(typeStr, "str"):
					propSchema["type"] = "string"
				case strings.HasPrefix(typeStr, "int"):
					propSchema["type"] = "integer"
				case strings.HasPrefix(typeStr, "num"):
					propSchema["type"] = "number"
				case strings.HasPrefix(typeStr, "bool"):
					propSchema["type"] = "boolean"
				}
				schema["properties"].(map[string]interface{})[fieldName] = propSchema

				if isRequired {
					required = append(required, fieldName)
				}
			}
		} else if value.Kind == ASTBlock {
			// Nested object
			fieldName = key
			schema["properties"].(map[string]interface{})[fieldName] = c.compileSchema(value)
		}
	}

	if len(required) > 0 {
		schema["required"] = required
	}

	return schema
}

// ParseMCPDSL is the main entry point for parsing MCP-DSL
func ParseMCPDSL(input string) interface{} {
	lexer := NewMCPDSLLexer(input)
	tokens := lexer.Tokenize()

	parser := NewMCPDSLParser(tokens)
	ast := parser.Parse()

	compiler := NewMCPDSLCompiler()
	return compiler.Compile(ast)
}

// ToJSON converts the result to a JSON string
func ToJSON(v interface{}) (string, error) {
	bytes, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// MCPDSLDecompiler converts JSON-RPC back to MCP-DSL
type MCPDSLDecompiler struct{}

// NewMCPDSLDecompiler creates a new decompiler
func NewMCPDSLDecompiler() *MCPDSLDecompiler {
	return &MCPDSLDecompiler{}
}

// Decompile converts JSON-RPC to DSL
func (d *MCPDSLDecompiler) Decompile(data interface{}) string {
	if data == nil {
		return ""
	}

	m, ok := data.(map[string]interface{})
	if !ok {
		return ""
	}

	// Detect message type based on JSON-RPC structure
	if jsonrpc, ok := m["jsonrpc"].(string); ok && jsonrpc == "2.0" {
		// Error response
		if _, hasError := m["error"]; hasError {
			return d.decompileError(m)
		}
		// Response with result
		if _, hasResult := m["result"]; hasResult {
			if _, hasID := m["id"]; hasID {
				return d.decompileResponse(m)
			}
		}
		// Request with id
		if method, hasMethod := m["method"]; hasMethod {
			if _, hasID := m["id"]; hasID {
				return d.decompileRequest(m, method.(string))
			}
			// Notification (no id)
			return d.decompileNotification(m, method.(string))
		}
	}

	// Tool definition
	if name, hasName := m["name"]; hasName {
		if _, hasSchema := m["inputSchema"]; hasSchema {
			return d.decompileTool(m, name.(string))
		}
		// Resource definition
		if _, hasURI := m["uri"]; hasURI {
			return d.decompileResource(m, name.(string))
		}
		// Prompt definition
		if _, hasMessages := m["messages"]; hasMessages {
			return d.decompilePrompt(m, name.(string))
		}
	}

	return ""
}

func (d *MCPDSLDecompiler) decompileRequest(m map[string]interface{}, method string) string {
	id := d.formatID(m["id"])
	params := d.getMapOrEmpty(m["params"])

	result := "> " + method + "#" + id

	if len(params) > 0 {
		result += " " + d.decompileParams(params)
	}

	return result
}

func (d *MCPDSLDecompiler) decompileResponse(m map[string]interface{}) string {
	id := d.formatID(m["id"])
	result := d.getMapOrEmpty(m["result"])

	output := "< #" + id

	if len(result) > 0 {
		output += " " + d.decompileObject(result, 0)
	}

	return output
}

func (d *MCPDSLDecompiler) decompileNotification(m map[string]interface{}, method string) string {
	params := d.getMapOrEmpty(m["params"])

	result := "! " + method

	if len(params) > 0 {
		result += " " + d.decompileParams(params)
	}

	return result
}

func (d *MCPDSLDecompiler) decompileError(m map[string]interface{}) string {
	id := d.formatID(m["id"])
	errorMap := d.getMapOrEmpty(m["error"])

	code := d.formatValue(errorMap["code"])
	message := d.formatValue(errorMap["message"])

	return "x #" + id + " " + code + ":" + message
}

func (d *MCPDSLDecompiler) decompileTool(m map[string]interface{}, name string) string {
	var result strings.Builder
	result.WriteString("T ")
	result.WriteString(name)
	result.WriteString(" {\n")

	if desc, ok := m["description"]; ok {
		result.WriteString("  desc: ")
		result.WriteString(d.formatValue(desc))
		result.WriteString("\n")
	}

	if schema, ok := m["inputSchema"]; ok {
		result.WriteString("  in: ")
		result.WriteString(d.decompileSchema(schema.(map[string]interface{}), 2))
		result.WriteString("\n")
	}

	if schema, ok := m["outputSchema"]; ok {
		result.WriteString("  out: ")
		result.WriteString(d.decompileSchema(schema.(map[string]interface{}), 2))
		result.WriteString("\n")
	}

	// Handle annotations
	if annotations, ok := m["annotations"].(map[string]interface{}); ok {
		if readOnly, ok := annotations["readOnlyHint"].(bool); ok && readOnly {
			result.WriteString("  @readonly\n")
		}
		if idempotent, ok := annotations["idempotentHint"].(bool); ok && idempotent {
			result.WriteString("  @idempotent\n")
		}
		if destructive, ok := annotations["destructiveHint"].(bool); ok && !destructive {
			result.WriteString("  @destructive: false\n")
		}
		if openWorld, ok := annotations["openWorldHint"].(bool); ok && !openWorld {
			result.WriteString("  @openWorld: false\n")
		}
	}

	result.WriteString("}")
	return result.String()
}

func (d *MCPDSLDecompiler) decompileResource(m map[string]interface{}, name string) string {
	var result strings.Builder
	result.WriteString("R ")
	result.WriteString(name)
	result.WriteString(" {\n")

	if uri, ok := m["uri"]; ok {
		result.WriteString("  uri: ")
		result.WriteString(d.formatValue(uri))
		result.WriteString("\n")
	}

	if desc, ok := m["description"]; ok {
		result.WriteString("  desc: ")
		result.WriteString(d.formatValue(desc))
		result.WriteString("\n")
	}

	if mime, ok := m["mimeType"]; ok {
		result.WriteString("  mime: ")
		result.WriteString(d.formatValue(mime))
		result.WriteString("\n")
	}

	if size, ok := m["size"]; ok {
		result.WriteString("  size: ")
		result.WriteString(d.formatValue(size))
		result.WriteString("\n")
	}

	if annotations, ok := m["annotations"].(map[string]interface{}); ok {
		for key, value := range annotations {
			if boolVal, ok := value.(bool); ok && boolVal {
				result.WriteString("  @")
				result.WriteString(key)
				result.WriteString("\n")
			} else {
				result.WriteString("  @")
				result.WriteString(key)
				result.WriteString(": ")
				result.WriteString(d.formatValue(value))
				result.WriteString("\n")
			}
		}
	}

	result.WriteString("}")
	return result.String()
}

func (d *MCPDSLDecompiler) decompilePrompt(m map[string]interface{}, name string) string {
	var result strings.Builder
	result.WriteString("P ")
	result.WriteString(name)
	result.WriteString(" {\n")

	if desc, ok := m["description"]; ok {
		result.WriteString("  desc: ")
		result.WriteString(d.formatValue(desc))
		result.WriteString("\n")
	}

	if args, ok := m["arguments"].([]interface{}); ok && len(args) > 0 {
		result.WriteString("  args: {\n")
		for _, arg := range args {
			argMap := arg.(map[string]interface{})
			argName := argMap["name"].(string)
			required := ""
			if req, ok := argMap["required"].(bool); ok && req {
				required = "!"
			}
			result.WriteString("    ")
			result.WriteString(argName)
			result.WriteString(": str")
			result.WriteString(required)
			result.WriteString("\n")
		}
		result.WriteString("  }\n")
	}

	if messages, ok := m["messages"].([]interface{}); ok && len(messages) > 0 {
		result.WriteString("  msgs: [\n")
		for _, msg := range messages {
			msgMap := msg.(map[string]interface{})
			role := "u"
			if r, ok := msgMap["role"].(string); ok && r == "assistant" {
				role = "a"
			}
			content := ""
			if c, ok := msgMap["content"].(string); ok {
				content = c
			} else if c, ok := msgMap["content"].(map[string]interface{}); ok {
				if text, ok := c["text"].(string); ok {
					content = text
				}
			}
			result.WriteString("    ")
			result.WriteString(role)
			result.WriteString(": \"")
			result.WriteString(content)
			result.WriteString("\"\n")
		}
		result.WriteString("  ]\n")
	}

	result.WriteString("}")
	return result.String()
}

func (d *MCPDSLDecompiler) decompileParams(params map[string]interface{}) string {
	obj := make(map[string]interface{})

	// Reverse special field mappings
	if protocolVersion, ok := params["protocolVersion"]; ok {
		obj["v"] = protocolVersion
	}

	if capabilities, ok := params["capabilities"].(map[string]interface{}); ok {
		obj["caps"] = d.decompileCapabilities(capabilities)
	}

	if clientInfo, ok := params["clientInfo"]; ok {
		obj["info"] = clientInfo
	}

	if serverInfo, ok := params["serverInfo"]; ok {
		obj["info"] = serverInfo
	}

	if arguments, ok := params["arguments"]; ok {
		obj["args"] = arguments
	}

	// Copy other params
	for key, value := range params {
		if key != "protocolVersion" && key != "capabilities" &&
		   key != "clientInfo" && key != "serverInfo" && key != "arguments" {
			obj[key] = value
		}
	}

	return d.decompileObject(obj, 0)
}

func (d *MCPDSLDecompiler) decompileObject(obj map[string]interface{}, indent int) string {
	if len(obj) == 0 {
		return "{}"
	}

	var result strings.Builder
	indentStr := strings.Repeat(" ", indent)
	innerIndentStr := strings.Repeat(" ", indent+2)

	result.WriteString("{\n")

	i := 0
	for key, value := range obj {
		result.WriteString(innerIndentStr)
		result.WriteString(key)
		result.WriteString(": ")
		result.WriteString(d.decompileValue(value, indent+2))
		if i < len(obj)-1 {
			result.WriteString(",")
		}
		result.WriteString("\n")
		i++
	}

	result.WriteString(indentStr)
	result.WriteString("}")

	return result.String()
}

func (d *MCPDSLDecompiler) decompileValue(value interface{}, indent int) string {
	if value == nil {
		return "null"
	}

	switch v := value.(type) {
	case string:
		return "\"" + v + "\""
	case float64:
		if v == float64(int(v)) {
			return strconv.Itoa(int(v))
		}
		return strconv.FormatFloat(v, 'f', -1, 64)
	case bool:
		if v {
			return "true"
		}
		return "false"
	case []interface{}:
		if len(v) == 0 {
			return "[]"
		}
		var items []string
		for _, item := range v {
			items = append(items, d.decompileValue(item, indent))
		}
		return "[" + strings.Join(items, ", ") + "]"
	case map[string]interface{}:
		return d.decompileObject(v, indent)
	}

	return ""
}

func (d *MCPDSLDecompiler) decompileSchema(schema map[string]interface{}, indent int) string {
	properties, ok := schema["properties"].(map[string]interface{})
	if !ok || len(properties) == 0 {
		return "{}"
	}

	var result strings.Builder
	indentStr := strings.Repeat(" ", indent)
	innerIndentStr := strings.Repeat(" ", indent+2)

	result.WriteString("{\n")

	required := make(map[string]bool)
	if req, ok := schema["required"].([]interface{}); ok {
		for _, r := range req {
			if name, ok := r.(string); ok {
				required[name] = true
			}
		}
	}

	i := 0
	for key, value := range properties {
		typeDef := value.(map[string]interface{})
		isRequired := required[key]

		result.WriteString(innerIndentStr)
		result.WriteString(key)
		result.WriteString(": ")
		result.WriteString(d.decompileType(typeDef, isRequired))
		if i < len(properties)-1 {
			result.WriteString(",")
		}
		result.WriteString("\n")
		i++
	}

	result.WriteString(indentStr)
	result.WriteString("}")

	return result.String()
}

func (d *MCPDSLDecompiler) decompileType(typeDef map[string]interface{}, required bool) string {
	typeMap := map[string]string{
		"string":  "str",
		"integer": "int",
		"number":  "num",
		"boolean": "bool",
	}

	typeStr, ok := typeDef["type"].(string)
	if !ok {
		return "str"
	}

	dslType := typeMap[typeStr]
	if dslType == "" {
		dslType = typeStr
	}

	if required {
		return dslType + "!"
	}
	return dslType
}

func (d *MCPDSLDecompiler) decompileCapabilities(caps map[string]interface{}) map[string]interface{} {
	capabilities := []string{}

	for key, value := range caps {
		if subMap, ok := value.(map[string]interface{}); ok && len(subMap) > 0 {
			for subKey := range subMap {
				capabilities = append(capabilities, key+"."+subKey)
			}
		} else {
			capabilities = append(capabilities, key)
		}
	}

	return map[string]interface{}{
		"includes": capabilities,
	}
}

func (d *MCPDSLDecompiler) formatID(id interface{}) string {
	switch v := id.(type) {
	case float64:
		return strconv.Itoa(int(v))
	case int:
		return strconv.Itoa(v)
	case string:
		return v
	}
	return ""
}

func (d *MCPDSLDecompiler) formatValue(value interface{}) string {
	if value == nil {
		return "null"
	}

	switch v := value.(type) {
	case string:
		return "\"" + v + "\""
	case int:
		return strconv.Itoa(v)
	case int64:
		return strconv.FormatInt(v, 10)
	case float64:
		if v == float64(int(v)) {
			return strconv.Itoa(int(v))
		}
		return strconv.FormatFloat(v, 'f', -1, 64)
	case bool:
		if v {
			return "true"
		}
		return "false"
	}

	return ""
}

func (d *MCPDSLDecompiler) getMapOrEmpty(value interface{}) map[string]interface{} {
	if m, ok := value.(map[string]interface{}); ok {
		return m
	}
	return make(map[string]interface{})
}

// DecompileMCPJSON is the main entry point for decompiling JSON to DSL
func DecompileMCPJSON(data interface{}) string {
	decompiler := NewMCPDSLDecompiler()
	return decompiler.Decompile(data)
}

