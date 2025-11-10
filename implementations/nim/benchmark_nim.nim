import std/[times, strutils, os]
import mcp_dsl_implementation

let testCases = [
  "> ping#2",

  """
> initialize#1 {
  v: "2025-03-26"
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
> tools/call#42 {
  name: "search"
  args: {query: "MCP protocol"}
}
  """,

  """x #10 -32601:"Method not found"""",

  """
R main_file {
  uri: "file:///project/src/main.rs"
  mime: "text/x-rust"
  desc: "Primary application entry point"
  @priority: 1.0
}
  """,

  """> initialize#1 {v: "2025-06-18"}
< #1 {v: "2025-06-18"}
! initialized
> tools/list#2
> tools/call#3 {name: "search", args: {q: "MCP protocol"}}"""
]

proc main() =
  if paramCount() < 1:
    echo "Usage: benchmark_nim <iterations>"
    quit(1)

  let iterations = parseInt(paramStr(1))
  var times: seq[float] = @[]

  for testCase in testCases:
    let start = cpuTime()
    for i in 0..<iterations:
      discard parseMCPDSL(testCase)
    let finish = cpuTime()
    let elapsed = (finish - start) * 1000.0  # Convert to milliseconds
    times.add(elapsed)

  # Output results as comma-separated values
  for i, time in times:
    stdout.write(time)
    if i < times.len - 1:
      stdout.write(",")
  stdout.write("\n")

when isMainModule:
  main()
