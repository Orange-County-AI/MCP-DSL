# MCP-DSL Token Efficiency Experiment

## Hypothesis

MCP-DSL's token efficiency enables small language models to perform better on multi-step MCP tool orchestration tasks compared to equivalent JSON-RPC formatted tasks.

## Research Questions

1. **Accuracy**: Does a model fine-tuned on MCP-DSL produce more accurate tool calls than one trained on JSON-RPC?
2. **Context Utilization**: Can the DSL-trained model handle more complex multi-step tasks within the same context window?
3. **Token Efficiency**: What is the actual token reduction in practice across diverse MCP scenarios?

## Methodology

### Models

Based on 2025 benchmarks:
- **Primary**: Qwen3-0.6B (smallest, Apache 2.0, strong fine-tuning performance)
- **Alternative**: Llama-3.2-1B (most tunable, biggest improvement from fine-tuning)

### Training Data

Generate parallel datasets:
- **Format A**: Natural Language → JSON-RPC (control)
- **Format B**: Natural Language → MCP-DSL (treatment)

Same underlying tasks, different output formats.

### Task Types

1. **Single Tool Call** - Basic tool invocation
2. **Multi-Tool Sequence** - 2-5 tool calls in sequence
3. **Tool Definition Generation** - Generate tool schemas from descriptions
4. **Complex Nested Structures** - Deep nesting, arrays, unions

### Dataset Size

- Training: 10,000 examples per format (20,000 total)
- Validation: 1,000 examples per format
- Test: 1,000 examples per format

### Evaluation Metrics

1. **Exact Match Accuracy** - Parsed output matches expected
2. **Structural Accuracy** - Correct structure, possibly different values
3. **Token Count** - Input/output tokens per example
4. **Complexity Ceiling** - Maximum complexity before degradation

## Budget Allocation ($100)

| Item | Cost Estimate |
|------|---------------|
| Data generation (CPU) | $2 |
| Fine-tuning Model A (JSON-RPC) | $35-40 |
| Fine-tuning Model B (MCP-DSL) | $35-40 |
| Evaluation runs | $10 |
| Buffer | $10-18 |

Using A10 GPUs at $1.10/hour ≈ 90 hours total available.

## Infrastructure

- **Platform**: Modal Labs
- **Training**: Axolotl + LoRA fine-tuning
- **Base**: modal-labs/llm-finetuning repo pattern

## Expected Outcomes

If hypothesis is correct:
- DSL model achieves higher accuracy on complex tasks
- DSL model handles longer sequences before context overflow
- Token savings of 60-80% confirmed empirically

If hypothesis is incorrect:
- Models perform similarly regardless of format
- Compression overhead negates token savings
- Learning a new syntax hurts more than token reduction helps

## Files

```
experiment/
├── EXPERIMENT.md          # This file
├── data/
│   ├── generate.ts        # Data generation script
│   ├── train_jsonrpc.jsonl
│   ├── train_dsl.jsonl
│   ├── val_jsonrpc.jsonl
│   ├── val_dsl.jsonl
│   ├── test_jsonrpc.jsonl
│   └── test_dsl.jsonl
├── modal/
│   ├── train.py           # Modal training script
│   ├── eval.py            # Modal evaluation script
│   └── config/
│       ├── jsonrpc.yml    # Axolotl config for JSON-RPC model
│       └── dsl.yml        # Axolotl config for DSL model
└── results/
    └── analysis.md        # Final analysis
```
