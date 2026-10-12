import json
from pathlib import Path
S=lambda **p:{'type':'object','properties':p,'required':list(p),'additionalProperties':False}
s={'type':'string'};i={'type':'integer'};b={'type':'boolean'};n={'type':'number','nullable':True};arr=lambda x:{'type':'array','items':x};ref=lambda x:{'$ref':'#/components/schemas/'+x}
tmdbReview=S(author=s,content=s,rating=n,url=s)
film=S(cast_members=arr(S(name=s,role=s)),crew=arr(S(name=s,role=s)),id=i,title=s,year=s,poster=s,backdrop=s,overview=s,genres=arr(s),director=s,runtime=i,certifications={'type':'object','additionalProperties':{'type':'string'}},vote_average={'type':'number'},vote_count=i,original_language=s,tmdb_reviews=arr(ref('TMDBReview')))
film['required']=[k for k in film['required'] if k not in ('certifications','vote_average','vote_count','original_language','tmdb_reviews')]
profile=S(id=s,username=s,name=s,bio=s,avatar=s,private=b,resurface=b,created_at=s,notify_availability=b,quiz_completed_at={'type':'string','nullable':True},family_policy=s,family_region=s)
view=S(id=s,user_id=s,film_id=i,watched_on=s,rating=n,notes=s,rewatch=b,visibility=s,request_id=s,created_at=s,film=ref('Film'),feelings=arr(s),context=s)
mem=S(id=s,user_id=s,viewing_id=s,scene=s,emotion=s,context=s,updated_at=s,film=ref('Film'),watched_on=s,explanation=s)
opinion=S(id=s,user_id=s,film_id=i,viewing_id={'type':'string','nullable':True},rating=n,reflection=s,kind=s,created_at=s,film=ref('Film'))
review=S(id=s,user_id=s,film_id=i,safe=s,watched=s,reflection=s,created_at=s,updated_at=s,film=ref('Film'),username=s,likes=i,liked=b,allowed_layer=i,tone=s)
review['required'].remove('watched');review['required'].remove('reflection')
li=S(likes=i,liked=b,id=s,user_id=s,title=s,description=s,private=b,ranked=b,created_at=s,username=s,items=arr(ref('Film')))
watch=S(user_id=s,film_id=i,private=b,created_at=s,film=ref('Film'),intent=s,intent_note=s)
notification=S(id=s,user_id=s,actor_id=s,kind=s,object_id=s,read=b,created_at=s,username=s)
comment=S(id=s,user_id=s,review_id=s,body=s,layer=i,created_at=s,username=s)
person={**profile,'properties':{**profile['properties'],'following':b,'followers':i,'films':i},'required':profile['required']+['following','followers','films']}
avail=S(available=b,username=s,reason=s,suggestions=arr(s));avail['required']=['available','username']
streaming=S(region=s,providers=arr(s),source=s,fetched_at=s,stale=b)
alert=S(id=s,user_id=s,film_id=i,region=s,provider=s,change=s,read=b,created_at=s,film=ref('Film'))
quizAnswer=S(film_id=i,response=s)
quizItem=S(user_id=s,film_id=i,response=s,created_at=s,film=ref('Film'))
quizStatus=S(completed_at={'type':'string','nullable':True},responses=arr(ref('QuizResponseItem')))
genreAffinity=S(genre=s,score=i,liked=i,disliked=i)
tasteMap=S(genres=arr(ref('GenreAffinity')),liked=i,disliked=i,unseen=i,confidence=s)
guestPrefs=S(liked_genres=arr(s),disliked_genres=arr(s));guestPrefs['required']=[]
tonightReq=S(max_minutes=i,mood=s,context=s,guest=ref('GuestPreferences'),partner=s);tonightReq['required']=[]
tonightPick=S(film=ref('Film'),reasons=arr(s))
tonightResult=S(picks=arr(ref('TonightPick')),candidates_considered=i,message=s)
tasteShare=S(id=s,requester_id=s,partner_id=s,status=s,created_at=s,responded_at={'type':'string','nullable':True},username=s,direction=s)
tasteShareReq=S(username=s)
tasteShareResp=S(id=s,accept=b)
compatibility=S(overall={'type':'integer','nullable':True},sample_size=i,shared=arr(s),differing=arr(s))
importEntry=S(title=s,year=s,watched_on=s,rating=n,rewatch=b);importEntry['required']=['title','watched_on']
importSkip=S(title=s,reason=s)
importResult=S(imported=i,skipped=arr(ref('ImportSkip')))
progress=S(id=s,user_id=s,film_id=i,status=s,progress_minutes={'type':'integer','nullable':True},reason=s,created_at=s,updated_at=s,film=ref('Film'))
craftNote=S(id=s,user_id=s,film_id=i,viewing_id={'type':'string','nullable':True},category=s,scene=s,body=s,spoiler=b,private=b,created_at=s,updated_at=s,username=s,allowed_spoiler=b,film=ref('Film'))
craftNote['required']=[k for k in craftNote['required'] if k not in ('username','allowed_spoiler','film')]
plan=S(id=s,film_id=i,creator_id=s,note=s,status=s,decided_slot_id={'type':'string','nullable':True},created_at=s,updated_at=s,film=ref('Film'))
plan['required'].remove('film')
planSlot=S(id=s,plan_id=s,label=s,created_at=s,votes=i,voted=b)
planSlot['required']=[k for k in planSlot['required'] if k not in ('votes','voted')]
planParticipant=S(plan_id=s,user_id=s,status=s,created_at=s,username=s)
planDetail=S(plan=ref('TheatricalPlan'),slots=arr(ref('PlanSlot')),participants=arr(ref('PlanParticipant')))
tribe=S(id=s,label=s,kind=s,joined=b)
rating=S(score=n,sample_size=i,source=s)
filmRatings=S(**{'global':ref('Rating')},tribe=ref('Rating'))
filmRatings['required']=['global']
setTribeReq=S(tribe=s,enabled=b)
createPlanReq=S(film_id=i,note=s);createPlanReq['required']=['film_id']
planSlotReq=S(label=s)
planInviteReq=S(username=s)
planRespondReq=S(accept=b)
planVoteReq=S(slot_id=s,on=b)
planDecideReq=S(slot_id=s,cancel=b);planDecideReq['required']=[]
fields='id watched_on notes request_id viewing_id scene emotion context reflection kind safe watched body title description username name bio target_id subject reason intent intent_note viewing_context tone status category family_policy family_region visibility'.split()
inp=S(**{k:s for k in fields},film_id=i,rating=n,layer=i,rewatch=b,private=b,ranked=b,resurface=b,notify_availability=b,enabled=b,film_ids=arr(i),feelings=arr(s),progress_minutes=i,spoiler=b);inp['required']=[]
schemas={'Film':film,'Profile':profile,'Viewing':view,'Memory':mem,'Opinion':opinion,'Review':review,'List':li,'Watch':watch,'Notification':notification,'Comment':comment,'Person':person,'Comparison':S(film_id=i,film=ref('Film'),then=ref('Opinion'),now=ref('Opinion'),change=n,count=i),'FilmState':S(watched=b,viewings=i,rating=n,watchlisted=b),'ProfileDetails':S(**profile['properties'],followers=i,following=i,viewings=i,diary=arr(ref('Viewing'))),'Mutation':inp,'Error':S(error=s),'Availability':avail,'StreamingAvailability':streaming,'AvailabilityAlert':alert,'QuizAnswer':quizAnswer,'QuizResponseItem':quizItem,'QuizStatus':quizStatus,'GenreAffinity':genreAffinity,'TasteMap':tasteMap,'GuestPreferences':guestPrefs,'TonightRequest':tonightReq,'TonightPick':tonightPick,'TonightResult':tonightResult,'TasteShare':tasteShare,'TasteShareRequest':tasteShareReq,'TasteShareRespond':tasteShareResp,'Compatibility':compatibility,'ImportEntry':importEntry,'ImportSkip':importSkip,'ImportResult':importResult,'Progress':progress,'CraftNote':craftNote,'TheatricalPlan':plan,'PlanSlot':planSlot,'PlanParticipant':planParticipant,'PlanDetail':planDetail,'CreatePlanRequest':createPlanReq,'PlanSlotRequest':planSlotReq,'PlanInviteRequest':planInviteReq,'PlanRespondRequest':planRespondReq,'PlanVoteRequest':planVoteReq,'PlanDecideRequest':planDecideReq,'Tribe':tribe,'Rating':rating,'FilmRatings':filmRatings,'SetTribeRequest':setTribeReq,'TMDBReview':tmdbReview}
paths={}
def response(schema):return {'200':{'description':'Success','content':{'application/json':{'schema':schema}}},**{str(x):{'description':'Request failed','content':{'application/json':{'schema':ref('Error')}}} for x in [400,401,404,409,429,500,502]}}
gettypes={'profile':ref('ProfileDetails'),'followers':arr(ref('Profile')),'following':arr(ref('Profile')),'film-state':ref('FilmState'),'insights':arr(ref('Comparison')),'me':ref('Profile'),'diary':arr(ref('Viewing')),'timeline':arr(ref('Opinion')),'memories':arr(ref('Memory')),'resurface':arr(ref('Memory')),'watchlist':arr(ref('Watch')),'lists':arr(ref('List')),'people':arr(ref('Person')),'notifications':arr(ref('Notification')),'reviews':arr(ref('Review')),'feed':arr(ref('Review')),'films':arr(ref('Film')),'availability-alerts':arr(ref('AvailabilityAlert')),'quiz-films':arr(ref('Film')),'quiz':ref('QuizStatus'),'taste-map':ref('TasteMap'),'taste-shares':arr(ref('TasteShare')),'muted':arr(ref('Profile')),'progress':arr(ref('Progress')),'craft':arr(ref('CraftNote'))}
for area,t in gettypes.items():
 params=[{'name':x,'in':'query','schema':s} for x in ['id','q','emotion','from','to','month','section','user_id']]+[{'name':x,'in':'query','schema':i} for x in ['film_id','offset','page']]+[{'name':'mine','in':'query','schema':b}]
 paths['/v1/'+area]={'get':{'operationId':'get_'+area,'parameters':params,'responses':response(t),'security':[] if area=='films' else [{'bearer':[]}]}}
