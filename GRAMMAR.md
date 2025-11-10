# MCP-DSL Grammar Specification

**Version**: 1.0.0
**Date**: 2025-11-10

## Lexical Structure

```ebnf
(* Tokens *)
IDENTIFIER  ::= [a-zA-Z_][a-zA-Z0-9_]*
METHOD_PATH ::= IDENTIFIER ('/' IDENTIFIER)*
INTEGER     ::= '-'? [0-9]+
DECIMAL     ::= '-'? [0-9]+ '.' [0-9]+
STRING      ::= '"' (CHAR | ESCAPE)* '"'
ESCAPE      ::= '\n' | '\t' | '\r' | '\"' | '\\' | '\{{'
CHAR        ::= [^"\\]
NEWLINE     ::= '\n' | '\r\n'
INDENT      ::= [ \t]+
WHITESPACE  ::= [ \t\r\n]+
COMMENT     ::= '#' [^\n]* '\n'
```

## Document Structure

```ebnf
document ::= (message | definition | server_block)*
server_block ::= 'server' IDENTIFIER version? block
version ::= 'v' (INTEGER '.' INTEGER '.' INTEGER)
```

## Messages

```ebnf
message ::= request | response | notification | error

request ::= '>' METHOD_PATH '#' message_id params?
response ::= '<' '#' message_id result?
notification ::= '!' METHOD_PATH params?
error ::= 'x' '#' message_id error_code ':' error_message data?

message_id ::= INTEGER
error_code ::= INTEGER
error_message ::= STRING | IDENTIFIER

params ::= inline_object | block
result ::= value
data ::= value
```

## Definitions

```ebnf
definition ::= resource_def | tool_def | prompt_def | template_def | collection_def

resource_def ::= 'R' IDENTIFIER block
tool_def ::= 'T' IDENTIFIER block
prompt_def ::= 'P' IDENTIFIER block
template_def ::= 'RT' IDENTIFIER block
collection_def ::= definition_type '[]' (IDENTIFIER block | inline_collection)

definition_type ::= 'R' | 'T' | 'P' | 'RT'
inline_collection ::= '{' named_block_list '}'
named_block_list ::= named_block (',' named_block)* ','?
named_block ::= IDENTIFIER ':' (block | STRING | type_expr)
```

## Type System

```ebnf
(* Type expressions - no left recursion *)
type_expr ::= union_type
union_type ::= cast_type ('|' cast_type)*
cast_type ::= primary_type ('::' IDENTIFIER)*
primary_type ::= base_type modifier?
base_type ::= primitive_type
            | array_type
            | object_type
            | enum_type
            | reference_type
            | '(' type_expr ')'

primitive_type ::= 'str' | 'int' | 'num' | 'bool' | 'uri' | 'blob'
array_type ::= '[' type_expr? ']'
object_type ::= '{' field_list? '}'
enum_type ::= 'enum' '[' enum_values ']'
reference_type ::= IDENTIFIER
modifier ::= '!' | '?'

enum_values ::= IDENTIFIER (',' IDENTIFIER)*
field_list ::= field_def (',' field_def)* ','?
field_def ::= IDENTIFIER ':' type_expr default_value?
default_value ::= '=' value
```

## Values

```ebnf
(* Values - no left recursion *)
value ::= primary_value ('::' IDENTIFIER)*
primary_value ::= primitive_value
                | structured_value
                | content_value
                | special_value

primitive_value ::= STRING | INTEGER | DECIMAL | boolean | null | IDENTIFIER
boolean ::= 'true' | 'false'
null ::= 'null'

structured_value ::= array | object_literal
array ::= '[' value_list? ']'
value_list ::= value (',' value)* ','?

(* Unified object syntax - disambiguated semantically *)
object ::= object_literal
inline_object ::= object_literal
block ::= object_literal
object_literal ::= '{' object_content '}'
object_content ::= (field_assignment | annotation | nested_definition)* ','?
field_assignment ::= IDENTIFIER modifier? ':' value
nested_definition ::= definition

content_value ::= text_content
                | image_content
                | audio_content
                | resource_ref
                | embedded_resource
                | tool_ref

text_content ::= 'txt' (STRING | multiline_string)
image_content ::= 'img' STRING ('::' image_format)?
audio_content ::= 'aud' STRING ('::' audio_format)?
resource_ref ::= 'res' '{' IDENTIFIER '}'
tool_ref ::= 'T' '{' IDENTIFIER '}'
embedded_resource ::= 'emb' '{' object_content '}'
image_format ::= 'jpeg' | 'png' | 'gif' | 'webp'
audio_format ::= 'mp3' | 'wav' | 'ogg' | 'flac'

multiline_string ::= '|' NEWLINE indented_block
indented_block ::= indented_line*
indented_line ::= INDENT line_content NEWLINE
line_content ::= [^\n]*

special_value ::= annotation | capability_set | role_message | inline_definition
```

## Annotations

```ebnf
annotation ::= '@' IDENTIFIER annotation_value?
annotation_value ::= ':' value | '(' argument_list ')'
argument_list ::= value (',' value)* ','?
```

## Special Constructs

