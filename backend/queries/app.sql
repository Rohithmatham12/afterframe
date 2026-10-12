-- name: SetViewer :exec
SELECT set_config('app.user_id', $1::text, true);

-- name: EnsureProfile :one
INSERT INTO profiles(id,username) VALUES($1::uuid,$2::text) ON CONFLICT(id) DO UPDATE SET id=excluded.id RETURNING to_jsonb(profiles.*);

-- name: Me :one
SELECT to_jsonb(p.*) FROM profiles p WHERE id=viewer_id();

-- name: SaveProfile :one
UPDATE profiles SET username=sqlc.arg(data)::jsonb->>'username', name=sqlc.arg(data)::jsonb->>'name', bio=sqlc.arg(data)::jsonb->>'bio', private=(sqlc.arg(data)::jsonb->>'private')::boolean, resurface=(sqlc.arg(data)::jsonb->>'resurface')::boolean, notify_availability=(sqlc.arg(data)::jsonb->>'notify_availability')::boolean, family_policy=coalesce(sqlc.arg(data)::jsonb->>'family_policy',family_policy), family_region=coalesce(nullif(sqlc.arg(data)::jsonb->>'family_region',''),family_region) WHERE id=viewer_id() RETURNING to_jsonb(profiles.*);

-- name: UsernameTaken :one
SELECT username_taken($1::text);

-- name: SaveQuizResponses :exec
INSERT INTO taste_quiz_responses(user_id,film_id,response)
 SELECT viewer_id(), f, r FROM unnest($1::bigint[], $2::text[]) AS u(f,r)
 ON CONFLICT(user_id,film_id) DO UPDATE SET response=excluded.response,created_at=now();

-- name: MarkQuizCompleted :one
UPDATE profiles SET quiz_completed_at=now() WHERE id=viewer_id() RETURNING to_jsonb(profiles.*);

-- name: QuizResponses :one
SELECT coalesce(jsonb_agg(to_jsonb(t.*)||jsonb_build_object('film',film_card(f))),'[]'::jsonb) FROM taste_quiz_responses t JOIN films f ON f.id=t.film_id WHERE t.user_id=viewer_id();

-- name: WatchedFilmIDs :one
SELECT coalesce(jsonb_agg(DISTINCT film_id),'[]'::jsonb) FROM viewings WHERE user_id=viewer_id();

-- name: Mute :exec
INSERT INTO mutes(user_id,target_id) VALUES(viewer_id(),$1) ON CONFLICT DO NOTHING;

-- name: Unmute :exec
DELETE FROM mutes WHERE user_id=viewer_id() AND target_id=$1;

-- name: MutedProfiles :one
SELECT coalesce(jsonb_agg(to_jsonb(p.*) ORDER BY m.created_at DESC),'[]'::jsonb) FROM mutes m JOIN profiles p ON p.id=m.target_id WHERE m.user_id=viewer_id();

-- name: ProfileIDByUsername :one
SELECT id FROM profiles WHERE username=$1 AND profile_visible(id);

-- name: RequestTasteShare :one
INSERT INTO taste_shares(requester_id,partner_id) VALUES(viewer_id(),$1) RETURNING to_jsonb(taste_shares.*);

-- name: RespondTasteShare :one
UPDATE taste_shares SET status=$2,responded_at=now() WHERE id=$1 AND partner_id=viewer_id() AND status='pending' RETURNING to_jsonb(taste_shares.*);

-- name: TasteShares :one
SELECT coalesce(jsonb_agg(to_jsonb(ts.*)||jsonb_build_object(
 'username',CASE WHEN ts.requester_id=viewer_id() THEN partner.username ELSE requester.username END,
 'direction',CASE WHEN ts.requester_id=viewer_id() THEN 'sent' ELSE 'received' END
) ORDER BY ts.created_at DESC),'[]'::jsonb)
FROM taste_shares ts
JOIN profiles requester ON requester.id=ts.requester_id
JOIN profiles partner ON partner.id=ts.partner_id
WHERE ts.requester_id=viewer_id() OR ts.partner_id=viewer_id();

-- name: SharedTaste :one
SELECT shared_taste($1::uuid);

