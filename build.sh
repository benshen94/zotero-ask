#!/bin/sh
set -eu
cd "$(dirname "$0")"
mkdir -p dist
rm -f dist/zotero-ask-*.xpi
python3 - <<'PY'
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path.cwd()
version = json.loads((root / "manifest.json").read_text())["version"]
output = root / "dist" / f"zotero-ask-{version}.xpi"
files = ["manifest.json", "bootstrap.js", "core.js"]
with ZipFile(output, "w", ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(root / name, name)
print(output)
PY
