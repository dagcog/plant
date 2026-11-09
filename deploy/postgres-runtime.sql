BEGIN;

GRANT USAGE ON SCHEMA windowsill TO windowsill_app;
GRANT SELECT ON ALL TABLES IN SCHEMA windowsill TO windowsill_app;
GRANT INSERT, UPDATE ON windowsill.players, windowsill.gardens, windowsill.plants TO windowsill_app;
GRANT INSERT ON windowsill.garden_slots, windowsill.earned_achievements, windowsill.leaf_ledger,
    windowsill.action_requests, windowsill.accounts TO windowsill_app;
GRANT UPDATE (result) ON windowsill.action_requests TO windowsill_app;
GRANT UPDATE (catalog_version) ON windowsill.garden_slots TO windowsill_app;
GRANT INSERT (player_id) ON windowsill.wallets TO windowsill_app;
GRANT INSERT, DELETE ON windowsill.shelf_likes, windowsill.account_sessions TO windowsill_app;
GRANT USAGE ON SEQUENCE windowsill.leaf_ledger_id_seq TO windowsill_app;
GRANT EXECUTE ON FUNCTION windowsill.read_shared_shelf(uuid) TO windowsill_app;

COMMIT;
