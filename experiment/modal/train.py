# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "modal",
# ]
# ///
"""
MCP-DSL vs JSON-RPC Fine-tuning Experiment

Train two small models on parallel datasets to compare token efficiency.
Uses Hugging Face SFTTrainer with LoRA for efficient fine-tuning.

Usage:
    # Train DSL model
    uvx modal run experiment/modal/train.py --config dsl

    # Train JSON-RPC model
    uvx modal run experiment/modal/train.py --config jsonrpc

    # Train both in parallel
    uvx modal run experiment/modal/train.py --config both
"""

import modal
import os

# Modal app setup
app = modal.App("mcp-dsl-experiment")

# Base image with training dependencies
training_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch>=2.1.0",
        "transformers>=4.40.0",
        "peft>=0.10.0",
        "bitsandbytes>=0.43.0",
        "accelerate>=0.28.0",
        "datasets>=2.18.0",
        "trl>=0.8.0",
        "scipy",
        "sentencepiece",
        "protobuf",
    )
    .env({
        "TOKENIZERS_PARALLELISM": "false",
    })
)

# Volume for storing trained models and data
volume = modal.Volume.from_name("mcp-dsl-experiment-vol", create_if_missing=True)
VOLUME_PATH = "/vol"


@app.function(
    image=training_image,
    gpu="A10G",
    timeout=7200,  # 2 hours
    volumes={VOLUME_PATH: volume},
)
def train_model(config_type: str, base_model: str = "Qwen/Qwen2.5-0.5B-Instruct"):
    """Train a single model on the specified dataset using SFTTrainer."""
    import json
    import torch
    from datasets import Dataset
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        BitsAndBytesConfig,
    )
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    from trl import SFTTrainer, SFTConfig

    print(f"Starting training for {config_type} model...")
    print(f"Base model: {base_model}")
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"CUDA available: {torch.cuda.is_available()}")

    # Load training data
    train_path = f"{VOLUME_PATH}/data/train_{config_type}.jsonl"
    val_path = f"{VOLUME_PATH}/data/val_{config_type}.jsonl"

    print(f"Loading training data from {train_path}")

    with open(train_path, "r") as f:
        train_data = [json.loads(line) for line in f]

    with open(val_path, "r") as f:
        val_data = [json.loads(line) for line in f]

    print(f"Loaded {len(train_data)} training examples, {len(val_data)} validation examples")

    # Format data for training
    def format_example(example):
        return {
            "text": f"### Instruction:\n{example['instruction']}\n\n### Input:\n{example['input']}\n\n### Response:\n{example['output']}"
        }

    train_dataset = Dataset.from_list([format_example(ex) for ex in train_data])
    val_dataset = Dataset.from_list([format_example(ex) for ex in val_data])

    # Load tokenizer
    print(f"Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # Quantization config for 4-bit training
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
    )

    # Load model
    print(f"Loading model...")
    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
        torch_dtype=torch.bfloat16,
    )

    # Prepare model for k-bit training
    model = prepare_model_for_kbit_training(model)

    # LoRA config
    lora_config = LoraConfig(
        r=32,
        lora_alpha=64,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    )

    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    # Output directory
    output_dir = f"{VOLUME_PATH}/outputs/{config_type}"
    os.makedirs(output_dir, exist_ok=True)

    # Training config
    sft_config = SFTConfig(
        output_dir=output_dir,
        num_train_epochs=3,
        per_device_train_batch_size=4,
        per_device_eval_batch_size=4,
        gradient_accumulation_steps=4,
        learning_rate=2e-4,
        weight_decay=0.01,
        warmup_ratio=0.1,
        lr_scheduler_type="cosine",
        logging_steps=10,
        eval_strategy="steps",
        eval_steps=100,
        save_strategy="steps",
        save_steps=500,
        save_total_limit=2,
        bf16=True,
        gradient_checkpointing=True,
        optim="adamw_8bit",
        report_to="none",
        max_grad_norm=0.3,
        max_length=1024,
        packing=True,
    )

    # Create trainer
    trainer = SFTTrainer(
        model=model,
        args=sft_config,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        processing_class=tokenizer,
    )

    # Train
    print("Starting training...")
    trainer.train()

    # Save the model
    print(f"Saving model to {output_dir}")
    trainer.save_model(output_dir)
    tokenizer.save_pretrained(output_dir)

    # Commit volume changes
    volume.commit()

    print(f"Training completed for {config_type}!")
    return f"Model trained and saved to {output_dir}"


