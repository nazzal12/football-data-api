"""Import an existing KV JSONL into football-api-redis on the VPS."""
from __future__ import annotations

import sys
from pathlib import Path

# reuse helpers
sys.path.insert(0, str(Path(__file__).resolve().parent))
from cf_kv_export_import import import_on_vps  # noqa: E402

path = Path(sys.argv[1] if len(sys.argv) > 1 else "backups/kv-export/football-kv-idmap-slug-partial.jsonl")
if not path.exists():
    raise SystemExit(f"missing {path}")
import_on_vps(path)
print("KV_IMPORT_DONE")