-- name: TasteShareAccepted :one
SELECT EXISTS(SELECT 1 FROM taste_shares WHERE status='accepted' AND ((requester_id=viewer_id() AND partner_id=$1) OR (requester_id=$1 AND partner_id=viewer_id())));

-- name: GetFilmAvailability :one
SELECT providers, source, fetched_at FROM film_availability WHERE film_id=$1 AND region=$2;

-- name: SetFilmAvailability :exec
INSERT INTO film_availability(film_id,region,providers,source,fetched_at) VALUES($1,$2,$3,$4,now())
 ON CONFLICT(film_id,region) DO UPDATE SET providers=excluded.providers,source=excluded.source,fetched_at=now();

-- name: NotifyAvailabilityChange :exec
INSERT INTO availability_alerts(user_id,film_id,region,provider,change)
 SELECT w.user_id,$1,$2,$3,$4 FROM watchlist w JOIN profiles p ON p.id=w.user_id WHERE w.film_id=$1 AND p.notify_availability;

-- name: AvailabilityAlerts :one
SELECT coalesce(jsonb_agg(to_jsonb(a.*)||jsonb_build_object('film',film_card(f)) ORDER BY a.created_at DESC),'[]'::jsonb) FROM (SELECT * FROM availability_alerts WHERE user_id=viewer_id() ORDER BY created_at DESC LIMIT 50) a JOIN films f ON f.id=a.film_id;

-- name: ReadAvailabilityAlerts :exec
UPDATE availability_alerts SET read=true WHERE user_id=viewer_id();

-- name: UpsertFilm :one
INSERT INTO films(id,title,year,poster,backdrop,overview,genres,director,runtime,cast_members,crew,certifications,vote_average,vote_count,original_language,tmdb_reviews) SELECT (d->>'id')::bigint,d->>'title',d->>'year',d->>'poster',d->>'backdrop',d->>'overview',ARRAY(SELECT jsonb_array_elements_text(d->'genres')),d->>'director',(d->>'runtime')::int,coalesce(nullif(d->'cast_members','null'::jsonb),'[]'::jsonb),coalesce(nullif(d->'crew','null'::jsonb),'[]'::jsonb),coalesce(nullif(d->'certifications','null'::jsonb),'{}'::jsonb),coalesce((d->>'vote_average')::numeric,0),coalesce((d->>'vote_count')::int,0),coalesce(d->>'original_language',''),coalesce(nullif(d->'tmdb_reviews','null'::jsonb),'[]'::jsonb) FROM (SELECT $1::jsonb d) x ON CONFLICT(id) DO UPDATE SET title=excluded.title,year=excluded.year,poster=excluded.poster,backdrop=excluded.backdrop,overview=excluded.overview,genres=excluded.genres,director=excluded.director,runtime=excluded.runtime,cast_members=excluded.cast_members,crew=excluded.crew,certifications=excluded.certifications,vote_average=excluded.vote_average,vote_count=excluded.vote_count,original_language=excluded.original_language,tmdb_reviews=excluded.tmdb_reviews,cached_at=now() RETURNING to_jsonb(films.*);

-- name: Film :one
SELECT to_jsonb(f.*) FROM films f WHERE id=$1 AND cached_at>now()-interval '1 day';

-- name: AddViewing :one
INSERT INTO viewings(user_id,film_id,watched_on,rating,notes,rewatch,private,request_id,context) SELECT viewer_id(),(d->>'film_id')::bigint,(d->>'watched_on')::date,(d->>'rating')::numeric,d->>'notes',(d->>'rewatch')::boolean,(d->>'private')::boolean,(d->>'request_id')::uuid,coalesce(d->>'viewing_context','') FROM (SELECT $1::jsonb d) x ON CONFLICT(user_id,request_id) DO NOTHING RETURNING to_jsonb(viewings.*);

-- name: ExistingViewing :one
SELECT to_jsonb(v.*) FROM viewings v WHERE user_id=viewer_id() AND request_id=$1;

-- name: EditViewing :one
UPDATE viewings SET watched_on=(d->>'watched_on')::date,rating=(d->>'rating')::numeric,notes=d->>'notes',rewatch=(d->>'rewatch')::boolean,private=(d->>'private')::boolean,context=coalesce(d->>'viewing_context','') FROM (SELECT $1::jsonb d) x WHERE id=(d->>'id')::uuid AND user_id=viewer_id() RETURNING to_jsonb(viewings.*);

