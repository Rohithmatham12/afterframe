from pathlib import Path
import urllib.request, urllib.error, json
v={}
for line in Path('.env').read_text().splitlines():
 if line.strip() and not line.lstrip().startswith('#') and '=' in line:
  k,val=line.split('=',1); v[k.strip()]=val.strip().strip('\"\'')
checks=[('TMDB','https://api.themoviedb.org/3/movie/550',{'Authorization':'Bearer '+v['TMDB_READ_ACCESS_TOKEN']}),('Supabase Auth',v['SUPABASE_URL'].rstrip('/')+'/auth/v1/settings',{'apikey':v['SUPABASE_PUBLISHABLE_KEY']})]
for label,url,headers in checks:
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=20) as r:
   data=json.load(r); print(label+': HTTP '+str(r.status))
   if label=='Supabase Auth': print('Google provider enabled: '+str(data.get('external',{}).get('google',False)))
 except urllib.error.HTTPError as e: print(label+': HTTP '+str(e.code))
 except Exception as e: print(label+': connection failed ('+type(e).__name__+')')
