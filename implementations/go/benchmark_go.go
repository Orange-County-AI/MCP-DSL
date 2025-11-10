// Performance benchmark for Go implementation
// Run with: go run benchmark_go.go <iterations>

package main

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

var testCases = []struct {
	name string
	dsl  string
}{
	{
		name: "Simple ping",
		dsl:  `> ping#2`,
	},
	{
		name: "Initialize request",
		dsl: `> initialize#1 {
			v: "2025-03-26"
		}`,
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
		}`,
	},
	{
		name: "Tools call request",
		dsl: `> tools/call#42 {
			name: "search"
			args: {query: "MCP protocol"}
		}`,
	},
	{
		name: "Error response",
		dsl:  `x #10 -32601:"Method not found"`,
	},
	{
		name: "Resource definition",
		dsl: `R main_file {
			uri: "file:///project/src/main.rs"
			mime: "text/x-rust"
			desc: "Primary application entry point"
			@priority: 1.0
		}`,
	},
	{
		name: "Complex conversation flow",
		dsl: `> initialize#1 {v: "2025-06-18"}
< #1 {v: "2025-06-18"}
! initialized
> tools/list#2
> tools/call#3 {name: "search", args: {q: "MCP protocol"}}`,
	},
}

func benchmarkGo(iterations int) []float64 {
	times := make([]float64, len(testCases))

	for i, tc := range testCases {
		start := time.Now()
		for j := 0; j < iterations; j++ {
			ParseMCPDSL(tc.dsl)
		}
		elapsed := time.Since(start)
		times[i] = float64(elapsed.Milliseconds())
	}

	return times
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintf(os.Stderr, "Usage: %s <iterations>\n", os.Args[0])
		os.Exit(1)
	}

	iterations, err := strconv.Atoi(os.Args[1])
	if err != nil {
		fmt.Fprintf(os.Stderr, "Invalid iterations: %v\n", err)
		os.Exit(1)
	}

	times := benchmarkGo(iterations)

	// Output as CSV (comma-separated for easy parsing)
	for i, t := range times {
		if i > 0 {
			fmt.Print(",")
		}
		fmt.Printf("%.2f", t)
	}
	fmt.Println()
}
