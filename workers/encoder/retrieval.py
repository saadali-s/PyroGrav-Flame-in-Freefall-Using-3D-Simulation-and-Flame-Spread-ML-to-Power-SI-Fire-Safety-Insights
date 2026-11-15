"""Run the pinned NASA encoder over the reviewed PyroGrav investigation catalog."""
import json
import os
import secrets
import re
from functools import lru_cache
from pathlib import Path

import torch
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from transformers import AutoModel, AutoTokenizer

WORKERS = Path(__file__).resolve().parents[1]
MODEL = "nasa-impact/indus-sde-st-v0.2"
REVISION = "92b505b65c35b5842167786de403061d06dedef9"
app = FastAPI(docs_url=None, redoc_url=None)


@lru_cache(maxsize=1)
def analytics_index():
    path = WORKERS.parent / "web/src/data/analytics-studies.json"
    catalog = json.loads(path.read_text("utf-8"))
    docs = [(s["id"], " ".join([s["name"], s["hardware"], s["objective"], s["measurement"], s["conditions"], s["limits"]]))
            for s in catalog["studies"]]
    docs.extend((a["id"], " ".join([a["name"], a["question"], a["finding"], a["context"], a["limit"]]))
                for a in catalog["applications"])
    return [key for key, _ in docs], retriever().encode([text for _, text in docs])


def catalog():
    entries = json.loads((WORKERS / "src/catalog.json").read_text("utf-8"))["entries"]
    return [{
        "id": e["id"], "name": e["name"], "facts": [e["objective"], e["measurement"] + ". " + e["units"] + ".",
            e["available"] + ".", e["utility"]], "limit": e["limits"],
        "sources": [{key: source[key] for key in ("url", "locator", "sha256")} for source in e["sources"]]
    } for e in entries]


class Retriever:
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        options = dict(revision=REVISION, local_files_only=True)
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL, **options)
        self.model = AutoModel.from_pretrained(MODEL, **options).to(self.device).eval()
        self.docs = catalog()
        passages = [" ".join([doc["name"], *doc["facts"], doc["limit"]]) for doc in self.docs]
        self.vectors = self.encode(passages)

    @torch.inference_mode()
    def encode(self, texts):
        batch = self.tokenizer(texts, return_tensors="pt", padding=True, truncation=True, max_length=256).to(self.device)
        hidden = self.model(**batch).last_hidden_state.float()
        mask = batch.attention_mask.unsqueeze(-1)
        pooled = (hidden * mask).sum(1) / mask.sum(1)
        return torch.nn.functional.normalize(pooled, dim=1)

    def search(self, question):
        scores = (self.vectors @ self.encode([question])[0]).tolist()
        aliases = {"pmma": ("pmma", "bass", "bass-ii"), "flex": ("flex",),
                   "same": ("same", "same-r"), "daft": ("daft",),
                   "saffire": ("saffire",), "luci": ("luci",)}
        def mentioned(doc):
            return any(re.search(r"(?<!\w)" + re.escape(alias.upper() if alias == "same" else alias) + r"(?!\w)", question,
                                 0 if alias == "same" else re.I)
                       for alias in aliases[doc["id"]])
        exact = [mentioned(doc) for doc in self.docs]
        order = sorted(range(len(scores)), key=lambda i: (exact[i], scores[i]), reverse=True)
        return [{"id": self.docs[i]["id"], "score": scores[i], "name_match": exact[i]} for i in order[:3]]


@lru_cache(maxsize=1)
def retriever():
    return Retriever()


class Query(BaseModel):
    question: str = Field(min_length=1, max_length=1000)


@app.post("/retrieve")
def retrieve(query: Query, authorization: str = Header(default="")):
    token = os.environ.get("ENCODER_TOKEN")
    if not token or not secrets.compare_digest(authorization.encode(), f"Bearer {token}".encode()):
        raise HTTPException(401)
    return {"revision": REVISION, "hits": retriever().search(query.question)}


@app.post("/retrieve-analytics")
def retrieve_analytics(query: Query, authorization: str = Header(default="")):
    token = os.environ.get("ENCODER_TOKEN")
    if not token or not secrets.compare_digest(authorization.encode(), f"Bearer {token}".encode()):
        raise HTTPException(401)
    ids, vectors = analytics_index()
    scores = (vectors @ retriever().encode([query.question])[0]).tolist()
    top = sorted(range(len(scores)), key=scores.__getitem__, reverse=True)[:3]
    return {"revision": REVISION, "hits": [{"id": ids[i], "score": scores[i]} for i in top]}
