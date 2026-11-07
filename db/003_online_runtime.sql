BEGIN;

ALTER TABLE windowsill.plants ADD COLUMN displayed_at timestamptz
    CHECK (displayed_at IS NULL OR (matured_at IS NOT NULL AND displayed_at >= matured_at));
UPDATE windowsill.plants SET displayed_at = matured_at WHERE shelf_position IS NOT NULL;

ALTER TABLE windowsill.earned_achievements ADD COLUMN earned_game_seconds bigint NOT NULL DEFAULT 0
    CHECK (earned_game_seconds >= 0);

COMMIT;