@app.function(
    image=training_image,
    gpu="A10G",
    timeout=3600,
    volumes={VOLUME_PATH: volume},
)
def evaluate_model(config_type: str, test_samples: int = 100):
    """Evaluate a trained model on test data."""
    import json
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import PeftModel

    print(f"Evaluating {config_type} model...")

    # Load base model and adapter
    base_model_name = "Qwen/Qwen2.5-0.5B-Instruct"
    adapter_path = f"{VOLUME_PATH}/outputs/{config_type}"

    print(f"Loading tokenizer from: {base_model_name}")
    tokenizer = AutoTokenizer.from_pretrained(base_model_name, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    print(f"Loading base model: {base_model_name}")
    model = AutoModelForCausalLM.from_pretrained(
        base_model_name,
        torch_dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True,
    )

    print(f"Loading adapter from: {adapter_path}")
    model = PeftModel.from_pretrained(model, adapter_path)
    model.eval()

    # Load test data
    test_path = f"{VOLUME_PATH}/data/test_{config_type}.jsonl"
    with open(test_path, "r") as f:
        test_data = [json.loads(line) for line in f][:test_samples]

    print(f"Loaded {len(test_data)} test examples")

    # Evaluate
    results = {
        "config_type": config_type,
        "total": len(test_data),
        "correct": 0,
        "structural_match": 0,
        "total_input_tokens": 0,
        "total_output_tokens": 0,
        "examples": [],
    }

    for i, example in enumerate(test_data):
        prompt = f"### Instruction:\n{example['instruction']}\n\n### Input:\n{example['input']}\n\n### Response:\n"

        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
        results["total_input_tokens"] += inputs.input_ids.shape[1]

        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=512,
                temperature=0.1,
                do_sample=False,
                pad_token_id=tokenizer.eos_token_id,
            )

        generated = tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)
        results["total_output_tokens"] += len(tokenizer.encode(generated))

        expected = example["output"]

        # Exact match
        if generated.strip() == expected.strip():
            results["correct"] += 1
            results["structural_match"] += 1
        else:
            # Try structural match (parse both as JSON/DSL)
            try:
                if config_type == "jsonrpc":
                    gen_parsed = json.loads(generated)
                    exp_parsed = json.loads(expected)
                    if gen_parsed == exp_parsed:
                        results["structural_match"] += 1
                else:
                    # For DSL, check key structural elements
                    gen_clean = generated.strip()
                    exp_clean = expected.strip()
                    # Check if main structure matches
                    if (gen_clean.startswith(exp_clean[:10]) and
                        len(gen_clean) > 0 and
                        gen_clean[0] == exp_clean[0]):
                        results["structural_match"] += 1
            except Exception:
                pass

        # Store a few examples for analysis
        if i < 5:
            results["examples"].append({
                "input": example["input"],
                "expected": expected[:200],
                "generated": generated[:200],
                "match": generated.strip() == expected.strip(),
            })

        if (i + 1) % 20 == 0:
            print(f"Evaluated {i + 1}/{len(test_data)} examples...")

    # Calculate metrics
    results["exact_match_accuracy"] = results["correct"] / results["total"]
    results["structural_accuracy"] = results["structural_match"] / results["total"]
    results["avg_input_tokens"] = results["total_input_tokens"] / results["total"]
    results["avg_output_tokens"] = results["total_output_tokens"] / results["total"]

    print(f"\n=== Results for {config_type} ===")
    print(f"Exact Match Accuracy: {results['exact_match_accuracy']:.2%}")
    print(f"Structural Accuracy: {results['structural_accuracy']:.2%}")
    print(f"Avg Input Tokens: {results['avg_input_tokens']:.1f}")
    print(f"Avg Output Tokens: {results['avg_output_tokens']:.1f}")

    # Save results
    results_path = f"{VOLUME_PATH}/outputs/{config_type}/eval_results.json"
    with open(results_path, "w") as f:
        json.dump(results, f, indent=2)

    volume.commit()

    return results


