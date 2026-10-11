"""Read-only provider checks. Never print credentials or provider response bodies."""
from pathlib import Path
from urllib.parse import urlparse
import json
import sys
import urllib.error
import urllib.request

root = Path(__file__).resolve().parents[1]
values = {}
for line in (root / '.env').read_text().splitlines():
    if line.strip() and not line.lstrip().startswith('#') and '=' in line:
        key, value = line.split('=', 1)
        values[key.strip()] = value.strip().strip('"\'')

url = values.get('SUPABASE_URL', '')
parsed = urlparse(url)
if parsed.scheme != 'https' or not parsed.hostname or '](' in url:
    sys.exit('Root .env: SUPABASE_URL must be a plain absolute HTTPS URL, not a Markdown link.')
print('Configuration source: root .env (local test overrides intentionally excluded)')
checks = [
    ('TMDB', 'https://api.themoviedb.org/3/movie/550',
     {'Authorization': 'Bearer ' + values.get('TMDB_READ_ACCESS_TOKEN', '')}),
    ('Supabase Auth', url.rstrip('/') + '/auth/v1/settings',
     {'apikey': values.get('SUPABASE_PUBLISHABLE_KEY', '')}),
]
failed = False
for label, endpoint, headers in checks:
    try:
        request = urllib.request.Request(endpoint, headers=headers)
        with urllib.request.urlopen(request, timeout=20) as response:
            data = json.load(response)
            print(f'{label}: HTTP {response.status}')
            if label == 'Supabase Auth':
                print('Google provider enabled: ' + str(data.get('external', {}).get('google', False)))
    except urllib.error.HTTPError as error:
        failed = True
        print(f'{label}: HTTP {error.code}')
    except Exception as error:
        failed = True
        print(f'{label}: connection failed ({type(error).__name__})')
sys.exit(1 if failed else 0)