```ebnf
(* Capability sets *)
capability_set ::= '{' capability_list? '}'
capability_list ::= capability (',' capability)* ','?
capability ::= bare_capability | dotted_capability
bare_capability ::= IDENTIFIER
dotted_capability ::= IDENTIFIER '.' capability_path
capability_path ::= IDENTIFIER ('.' IDENTIFIER)*

(* Role messages for prompts *)
role_message ::= role_indicator ':' (STRING | multiline_string | content_expression)
role_indicator ::= 'u' | 'a' | 's'
content_expression ::= composite_content
composite_content ::= content_value ('+' content_value)*

(* Inline definitions *)
inline_definition ::= inline_tool | inline_resource | inline_prompt
inline_tool ::= 'T' '{' IDENTIFIER ':' block '}'
inline_resource ::= 'R' '{' IDENTIFIER ':' block '}'
inline_prompt ::= 'P' '{' IDENTIFIER ':' block '}'
```

## Semantic Disambiguation

The grammar uses unified rules for syntactically identical constructs. Context-specific validation occurs post-parse:

### Object Literal Contexts

1. **Capability set** (field named `caps` or `capabilities`):
   - Must contain only bare identifiers or dot-paths
   - No colons allowed

2. **Request/notification params**:
   - Allows: field assignments, annotations
   - Disallows: nested definitions

3. **Response/error data**:
   - Allows: field assignments only
   - Disallows: annotations, nested definitions

4. **Definition blocks** (inside R/T/P/RT):
   - Allows: field assignments, annotations, nested definitions

5. **General values**:
   - Plain objects: field assignments only

## Type Operator Precedence

Highest to lowest:

1. Parentheses `()`
2. Type cast `::` (left-associative)
3. Union `|` (left-associative)
4. Modifier `!` `?` (postfix)

## Field Name Mappings

DSL abbreviations map to full JSON-RPC field names:

| DSL | JSON | Context |
|-----|------|---------|
| `v` | `protocolVersion` | Initialize |
| `caps` | `capabilities` | Initialize |
| `info` | `clientInfo` / `serverInfo` | Initialize |
| `args` | `arguments` | Tool call |
| `desc` | `description` | All definitions |
| `mime` | `mimeType` | Resources |
| `in` | `inputSchema` | Tools |
| `out` | `outputSchema` | Tools |
| `msgs` | `messages` | Prompts |
| `ok` | `isError` (negated) | Tool result |

## Type Compilation

| DSL Type | JSON Schema |
|----------|-------------|
| `str` | `{"type": "string"}` |
| `str!` | `{"type": "string"}` + add to `required` |
| `str?` | `{"type": "string"}` + omit from `required` |
| `int` | `{"type": "integer"}` |
| `num` | `{"type": "number"}` |
| `bool` | `{"type": "boolean"}` |
| `uri` | `{"type": "string", "format": "uri"}` |
| `blob` | `{"type": "string", "contentEncoding": "base64"}` |
| `[]` | `{"type": "array"}` |
| `[str]` | `{"type": "array", "items": {"type": "string"}}` |
| `{}` | `{"type": "object"}` |
| `enum[a,b,c]` | `{"type": "string", "enum": ["a", "b", "c"]}` |
| `str\|int` | `{"oneOf": [{"type": "string"}, {"type": "integer"}]}` |
| `str::date-time` | `{"type": "string", "format": "date-time"}` |

## Annotation Mappings

| Annotation | Target | JSON |
|------------|--------|------|
| `@readonly` | Tool | `"annotations": {"readOnlyHint": true}` |
| `@idempotent` | Tool | `"annotations": {"idempotentHint": true}` |
| `@destructive` | Tool | `"annotations": {"destructiveHint": false}` |
| `@openWorld: bool` | Tool | `"annotations": {"openWorld": bool}` |
| `@priority: num` | Resource | `"annotations": {"priority": num}` |
| `@audience: [str]` | Resource/Prompt | `"annotations": {"audience": [str]}` |
| `@impl(name, ver)` | Initialize | `{"name": name, "version": ver}` |

Custom annotations are preserved in the `annotations` object.

## Capability Compilation

**Bare capability**: `tools` → `{"tools": {}}`
**Dotted capability**: `roots.listChanged` → `{"roots": {"listChanged": true}}`

Algorithm for dotted path `a.b.c`:
1. Split on dots: `["a", "b", "c"]`
2. Build nested object with last element = `true`
3. Result: `{"a": {"b": {"c": true}}}`

## Multiline String Indentation

1. First line after `|` establishes base indentation level
2. All subsequent lines must have indentation ≥ base
3. Base indentation is stripped from all lines
4. Relative indentation (beyond base) is preserved
5. Empty lines are preserved
6. Content ends when indentation < base

## Template Variables

Template syntax is **not** processed by the DSL parser. Templates are passed through as-is within string content:

- Variable: `{{identifier}}` or `{{path.to.value}}`
- Helper: `{{#if condition}}...{{/if}}`
- Comment: `{{! comment text}}`

The MCP client/server's template engine (e.g., Handlebars, Jinja) handles expansion.

## Parser Implementation Notes

**Left Recursion**: This grammar contains zero left recursion. All recursive productions use iterative patterns (`*` or `+`).

**Ambiguity**: Syntactic ambiguity (e.g., `{...}` constructs) is resolved via two-phase parsing:
1. **Parse phase**: Build unified AST using generic rules
2. **Semantic phase**: Validate based on context

**Lookahead**: Most productions require LL(1). Some require LL(k) where k ≤ 4:
- Distinguishing `T identifier` vs `T []` requires 2 tokens
- Distinguishing `T { id }` vs `T { id: ... }` requires 4 tokens

**Suitable Parsers**: ANTLR, Yacc, Bison, recursive descent, PEG parsers.
