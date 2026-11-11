BEGIN;

INSERT INTO windowsill.content_releases
    (version, algorithm_key, opening_leaves, initial_game_seconds, offline_cap_seconds, clock_phases)
SELECT 3, 'growth_potting_v3', opening_leaves, initial_game_seconds, offline_cap_seconds, clock_phases
FROM windowsill.content_releases WHERE version = 2;

INSERT INTO windowsill.species_catalog
    (content_version, species_key, title, latin_name, description, seed_price, base_sale_value,
     base_growth_seconds, ideal_moisture, ideal_nutrition, ideal_light, render_config)
SELECT 3, species_key, title, latin_name, description, seed_price, base_sale_value,
    base_growth_seconds, ideal_moisture, ideal_nutrition, ideal_light, render_config
FROM windowsill.species_catalog WHERE content_version = 2;

INSERT INTO windowsill.species_variants (content_version, species_key, variant_key, title, is_rare, appearance)
SELECT 3, species_key, variant_key, title, is_rare, appearance
FROM windowsill.species_variants WHERE content_version = 2;

INSERT INTO windowsill.pot_catalog (content_version, pot_key, title, description, price, drainage, render_config)
SELECT 3, pot_key, title, description, price, drainage, render_config
FROM windowsill.pot_catalog WHERE content_version = 2;

INSERT INTO windowsill.slot_catalog (content_version, slot_key, title, display_order, light_offset, unlock_price)
SELECT 3, slot_key, title, display_order, light_offset, unlock_price
FROM windowsill.slot_catalog WHERE content_version = 2;

INSERT INTO windowsill.achievement_catalog (content_version, achievement_key, title, description, reward_leaves)
SELECT 3, achievement_key, title, description, reward_leaves
FROM windowsill.achievement_catalog WHERE content_version = 2;

CREATE TABLE windowsill.material_inventory (
    garden_id uuid NOT NULL REFERENCES windowsill.gardens ON DELETE CASCADE,
    material_key text NOT NULL CHECK (material_key ~ '^[a-z][a-z_]*$'),
    units integer NOT NULL CHECK (units >= 0),
    PRIMARY KEY (garden_id, material_key)
);

ALTER TABLE windowsill.plants ADD COLUMN potting jsonb
    CHECK (potting IS NULL OR (content_version >= 3 AND jsonb_typeof(potting) = 'object'));

ALTER TABLE windowsill.leaf_ledger
    DROP CONSTRAINT leaf_ledger_reason_check,
    DROP CONSTRAINT leaf_ledger_check1,
    DROP CONSTRAINT leaf_ledger_check3,
    ADD CONSTRAINT leaf_ledger_reason_check
        CHECK (reason IN ('opening', 'unlock', 'plant', 'sale', 'achievement', 'adjustment', 'buy-material')),
    ADD CONSTRAINT leaf_ledger_garden_required
        CHECK (reason NOT IN ('unlock', 'plant', 'sale', 'buy-material') OR garden_id IS NOT NULL),
    ADD CONSTRAINT leaf_ledger_delta_direction
        CHECK ((reason IN ('opening', 'sale', 'achievement') AND delta > 0)
            OR (reason IN ('unlock', 'plant', 'buy-material') AND delta < 0) OR reason = 'adjustment');

CREATE OR REPLACE FUNCTION windowsill.read_shared_shelf(token uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = pg_catalog
AS $$
    SELECT jsonb_build_object(
        'title', g.title,
        'likes', (SELECT count(*) FROM windowsill.shelf_likes AS l WHERE l.garden_id = g.id),
        'plants', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'species', p.species_key, 'speciesTitle', s.title, 'speciesRender', s.render_config,
                'pot', p.pot_key, 'potTitle', t.title, 'potRender', t.render_config,
                'variant', p.variant_key, 'variantTitle', v.title, 'rare', v.is_rare, 'appearance', v.appearance,
                'quality', p.quality, 'seed', p.visual_seed, 'position', p.shelf_position, 'potting', p.potting
            ) ORDER BY p.shelf_position)
            FROM windowsill.plants AS p
            JOIN windowsill.species_catalog AS s USING (content_version, species_key)
            JOIN windowsill.pot_catalog AS t USING (content_version, pot_key)
            JOIN windowsill.species_variants AS v USING (content_version, species_key, variant_key)
            WHERE p.garden_id = g.id AND p.shelf_position IS NOT NULL
        ), '[]'::jsonb)
    )
    FROM windowsill.gardens AS g
    WHERE g.share_token = token AND g.visibility IN ('unlisted', 'public');
$$;

COMMIT;
