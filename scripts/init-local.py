from pathlib import Path
import secrets,os
p=Path('.env.local')
if not p.exists():
 password=secrets.token_hex(24)
 body=f'LOCAL_DB_PASSWORD={password}\nLOCAL_JWT_SECRET={secrets.token_hex(32)}\nDATABASE_URL=postgres://postgres:{password}@127.0.0.1:55432/afterframe?sslmode=disable\nSUPABASE_URL=http://127.0.0.1:54321\nSUPABASE_PUBLISHABLE_KEY=local-auth-only\nAUTH_DIRECT=true\nAPI_ORIGINS=http://localhost:3000,http://127.0.0.1:3000\nPORT=8080\n'
 fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:f.write(body)
 print('Local-only credentials generated; cloud values unchanged.')
