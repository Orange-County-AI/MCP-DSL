# MCP-DSL: A Token-Efficient Language for Model Context Protocol

**75-85% token reduction. Same MCP power. Real cost savings.**

MCP-DSL is a domain-specific language designed to replace verbose JSON-RPC in the Model Context Protocol, cutting token usage by up to 85% while maintaining full compatibility and expressiveness.

## Quick Example

Traditional JSON-RPC:
```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "method": "tools/call",
  "params": {
    "name": "search",
    "arguments": {
      "query": "weather"
    }
  }
}
```

MCP-DSL:
```mcp-dsl
> tools/call#42 {name: "search", args: {query: "weather"}}
```

**Result**: 176 tokens → 42 tokens (76% reduction)

---

## Installation

Install as a library:

```bash
npm install mcp-dsl
# or
bun install mcp-dsl
```

Install globally for CLI usage:

```bash
npm install -g mcp-dsl
# or
bun install -g mcp-dsl
```

## Usage

### As a Library

```typescript
import { compileDsl, decompile } from 'mcp-dsl';

// Compile DSL to JSON-RPC
const result = compileDsl('> initialize#1 {v: "2025-06-18"}');
console.log(result.messages[0]);
// {
//   jsonrpc: "2.0",
//   id: 1,
//   method: "initialize",
//   params: { protocolVersion: "2025-06-18" }
// }

// Decompile JSON-RPC back to DSL
const dsl = decompile(result.messages);
console.log(dsl);
// > initialize#1 {v: "2025-06-18"}
```

### CLI Tool

```bash
# Compile DSL to JSON
echo '> initialize#1 {v: "2025-06-18"}' | mcp-dsl compile --pretty

# Decompile JSON to DSL
cat message.json | mcp-dsl decompile

# Validate DSL
mcp-dsl lint input.mcp

# Format DSL
mcp-dsl format input.mcp -o output.mcp
```

#### CLI Commands

- `compile` - Convert DSL to JSON-RPC
  - `--pretty` - Pretty-print JSON output
  - `--messages` - Output only messages
  - `--tools` - Output only tool definitions
  - `--resources` - Output only resource definitions
  - `--no-validate` - Skip semantic validation

- `decompile` - Convert JSON-RPC to DSL
  - `--messages/--tools/--resources` - Decompile specific types

- `lint` - Validate DSL syntax and semantics

- `format` - Parse and pretty-print DSL

All commands support `-i/--input` (file or `-` for stdin) and `-o/--output` (file or `-` for stdout).

## Language Features

### Message Types
- `>` Request (with method#id)
- `<` Response (with #id)
- `!` Notification (no response expected)
- `x` Error (with code:message)

### Definition Types
- `T` Tool (executable function with schema)
- `R` Resource (data source with URI)
- `P` Prompt (template with arguments)
- `RT` Resource Template (parameterized URI pattern)

### Type System

Compact type notation with inference:
```mcp-dsl
T analyze_code {
  desc: "Analyzes code for issues"
  in: {
    code: str!           # Required string
    language: str!
    rules?: {            # Optional nested object
      complexity?: int = 10
      lineLength?: int = 100
    }
  }
  out: {
    issues: [{          # Array of objects
      line: int
      severity: enum[error, warning, info]
      message: str
    }]
  }
}
```

### Field Name Abbreviations

| DSL | JSON-RPC |
|-----|----------|
| `v` | `protocolVersion` |
| `caps` | `capabilities` |
| `info` | `clientInfo` / `serverInfo` |
| `args` | `arguments` |
| `desc` | `description` |
| `mime` | `mimeType` |
| `in` | `inputSchema` |
| `out` | `outputSchema` |

See [GRAMMAR.md](./GRAMMAR.md) for complete language specification.

## Why MCP-DSL?

### Token Efficiency

For a system processing **1 million MCP messages per day**:

- **Tokens saved**: 341M tokens/day
- **API cost savings** (at $3/M input tokens): **$1,023/day** = **$373,395/year**
- **With output tokens** (at $15/M): Total savings **$1.2M+/year**

Even at moderate scale (100K messages/day), annual savings exceed **$120K**.

### When to Use MCP-DSL

MCP-DSL provides maximum value when:
- **High message volume**: Servers handling thousands of requests daily
- **Context-constrained models**: Smaller models with limited windows
- **Cost-sensitive applications**: Production systems at scale
- **Real-time systems**: Lower token counts mean faster processing
- **Multi-turn conversations**: Savings compound across multiple exchanges

## Development

### Setup

This project uses [mise](https://mise.jdx.dev/) for tool version management:

```bash
# Install mise (if not already installed)
curl https://mise.run | sh

# Install project dependencies
mise install
bun install
```

### Running Tests

```bash
mise run test              # Run all tests
mise run test-watch        # Watch mode
bun test                   # Direct via bun
```

### Development Tasks

```bash
mise run check            # Run all checks (tests + CLI verification)
mise run build            # Verify CLI tool works
mise run lint             # Lint example files (when available)
mise run format           # Format example files (when available)
```

### Project Structure

```
src/
├── ast/              # Abstract Syntax Tree definitions
├── lexer/            # Tokenization
├── parser/           # Recursive descent parser
├── compiler/         # DSL → JSON-RPC transformation
├── decompiler/       # JSON-RPC → DSL transformation
├── semantic/         # Semantic validation
├── types/            # Common type definitions
├── utils/            # Utilities (mappings, string handling)
├── cli.ts            # CLI tool
└── index.ts          # Public API
```

## Grammar

See [GRAMMAR.md](./GRAMMAR.md) for the complete EBNF grammar specification.

## Contributing

Contributions welcome! Please check the [issue tracker](../../issues) for current tasks and planned features.

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Why This Matters

Model Context Protocol is becoming the standard for LLM-tool interactions. As MCP adoption grows, protocol efficiency directly impacts:

- **Cost at scale**: Production systems handling millions of messages
- **Model capability**: More tokens available for actual content
- **Developer experience**: Readable, maintainable protocol definitions
- **Ecosystem growth**: Lower barriers to building MCP servers/clients

MCP-DSL makes the protocol more accessible and cost-effective without compromising power or compatibility.
