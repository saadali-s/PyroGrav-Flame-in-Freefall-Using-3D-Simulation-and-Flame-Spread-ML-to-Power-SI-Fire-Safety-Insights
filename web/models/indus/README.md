# NASA INDUS encoder

This CPU export derives from [NASA IMPACT’s INDUS SDE Sentence Transformer](https://huggingface.co/nasa-impact/indus-sde-st-v0.2) at revision `92b505b65c35b5842167786de403061d06dedef9`, distributed under Apache 2.0. The export uses ONNX with FP16 weight storage, FP32 inference, masked mean pooling and L2 normalization. The compressed weight shards contain the ONNX graph and weights. The index includes the matching vectors for the reviewed PyroGrav guide and Analytics catalogs.

Recreate the export with `workers/encoder/export_indus.py` using the pinned Hugging Face snapshot and the PyTorch, Transformers, ONNX and ONNX Runtime libraries. The export script checks the embeddings and held-out retrieval rankings against the source model. `index.json` records those checks and the individual shard checksums.
