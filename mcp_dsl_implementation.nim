# MCP-DSL Parser & Compiler - Nim Implementation
# Demonstrates core parsing and compilation logic

import std/[json, strutils, sequtils, tables, options]

type
  TokenType = enum
    ttSymbol, ttString, ttNumber, ttIdentifier, ttOperator

  Token = object
    kind: TokenType
    value: string
    line: int
    column: int

  MCPDSLLexer = object
    input: string
    position: int
    line: int
    column: int

  MCPDSLParser = object
    tokens: seq[Token]
    position: int

  ASTNodeKind = enum
    astRequest, astResponse, astNotification, astError,
    astResource, astTool, astPrompt, astBlock, astValue

  ASTNode = ref object
    case kind: ASTNodeKind
    of astRequest:
      reqMethod: string
      reqId: Option[int]
      reqParams: Option[ASTNode]
    of astResponse:
      respId: int
      respResult: ASTNode
    of astNotification:
      notifMethod: string
      notifParams: Option[ASTNode]
    of astError:
      errId: int
      errCode: int
      errMessage: string
    of astResource, astTool, astPrompt:
      defName: string
      defFields: Table[string, ASTNode]
    of astBlock:
      blockFields: Table[string, ASTNode]
    of astValue:
      val: JsonNode

# Lexer implementation
proc newMCPDSLLexer(input: string): MCPDSLLexer =
  MCPDSLLexer(input: input, position: 0, line: 1, column: 1)

proc advance(lexer: var MCPDSLLexer) =
  if lexer.position < lexer.input.len and lexer.input[lexer.position] == '\n':
    lexer.line.inc
    lexer.column = 1
  else:
    lexer.column.inc
  lexer.position.inc

proc skipWhitespace(lexer: var MCPDSLLexer) =
  while lexer.position < lexer.input.len and lexer.input[lexer.position] in Whitespace:
    lexer.advance()

proc readString(lexer: var MCPDSLLexer): Token =
  let startLine = lexer.line
  let startCol = lexer.column
  lexer.advance() # Skip opening quote
  var value = ""

  while lexer.position < lexer.input.len and lexer.input[lexer.position] != '"':
    if lexer.input[lexer.position] == '\\':
      lexer.advance()
      if lexer.position < lexer.input.len:
        value.add(lexer.input[lexer.position])
    else:
      value.add(lexer.input[lexer.position])
    lexer.advance()

  lexer.advance() # Skip closing quote
  Token(kind: ttString, value: value, line: startLine, column: startCol)

proc readNumber(lexer: var MCPDSLLexer): Token =
  let startLine = lexer.line
  let startCol = lexer.column
  var value = ""

  while lexer.position < lexer.input.len and lexer.input[lexer.position] in Digits + {'.'}:
    value.add(lexer.input[lexer.position])
    lexer.advance()

  Token(kind: ttNumber, value: value, line: startLine, column: startCol)

proc readIdentifier(lexer: var MCPDSLLexer): Token =
  let startLine = lexer.line
  let startCol = lexer.column
  var value = ""

  while lexer.position < lexer.input.len and
        lexer.input[lexer.position] in Letters + Digits + {'_', '/'}:
    value.add(lexer.input[lexer.position])
    lexer.advance()

  Token(kind: ttIdentifier, value: value, line: startLine, column: startCol)

proc tokenize(lexer: var MCPDSLLexer): seq[Token] =
  result = @[]

  while lexer.position < lexer.input.len:
    lexer.skipWhitespace()
    if lexer.position >= lexer.input.len:
      break

    let ch = lexer.input[lexer.position]

    # Operators and symbols
    if ch in "><!'x#@?:=|&-":
      result.add(Token(kind: ttOperator, value: $ch, line: lexer.line, column: lexer.column))
      lexer.advance()
    # String literals
    elif ch == '"':
      result.add(lexer.readString())
    # Numbers
    elif ch in Digits:
      result.add(lexer.readNumber())
    # Identifiers and keywords
    elif ch in Letters + {'_'}:
      result.add(lexer.readIdentifier())
    # Braces, brackets, parens, comma
    elif ch in "{}[](),":
      result.add(Token(kind: ttSymbol, value: $ch, line: lexer.line, column: lexer.column))
      lexer.advance()

