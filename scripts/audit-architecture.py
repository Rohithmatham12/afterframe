"""Verify local implementation claims against exact source spans and content hashes."""
from pathlib import Path
import hashlib,json,subprocess
root=Path(__file__).resolve().parents[1]
claims=[
 ('Static frontend delegates to generated API client','frontend/lib/api.ts','createClient<paths>',12),
 ('Go routes own authentication and authorization','backend/internal/httpapi/api.go','a.Verify(',18),
 ('Auth validates bearer tokens with authoritative provider','backend/internal/auth/auth.go','func (v *Verifier) Verify',42),
 ('Every service transaction sets viewer and database role','backend/internal/service/service.go','func (s *Service) Transaction',27),
 ('Atomic film logging appends opinions and memories','backend/internal/service/service.go','func saveViewing',70),
 ('TMDB requests carry server credentials only','backend/internal/catalog/catalog.go','func (c *Client) get',25),
 ('Memory search is owner-scoped PostgreSQL FTS and fuzzy matching','backend/queries/app.sql','-- name: SearchMemories',9),
 ('Timeline comparison belongs to Go','backend/internal/taste/insights.go','func Compare',60),
 ('Forbidden spoiler fields are removed before serialization','backend/internal/spoilers/policy.go','func Disclose',14),
 ('Review and feed reads invoke the same disclosure policy','backend/internal/service/service.go','case "reviews", "feed":',20),
 ('Social writes execute within the owner transaction','backend/internal/service/service.go','case "follow":',45),
 ('Account erasure commits private deletion and durable tombstone','backend/internal/service/account.go','func (s *Service) EraseAccount',14),
 ('Auth erasure retries are bounded and durable','backend/internal/service/account.go','func (s *Service) RetryErasures',23),
 ('Database uses RLS and role-scoped permissions','backend/migrations/000002_security.up.sql','DO $$',18),
 ('Deployment configuration targets Render Free without auto deploy','render.yaml','plan: free',7),
 ('GitHub workflow builds a static Pages artifact without deploying','.github/workflows/pages.yml','name: Prepare',35),
]
result=[]
for claim,path,needle,count in claims:
 p=root/path;text=p.read_text();lines=text.splitlines();matches=[i for i,l in enumerate(lines) if needle in l]
 if not matches:raise SystemExit('Missing evidence anchor: '+path+' '+needle)
 start=matches[0];result.append({'claim':claim,'path':path,'start_line':start+1,'end_line':min(start+count,len(lines)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
status=subprocess.check_output(['git','status','--porcelain'],cwd=root,text=True)
record={'revision':revision,'snapshot':'working tree' if status else 'committed','scope':'Source trace audit; not a remote-backed Archify provenance receipt','claims':result}
(root/'docs/architecture/source-audit.json').write_text(json.dumps(record,indent=2)+'\n')
md='# Local source audit\n\nSnapshot: '+record['snapshot']+'; base commit '+revision+'. SHA-256 hashes pin the inspected bytes. Remote-backed Archify provenance remains unavailable because no remote repository exists.\n\n'
for r in result:md+=f"- {r['claim']}: `{r['path']}:{r['start_line']}`–`{r['end_line']}`.\n"
(root/'docs/architecture/SOURCE_AUDIT.md').write_text(md)
print('Verified',len(result),'implementation source anchors with hashes')