-- name: DeleteViewing :one
DELETE FROM viewings WHERE id=$1 AND user_id=viewer_id() RETURNING to_jsonb(viewings.*);

-- name: Diary :one
SELECT coalesce(jsonb_agg(item ORDER BY watched_on DESC,created_at DESC),'[]'::jsonb) FROM (SELECT to_jsonb(v.*)||jsonb_build_object('film',film_card(f),'feelings',coalesce((SELECT jsonb_agg(feeling ORDER BY feeling) FROM viewing_feelings vf WHERE vf.viewing_id=v.id),'[]'::jsonb)) item,v.watched_on,v.created_at FROM viewings v JOIN films f ON f.id=v.film_id WHERE v.user_id=viewer_id() AND ($1::text='' OR to_char(v.watched_on,'YYYY-MM')=$1) ORDER BY v.watched_on DESC,v.created_at DESC LIMIT 50 OFFSET $2) x;

-- name: DeleteViewingFeelings :exec
DELETE FROM viewing_feelings WHERE viewing_id=$1;

-- name: AddViewingFeelings :exec
INSERT INTO viewing_feelings(viewing_id,feeling) SELECT $1,unnest($2::text[]) ON CONFLICT DO NOTHING;

-- name: AddOpinion :one
INSERT INTO opinions(user_id,film_id,viewing_id,rating,reflection,kind) SELECT viewer_id(),(d->>'film_id')::bigint,nullif(d->>'viewing_id','')::uuid,(d->>'rating')::numeric,d->>'reflection',d->>'kind' FROM (SELECT $1::jsonb d) x RETURNING to_jsonb(opinions.*);

-- name: Timeline :one
SELECT coalesce(jsonb_agg(item ORDER BY created_at DESC,id DESC),'[]'::jsonb) FROM (SELECT to_jsonb(o.*)||jsonb_build_object('film',film_card(f)) item,o.created_at,o.id FROM opinions o JOIN films f ON f.id=o.film_id WHERE o.user_id=viewer_id() AND ($1::bigint=0 OR o.film_id=$1) ORDER BY o.created_at DESC,o.id DESC LIMIT 500) x;

-- name: SaveMemory :one
INSERT INTO memories(user_id,viewing_id,scene,emotion,context) SELECT viewer_id(),v.id,d->>'scene',d->>'emotion',d->>'context' FROM (SELECT $1::jsonb d) x JOIN viewings v ON v.id=(d->>'viewing_id')::uuid AND v.user_id=viewer_id() ON CONFLICT(viewing_id) DO UPDATE SET scene=excluded.scene,emotion=excluded.emotion,context=excluded.context,updated_at=now() WHERE memories.user_id=viewer_id() RETURNING (to_jsonb(memories.*)-'search')::jsonb;

-- name: DeleteMemory :one
DELETE FROM memories WHERE id=$1 AND user_id=viewer_id() RETURNING (to_jsonb(memories.*)-'search')::jsonb;

-- name: SearchMemories :one
SELECT coalesce(jsonb_agg(item ORDER BY score DESC,watched_on DESC),'[]'::jsonb) FROM (
 SELECT (to_jsonb(m.*)-'search')||jsonb_build_object('film',film_card(f),'watched_on',v.watched_on,'explanation',CASE WHEN $1::text='' THEN 'Your private viewing memory' WHEN m.search @@ websearch_to_tsquery('english',$1) THEN 'Matches words in your memory' ELSE 'Similar wording in your memory' END) item,v.watched_on,
 ts_rank(m.search,websearch_to_tsquery('english',$1))+word_similarity($1,m.scene||' '||m.emotion||' '||m.context) score
 FROM memories m JOIN viewings v ON v.id=m.viewing_id JOIN films f ON f.id=v.film_id
 WHERE m.user_id=viewer_id() AND ($1='' OR m.search @@ websearch_to_tsquery('english',$1) OR word_similarity($1,m.scene||' '||m.emotion||' '||m.context)>.18 OR (m.scene||' '||m.emotion||' '||m.context) ILIKE '%'||$1||'%')
 AND ($2::text='' OR m.emotion ILIKE '%'||$2||'%') AND ($3::text='' OR v.watched_on>= $3::date) AND ($4::text='' OR v.watched_on<=$4::date) ORDER BY score DESC,v.watched_on DESC LIMIT 50) x;

