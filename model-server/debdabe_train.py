"""Helpers shared by the Colab notebook: labels, span alignment, decoding.

Pure Python (no torch), so the tricky parts can be tested without a GPU.
"""
from labels import INTENTS, TAGS

LABELS = ["O"] + [f"{p}-{t}" for t in TAGS for p in ("B", "I")]
LABEL2ID = {l: i for i, l in enumerate(LABELS)}
INTENT2ID = {l: i for i, l in enumerate(INTENTS)}


def align_labels(offsets, spans):
    """Give each model token a label from the character spans.

    offsets: [(start, end)] per token, (0, 0) for special tokens.
    A token gets a tag if it overlaps a fact; the first such token is B-, the rest I-.
    """
    labels, seen = [], set()
    for s, e in offsets:
        if s == e:
            labels.append(-100)
            continue
        lab = "O"
        for i, (ss, se, tag) in enumerate(spans):
            if s < se and e > ss:
                lab = ("I-" if i in seen else "B-") + tag
                seen.add(i)
                break
        labels.append(LABEL2ID[lab])
    return labels


TRIM = " ,.;:፡።፣()-\"'"


def decode_spans(text, offsets, label_ids, scores=None):
    """Turn per-token labels back into {TAG: (start, end)}. Keeps the most confident span per tag."""
    found = {}  # tag -> (score, start, end)
    cur = None  # [tag, start, end, score_sum, count]

    def close():
        if cur:
            tag, s, e, tot, n = cur
            sc = tot / n
            if tag not in found or sc > found[tag][0]:
                found[tag] = (sc, s, e)

    for k, ((s, e), lid) in enumerate(zip(offsets, label_ids)):
        if s == e:
            continue
        lab = LABELS[lid]
        sc = scores[k] if scores is not None else 1.0
        if lab == "O":
            close()
            cur = None
            continue
        prefix, tag = lab.split("-", 1)
        if cur and cur[0] == tag and (prefix == "I" or text[cur[2]:s].strip() == ""):
            if prefix == "B" and text[cur[2]:s] != "":  # a new B after a space = new fact
                close()
                cur = [tag, s, e, sc, 1]
            else:
                cur[2], cur[3], cur[4] = e, cur[3] + sc, cur[4] + 1
        else:
            close()
            cur = [tag, s, e, sc, 1]
    close()
    return {tag: (s, e) for tag, (_, s, e) in found.items()}


def decode(text, offsets, label_ids, scores=None):
    """Like decode_spans, but returns {TAG: text}."""
    out = {}
    for tag, (s, e) in decode_spans(text, offsets, label_ids, scores).items():
        v = text[s:e].strip(TRIM)
        if v:
            out[tag] = v
    return out


PREFIXES = "ለበከየ"


def _ethiopic_or_digit(ch):
    return ch.isdigit() or "\u1200" <= ch <= "\u137f"


def split_prefixes(text):
    """Show the model Amharic prefixes as separate pieces: "ለአስቴር" -> "ለ አስቴር".

    Returns (model_text, n2o) where n2o[i] is the original index of model_text[i]
    (None for an inserted space). Names like "ከበደ" become "ከ በደ"; the model learns
    that both pieces belong to the name, and decoding maps back to "ከበደ".
    """
    out, n2o = [], []
    for i, ch in enumerate(text):
        out.append(ch)
        n2o.append(i)
        word_start = i == 0 or text[i - 1] in " \t/፡።፣,(-"
        if word_start and ch in PREFIXES and i + 1 < len(text) and _ethiopic_or_digit(text[i + 1]):
            out.append(" ")
            n2o.append(None)
    return "".join(out), n2o


def map_spans(spans, n2o):
    """Original-text spans -> model-text spans."""
    o2n = {o: n for n, o in enumerate(n2o) if o is not None}
    return [(o2n[s], o2n[e - 1] + 1, tag) for s, e, tag in spans]


def decode_original(text, model_text, n2o, offsets, label_ids, scores=None):
    """Decode on the model text, return facts as substrings of the ORIGINAL text."""
    facts = {}
    for tag, (s, e) in decode_spans(model_text, offsets, label_ids, scores).items():
        idx = [n2o[k] for k in range(s, e) if n2o[k] is not None]
        if idx:
            facts[tag] = text[idx[0]:idx[-1] + 1].strip(TRIM)
    return facts


def to_gold(ex):
    """Generated example -> the scorer's format."""
    facts = {}
    for s, e, tag in ex["spans"]:
        facts.setdefault(tag, ex["text"][s:e])
    return {"text": ex["text"], "intent": ex["intent"], "facts": facts}