# Parser implementation
proc newMCPDSLParser(tokens: seq[Token]): MCPDSLParser =
  MCPDSLParser(tokens: tokens, position: 0)

proc peek(parser: MCPDSLParser): Option[Token] =
  if parser.position < parser.tokens.len:
    some(parser.tokens[parser.position])
  else:
    none(Token)

proc advance(parser: var MCPDSLParser) =
  parser.position.inc

proc expect(parser: var MCPDSLParser, expected: string): Token =
  let token = parser.peek()
  if token.isNone:
    raise newException(ValueError, "Expected " & expected & " but reached end of input")

  let t = token.get
  if expected == t.value or (expected == "identifier" and t.kind == ttIdentifier) or
     (expected == "string" and t.kind == ttString) or
     (expected == "number" and t.kind == ttNumber):
    parser.advance()
    return t

  raise newException(ValueError, "Expected " & expected & " but got " & t.value)

proc parseValue(parser: var MCPDSLParser): ASTNode
proc parseBlock(parser: var MCPDSLParser): ASTNode

proc parseArray(parser: var MCPDSLParser): ASTNode =
  discard parser.expect("[")
  var arr = newJArray()

  while parser.peek().isSome and parser.peek().get.value != "]":
    let val = parser.parseValue()
    arr.add(val.val)
    if parser.peek().isSome and parser.peek().get.value == ",":
      parser.advance()

  discard parser.expect("]")
  ASTNode(kind: astValue, val: arr)

proc parsePipeString(parser: var MCPDSLParser): ASTNode =
  discard parser.expect("|")

  if parser.peek().isSome and parser.peek().get.kind == ttString:
    let content = parser.expect("string")
    return ASTNode(kind: astValue, val: %content.value)

  ASTNode(kind: astValue, val: %"multiline content here")

proc parseValue(parser: var MCPDSLParser): ASTNode =
  let token = parser.peek()

  if token.isNone:
    return ASTNode(kind: astValue, val: newJNull())

  let t = token.get

  case t.kind
  of ttString:
    parser.advance()
    return ASTNode(kind: astValue, val: %t.value)

  of ttNumber:
    parser.advance()
    return ASTNode(kind: astValue, val: %parseFloat(t.value))

  of ttIdentifier:
    let value = t.value
    parser.advance()

    # Check for type annotations
    if parser.peek().isSome and parser.peek().get.value == "!":
      parser.advance()
      return ASTNode(kind: astValue, val: %*{"type": value, "required": true})
    elif parser.peek().isSome and parser.peek().get.value == "?":
      parser.advance()
      return ASTNode(kind: astValue, val: %*{"type": value, "required": false})

    # Check for special types
    if value in ["str", "int", "num", "bool"]:
      return ASTNode(kind: astValue, val: %*{"type": value})

    return ASTNode(kind: astValue, val: %value)

  of ttOperator:
    if t.value == "|":
      return parser.parsePipeString()

  of ttSymbol:
    if t.value == "{":
      return parser.parseBlock()
    elif t.value == "[":
      return parser.parseArray()

  ASTNode(kind: astValue, val: newJNull())

