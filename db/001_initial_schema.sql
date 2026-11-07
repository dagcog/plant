BEGIN;

CREATE SCHEMA windowsill;

CREATE TABLE windowsill.content_releases (
    version integer PRIMARY KEY CHECK (version > 0),
    algorithm_key text NOT NULL,
    opening_leaves integer NOT NULL CHECK (opening_leaves > 0),
    initial_game_seconds bigint NOT NULL CHECK (initial_game_seconds >= 0),
    offline_cap_seconds integer NOT NULL CHECK (offline_cap_seconds > 0),
    clock_phases jsonb NOT NULL CHECK (jsonb_typeof(clock_phases) = 'array'),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE windowsill.species_catalog (
    content_version integer NOT NULL REFERENCES windowsill.content_releases,
    species_key text NOT NULL,
    title text NOT NULL,
    latin_name text NOT NULL,
    description text NOT NULL,
    seed_price integer NOT NULL CHECK (seed_price >= 0),
    base_sale_value integer NOT NULL CHECK (base_sale_value > 0),
    base_growth_seconds integer NOT NULL CHECK (base_growth_seconds > 0),
    ideal_moisture smallint NOT NULL CHECK (ideal_moisture BETWEEN 0 AND 100),
    ideal_nutrition smallint NOT NULL CHECK (ideal_nutrition BETWEEN 0 AND 100),
    ideal_light smallint NOT NULL CHECK (ideal_light BETWEEN 0 AND 100),
    render_config jsonb NOT NULL CHECK (jsonb_typeof(render_config) = 'object'),
    PRIMARY KEY (content_version, species_key)
);

CREATE TABLE windowsill.species_variants (
    content_version integer NOT NULL,
    species_key text NOT NULL,
    variant_key text NOT NULL,
    title text NOT NULL,
    is_rare boolean NOT NULL,
    appearance jsonb NOT NULL CHECK (jsonb_typeof(appearance) = 'object'),
    PRIMARY KEY (content_version, species_key, variant_key),
    FOREIGN KEY (content_version, species_key) REFERENCES windowsill.species_catalog
);

CREATE TABLE windowsill.pot_catalog (
    content_version integer NOT NULL REFERENCES windowsill.content_releases,
    pot_key text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    price integer NOT NULL CHECK (price >= 0),
    drainage numeric(6,3) NOT NULL CHECK (drainage > 0 AND drainage <= 10),
    render_config jsonb NOT NULL CHECK (jsonb_typeof(render_config) = 'object'),
    PRIMARY KEY (content_version, pot_key)
);

CREATE TABLE windowsill.slot_catalog (
    content_version integer NOT NULL REFERENCES windowsill.content_releases,
    slot_key text NOT NULL,
    title text NOT NULL,
    display_order smallint NOT NULL CHECK (display_order > 0),
    light_offset smallint NOT NULL CHECK (light_offset BETWEEN -100 AND 100),
    unlock_price integer NOT NULL CHECK (unlock_price >= 0),
    PRIMARY KEY (content_version, slot_key),
    UNIQUE (content_version, display_order)
);

CREATE TABLE windowsill.achievement_catalog (
    content_version integer NOT NULL REFERENCES windowsill.content_releases,
    achievement_key text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    reward_leaves integer NOT NULL CHECK (reward_leaves >= 0),
    PRIMARY KEY (content_version, achievement_key)
);

CREATE TABLE windowsill.players (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_issuer text NOT NULL CHECK (auth_issuer <> ''),
    auth_subject text NOT NULL CHECK (auth_subject <> ''),
    display_name text NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 40),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (auth_issuer, auth_subject)
);

CREATE TABLE windowsill.gardens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id uuid NOT NULL UNIQUE REFERENCES windowsill.players,
    content_version integer NOT NULL REFERENCES windowsill.content_releases,
    title text NOT NULL DEFAULT '我的窗台' CHECK (char_length(btrim(title)) BETWEEN 1 AND 60),
    game_seconds bigint NOT NULL CHECK (game_seconds >= 0),
    settled_at timestamptz NOT NULL,
    revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
    visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'unlisted', 'public')),
    share_token uuid UNIQUE,
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, player_id),
    CHECK ((visibility = 'private' AND share_token IS NULL AND published_at IS NULL)
        OR (visibility IN ('unlisted', 'public') AND share_token IS NOT NULL AND published_at IS NOT NULL))
);

