from pathlib import Path
import os
v={}
for file in ['.env','.env.local']:
 for l in Path(file).read_text().splitlines():
  if '=' in l and not l.startswith('#'):
   k,val=l.split('=',1);v[k]=val.strip().strip('\"\'')
p=Path('frontend/.env.local')
fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
with os.fdopen(fd,'w') as f:
 for name,value in {'NEXT_PUBLIC_API_URL':'http://127.0.0.1:8080','NEXT_PUBLIC_SUPABASE_URL':v['SUPABASE_URL'],'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY':v['SUPABASE_PUBLISHABLE_KEY'],'NEXT_PUBLIC_AUTH_DIRECT':'true'}.items():f.write(name+'='+value+'\n')
print('Local frontend public configuration written; server secrets excluded.')