-- name: Resurface :one
SELECT coalesce(jsonb_agg(item),'[]'::jsonb) FROM (SELECT (to_jsonb(m.*)-'search')||jsonb_build_object('film',film_card(f),'watched_on',v.watched_on,'explanation','A memory from an earlier chapter') item FROM memories m JOIN viewings v ON v.id=m.viewing_id JOIN films f ON f.id=v.film_id JOIN profiles p ON p.id=m.user_id WHERE m.user_id=viewer_id() AND p.resurface AND v.watched_on<current_date-interval '30 days' ORDER BY abs(extract(doy FROM v.watched_on)-extract(doy FROM current_date)),v.watched_on DESC LIMIT 3) x;

-- name: SaveReview :one
INSERT INTO reviews(id,user_id,film_id,safe,watched,reflection,tone) SELECT coalesce(nullif(d->>'id','')::uuid,gen_random_uuid()),viewer_id(),(d->>'film_id')::bigint,d->>'safe',d->>'watched',d->>'reflection',coalesce(d->>'tone','') FROM (SELECT $1::jsonb d) x ON CONFLICT(id) DO UPDATE SET safe=excluded.safe,watched=excluded.watched,reflection=excluded.reflection,tone=excluded.tone,updated_at=now() WHERE reviews.user_id=viewer_id() RETURNING to_jsonb(reviews.*);

-- name: DeleteReview :one
DELETE FROM reviews WHERE id=$1 AND user_id=viewer_id() RETURNING to_jsonb(reviews.*);

-- name: ReadReviews :one
SELECT coalesce(jsonb_agg(item ORDER BY created_at DESC),'[]'::jsonb) FROM (
 SELECT to_jsonb(r.*)||jsonb_build_object('film',film_card(f),'username',p.username,'likes',(SELECT count(*) FROM review_likes WHERE review_id=r.id),'liked',EXISTS(SELECT 1 FROM review_likes WHERE review_id=r.id AND user_id=viewer_id()),'allowed_layer',CASE WHEN r.user_id=viewer_id() THEN 3 ELSE greatest(coalesce((SELECT layer FROM reveals WHERE user_id=viewer_id() AND film_id=r.film_id),1),CASE WHEN EXISTS(SELECT 1 FROM viewings WHERE user_id=viewer_id() AND film_id=r.film_id) THEN 2 ELSE 1 END) END) item,r.created_at
 FROM reviews r JOIN profiles p ON p.id=r.user_id JOIN films f ON f.id=r.film_id WHERE profile_visible(r.user_id) AND ($1::bigint=0 OR r.film_id=$1) AND ($2::boolean=false OR r.user_id=viewer_id() OR EXISTS(SELECT 1 FROM follows WHERE user_id=viewer_id() AND target_id=r.user_id)) AND ($4::text='' OR r.tone=$4) AND NOT EXISTS(SELECT 1 FROM mutes WHERE user_id=viewer_id() AND target_id=r.user_id) ORDER BY r.created_at DESC LIMIT 30 OFFSET $3) x;

-- name: ReviewAccess :one
SELECT to_jsonb(r.*)||jsonb_build_object('allowed_layer',CASE WHEN r.user_id=viewer_id() THEN 3 ELSE greatest(coalesce((SELECT layer FROM reveals WHERE user_id=viewer_id() AND film_id=r.film_id),1),CASE WHEN EXISTS(SELECT 1 FROM viewings WHERE user_id=viewer_id() AND film_id=r.film_id) THEN 2 ELSE 1 END) END) FROM reviews r WHERE r.id=$1 AND profile_visible(r.user_id);

-- name: Reveal :one
INSERT INTO reveals(user_id,film_id,layer) VALUES(viewer_id(),$1,$2) ON CONFLICT(user_id,film_id) DO UPDATE SET layer=excluded.layer RETURNING to_jsonb(reveals.*);

-- name: SetWatchlist :one
INSERT INTO watchlist(user_id,film_id,private,intent,intent_note) VALUES(viewer_id(),$1,$2,$3,$4) ON CONFLICT(user_id,film_id) DO UPDATE SET private=excluded.private,intent=excluded.intent,intent_note=excluded.intent_note RETURNING to_jsonb(watchlist.*);

