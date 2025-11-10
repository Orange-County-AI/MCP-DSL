#!/usr/bin/env bun
// Performance benchmark comparing TypeScript (Bun) and Nim implementations

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

async function main() {
  const iterations = 10000;

  console.log("=".repeat(70));
  console.log("MCP-DSL Performance Benchmark: TypeScript (Bun) vs Nim");
  console.log("=".repeat(70));
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

  // Display results
  console.log("\n" + "=".repeat(70));
  console.log("Results by Test Case:");
  console.log("=".repeat(70));
  console.log(
    "Test Case".padEnd(35) +
    "TypeScript".padEnd(15) +
    "Nim".padEnd(15) +
    "Speedup"
  );
  console.log("-".repeat(70));

  testCases.forEach((testCase, i) => {
    const tsTime = tsTimes[i];
    const nimTime = nimTimes[i];
    const speedup = (tsTime / nimTime).toFixed(2);

    console.log(
      testCase.name.padEnd(35) +
      `${tsTime.toFixed(2)}ms`.padEnd(15) +
      `${nimTime.toFixed(2)}ms`.padEnd(15) +
      `${speedup}x`
    );
  });

  // Calculate totals
  const tsTotalTime = tsTimes.reduce((a, b) => a + b, 0);
  const nimTotalTime = nimTimes.reduce((a, b) => a + b, 0);
  const overallSpeedup = (tsTotalTime / nimTotalTime).toFixed(2);

  console.log("-".repeat(70));
  console.log(
    "TOTAL".padEnd(35) +
    `${tsTotalTime.toFixed(2)}ms`.padEnd(15) +
    `${nimTotalTime.toFixed(2)}ms`.padEnd(15) +
    `${overallSpeedup}x`
  );

  console.log("\n" + "=".repeat(70));
  console.log("Summary:");
  console.log("=".repeat(70));
  console.log(`Total execution time (TypeScript): ${tsTotal.toFixed(2)}ms`);
  console.log(`Total execution time (Nim):        ${nimTotal.toFixed(2)}ms`);
  console.log(`\nNim is ${overallSpeedup}x faster than TypeScript (Bun)`);

  // Memory usage comparison
  console.log("\n" + "=".repeat(70));
  console.log("Notes:");
  console.log("=".repeat(70));
  console.log("- TypeScript: Bun runtime with JIT compilation");
  console.log("- Nim: Compiled to native code with --opt:speed --mm:orc");
  console.log("- Both implementations use the same parser architecture");
  console.log("- Measurements include lexing, parsing, and JSON compilation");
  console.log("=".repeat(70));
}

main().catch(console.error);