proc parseBlock(parser: var MCPDSLParser): ASTNode =
  discard parser.expect("{")
  var fields = initTable[string, ASTNode]()

  while parser.peek().isSome and parser.peek().get.value != "}":
    # Skip commas
    if parser.peek().get.value == ",":
      parser.advance()
      continue

    # Parse annotations
    if parser.peek().get.value == "@":
      parser.advance()
      let annotationName = parser.expect("identifier").value
      if parser.peek().isSome and parser.peek().get.value == ":":
        parser.advance()
        fields["@" & annotationName] = parser.parseValue()
      else:
        fields["@" & annotationName] = ASTNode(kind: astValue, val: %true)

      if parser.peek().isSome and parser.peek().get.value == ",":
        parser.advance()
      continue

    # Parse regular fields
    let key = parser.expect("identifier").value
    discard parser.expect(":")
    fields[key] = parser.parseValue()

    if parser.peek().isSome and parser.peek().get.value == ",":
      parser.advance()

  discard parser.expect("}")
  ASTNode(kind: astBlock, blockFields: fields)

proc parseRequest(parser: var MCPDSLParser): ASTNode =
  discard parser.expect(">")
  let meth = parser.expect("identifier").value
  var id = none(int)

  if parser.peek().isSome and parser.peek().get.value == "#":
    parser.advance()
    id = some(parseInt(parser.expect("number").value))

  var params = none(ASTNode)
  if parser.peek().isSome and parser.peek().get.value == "{":
    params = some(parser.parseBlock())

  ASTNode(kind: astRequest, reqMethod: meth, reqId: id, reqParams: params)

proc parseResponse(parser: var MCPDSLParser): ASTNode =
  discard parser.expect("<")
  discard parser.expect("#")
  let id = parseInt(parser.expect("number").value)
  let result = parser.parseBlock()

  ASTNode(kind: astResponse, respId: id, respResult: result)

proc parseNotification(parser: var MCPDSLParser): ASTNode =
  discard parser.expect("!")
  let meth = parser.expect("identifier").value
  var params = none(ASTNode)

  if parser.peek().isSome and parser.peek().get.value == "{":
    params = some(parser.parseBlock())

  ASTNode(kind: astNotification, notifMethod: meth, notifParams: params)

proc parseError(parser: var MCPDSLParser): ASTNode =
  discard parser.expect("x")
  discard parser.expect("#")
  let id = parseInt(parser.expect("number").value)

  # Handle negative error codes
  var code: int
  if parser.peek().isSome and parser.peek().get.value == "-":
    parser.advance()
    code = -parseInt(parser.expect("number").value)
  else:
    code = parseInt(parser.expect("number").value)

  discard parser.expect(":")
  let message = parser.expect("string").value

  ASTNode(kind: astError, errId: id, errCode: code, errMessage: message)

proc parseResource(parser: var MCPDSLParser): ASTNode =
  discard parser.expect("R")
  let name = parser.expect("identifier").value
  let definition = parser.parseBlock()

  ASTNode(kind: astResource, defName: name, defFields: definition.blockFields)

proc parseTool(parser: var MCPDSLParser): ASTNode =
  discard parser.expect("T")
  let name = parser.expect("identifier").value
  let definition = parser.parseBlock()

  ASTNode(kind: astTool, defName: name, defFields: definition.blockFields)

proc parsePrompt(parser: var MCPDSLParser): ASTNode =
  discard parser.expect("P")
  let name = parser.expect("identifier").value
  let definition = parser.parseBlock()

  ASTNode(kind: astPrompt, defName: name, defFields: definition.blockFields)

proc parse(parser: var MCPDSLParser): ASTNode =
  let first = parser.peek()

  if first.isNone:
    return ASTNode(kind: astValue, val: newJNull())

  case first.get.value
  of ">": parser.parseRequest()
  of "<": parser.parseResponse()
  of "!": parser.parseNotification()
  of "x": parser.parseError()
  of "R": parser.parseResource()
  of "T": parser.parseTool()
  of "P": parser.parsePrompt()
  else: parser.parseBlock()

# Compiler implementation
type MCPDSLCompiler = object

proc compileValue(compiler: MCPDSLCompiler, node: ASTNode): JsonNode
proc compileObject(compiler: MCPDSLCompiler, fields: Table[string, ASTNode]): JsonNode