-- name: RemoveWatchlist :exec
DELETE FROM watchlist WHERE user_id=viewer_id() AND film_id=$1;

-- name: Watchlist :one
SELECT coalesce(jsonb_agg(to_jsonb(w.*)||jsonb_build_object('film',film_card(f)) ORDER BY w.created_at DESC),'[]'::jsonb) FROM (SELECT * FROM watchlist WHERE user_id=viewer_id() AND ($1::text='' OR intent=$1) ORDER BY created_at DESC LIMIT 50 OFFSET $2) w JOIN films f ON f.id=w.film_id;

-- name: SaveList :one
INSERT INTO lists(id,user_id,title,description,private,ranked) SELECT coalesce(nullif(d->>'id','')::uuid,gen_random_uuid()),viewer_id(),d->>'title',d->>'description',(d->>'private')::boolean,(d->>'ranked')::boolean FROM (SELECT $1::jsonb d) x ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,private=excluded.private,ranked=excluded.ranked WHERE lists.user_id=viewer_id() RETURNING to_jsonb(lists.*);

-- name: DeleteListItems :exec
DELETE FROM list_items WHERE list_id=$1 AND EXISTS(SELECT 1 FROM lists WHERE id=$1 AND user_id=viewer_id());

-- name: AddListItem :exec
INSERT INTO list_items(list_id,film_id,position) SELECT $1,$2,$3 WHERE EXISTS(SELECT 1 FROM lists WHERE id=$1 AND user_id=viewer_id());

-- name: Lists :one
SELECT coalesce(jsonb_agg(to_jsonb(l.*)||jsonb_build_object('username',p.username,'likes',(SELECT count(*) FROM list_likes WHERE list_id=l.id),'liked',EXISTS(SELECT 1 FROM list_likes WHERE list_id=l.id AND user_id=viewer_id()),'items',coalesce((SELECT jsonb_agg(film_card(f) ORDER BY i.position) FROM list_items i JOIN films f ON f.id=i.film_id WHERE i.list_id=l.id),'[]'::jsonb)) ORDER BY l.created_at DESC),'[]'::jsonb) FROM (SELECT * FROM lists WHERE ($1::boolean=false OR user_id=viewer_id()) AND ($2::text='' OR id::text=$2) ORDER BY created_at DESC LIMIT 30 OFFSET $3) l JOIN profiles p ON p.id=l.user_id WHERE (l.user_id=viewer_id() OR (NOT l.private AND profile_visible(l.user_id)));

-- name: DeleteList :one
DELETE FROM lists WHERE id=$1 AND user_id=viewer_id() RETURNING to_jsonb(lists.*);

-- name: Profiles :one
SELECT coalesce(jsonb_agg(item),'[]'::jsonb) FROM (SELECT to_jsonb(p.*)||jsonb_build_object('following',EXISTS(SELECT 1 FROM follows WHERE user_id=viewer_id() AND target_id=p.id),'followers',(SELECT count(*) FROM follows WHERE target_id=p.id),'films',(SELECT count(*) FROM viewings WHERE user_id=p.id AND (NOT private OR p.id=viewer_id()))) item FROM profiles p WHERE profile_visible(p.id) AND (username ILIKE '%'||$1||'%' OR name ILIKE '%'||$1||'%') ORDER BY username LIMIT 50) x;

-- name: Follow :one
INSERT INTO follows(user_id,target_id) SELECT viewer_id(),$1 WHERE profile_visible($1) ON CONFLICT DO NOTHING RETURNING to_jsonb(follows.*);

-- name: Unfollow :exec
DELETE FROM follows WHERE user_id=viewer_id() AND target_id=$1;

-- name: Block :exec
INSERT INTO blocks(user_id,target_id) VALUES(viewer_id(),$1) ON CONFLICT DO NOTHING;

-- name: RemoveBlockedFollows :exec
DELETE FROM follows WHERE (user_id=viewer_id() AND target_id=$1) OR (user_id=$1 AND target_id=viewer_id());

-- name: Notify :exec
INSERT INTO notifications(user_id,actor_id,kind,object_id) SELECT $1,viewer_id(),$2,$3 WHERE $1<>viewer_id() AND not_blocked($1);

