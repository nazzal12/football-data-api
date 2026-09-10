"""Export only slug: KV keys and import into VPS Redis (append)."""
from __future__ import annotations

import time
from pathlib import Path

from cf_kv_export_import import PREFIXES, export_jsonl, import_on_vps, load_token

# monkey-patch prefixes for this run
import cf_kv_export_import as m

m.PREFIXES = ["slug:"]

token = load_token()
out = Path("backups/kv-export") / f"football-kv-slug-{time.strftime('%Y%m%d-%H%M%S')}.jsonl"
n = export_jsonl(token, out)
print(f"exported {n} -> {out}", flush=True)
if n:
    import_on_vps(out)
else:
    print("no slug keys", flush=True)
print("SLUG_IMPORT_DONE", flush=True)
