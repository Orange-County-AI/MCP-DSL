#!/usr/bin/env bash
# Stop hook that prompts user to continue until budget is exhausted
# Exit with JSON output to block stopping and provide continuation message

cat <<'EOF'
{"decision": "block", "reason": "Budget experiment in progress. You have up to $100 on Modal. Continue working on the MCP-DSL validation experiment - research small models, generate training data, set up Modal infrastructure, train models, and analyze results. Check your todo list for current progress."}
EOF
