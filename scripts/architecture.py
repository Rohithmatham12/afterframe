from pathlib import Path
import subprocess,json
revision=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
base={'schema_version':1,'diagram_type':'architecture'}
def source(path):return [{'path':path,'line':1}]
def node(id,typ,label,sub,pos,path):return {'id':id,'type':typ,'label':label,'sublabel':sub,'pos':pos,'size':[190,70],'sources':source(path)}
def edge(a,b,label):return {'id':a+'-'+b,'from':a,'to':b,'label':label}
def save(slug,title,nodes,edges,boundaries=[]):
 d={**base,'meta':{'title':title,'output':'docs/architecture/'+slug+'.html','quality_profile':'showcase','repository':{'url':str(Path.cwd()),'revision':revision,'link_mode':'local-only'}},'components':nodes,'connections':edges,'boundaries':boundaries}
 Path('docs/architecture/'+slug+'.json').write_text(json.dumps(d,indent=2)+'\n')
save('overview','Afterframe — runtime and trust boundaries',[
 node('browser','frontend','Next.js PWA','Static React / TypeScript',[40,290],'frontend/components/cinema.tsx'),
 node('api','backend','Go API','Chi / authorization / services',[400,290],'backend/internal/httpapi/api.go'),
 node('database','database','PostgreSQL','sqlc / pgx / RLS / transactions',[760,290],'backend/internal/service/service.go'),
 node('auth','security','Supabase Auth','Access token validation',[400,70],'backend/internal/auth/auth.go'),
 node('tmdb','external','TMDB','Backend-only read token',[400,510],'backend/internal/catalog/catalog.go'),
],[edge('browser','api','Bearer + JSON'),edge('api','database','SQL transactions'),edge('api','auth','Validate token'),edge('api','tmdb','Movie data')],[{'kind':'security-group','label':'Server trust boundary','wraps':['api']},{'kind':'region','label':'Private persistence','wraps':['database']}])
flows={
'authentication':('Authentication and authorization',[('client','frontend','Browser session','Supabase email / Google','frontend/lib/auth.ts'),('verify','security','Go validation','Authoritative Auth /user','backend/internal/auth/auth.go'),('policy','security','Owner context','Transaction-local role','backend/internal/service/service.go'),('records','database','RLS records','Private rows stay private','backend/migrations/000002_security.up.sql')],['Bearer token','Verified user UUID','SQL policies']),
'logging':('Atomic film logging and diary',[('form','frontend','Log form','Optional memory capture','frontend/components/forms.tsx'),('validate','backend','Go validation','Date / half-star / request ID','backend/internal/service/service.go'),('atomic','backend','Save viewing','Append opinion + memory','backend/internal/service/service.go'),('store','database','PostgreSQL commit','Remove watchlist atomically','backend/queries/app.sql')],['Typed request','Owner transaction','Commit or rollback']),
'memory':('Memory Vault — private non-AI recall',[('capture','frontend','Memory anchors','Scene / feeling / context','frontend/components/forms.tsx'),('search','backend','Go recall service','Explicit date phrase parsing','backend/internal/memory/query.go'),('index','database','PostgreSQL search','FTS + pg_trgm + owner scope','backend/queries/app.sql'),('result','frontend','Traceable results','Original text and explanation','frontend/components/library.tsx')],['Private inputs','Scoped query','Matching records']),
 'taste':('Taste Timeline — opinions without rewatches',[('reflection','frontend','New reflection','No new viewing required','frontend/components/forms.tsx'),('events','backend','Go opinion service','Append or explicit correction','backend/internal/service/service.go'),('history','database','Opinion events','History retained on log delete','backend/migrations/000001_init.up.sql'),('compare','backend','Go comparisons','Then / now / change','backend/internal/taste/insights.go')],['New opinion','Append-only writes','History observations']),
'spoilers':('Spoiler-safe review response',[('request','frontend','Reader request','Film detail or following feed','frontend/components/reviews.tsx'),('viewer','database','Viewer state','Watched + explicit reveals','backend/queries/app.sql'),('policy','security','Go disclosure policy','Remove forbidden fields','backend/internal/spoilers/policy.go'),('safe','frontend','Permitted layers only','No hidden plot in DOM','frontend/components/reviews.tsx')],['Go-authenticated read','Allowed layer','Filtered JSON']),
'social':('Social graph and notification flow',[('action','frontend','Follow / like / comment','Explicit user action','frontend/components/reviews.tsx'),('service','backend','Go social service','Ownership / blocks / visibility','backend/internal/service/service.go'),('graph','database','Graph and events','Atomic notification writes','backend/queries/app.sql'),('feed','frontend','Following feed','Spoiler-filtered responses','frontend/components/cinema.tsx')],['Typed mutation','Transaction','Safe reads']),
'erasure':('Account erasure with durable retry',[('confirm','frontend','Explicit confirmation','Type DELETE','frontend/components/account.tsx'),('erase','backend','Go erasure service','Delete private data atomically','backend/internal/service/account.go'),('outbox','database','Deletion tombstone','Prevent profile recreation','backend/migrations/000004_erasure_retry.up.sql'),('provider','external','Supabase admin API','Bounded one-minute retries','backend/internal/auth/admin.go')],['Authenticated request','Commit deletion','Retry until erased']),
}
for slug,(title,items,labels) in flows.items():
 nodes=[node(id,t,l,sub,[40+(i%2)*380,70+(i//2)*230],path) for i,(id,t,l,sub,path) in enumerate(items)]
 # Snake path keeps connected neighbors adjacent without crossing nodes.
 nodes[2]['pos']=[420,300];nodes[3]['pos']=[40,300]
 edges=[edge(items[i][0],items[i+1][0],labels[i]) for i in range(3)]
 save(slug,title,nodes,edges)
print('Wrote eight repository-backed typed diagram sources at '+revision)
