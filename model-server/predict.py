"""Load a trained Debdabe model folder and answer requests (used by the Space)."""
import torch
from transformers import AutoModelForSequenceClassification, AutoModelForTokenClassification, AutoTokenizer

from debdabe_train import decode_original, split_prefixes
from labels import INTENTS


def load(folder, threshold=0.5):
    """folder contains intent/ and facts/ (as saved by the training notebook). Returns predict(texts)."""
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    tok = AutoTokenizer.from_pretrained(f"{folder}/intent")
    m_int = AutoModelForSequenceClassification.from_pretrained(f"{folder}/intent").to(dev).eval()
    m_fac = AutoModelForTokenClassification.from_pretrained(f"{folder}/facts").to(dev).eval()

    @torch.no_grad()
    def predict(texts, bs=64):
        out = []
        for i in range(0, len(texts), bs):
            chunk = texts[i:i + bs]
            prepared = [split_prefixes(t) for t in chunk]
            mts = [m for m, _ in prepared]
            e = tok(mts, truncation=True, max_length=64, padding=True, return_tensors="pt").to(dev)
            probs = torch.softmax(m_int(**e).logits, -1).cpu().numpy()
            e2 = tok(mts, truncation=True, max_length=96, padding=True, return_tensors="pt",
                     return_offsets_mapping=True)
            offs = e2.pop("offset_mapping").tolist()
            lp = torch.softmax(m_fac(**{k: v.to(dev) for k, v in e2.items()}).logits, -1).cpu().numpy()
            for j, t in enumerate(chunk):
                k = int(probs[j].argmax())
                conf = float(probs[j][k])
                facts = decode_original(t, prepared[j][0], prepared[j][1], [tuple(o) for o in offs[j]],
                                        lp[j].argmax(-1).tolist(), lp[j].max(-1).tolist())
                out.append({"intent": INTENTS[k] if conf >= threshold else "none",
                            "confidence": round(conf, 4), "facts": facts})
        return out

    return predict