for area in ['me','diary','timeline','memories','reviews','reveal','watchlist','lists','follow','block','mute','list-like','like','comments','notifications','report','availability-alerts','progress','craft']:
 paths.setdefault('/v1/'+area,{})['post']={'operationId':'save_'+area,'requestBody':{'required':True,'content':{'application/json':{'schema':ref('Mutation')}}},'responses':response({'type':'object','additionalProperties':True,'nullable':True}),'security':[{'bearer':[]}]}
for area in ['diary','memories','reviews','lists','craft']:
 paths['/v1/'+area+'/{id}']={'delete':{'operationId':'delete_'+area,'parameters':[{'name':'id','in':'path','required':True,'schema':s}],'responses':response({'type':'object','additionalProperties':True}),'security':[{'bearer':[]}]}}
for area,t in [('films',ref('Film')),('comments',arr(ref('Comment')))]:
 paths['/v1/'+area+'/{id}']={'get':{'operationId':'get_'+area+'_id','parameters':[{'name':'id','in':'path','required':True,'schema':s}],'responses':response(t),'security':[] if area=='films' else [{'bearer':[]}]}}
paths['/v1/taste-share']={'post':{'operationId':'request_taste_share','requestBody':{'required':True,'content':{'application/json':{'schema':ref('TasteShareRequest')}}},'responses':response(ref('TasteShare')),'security':[{'bearer':[]}]}}
paths['/v1/taste-share-respond']={'post':{'operationId':'respond_taste_share','requestBody':{'required':True,'content':{'application/json':{'schema':ref('TasteShareRespond')}}},'responses':response(ref('TasteShare')),'security':[{'bearer':[]}]}}
paths['/v1/tonight']={'post':{'operationId':'tonight','requestBody':{'required':True,'content':{'application/json':{'schema':ref('TonightRequest')}}},'responses':response(ref('TonightResult')),'security':[{'bearer':[]}]}}
paths['/v1/quiz']['post']={'operationId':'save_quiz','requestBody':{'required':True,'content':{'application/json':{'schema':arr(ref('QuizAnswer'))}}},'responses':response(ref('Profile')),'security':[{'bearer':[]}]}
paths['/v1/import/letterboxd']={'post':{'operationId':'import_letterboxd','requestBody':{'required':True,'content':{'application/json':{'schema':arr(ref('ImportEntry'))}}},'responses':response(ref('ImportResult')),'security':[{'bearer':[]}]}}
paths['/v1/compatibility']={'get':{'operationId':'get_compatibility','parameters':[{'name':'partner','in':'query','required':True,'schema':s}],'responses':response(ref('Compatibility')),'security':[{'bearer':[]}]}}
paths['/v1/availability']={'get':{'operationId':'get_availability','parameters':[{'name':'film_id','in':'query','required':True,'schema':i},{'name':'region','in':'query','schema':s}],'responses':response(ref('StreamingAvailability')),'security':[{'bearer':[]}]}}
paths['/v1/username-available']={'get':{'operationId':'check_username','parameters':[{'name':'u','in':'query','required':True,'schema':s}],'responses':response(ref('Availability')),'security':[{'bearer':[]}]}}
paths['/v1/theatrical-plans']={
 'get':{'operationId':'list_plans','responses':response(arr(ref('TheatricalPlan'))),'security':[{'bearer':[]}]},
 'post':{'operationId':'create_plan','requestBody':{'required':True,'content':{'application/json':{'schema':ref('CreatePlanRequest')}}},'responses':response(ref('TheatricalPlan')),'security':[{'bearer':[]}]},
}
paths['/v1/theatrical-plans/{id}']={'get':{'operationId':'get_plan','parameters':[{'name':'id','in':'path','required':True,'schema':s}],'responses':response(ref('PlanDetail')),'security':[{'bearer':[]}]}}
paths['/v1/theatrical-plans/{id}/slots']={'post':{'operationId':'add_plan_slot','parameters':[{'name':'id','in':'path','required':True,'schema':s}],'requestBody':{'required':True,'content':{'application/json':{'schema':ref('PlanSlotRequest')}}},'responses':response(ref('PlanSlot')),'security':[{'bearer':[]}]}}
paths['/v1/theatrical-plans/{id}/invite']={'post':{'operationId':'invite_plan_participant','parameters':[{'name':'id','in':'path','required':True,'schema':s}],'requestBody':{'required':True,'content':{'application/json':{'schema':ref('PlanInviteRequest')}}},'responses':response(ref('PlanParticipant')),'security':[{'bearer':[]}]}}
paths['/v1/theatrical-plans/{id}/respond']={'post':{'operationId':'respond_plan_invite','parameters':[{'name':'id','in':'path','required':True,'schema':s}],'requestBody':{'required':True,'content':{'application/json':{'schema':ref('PlanRespondRequest')}}},'responses':response(ref('PlanParticipant')),'security':[{'bearer':[]}]}}
paths['/v1/theatrical-plans/{id}/vote']={'post':{'operationId':'vote_plan_slot','parameters':[{'name':'id','in':'path','required':True,'schema':s}],'requestBody':{'required':True,'content':{'application/json':{'schema':ref('PlanVoteRequest')}}},'responses':response({'type':'object','nullable':True}),'security':[{'bearer':[]}]}}
paths['/v1/theatrical-plans/{id}/decide']={'post':{'operationId':'decide_plan','parameters':[{'name':'id','in':'path','required':True,'schema':s}],'requestBody':{'required':True,'content':{'application/json':{'schema':ref('PlanDecideRequest')}}},'responses':response(ref('TheatricalPlan')),'security':[{'bearer':[]}]}}
paths['/v1/tribes']={
 'get':{'operationId':'list_tribes','responses':response(arr(ref('Tribe'))),'security':[{'bearer':[]}]},
 'post':{'operationId':'set_tribe','requestBody':{'required':True,'content':{'application/json':{'schema':ref('SetTribeRequest')}}},'responses':response({'type':'object','nullable':True}),'security':[{'bearer':[]}]},
}
paths['/v1/film-ratings']={'get':{'operationId':'get_film_ratings','parameters':[{'name':'film_id','in':'query','required':True,'schema':i},{'name':'tribe','in':'query','schema':s}],'responses':response(ref('FilmRatings')),'security':[{'bearer':[]}]}}
paths['/v1/avatar']={'post':{'operationId':'upload_avatar','security':[{'bearer':[]}],'requestBody':{'required':True,'content':{'application/octet-stream':{'schema':{'type':'string','format':'binary'}}}},'responses':response({'type':'object','nullable':True})}}
paths['/v1/account-delete']={'post':{'operationId':'delete_account','security':[{'bearer':[]}],'requestBody':{'required':True,'content':{'application/json':{'schema':S(confirmation=s)}}},'responses':response({'type':'object','nullable':True})}}
Path('api/openapi.json').write_text(json.dumps({'openapi':'3.0.3','info':{'title':'Afterframe Go API','version':'0.1.0'},'paths':paths,'components':{'schemas':schemas,'securitySchemes':{'bearer':{'type':'http','scheme':'bearer','bearerFormat':'JWT'}}}},indent=2)+'\n')
