# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "modal",
# ]
# ///
"""
Upload training data to Modal volume.

Usage:
    uv run experiment/modal/upload_data.py
"""

import modal
from pathlib import Path

app = modal.App("mcp-dsl-upload")
volume = modal.Volume.from_name("mcp-dsl-experiment-vol", create_if_missing=True)
VOLUME_PATH = "/vol"


@app.local_entrypoint()
def main():
    """Upload local data files to Modal volume."""
    data_dir = Path("experiment/data")

    files_to_upload = [
        "train_dsl.jsonl",
        "train_jsonrpc.jsonl",
        "val_dsl.jsonl",
        "val_jsonrpc.jsonl",
        "test_dsl.jsonl",
        "test_jsonrpc.jsonl",
    ]

    print("Uploading training data to Modal volume...")

    with volume.batch_upload() as batch:
        for filename in files_to_upload:
            local_path = data_dir / filename
            if not local_path.exists():
                print(f"  SKIP: {filename} (not found)")
                continue

            remote_path = f"data/{filename}"
            print(f"  Uploading: {filename} -> {remote_path}")
            batch.put_file(str(local_path), remote_path)

    print("\nDone! Files uploaded to volume 'mcp-dsl-experiment-vol'")