@app.function(
    image=training_image,
    timeout=600,
    volumes={VOLUME_PATH: volume},
)
def compare_results():
    """Compare results from both models."""
    import json

    dsl_path = f"{VOLUME_PATH}/outputs/dsl/eval_results.json"
    jsonrpc_path = f"{VOLUME_PATH}/outputs/jsonrpc/eval_results.json"

    try:
        with open(dsl_path, "r") as f:
            dsl_results = json.load(f)
        with open(jsonrpc_path, "r") as f:
            jsonrpc_results = json.load(f)
    except FileNotFoundError as e:
        return f"Results not found: {e}. Run evaluation first."

    comparison = {
        "dsl": {
            "exact_match": dsl_results["exact_match_accuracy"],
            "structural_match": dsl_results["structural_accuracy"],
            "avg_output_tokens": dsl_results["avg_output_tokens"],
        },
        "jsonrpc": {
            "exact_match": jsonrpc_results["exact_match_accuracy"],
            "structural_match": jsonrpc_results["structural_accuracy"],
            "avg_output_tokens": jsonrpc_results["avg_output_tokens"],
        },
        "token_reduction": (
            (jsonrpc_results["avg_output_tokens"] - dsl_results["avg_output_tokens"])
            / jsonrpc_results["avg_output_tokens"]
            * 100
        ),
    }

    print("\n" + "=" * 60)
    print("EXPERIMENT RESULTS: MCP-DSL vs JSON-RPC")
    print("=" * 60)
    print(f"\n{'Metric':<25} {'DSL':<15} {'JSON-RPC':<15}")
    print("-" * 55)
    print(f"{'Exact Match Accuracy':<25} {comparison['dsl']['exact_match']:.2%}{'':<8} {comparison['jsonrpc']['exact_match']:.2%}")
    print(f"{'Structural Accuracy':<25} {comparison['dsl']['structural_match']:.2%}{'':<8} {comparison['jsonrpc']['structural_match']:.2%}")
    print(f"{'Avg Output Tokens':<25} {comparison['dsl']['avg_output_tokens']:.1f}{'':<12} {comparison['jsonrpc']['avg_output_tokens']:.1f}")
    print(f"\nToken Reduction (DSL vs JSON-RPC): {comparison['token_reduction']:.1f}%")
    print("=" * 60)

    # Save comparison
    with open(f"{VOLUME_PATH}/outputs/comparison.json", "w") as f:
        json.dump(comparison, f, indent=2)

    volume.commit()

    return comparison


@app.local_entrypoint()
def main(
    config: str = "both",
    base_model: str = "Qwen/Qwen2.5-0.5B-Instruct",
    eval_only: bool = False,
    compare_only: bool = False,
    test_samples: int = 100,
):
    """
    Main entrypoint for the experiment.

    Args:
        config: Which model to train - "dsl", "jsonrpc", or "both"
        base_model: Base model to fine-tune
        eval_only: Only evaluate, don't train
        compare_only: Only compare results
    """
    print(f"MCP-DSL Experiment")
    print(f"Config: {config}, Base Model: {base_model}")

    if compare_only:
        print("\n=== Comparing Results ===")
        result = compare_results.remote()
        print(f"\nComparison: {result}")
        return

    if eval_only:
        print("\n=== Running Evaluation ===")
        if config in ["dsl", "both"]:
            dsl_results = evaluate_model.remote("dsl", test_samples)
            print(f"\nDSL Results: {dsl_results}")

        if config in ["jsonrpc", "both"]:
            jsonrpc_results = evaluate_model.remote("jsonrpc", test_samples)
            print(f"\nJSON-RPC Results: {jsonrpc_results}")

        if config == "both":
            print("\n=== Comparing Results ===")
            comparison = compare_results.remote()
            print(f"\nComparison: {comparison}")
        return

    # Training
    if config == "both":
        print("\n=== Training Both Models in Parallel ===")
        # Spawn both training jobs
        dsl_future = train_model.spawn("dsl", base_model)
        jsonrpc_future = train_model.spawn("jsonrpc", base_model)

        # Wait for both
        dsl_result = dsl_future.get()
        jsonrpc_result = jsonrpc_future.get()

        print(f"\nDSL: {dsl_result}")
        print(f"JSON-RPC: {jsonrpc_result}")

    elif config == "dsl":
        print("\n=== Training DSL Model ===")
        result = train_model.remote("dsl", base_model)
        print(result)

    elif config == "jsonrpc":
        print("\n=== Training JSON-RPC Model ===")
        result = train_model.remote("jsonrpc", base_model)
        print(result)

    else:
        raise ValueError(f"Unknown config: {config}. Use 'dsl', 'jsonrpc', or 'both'")

    print("\n=== Training Complete ===")
    print("Run evaluation with: uvx modal run experiment/modal/train.py --eval-only --config both")