proc compileType(compiler: MCPDSLCompiler, typeNode: JsonNode): JsonNode =
  let typeMap = {"str": "string", "int": "integer", "num": "number", "bool": "boolean"}.toTable

  let typeName = typeNode["type"].getStr
  let jsonType = typeMap.getOrDefault(typeName, typeName)

  %*{"type": jsonType}

proc compileSchema(compiler: MCPDSLCompiler, schema: Table[string, ASTNode]): JsonNode =
  var result = %*{
    "type": "object",
    "properties": newJObject(),
    "required": newJArray()
  }

  for key, field in schema:
    if field.kind == astValue and field.val.kind == JObject and field.val.hasKey("type"):
      result["properties"][key] = compiler.compileType(field.val)
      if field.val.hasKey("required") and field.val["required"].getBool:
        result["required"].add(%key)
    else:
      result["properties"][key] = compiler.compileType(%*{"type": "string"})

  result

proc compileCapabilities(compiler: MCPDSLCompiler, caps: JsonNode): JsonNode =
  result = newJObject()

  # Simple capability parsing for demo
  if caps.kind == JObject:
    for key, val in caps:
      if "." in key:
        let parts = key.split('.')
        if parts.len == 2:
          if not result.hasKey(parts[0]):
            result[parts[0]] = newJObject()
          result[parts[0]][parts[1]] = %true
      else:
        result[key] = newJObject()

proc compileParams(compiler: MCPDSLCompiler, params: Table[string, ASTNode]): JsonNode =
  result = newJObject()

  for key, val in params:
    if not key.startsWith("@"):
      result[key] = compiler.compileValue(val)

  # Handle special field mappings
  if result.hasKey("v"):
    result["protocolVersion"] = result["v"]
    result.delete("v")

  if result.hasKey("caps"):
    result["capabilities"] = compiler.compileCapabilities(result["caps"])
    result.delete("caps")

  if result.hasKey("info"):
    result["clientInfo"] = result["info"]
    result.delete("info")

  if result.hasKey("args"):
    result["arguments"] = result["args"]
    result.delete("args")

proc compileValue(compiler: MCPDSLCompiler, node: ASTNode): JsonNode =
  case node.kind
  of astValue:
    if node.val.kind == JObject and node.val.hasKey("type"):
      return compiler.compileType(node.val)
    return node.val
  of astBlock:
    return compiler.compileObject(node.blockFields)
  else:
    return newJNull()

proc compileObject(compiler: MCPDSLCompiler, fields: Table[string, ASTNode]): JsonNode =
  result = newJObject()

  for key, val in fields:
    if not key.startsWith("@"):
      result[key] = compiler.compileValue(val)

proc compileRequest(compiler: MCPDSLCompiler, ast: ASTNode): JsonNode =
  result = %*{
    "jsonrpc": "2.0",
    "method": ast.reqMethod
  }

  if ast.reqId.isSome:
    result["id"] = %ast.reqId.get

  if ast.reqParams.isSome:
    result["params"] = compiler.compileParams(ast.reqParams.get.blockFields)

proc compileResponse(compiler: MCPDSLCompiler, ast: ASTNode): JsonNode =
  %*{
    "jsonrpc": "2.0",
    "id": ast.respId,
    "result": compiler.compileObject(ast.respResult.blockFields)
  }

proc compileNotification(compiler: MCPDSLCompiler, ast: ASTNode): JsonNode =
  result = %*{
    "jsonrpc": "2.0",
    "method": ast.notifMethod
  }

  if ast.notifParams.isSome:
    result["params"] = compiler.compileParams(ast.notifParams.get.blockFields)

proc compileError(compiler: MCPDSLCompiler, ast: ASTNode): JsonNode =
  %*{
    "jsonrpc": "2.0",
    "id": ast.errId,
    "error": {
      "code": ast.errCode,
      "message": ast.errMessage
    }
  }

