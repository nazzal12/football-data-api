from collections import Counter
from pathlib import Path
import json

p = Path("backups/kv-export/football-kv-20260810-211303.jsonl")
c = Counter()
n = 0
idmap_slug = Path("backups/kv-export/football-kv-idmap-slug-partial.jsonl")
kept = 0
with p.open(encoding="utf-8") as src, idmap_slug.open("w", encoding="utf-8") as dst:
    for line in src:
        if not line.strip():
            continue
        row = json.loads(line)
        k = row["key"]
        pref = k.split(":", 1)[0] + ":" if ":" in k else "?"
        c[pref] += 1
        n += 1
        if pref in ("idmap:", "slug:"):
            dst.write(line if line.endswith("\n") else line + "\n")
            kept += 1
print("total", n)
print(dict(c))
print("kept idmap+slug", kept, "->", idmap_slug)