-- name: Notifications :one
SELECT coalesce(jsonb_agg(to_jsonb(n.*)||jsonb_build_object('username',p.username) ORDER BY n.created_at DESC),'[]'::jsonb) FROM notifications n JOIN profiles p ON p.id=n.actor_id WHERE n.user_id=viewer_id() AND not_blocked(n.actor_id);

-- name: ReadNotifications :exec
UPDATE notifications SET read=true WHERE user_id=viewer_id();

-- name: LikeReview :one
INSERT INTO review_likes(user_id,review_id) SELECT viewer_id(),id FROM reviews WHERE id=$1 AND profile_visible(user_id) ON CONFLICT DO NOTHING RETURNING to_jsonb(review_likes.*);

-- name: UnlikeReview :exec
DELETE FROM review_likes WHERE user_id=viewer_id() AND review_id=$1;

-- name: AddComment :one
INSERT INTO comments(user_id,review_id,body,layer) VALUES(viewer_id(),$1,$2,$3) RETURNING to_jsonb(comments.*);

-- name: Comments :one
SELECT coalesce(jsonb_agg(to_jsonb(c.*)||jsonb_build_object('username',p.username) ORDER BY c.created_at),'[]'::jsonb) FROM comments c JOIN profiles p ON p.id=c.user_id WHERE c.review_id=$1 AND c.layer<=$2 AND profile_visible(c.user_id);

-- name: Report :exec
INSERT INTO reports(user_id,subject,reason) VALUES(viewer_id(),$1,$2);

-- name: Analytics :exec
INSERT INTO analytics(user_id,event) VALUES(viewer_id(),$1);

-- name: DeleteAccount :exec
DELETE FROM profiles WHERE id=viewer_id();

-- name: SetRole :exec
SET LOCAL ROLE afterframe_api;

-- name: FilmState :one
SELECT jsonb_build_object('watched',EXISTS(SELECT 1 FROM viewings v WHERE v.user_id=viewer_id() AND v.film_id=$1),'viewings',(SELECT count(*) FROM viewings v WHERE v.user_id=viewer_id() AND v.film_id=$1),'rating',(SELECT o.rating FROM opinions o WHERE o.user_id=viewer_id() AND o.film_id=$1 ORDER BY o.created_at DESC,o.id DESC LIMIT 1),'watchlisted',EXISTS(SELECT 1 FROM watchlist w WHERE w.user_id=viewer_id() AND w.film_id=$1));

-- name: LikeList :exec
INSERT INTO list_likes(user_id,list_id) SELECT viewer_id(),id FROM lists WHERE id=$1 ON CONFLICT DO NOTHING;

-- name: UnlikeList :exec
DELETE FROM list_likes WHERE user_id=viewer_id() AND list_id=$1;

-- name: SaveAvatar :exec
UPDATE profiles SET avatar=$1 WHERE id=viewer_id();

-- name: ProfileDetails :one
SELECT to_jsonb(p.*)||jsonb_build_object('followers',(SELECT count(*) FROM follows WHERE target_id=p.id),'following',(SELECT count(*) FROM follows WHERE user_id=p.id),'viewings',(SELECT count(*) FROM viewings WHERE user_id=p.id),'diary',coalesce((SELECT jsonb_agg(to_jsonb(v.*)||jsonb_build_object('film',film_card(f)) ORDER BY v.watched_on DESC) FROM (SELECT * FROM viewings WHERE user_id=p.id AND (NOT private OR p.id=viewer_id()) ORDER BY watched_on DESC,created_at DESC LIMIT 50) v JOIN films f ON f.id=v.film_id),'[]'::jsonb)) FROM profiles p WHERE p.id=$1 AND profile_visible(p.id);

-- name: Network :one
SELECT coalesce(jsonb_agg(to_jsonb(p.*)),'[]'::jsonb) FROM profiles p WHERE p.id IN (SELECT CASE WHEN $2::boolean THEN user_id ELSE target_id END FROM follows WHERE CASE WHEN $2 THEN target_id=$1 ELSE user_id=$1 END);

-- name: AccountDeleted :one
SELECT EXISTS(SELECT 1 FROM deleted_accounts WHERE user_id=viewer_id());

-- name: MarkAccountDeleted :exec
INSERT INTO deleted_accounts(user_id) VALUES(viewer_id()) ON CONFLICT DO NOTHING;

