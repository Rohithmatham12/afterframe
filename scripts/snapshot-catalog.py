"""Cache public discovery data from the real Go API for the static HTML shell."""
from pathlib import Path
import json, urllib.request
root=Path(__file__).resolve().parents[1]
with urllib.request.urlopen('http://127.0.0.1:8080/v1/films',timeout=20) as r:
    films=json.load(r)
if not isinstance(films,list) or not films:
    raise SystemExit('No catalog data; existing snapshot retained')
(root/'frontend/lib/catalog-snapshot.json').write_text(json.dumps(films,ensure_ascii=False)+'\n')
print('Saved public Go API discovery snapshot; runtime revalidates with Go')
