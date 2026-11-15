"""Start the local encoder using the private development credential."""
import json
import os
from pathlib import Path
import uvicorn
from retrieval import retriever

if __name__ == "__main__":
    secret = Path(__file__).resolve().parents[1] / ".dev.vars.encoder.json"
    os.environ["ENCODER_TOKEN"] = json.loads(secret.read_text("utf-8"))["ENCODER_TOKEN"]
    retriever()
    uvicorn.run("retrieval:app", host="127.0.0.1", port=8011, log_level="warning")