-- name: PendingErasures :many
SELECT user_id FROM deleted_accounts WHERE NOT auth_deleted ORDER BY deleted_at LIMIT 20;

-- name: AuthErased :exec
UPDATE deleted_accounts SET auth_deleted=true WHERE user_id=$1;

-- name: ListAccess :one
SELECT id FROM lists WHERE id=$1;

-- name: SaveProgress :one
INSERT INTO viewing_progress(user_id,film_id,status,progress_minutes,reason) SELECT viewer_id(),(d->>'film_id')::bigint,d->>'status',nullif(d->>'progress_minutes','')::int,nullif(d->>'reason','') FROM (SELECT $1::jsonb d) x ON CONFLICT(user_id,film_id) DO UPDATE SET status=excluded.status,progress_minutes=excluded.progress_minutes,reason=excluded.reason,updated_at=now() RETURNING to_jsonb(viewing_progress.*);

-- name: Progress :one
SELECT coalesce(jsonb_agg(to_jsonb(vp.*)||jsonb_build_object('film',film_card(f)) ORDER BY vp.updated_at DESC),'[]'::jsonb) FROM viewing_progress vp JOIN films f ON f.id=vp.film_id WHERE vp.user_id=viewer_id();

-- name: ClearProgress :exec
DELETE FROM viewing_progress WHERE user_id=viewer_id() AND film_id=$1;

-- name: UnresolvedProgressFilmIDs :one
SELECT coalesce(jsonb_agg(DISTINCT film_id),'[]'::jsonb) FROM viewing_progress WHERE user_id=viewer_id() AND status IN ('paused','abandoned');

-- name: SaveCraftNote :one
INSERT INTO craft_notes(id,user_id,film_id,viewing_id,category,scene,body,spoiler,private) SELECT coalesce(nullif(d->>'id','')::uuid,gen_random_uuid()),viewer_id(),(d->>'film_id')::bigint,v.id,d->>'category',coalesce(d->>'scene',''),coalesce(d->>'body',''),coalesce((d->>'spoiler')::boolean,false),coalesce((d->>'private')::boolean,true) FROM (SELECT $1::jsonb d) x LEFT JOIN viewings v ON v.id=nullif(d->>'viewing_id','')::uuid AND v.user_id=viewer_id() AND v.film_id=(d->>'film_id')::bigint WHERE nullif(d->>'viewing_id','') IS NULL OR v.id IS NOT NULL ON CONFLICT(id) DO UPDATE SET film_id=excluded.film_id,viewing_id=excluded.viewing_id,category=excluded.category,scene=excluded.scene,body=excluded.body,spoiler=excluded.spoiler,private=excluded.private,updated_at=now() WHERE craft_notes.user_id=viewer_id() RETURNING (to_jsonb(craft_notes.*)-'search');

-- name: CraftNotesForFilm :one
SELECT coalesce(jsonb_agg((to_jsonb(c.*)-'search')||jsonb_build_object('username',p.username,'allowed_spoiler',c.user_id=viewer_id() OR NOT c.spoiler OR coalesce((SELECT layer FROM reveals WHERE user_id=viewer_id() AND film_id=c.film_id),1)>=2 OR EXISTS(SELECT 1 FROM viewings WHERE user_id=viewer_id() AND film_id=c.film_id)) ORDER BY c.created_at DESC),'[]'::jsonb) FROM craft_notes c JOIN profiles p ON p.id=c.user_id WHERE c.film_id=$1 AND (c.user_id=viewer_id() OR (NOT c.private AND profile_visible(c.user_id)));

-- name: SearchCraftNotes :one
SELECT coalesce(jsonb_agg((to_jsonb(c.*)-'search')||jsonb_build_object('film',film_card(f)) ORDER BY c.created_at DESC),'[]'::jsonb) FROM craft_notes c JOIN films f ON f.id=c.film_id WHERE c.user_id=viewer_id() AND ($1::text='' OR c.search @@ websearch_to_tsquery('english',$1) OR (c.scene||' '||c.body||' '||c.category) ILIKE '%'||$1||'%') LIMIT 200;

-- name: DeleteCraftNote :one
DELETE FROM craft_notes WHERE id=$1 AND user_id=viewer_id() RETURNING (to_jsonb(craft_notes.*)-'search');

