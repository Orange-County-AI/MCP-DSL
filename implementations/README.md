# MCP-DSL Implementations

This directory contains production-ready implementations of the MCP-DSL parser and compiler in multiple languages, each offering different trade-offs for performance, developer experience, and deployment scenarios.

## Available Implementations

### [TypeScript](typescript/)
**Best developer experience** - Excellent for rapid development and integration with Node.js/Bun ecosystems.

- Runtime: Bun (recommended) or Node.js
- Performance: 566ms for benchmark suite
- Lines of code: ~1200
- Test coverage: 25 tests (15 compiler + 10 round-trip)
- Key features: Hot reload, great debugging, extensive ecosystem

### [Go](go/)
**Best balance** - Excellent performance with great tooling and fast compilation times.

- Performance: 455ms for benchmark suite (1.24x faster than TypeScript)
- Lines of code: ~1400
- Test coverage: 25 tests (15 compiler + 10 round-trip)
- Key features: Static typing, fast compilation, excellent standard library

### [Nim](nim/)
**Maximum performance** - Fastest implementation with low memory footprint.

- Performance: 296.5ms for benchmark suite (1.91x faster than TypeScript, 1.53x faster than Go)
- Lines of code: ~1100
- Test coverage: 25 tests (15 compiler + 10 round-trip)
- Key features: Native compilation, zero-cost abstractions, ORC memory management

## Performance Comparison

Benchmark results across 7 test cases with 10,000 iterations each:

| Test Case | TypeScript | Nim | Go | Winner |
|-----------|------------|-----|-----|--------|
| Simple ping | 39.68ms | 21.28ms | 13.00ms | Go |
| Initialize request | 59.51ms | 50.68ms | 26.00ms | Go |
| Tool definition | 153.57ms | 68.38ms | 82.00ms | Nim |
| Tools call request | 68.48ms | 42.51ms | 66.00ms | Nim |
| Error response | 26.25ms | 14.67ms | 25.00ms | Nim |
| Resource definition | 108.84ms | 53.95ms | 65.00ms | Nim |
| Complex conversation | 109.83ms | 45.06ms | 178.00ms | Nim |
| **TOTAL** | **566.16ms** | **296.53ms** | **455.00ms** | **Nim** |

See [../PERFORMANCE.md](../PERFORMANCE.md) for detailed analysis and recommendations.

## Choosing an Implementation

**Choose TypeScript if:**
- You're building Node.js/Bun applications
- You value rapid development and hot reload
- You need extensive npm package integration
- Developer experience is the priority

**Choose Go if:**
- You need a balance of performance and productivity
- You're building standalone services or CLI tools
- You value fast compilation times
- You want strong standard library support

**Choose Nim if:**
- Performance is critical
- You need low memory footprint
- You're building high-throughput systems
- You want native code performance

## Common Features

All implementations provide:

✅ Complete MCP-DSL parser (Lexer → Parser → Compiler)
✅ Bidirectional transpilation (DSL ↔ JSON-RPC)
✅ Full MCP specification compliance
✅ Comprehensive test suites (25 tests each)
✅ Round-trip fidelity verification
✅ Same parser architecture and semantics

## Setup & Requirements

### TypeScript
**Prerequisites:**
- [Bun](https://bun.sh) (recommended) or Node.js 18+

**Setup:**
```bash
cd implementations/typescript
bun install  # or npm install
```

**Run:**
```bash
bun test                           # Run tests
bun run benchmark.ts 10000         # Run benchmark
bun run round-trip-demo.ts         # See round-trip demo
```

### Go
**Prerequisites:**
- Go 1.21+

**Setup:**
```bash
cd implementations/go
# No additional setup needed - uses standard library only
```

**Run:**
```bash
go test -v                         # Run tests
go build -o benchmark_go benchmark_go.go mcp_dsl_implementation.go
./benchmark_go 10000               # Run benchmark
```

### Nim
**Prerequisites:**
- [Nim](https://nim-lang.org) 2.0+

**Setup:**
```bash
cd implementations/nim
# No additional setup needed - uses standard library only
```

**Run:**
```bash
nim c -r mcp_dsl_implementation_test.nim  # Run tests
nim c -d:release --opt:speed --mm:orc -o:benchmark_nim benchmark_nim.nim
./benchmark_nim 10000                      # Run benchmark
```

## Running Tests

**With mise (recommended):**
```bash
# All implementations
mise run test-all

# Individual implementations
mise run test      # TypeScript
mise run test-go   # Go
mise run test-nim  # Nim
```

**Direct execution:**
```bash
# TypeScript
cd implementations/typescript && bun test

# Go
cd implementations/go && go test -v

# Nim
cd implementations/nim && nim c -r mcp_dsl_implementation_test.nim
```

## Running Benchmarks

```bash
# All implementations (with mise)
mise run bench

# Manual execution
cd implementations
nim c -d:release --opt:speed --mm:orc -o:benchmark_nim nim/benchmark_nim.nim
go build -o benchmark_go go/benchmark_go.go go/mcp_dsl_implementation.go
./benchmark_nim 10000
./benchmark_go 10000
bun run typescript/benchmark.ts 10000
```

## Contributing

When contributing to implementations:

1. Maintain semantic equivalence across all three implementations
2. Update all relevant test suites
3. Verify round-trip transpilation works correctly
4. Update benchmarks if parser logic changes
5. Keep documentation synchronized

## License

All implementations are licensed under MIT. See [../LICENSE](../LICENSE) for details.