CREATE INDEX gardens_public_listing_idx ON windowsill.gardens (published_at DESC, id DESC)
    WHERE visibility = 'public';

-- A row represents an unlocked slot. Other positions are read from the catalog.
CREATE TABLE windowsill.garden_slots (
    garden_id uuid NOT NULL REFERENCES windowsill.gardens,
    slot_key text NOT NULL,
    catalog_version integer NOT NULL,
    unlocked_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (garden_id, slot_key),
    FOREIGN KEY (catalog_version, slot_key) REFERENCES windowsill.slot_catalog
);

-- One instance keeps its identity from sowing through display or sale.
CREATE TABLE windowsill.plants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    garden_id uuid NOT NULL REFERENCES windowsill.gardens,
    content_version integer NOT NULL,
    species_key text NOT NULL,
    pot_key text NOT NULL,
    variant_key text,
    visual_seed bigint NOT NULL CHECK (visual_seed BETWEEN 0 AND 4294967295),
    planted_at timestamptz NOT NULL DEFAULT now(),
    matured_at timestamptz,
    sold_at timestamptz,
    slot_key text,
    shelf_position smallint CHECK (shelf_position BETWEEN 1 AND 8),
    moisture double precision NOT NULL DEFAULT 58 CHECK (moisture BETWEEN 0 AND 100),
    nutrition double precision NOT NULL DEFAULT 63 CHECK (nutrition BETWEEN 0 AND 100),
    exposure smallint NOT NULL DEFAULT 1 CHECK (exposure BETWEEN 0 AND 2),
    growth double precision NOT NULL DEFAULT 0 CHECK (growth BETWEEN 0 AND 1),
    fit_samples integer NOT NULL DEFAULT 0 CHECK (fit_samples >= 0),
    fit_sum double precision NOT NULL DEFAULT 0 CHECK (fit_sum BETWEEN 0 AND fit_samples + 0.000001),
    quality smallint CHECK (quality BETWEEN 0 AND 100),
    UNIQUE (garden_id, id),
    UNIQUE (garden_id, slot_key),
    CONSTRAINT plants_shelf_position_unique UNIQUE (garden_id, shelf_position) DEFERRABLE INITIALLY IMMEDIATE,
    FOREIGN KEY (garden_id, slot_key) REFERENCES windowsill.garden_slots,
    FOREIGN KEY (content_version, species_key) REFERENCES windowsill.species_catalog,
    FOREIGN KEY (content_version, pot_key) REFERENCES windowsill.pot_catalog,
    FOREIGN KEY (content_version, species_key, variant_key) REFERENCES windowsill.species_variants,
    CHECK (num_nonnulls(slot_key, shelf_position, sold_at) = 1),
    CHECK ((matured_at IS NULL AND growth < 1 AND quality IS NULL AND variant_key IS NULL AND slot_key IS NOT NULL)
        OR (matured_at IS NOT NULL AND matured_at >= planted_at AND growth = 1 AND fit_samples > 0
            AND quality IS NOT NULL AND variant_key IS NOT NULL)),
    CHECK (sold_at IS NULL OR (matured_at IS NOT NULL AND sold_at >= matured_at))
);

CREATE INDEX plants_album_idx ON windowsill.plants (garden_id, species_key) WHERE matured_at IS NOT NULL;

CREATE TABLE windowsill.earned_achievements (
    player_id uuid NOT NULL REFERENCES windowsill.players,
    achievement_key text NOT NULL,
    content_version integer NOT NULL,
    earned_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (player_id, achievement_key),
    FOREIGN KEY (content_version, achievement_key) REFERENCES windowsill.achievement_catalog
);

CREATE TABLE windowsill.action_requests (
    player_id uuid NOT NULL REFERENCES windowsill.players,
    request_id uuid NOT NULL,
    action_key text NOT NULL,
    arguments jsonb NOT NULL CHECK (jsonb_typeof(arguments) = 'object'),
    result jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(result) = 'object'),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (player_id, request_id)
);

CREATE TABLE windowsill.wallets (
    player_id uuid PRIMARY KEY REFERENCES windowsill.players,
    balance bigint NOT NULL DEFAULT 0 CHECK (balance >= 0)
);