-- name: CreatePlan :one
INSERT INTO theatrical_plans(film_id,creator_id,note) VALUES($1,viewer_id(),$2) RETURNING to_jsonb(theatrical_plans.*);

-- name: JoinOwnPlan :exec
INSERT INTO plan_participants(plan_id,user_id,status) VALUES($1,viewer_id(),'joined') ON CONFLICT DO NOTHING;

-- name: AddPlanSlot :one
INSERT INTO plan_slots(plan_id,label) SELECT $1,$2 WHERE EXISTS(SELECT 1 FROM theatrical_plans WHERE id=$1 AND creator_id=viewer_id()) RETURNING to_jsonb(plan_slots.*);

-- name: InvitePlanParticipant :one
INSERT INTO plan_participants(plan_id,user_id) SELECT $1,$2 WHERE EXISTS(SELECT 1 FROM theatrical_plans WHERE id=$1 AND creator_id=viewer_id()) ON CONFLICT DO NOTHING RETURNING to_jsonb(plan_participants.*);

-- name: RespondPlanInvite :one
UPDATE plan_participants SET status=$2 WHERE plan_id=$1 AND user_id=viewer_id() RETURNING to_jsonb(plan_participants.*);

-- name: VoteSlot :exec
INSERT INTO plan_votes(slot_id,user_id) SELECT $1,viewer_id() WHERE EXISTS(SELECT 1 FROM plan_participants pp JOIN plan_slots s ON s.plan_id=pp.plan_id WHERE s.id=$1 AND pp.user_id=viewer_id() AND pp.status='joined') ON CONFLICT DO NOTHING;

-- name: UnvoteSlot :exec
DELETE FROM plan_votes WHERE slot_id=$1 AND user_id=viewer_id();

-- name: DecidePlan :one
UPDATE theatrical_plans SET status='decided',decided_slot_id=$2,updated_at=now() WHERE id=$1 AND creator_id=viewer_id() AND EXISTS(SELECT 1 FROM plan_slots WHERE id=$2 AND plan_id=$1) RETURNING to_jsonb(theatrical_plans.*);

-- name: CancelPlan :one
UPDATE theatrical_plans SET status='cancelled',updated_at=now() WHERE id=$1 AND creator_id=viewer_id() RETURNING to_jsonb(theatrical_plans.*);

-- name: MyPlans :one
SELECT coalesce(jsonb_agg(to_jsonb(p.*)||jsonb_build_object('film',film_card(f)) ORDER BY p.created_at DESC),'[]'::jsonb) FROM theatrical_plans p JOIN films f ON f.id=p.film_id WHERE p.creator_id=viewer_id() OR EXISTS(SELECT 1 FROM plan_participants pp WHERE pp.plan_id=p.id AND pp.user_id=viewer_id());

-- name: PlanDetail :one
SELECT to_jsonb(p.*)||jsonb_build_object('film',film_card(f)) FROM theatrical_plans p JOIN films f ON f.id=p.film_id WHERE p.id=$1;

-- name: PlanSlots :one
SELECT coalesce(jsonb_agg(to_jsonb(s.*)||jsonb_build_object('votes',(SELECT count(*) FROM plan_votes v WHERE v.slot_id=s.id),'voted',EXISTS(SELECT 1 FROM plan_votes v WHERE v.slot_id=s.id AND v.user_id=viewer_id())) ORDER BY s.created_at),'[]'::jsonb) FROM plan_slots s WHERE s.plan_id=$1;

-- name: PlanParticipants :one
SELECT plan_roster($1::uuid);

-- name: JoinTribe :exec
INSERT INTO user_tribes(user_id,tribe_id) VALUES(viewer_id(),$1) ON CONFLICT DO NOTHING;

-- name: LeaveTribe :exec
DELETE FROM user_tribes WHERE user_id=viewer_id() AND tribe_id=$1;

-- name: MyTribes :one
SELECT coalesce(jsonb_agg(tribe_id),'[]'::jsonb) FROM user_tribes WHERE user_id=viewer_id();

-- name: GlobalRating :one
SELECT avg_rating::float8, sample_size FROM global_rating($1);

-- name: TribeRating :one
SELECT avg_rating::float8, sample_size FROM tribe_rating($1,$2);
