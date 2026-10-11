import json
from pathlib import Path
S=lambda **p:{'type':'object','properties':p,'required':list(p),'additionalProperties':False}
s={'type':'string'};i={'type':'integer'};b={'type':'boolean'};n={'type':'number','nullable':True};arr=lambda x:{'type':'array','items':x};ref=lambda x:{'$ref':'#/components/schemas/'+x}
film=S(cast_members=arr(S(name=s,role=s)),crew=arr(S(name=s,role=s)),id=i,title=s,year=s,poster=s,backdrop=s,overview=s,genres=arr(s),director=s,runtime=i)
profile=S(id=s,username=s,name=s,bio=s,avatar=s,private=b,resurface=b,created_at=s)
view=S(id=s,user_id=s,film_id=i,watched_on=s,rating=n,notes=s,rewatch=b,private=b,request_id=s,created_at=s,film=ref('Film'))
mem=S(id=s,user_id=s,viewing_id=s,scene=s,emotion=s,context=s,updated_at=s,film=ref('Film'),watched_on=s,explanation=s)
opinion=S(id=s,user_id=s,film_id=i,viewing_id={'type':'string','nullable':True},rating=n,reflection=s,kind=s,created_at=s,film=ref('Film'))
review=S(id=s,user_id=s,film_id=i,safe=s,watched=s,reflection=s,created_at=s,updated_at=s,film=ref('Film'),username=s,likes=i,liked=b,allowed_layer=i)
review['required'].remove('watched');review['required'].remove('reflection')
li=S(likes=i,liked=b,id=s,user_id=s,title=s,description=s,private=b,ranked=b,created_at=s,username=s,items=arr(ref('Film')))
watch=S(user_id=s,film_id=i,private=b,created_at=s,film=ref('Film'))
notification=S(id=s,user_id=s,actor_id=s,kind=s,object_id=s,read=b,created_at=s,username=s)
comment=S(id=s,user_id=s,review_id=s,body=s,layer=i,created_at=s,username=s)
person={**profile,'properties':{**profile['properties'],'following':b,'followers':i,'films':i},'required':profile['required']+['following','followers','films']}
fields='id watched_on notes request_id viewing_id scene emotion context reflection kind safe watched body title description username name bio target_id subject reason'.split()
inp=S(**{k:s for k in fields},film_id=i,rating=n,layer=i,rewatch=b,private=b,ranked=b,resurface=b,enabled=b,film_ids=arr(i));inp['required']=[]
schemas={'Film':film,'Profile':profile,'Viewing':view,'Memory':mem,'Opinion':opinion,'Review':review,'List':li,'Watch':watch,'Notification':notification,'Comment':comment,'Person':person,'Comparison':S(film_id=i,film=ref('Film'),then=ref('Opinion'),now=ref('Opinion'),change=n,count=i),'FilmState':S(watched=b,viewings=i,rating=n,watchlisted=b),'ProfileDetails':S(**profile['properties'],followers=i,following=i,viewings=i,diary=arr(ref('Viewing'))),'Mutation':inp,'Error':S(error=s)}
paths={}
def response(schema):return {'200':{'description':'Success','content':{'application/json':{'schema':schema}}},**{str(x):{'description':'Request failed','content':{'application/json':{'schema':ref('Error')}}} for x in [400,401,404,409,429,500,502]}}
gettypes={'profile':ref('ProfileDetails'),'followers':arr(ref('Profile')),'following':arr(ref('Profile')),'film-state':ref('FilmState'),'insights':arr(ref('Comparison')),'me':ref('Profile'),'diary':arr(ref('Viewing')),'timeline':arr(ref('Opinion')),'memories':arr(ref('Memory')),'resurface':arr(ref('Memory')),'watchlist':arr(ref('Watch')),'lists':arr(ref('List')),'people':arr(ref('Person')),'notifications':arr(ref('Notification')),'reviews':arr(ref('Review')),'feed':arr(ref('Review')),'films':arr(ref('Film'))}
for area,t in gettypes.items():
 params=[{'name':x,'in':'query','schema':s} for x in ['id','q','emotion','from','to','month','section','user_id']]+[{'name':x,'in':'query','schema':i} for x in ['film_id','offset','page']]+[{'name':'mine','in':'query','schema':b}]
 paths['/v1/'+area]={'get':{'operationId':'get_'+area,'parameters':params,'responses':response(t),'security':[] if area=='films' else [{'bearer':[]}]}}
for area in ['me','diary','timeline','memories','reviews','reveal','watchlist','lists','follow','block','list-like','like','comments','notifications','report']:
 paths.setdefault('/v1/'+area,{})['post']={'operationId':'save_'+area,'requestBody':{'required':True,'content':{'application/json':{'schema':ref('Mutation')}}},'responses':response({'type':'object','additionalProperties':True,'nullable':True}),'security':[{'bearer':[]}]}
for area in ['diary','memories','reviews','lists']:
 paths['/v1/'+area+'/{id}']={'delete':{'operationId':'delete_'+area,'parameters':[{'name':'id','in':'path','required':True,'schema':s}],'responses':response({'type':'object','additionalProperties':True}),'security':[{'bearer':[]}]}}
for area,t in [('films',ref('Film')),('comments',arr(ref('Comment')))]:
 paths['/v1/'+area+'/{id}']={'get':{'operationId':'get_'+area+'_id','parameters':[{'name':'id','in':'path','required':True,'schema':s}],'responses':response(t),'security':[] if area=='films' else [{'bearer':[]}]}}
paths['/v1/avatar']={'post':{'operationId':'upload_avatar','security':[{'bearer':[]}],'requestBody':{'required':True,'content':{'application/octet-stream':{'schema':{'type':'string','format':'binary'}}}},'responses':response({'type':'object','nullable':True})}}
paths['/v1/account-delete']={'post':{'operationId':'delete_account','security':[{'bearer':[]}],'requestBody':{'required':True,'content':{'application/json':{'schema':S(confirmation=s)}}},'responses':response({'type':'object','nullable':True})}}
Path('api/openapi.json').write_text(json.dumps({'openapi':'3.0.3','info':{'title':'Afterframe Go API','version':'0.1.0'},'paths':paths,'components':{'schemas':schemas,'securitySchemes':{'bearer':{'type':'http','scheme':'bearer','bearerFormat':'JWT'}}}},indent=2)+'\n')
