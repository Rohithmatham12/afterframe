DROP FUNCTION plan_roster(uuid);
DROP FUNCTION plan_member(uuid);
DROP FUNCTION is_plan_participant(uuid);
DROP FUNCTION is_plan_creator(uuid);
DROP TABLE plan_votes;
DROP TABLE plan_participants;
ALTER TABLE theatrical_plans DROP CONSTRAINT theatrical_plans_decided_slot_fkey;
DROP TABLE plan_slots;
DROP TABLE theatrical_plans;