proc compileResource(compiler: MCPDSLCompiler, ast: ASTNode): JsonNode =
  result = %*{"name": ast.defName}

  # Extract standard fields
  if ast.defFields.hasKey("uri"):
    result["uri"] = compiler.compileValue(ast.defFields["uri"])
  if ast.defFields.hasKey("desc"):
    result["description"] = compiler.compileValue(ast.defFields["desc"])
  if ast.defFields.hasKey("mime"):
    result["mimeType"] = compiler.compileValue(ast.defFields["mime"])
  if ast.defFields.hasKey("size"):
    result["size"] = compiler.compileValue(ast.defFields["size"])

  # Extract annotations
  var annotations = newJObject()
  for key, val in ast.defFields:
    if key.startsWith("@"):
      annotations[key[1..^1]] = compiler.compileValue(val)

  if annotations.len > 0:
    result["annotations"] = annotations

proc compileTool(compiler: MCPDSLCompiler, ast: ASTNode): JsonNode =
  result = %*{"name": ast.defName}

  if ast.defFields.hasKey("desc"):
    result["description"] = compiler.compileValue(ast.defFields["desc"])

  if ast.defFields.hasKey("in"):
    result["inputSchema"] = compiler.compileSchema(ast.defFields["in"].blockFields)

  if ast.defFields.hasKey("out"):
    result["outputSchema"] = compiler.compileSchema(ast.defFields["out"].blockFields)

  # Extract annotations
  var annotations = newJObject()
  if ast.defFields.hasKey("@readonly"):
    annotations["readOnlyHint"] = %true
  if ast.defFields.hasKey("@idempotent"):
    annotations["idempotentHint"] = %true
  if ast.defFields.hasKey("@destructive"):
    let val = compiler.compileValue(ast.defFields["@destructive"])
    if val.kind == JBool and val.getBool == false:
      annotations["destructiveHint"] = %false
  if ast.defFields.hasKey("@openWorld"):
    let val = compiler.compileValue(ast.defFields["@openWorld"])
    if val.kind == JBool and val.getBool == false:
      annotations["openWorldHint"] = %false

  if annotations.len > 0:
    result["annotations"] = annotations

proc compile(compiler: MCPDSLCompiler, ast: ASTNode): JsonNode =
  case ast.kind
  of astRequest: compiler.compileRequest(ast)
  of astResponse: compiler.compileResponse(ast)
  of astNotification: compiler.compileNotification(ast)
  of astError: compiler.compileError(ast)
  of astResource: compiler.compileResource(ast)
  of astTool: compiler.compileTool(ast)
  of astPrompt: %*{"name": ast.defName}  # Simplified for now
  of astBlock: compiler.compileObject(ast.blockFields)
  of astValue: ast.val

# Public API
proc parseMCPDSL*(input: string): JsonNode =
  var lexer = newMCPDSLLexer(input)
  let tokens = lexer.tokenize()

  var parser = newMCPDSLParser(tokens)
  let ast = parser.parse()

  let compiler = MCPDSLCompiler()
  compiler.compile(ast)

# Only run examples when executed directly
when isMainModule:
  let examples = [
    """
> initialize#1 {
  v: "2025-06-18"
  info: @impl("MyClient", "1.0.0")
}
    """,
    """
T search {
  desc: "Search the web"
  in: {
    query: str!
    limit: int
  }
  @readonly
}
    """,
    """
< #42 {
  status: "ok"
}
    """,
    """
! initialized
    """,
    """
x #10 -32601:"Method not found"
    """
  ]

  for i, example in examples:
    echo "\n=== Example ", i + 1, " ==="
    echo "MCP-DSL Input:"
    echo example.strip

    try:
      let result = parseMCPDSL(example)
      echo "\nCompiled JSON:"
      echo result.pretty
    except:
      echo "Parsing error: ", getCurrentExceptionMsg()
