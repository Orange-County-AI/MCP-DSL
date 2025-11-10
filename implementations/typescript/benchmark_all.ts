#!/usr/bin/env bun
// Performance benchmark comparing TypeScript (Bun), Nim, and Go implementations

import { parseMCPDSL } from "./mcp-dsl-implementation";
import { $ } from "bun";

const testCases = [
  {
    name: "Simple ping",
    dsl: `> ping#2`
  },
  {
    name: "Initialize request",
    dsl: `> initialize#1 {
      v: "2025-03-26"
    }`
  },
  {
    name: "Tool definition",
    dsl: `T search {
      desc: "Search the web"
      in: {
        query: str!
        limit: int
      }
      @readonly
    }`
  },
  {
    name: "Tools call request",
    dsl: `> tools/call#42 {
      name: "search"
      args: {query: "MCP protocol"}
    }`
  },
  {
    name: "Error response",
    dsl: `x #10 -32601:"Method not found"`
  },
  {
    name: "Resource definition",
    dsl: `R main_file {
      uri: "file:///project/src/main.rs"
      mime: "text/x-rust"
      desc: "Primary application entry point"
      @priority: 1.0
    }`
  },
  {
    name: "Complex conversation flow",
    dsl: `> initialize#1 {v: "2025-06-18"}
< #1 {v: "2025-06-18"}
! initialized
> tools/list#2
> tools/call#3 {name: "search", args: {q: "MCP protocol"}}`
  }
];

async function benchmarkTypeScript(iterations: number) {
  const times: number[] = [];

  for (const testCase of testCases) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      parseMCPDSL(testCase.dsl);
    }
    const end = performance.now();
    times.push(end - start);
  }

  return times;
}

async function benchmarkNim(iterations: number) {
  // First compile the Nim benchmark with optimizations
  console.log("Compiling Nim benchmark with optimizations...");
  await $`nim c -d:release --opt:speed --mm:orc -o:benchmark_nim benchmark_nim.nim`.quiet();

  // Run the Nim benchmark
  const result = await $`./benchmark_nim ${iterations}`.text();

  // Parse results (format: time1,time2,time3,...)
  return result.trim().split(',').map(t => parseFloat(t));
}

async function benchmarkGo(iterations: number) {
  // First compile the Go benchmark with optimizations
  console.log("Compiling Go benchmark with optimizations...");
  await $`go build -o benchmark_go benchmark_go.go mcp_dsl_implementation.go`.quiet();

  // Run the Go benchmark
  const result = await $`./benchmark_go ${iterations}`.text();

  // Parse results (format: time1,time2,time3,...)
  return result.trim().split(',').map(t => parseFloat(t));
}

async function main() {
  const iterations = 10000;

  console.log("=".repeat(80));
  console.log("MCP-DSL Performance Benchmark: TypeScript vs Nim vs Go");
  console.log("=".repeat(80));
  console.log(`Iterations per test case: ${iterations.toLocaleString()}\n`);

  // Run TypeScript benchmark
  console.log("Running TypeScript (Bun) benchmark...");
  const tsStart = performance.now();
  const tsTimes = await benchmarkTypeScript(iterations);
  const tsTotal = performance.now() - tsStart;

  // Run Nim benchmark
  console.log("Running Nim benchmark...");
  const nimStart = performance.now();
  const nimTimes = await benchmarkNim(iterations);
  const nimTotal = performance.now() - nimStart;

  // Run Go benchmark
  console.log("Running Go benchmark...");
  const goStart = performance.now();
  const goTimes = await benchmarkGo(iterations);
  const goTotal = performance.now() - goStart;

  // Display results
  console.log("\n" + "=".repeat(80));
  console.log("Results by Test Case:");
  console.log("=".repeat(80));
  console.log(
    "Test Case".padEnd(35) +
    "TypeScript".padEnd(13) +
    "Nim".padEnd(13) +
    "Go".padEnd(13) +
    "TS/Nim".padEnd(8) +
    "TS/Go"
  );
  console.log("-".repeat(80));

  testCases.forEach((testCase, i) => {
    const tsTime = tsTimes[i];
    const nimTime = nimTimes[i];
    const goTime = goTimes[i];
    const nimSpeedup = (tsTime / nimTime).toFixed(2);
    const goSpeedup = (tsTime / goTime).toFixed(2);

    console.log(
      testCase.name.padEnd(35) +
      `${tsTime.toFixed(2)}ms`.padEnd(13) +
      `${nimTime.toFixed(2)}ms`.padEnd(13) +
      `${goTime.toFixed(2)}ms`.padEnd(13) +
      `${nimSpeedup}x`.padEnd(8) +
      `${goSpeedup}x`
    );
  });

  // Calculate totals
  const tsTotalTime = tsTimes.reduce((a, b) => a + b, 0);
  const nimTotalTime = nimTimes.reduce((a, b) => a + b, 0);
  const goTotalTime = goTimes.reduce((a, b) => a + b, 0);
  const nimOverallSpeedup = (tsTotalTime / nimTotalTime).toFixed(2);
  const goOverallSpeedup = (tsTotalTime / goTotalTime).toFixed(2);

  console.log("-".repeat(80));
  console.log(
    "TOTAL".padEnd(35) +
    `${tsTotalTime.toFixed(2)}ms`.padEnd(13) +
    `${nimTotalTime.toFixed(2)}ms`.padEnd(13) +
    `${goTotalTime.toFixed(2)}ms`.padEnd(13) +
    `${nimOverallSpeedup}x`.padEnd(8) +
    `${goOverallSpeedup}x`
  );

  console.log("\n" + "=".repeat(80));
  console.log("Summary:");
  console.log("=".repeat(80));
  console.log(`Total execution time (TypeScript): ${tsTotal.toFixed(2)}ms`);
  console.log(`Total execution time (Nim):        ${nimTotal.toFixed(2)}ms`);
  console.log(`Total execution time (Go):         ${goTotal.toFixed(2)}ms`);
  console.log(`\nNim is ${nimOverallSpeedup}x faster than TypeScript (Bun)`);
  console.log(`Go is ${goOverallSpeedup}x faster than TypeScript (Bun)`);

  // Comparison between Nim and Go
  const nimVsGo = (nimTotalTime / goTotalTime).toFixed(2);
  if (parseFloat(nimVsGo) < 1) {
    console.log(`Nim is ${(1 / parseFloat(nimVsGo)).toFixed(2)}x faster than Go`);
  } else {
    console.log(`Go is ${nimVsGo}x faster than Nim`);
  }

  // Memory usage comparison
  console.log("\n" + "=".repeat(80));
  console.log("Notes:");
  console.log("=".repeat(80));
  console.log("- TypeScript: Bun runtime with JIT compilation");
  console.log("- Nim: Compiled to native code with --opt:speed --mm:orc");
  console.log("- Go: Compiled to native code with default optimizations");
  console.log("- All implementations use the same parser architecture");
  console.log("- Measurements include lexing, parsing, and JSON compilation");
  console.log("=".repeat(80));
}

main().catch(console.error);