CREATE TABLE windowsill.leaf_ledger (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    player_id uuid NOT NULL REFERENCES windowsill.wallets,
    request_id uuid NOT NULL,
    line_no smallint NOT NULL CHECK (line_no > 0),
    reason text NOT NULL CHECK (reason IN ('opening', 'unlock', 'plant', 'sale', 'achievement', 'adjustment')),
    delta integer NOT NULL CHECK (delta <> 0),
    garden_id uuid,
    plant_id uuid,
    achievement_key text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (player_id, request_id, line_no),
    FOREIGN KEY (player_id, request_id) REFERENCES windowsill.action_requests,
    FOREIGN KEY (garden_id, player_id) REFERENCES windowsill.gardens (id, player_id),
    FOREIGN KEY (garden_id, plant_id) REFERENCES windowsill.plants (garden_id, id),
    FOREIGN KEY (player_id, achievement_key) REFERENCES windowsill.earned_achievements,
    CHECK ((reason IN ('plant', 'sale')) = (plant_id IS NOT NULL)),
    CHECK (reason NOT IN ('unlock', 'plant', 'sale') OR garden_id IS NOT NULL),
    CHECK ((reason = 'achievement') = (achievement_key IS NOT NULL)),
    CHECK ((reason IN ('opening', 'sale', 'achievement') AND delta > 0)
        OR (reason IN ('unlock', 'plant') AND delta < 0) OR reason = 'adjustment')
);

CREATE UNIQUE INDEX leaf_ledger_opening_once_idx ON windowsill.leaf_ledger (player_id) WHERE reason = 'opening';
CREATE UNIQUE INDEX leaf_ledger_sale_once_idx ON windowsill.leaf_ledger (plant_id) WHERE reason = 'sale';
CREATE UNIQUE INDEX leaf_ledger_achievement_once_idx ON windowsill.leaf_ledger (player_id, achievement_key)
    WHERE reason = 'achievement';
CREATE INDEX leaf_ledger_player_history_idx ON windowsill.leaf_ledger (player_id, created_at DESC, id DESC);

-- AFTER INSERT runs only for a row that was actually inserted, including on retries.
CREATE FUNCTION windowsill.apply_leaf_delta() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
BEGIN
    UPDATE windowsill.wallets
    SET balance = balance + NEW.delta
    WHERE player_id = NEW.player_id AND balance + NEW.delta >= 0;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'insufficient leaf balance' USING ERRCODE = '23514', CONSTRAINT = 'wallets_nonnegative';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION windowsill.apply_leaf_delta() FROM PUBLIC;

CREATE TRIGGER leaf_ledger_post_delta AFTER INSERT ON windowsill.leaf_ledger
FOR EACH ROW EXECUTE FUNCTION windowsill.apply_leaf_delta();

CREATE TABLE windowsill.shelf_likes (
    garden_id uuid NOT NULL,
    garden_owner_id uuid NOT NULL,
    visitor_id uuid NOT NULL REFERENCES windowsill.players,
    liked_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (garden_id, visitor_id),
    FOREIGN KEY (garden_id, garden_owner_id) REFERENCES windowsill.gardens (id, player_id),
    CHECK (garden_owner_id <> visitor_id)
);

CREATE INDEX shelf_likes_visitor_idx ON windowsill.shelf_likes (visitor_id, garden_id);

CREATE VIEW windowsill.plant_album AS
SELECT p.garden_id, p.species_key, count(*) AS mature_count,
    count(*) FILTER (WHERE v.is_rare) AS rare_count, max(p.quality) AS best_quality
FROM windowsill.plants AS p
JOIN windowsill.species_variants AS v USING (content_version, species_key, variant_key)
WHERE p.matured_at IS NOT NULL
GROUP BY p.garden_id, p.species_key;

-- Only the fields needed to render a published shelf cross the share boundary.
CREATE FUNCTION windowsill.read_shared_shelf(token uuid) RETURNS jsonb
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
                'quality', p.quality, 'seed', p.visual_seed, 'position', p.shelf_position
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

REVOKE ALL ON SCHEMA windowsill FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION windowsill.read_shared_shelf(uuid) FROM PUBLIC;

COMMIT;
