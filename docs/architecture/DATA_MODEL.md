# Data model

Profiles use the Supabase user UUID. Films cache TMDB data. Viewings reference profiles/films and store dated ratings, notes, privacy and idempotency keys. Opinions are historical rating/reflection events; deleting a viewing clears its opinion link without destroying opinion history. Memories belong to one viewing and owner, with generated full-text indexes and trigram search. Reviews contain three disclosure layers; reveals store each viewer's explicit film permission.

Lists own ordered unique film items. Watchlist tracks user/film pairs. Follows and blocks form the social graph; review/list likes and comments reference their subjects. Notifications store bounded social events. Reports are private moderation inputs. Analytics is a minimal first-party event table. Deleted-account tombstones prevent profile recreation and persist authentication deletion retries.

Versioned migrations and constraints are authoritative under backend/migrations. All application tables use RLS; Go transactions use afterframe_api. Auth tables live in a separate local database. No cloud migration has run.
