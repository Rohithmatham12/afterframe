"""Isolated local build/API using hosted Auth. Never uses the hosted database."""
from pathlib import Path
from urllib.parse import urlsplit,urlunsplit
import os,shutil,subprocess,sys
root=Path(__file__).resolve().parents[1]
def values(path):
    out={}
    for line in path.read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k,v=line.split('=',1);out[k.strip()]=v.strip().strip('"\'')
    return out
hosted=values(root/'.env');local=values(root/'.env.local')
u=urlsplit(local['DATABASE_URL'])
if u.hostname!='127.0.0.1':raise SystemExit('Refusing non-loopback database')
env={**os.environ,**hosted,'DATABASE_URL':urlunsplit(u._replace(path='/afterframe_oauth_verification')),'AFTERFRAME_LOCAL':'0','AUTH_DIRECT':'false','PORT':'8081','API_ORIGINS':'http://127.0.0.1:3001,http://localhost:3001'}
mode=sys.argv[1]
if mode in ['api','migrate']:
    os.chdir(root/'backend');os.execvpe('/opt/homebrew/bin/go',['go','run','./cmd/'+mode],env)
if mode!='build':raise SystemExit('Use build, migrate, or api')
clone=root/'.local/oauth-frontend'
if clone.exists():shutil.rmtree(clone)
shutil.copytree(root/'frontend',clone,ignore=shutil.ignore_patterns('node_modules','.next','out','.env*','test-results','*.tsbuildinfo'))
(clone/'node_modules').symlink_to(root/'frontend/node_modules',target_is_directory=True)
p=clone/'next.config.ts';p.write_text(p.read_text().replace('root: process.cwd()', 'root: '+repr(str(root))))
env.update({'NEXT_PUBLIC_API_URL':'http://127.0.0.1:8081','NEXT_PUBLIC_SUPABASE_URL':hosted['SUPABASE_URL'],'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY':hosted['SUPABASE_PUBLISHABLE_KEY'],'NEXT_PUBLIC_AUTH_DIRECT':'false','NEXT_PUBLIC_BASE_PATH':''})
# Only public Next variables are embedded; server credentials are not passed to this build.
for key in hosted:
    if not key.startswith('NEXT_PUBLIC_'):env.pop(key,None)
env.pop('DATABASE_URL',None)
subprocess.run(['npm','run','build'],cwd=clone,env=env,check=True)
print('Hosted-Auth verification export ready; local application build untouched')
