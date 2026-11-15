"""Package the pinned INDUS encoder for CPU inference in the Next.js app."""

import gzip
import hashlib
import json
import shutil
import sys
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import torch
from huggingface_hub import snapshot_download
from transformers import AutoModel, AutoTokenizer

from evaluate import CASES
from retrieval import MODEL, REVISION, catalog

ROOT = Path(__file__).resolve().parents[2]
DESTINATION = ROOT / "web/models/indus"


class Encoder(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, input_ids, attention_mask):
        hidden = self.model(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
        mask = attention_mask.unsqueeze(-1)
        pooled = (hidden.float() * mask).sum(1) / mask.sum(1)
        return torch.nn.functional.normalize(pooled, dim=1)


def main(scratch):
    scratch.mkdir(parents=True, exist_ok=True)
    DESTINATION.mkdir(parents=True, exist_ok=True)
    torch.set_num_threads(2)
    source = Path(snapshot_download(MODEL, revision=REVISION, local_files_only=True))
    tokenizer = AutoTokenizer.from_pretrained(source)
    model = Encoder(AutoModel.from_pretrained(source, dtype=torch.float32, attn_implementation="eager")).eval()
    example = tokenizer("NASA flame spread on the ISS", return_tensors="pt")
    original_path = scratch / "indus-f32.onnx"
    compact_path = scratch / "indus-fp16-storage.onnx"
    with torch.inference_mode():
        torch.onnx.export(
            model, (example.input_ids, example.attention_mask), original_path,
            input_names=["input_ids", "attention_mask"], output_names=["embedding"],
            dynamic_axes={key: {0: "batch", 1: "length"} for key in ["input_ids", "attention_mask"]},
            opset_version=17, dynamo=False,
        )
    graph = onnx.load(original_path)
    casts = []
    for table in graph.graph.initializer:
        if table.data_type != onnx.TensorProto.FLOAT or len(table.dims) != 2:
            continue
        output = table.name
        table.CopyFrom(onnx.numpy_helper.from_array(onnx.numpy_helper.to_array(table).astype(np.float16), output + "_fp16"))
        casts.append(onnx.helper.make_node("Cast", [table.name], [output], to=onnx.TensorProto.FLOAT))
    for node in reversed(casts):
        graph.graph.node.insert(0, node)
    onnx.save(graph, compact_path)
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    session = ort.InferenceSession(str(compact_path), sess_options=options, providers=["CPUExecutionProvider"])

    entries = catalog()
    passages = [" ".join([e["name"], *e["facts"], e["limit"]]) for e in entries]
    analytics = json.loads((ROOT / "web/src/data/analytics-studies.json").read_text("utf-8"))
    studies = [(s["id"], " ".join([s["name"], s["hardware"], s["objective"], s["measurement"], s["conditions"], s["limits"]]))
               for s in analytics["studies"]]
    applications = [(a["id"], " ".join([a["name"], a["question"], a["finding"], a["context"], a["limit"]]))
                    for a in analytics["applications"]]
    analytics_entries = studies + applications
    all_texts = passages + [text for _, text in analytics_entries] + [question for question, _ in CASES]
    # Hosted requests use unpadded single sequences, matching the export path.
    original_rows = []
    compact_rows = []
    with torch.inference_mode():
        for text in all_texts:
            tokens = tokenizer(text, return_tensors="pt", truncation=True, max_length=256)
            original_rows.append(model(tokens.input_ids, tokens.attention_mask).numpy()[0])
            compact_rows.append(session.run(None, {k: tokens[k].numpy() for k in ("input_ids", "attention_mask")})[0][0])
    original = np.array(original_rows)
    compact = np.array(compact_rows)
    cosine = np.sum(original * compact, axis=1)
    assert cosine.min() >= 0.9999, f"Export drift: {cosine.min()}"
    indices = np.argmax(compact[-len(CASES):] @ compact[:len(entries)].T, axis=1)
    original_indices = np.argmax(original[-len(CASES):] @ original[:len(entries)].T, axis=1)
    assert np.array_equal(indices, original_indices), "Changed a held-out retrieval result"
    first = sum(entries[index]["id"] == target for index, (_, target) in zip(indices, CASES))
    print(f"INDUS parity: minimum cosine {cosine.min():.5f}, exact top-rank agreement on all {len(CASES)} queries, {first} expected top hits")
    for filename in ("tokenizer.json", "tokenizer_config.json"):
        shutil.copyfile(source / filename, DESTINATION / filename)
    shards = []
    with compact_path.open("rb") as model_file:
        while chunk := model_file.read(64 * 1024**2):
            filename = f"weights-{len(shards) + 1}.gz"
            compressed = gzip.compress(chunk, compresslevel=6, mtime=0)
            (DESTINATION / filename).write_bytes(compressed)
            shards.append(dict(file=filename, bytes=len(compressed), sha256=hashlib.sha256(compressed).hexdigest()))
    metadata = dict(
        model=MODEL,
        revision=REVISION,
        shards=shards,
        guide=dict(ids=[e["id"] for e in entries], vectors=compact[:len(entries)].tolist()),
        analytics=dict(ids=[key for key, _ in analytics_entries], vectors=compact[len(entries):-len(CASES)].tolist()),
        verification=dict(minimum_cosine=float(cosine.min()), expected_top_hits=first, reference_agreement=len(CASES)),
    )
    (DESTINATION / "index.json").write_text(json.dumps(metadata, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main(Path(sys.argv[1]).resolve())
