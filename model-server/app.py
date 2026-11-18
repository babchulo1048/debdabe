"""Debdabe model server: POST /understand, GET /health, GET /log?key=… on port 7860.

The model comes from one of two places:
  MODEL_DIR=/model                  a folder with intent/ and facts/ (e.g. model_round1 from Google Drive)
  MODEL_REPO=Babchulo/debdabe-model-round1 (+ HF_TOKEN)   download from Hugging Face
"""
import os

import torch

import predict
import serve

torch.set_num_threads(max(1, os.cpu_count() or 1))
NAME = os.environ.get("MODEL_NAME", "round1")

folder = os.environ.get("MODEL_DIR")
if folder:
    print(f"Loading model from {folder} …", flush=True)
else:
    from huggingface_hub import snapshot_download

    repo = os.environ["MODEL_REPO"]
    print(f"Downloading {repo} …", flush=True)
    folder = snapshot_download(repo, token=os.environ.get("HF_TOKEN"))

answer = predict.load(folder)
answer(["ለአስቴር ከበደ የደመወዝ ማረጋገጫ 25000"])  # warm-up
serve.start(answer, NAME, port=7860, log_key=os.environ.get("LOG_KEY"))
print(f"Debdabe {NAME} ready on port 7860 ✅", flush=True)
