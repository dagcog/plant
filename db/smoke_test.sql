BEGIN;

DO $$
<<smoke>>
DECLARE
    owner_id uuid;
    visitor_id uuid;
    garden_id uuid;
    visitor_garden_id uuid;
    first_plant uuid;
    second_plant uuid;
    request_id uuid := gen_random_uuid();
    token uuid := gen_random_uuid();
    violated_constraint text;
    shared jsonb;
BEGIN
    INSERT INTO windowsill.players (auth_issuer, auth_subject, display_name)
    VALUES ('test', gen_random_uuid()::text, '测试主人') RETURNING id INTO owner_id;
    INSERT INTO windowsill.players (auth_issuer, auth_subject, display_name)
    VALUES ('test', gen_random_uuid()::text, '测试访客') RETURNING id INTO visitor_id;

    INSERT INTO windowsill.gardens (player_id, content_version, game_seconds, settled_at)
    VALUES (owner_id, 1, 18, now()) RETURNING id INTO garden_id;
    INSERT INTO windowsill.gardens (player_id, content_version, game_seconds, settled_at)
    VALUES (visitor_id, 1, 18, now()) RETURNING id INTO visitor_garden_id;

    INSERT INTO windowsill.wallets (player_id) VALUES (owner_id);
    INSERT INTO windowsill.action_requests (player_id, request_id, action_key, arguments)
    VALUES (owner_id, request_id, 'smoke_test', '{}');
    INSERT INTO windowsill.leaf_ledger (player_id, request_id, line_no, reason, delta)
    VALUES (owner_id, request_id, 1, 'opening', 86);
    INSERT INTO windowsill.leaf_ledger (player_id, request_id, line_no, reason, delta)
    VALUES (owner_id, request_id, 1, 'opening', 86) ON CONFLICT DO NOTHING;
    IF (SELECT balance FROM windowsill.wallets WHERE player_id = owner_id) <> 86 THEN
        RAISE EXCEPTION 'duplicate ledger insert changed the balance';
    END IF;

    INSERT INTO windowsill.garden_slots (garden_id, slot_key, catalog_version)
    VALUES (garden_id, 'left', 1), (garden_id, 'middle', 1), (visitor_garden_id, 'right', 1);

    BEGIN
        INSERT INTO windowsill.plants (garden_id, content_version, species_key, pot_key, visual_seed, slot_key)
        VALUES (garden_id, 1, 'chamomile', 'clay', 1, 'right');
        RAISE EXCEPTION 'accepted a slot not unlocked in this garden';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;

    BEGIN
        INSERT INTO windowsill.plants (garden_id, content_version, species_key, pot_key, visual_seed, slot_key)
        VALUES (garden_id, 1, 'chamomile', 'clay', 2, 'middle') RETURNING id INTO first_plant;
        INSERT INTO windowsill.leaf_ledger (player_id, request_id, line_no, reason, delta, garden_id, plant_id)
        VALUES (owner_id, request_id, 2, 'plant', -87, garden_id, first_plant);
        RAISE EXCEPTION 'accepted an overdraft';
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS violated_constraint = CONSTRAINT_NAME;
        IF violated_constraint IS DISTINCT FROM 'wallets_nonnegative' THEN RAISE; END IF;
    END;

    IF EXISTS (SELECT 1 FROM windowsill.plants WHERE id = first_plant)
        OR (SELECT balance FROM windowsill.wallets WHERE player_id = owner_id) <> 86 THEN
        RAISE EXCEPTION 'failed purchase left a plant or changed balance';
    END IF;

    INSERT INTO windowsill.plants (garden_id, content_version, species_key, pot_key, visual_seed, slot_key)
    VALUES (garden_id, 1, 'chamomile', 'clay', 4294967295, 'left') RETURNING id INTO first_plant;
    INSERT INTO windowsill.leaf_ledger (player_id, request_id, line_no, reason, delta, garden_id, plant_id)
    VALUES (owner_id, request_id, 2, 'plant', -28, garden_id, first_plant);

    BEGIN
        INSERT INTO windowsill.plants (garden_id, content_version, species_key, pot_key, visual_seed, slot_key)
        VALUES (garden_id, 1, 'lavender', 'glaze', 3, 'left');
        RAISE EXCEPTION 'accepted a second plant in an occupied slot';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    BEGIN
        UPDATE windowsill.plants SET slot_key = NULL, shelf_position = 1 WHERE id = first_plant;
        RAISE EXCEPTION 'accepted an immature exhibit';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    BEGIN
        UPDATE windowsill.plants SET growth = 1, quality = 90, fit_samples = 100, fit_sum = 90,
            matured_at = now(), variant_key = 'moon_white' WHERE id = first_plant;
        RAISE EXCEPTION 'accepted a variant belonging to another species';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;

    UPDATE windowsill.plants SET growth = 1, quality = 90, fit_samples = 100, fit_sum = 90,
        matured_at = now(), variant_key = 'peach_dew', slot_key = NULL, shelf_position = 1
    WHERE id = first_plant;
    INSERT INTO windowsill.plants (garden_id, content_version, species_key, pot_key, visual_seed, shelf_position,
        growth, quality, fit_samples, fit_sum, matured_at, variant_key)
    VALUES (garden_id, 1, 'lavender', 'glaze', 5, 2, 1, 80, 100, 80, now(), 'normal') RETURNING id INTO second_plant;

    SET CONSTRAINTS windowsill.plants_shelf_position_unique DEFERRED;
    UPDATE windowsill.plants SET shelf_position = 3 - shelf_position WHERE id IN (first_plant, second_plant);
    SET CONSTRAINTS windowsill.plants_shelf_position_unique IMMEDIATE;

    BEGIN
        UPDATE windowsill.plants SET shelf_position = 9 WHERE id = first_plant;
        RAISE EXCEPTION 'accepted a position outside the shelf';
    EXCEPTION WHEN check_violation THEN NULL;
    END;

    IF windowsill.read_shared_shelf(token) IS NOT NULL THEN
        RAISE EXCEPTION 'unpublished shelf is accessible';
    END IF;
    UPDATE windowsill.gardens SET visibility = 'unlisted', share_token = token, published_at = now() WHERE id = garden_id;

    BEGIN
        INSERT INTO windowsill.shelf_likes (garden_id, garden_owner_id, visitor_id)
        VALUES (garden_id, owner_id, owner_id);
        RAISE EXCEPTION 'accepted a self-like';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    INSERT INTO windowsill.shelf_likes (garden_id, garden_owner_id, visitor_id) VALUES (garden_id, owner_id, visitor_id);
    INSERT INTO windowsill.shelf_likes (garden_id, garden_owner_id, visitor_id)
    VALUES (garden_id, owner_id, visitor_id) ON CONFLICT DO NOTHING;

    shared := windowsill.read_shared_shelf(token);
    IF (shared->>'likes')::int IS DISTINCT FROM 1 OR jsonb_array_length(shared->'plants') IS DISTINCT FROM 2
        OR shared #>> '{plants,0,species}' IS DISTINCT FROM 'lavender' OR shared ? 'playerId'
        OR (shared->'plants'->0) ? 'moisture' THEN
        RAISE EXCEPTION 'wrong public projection: %', shared;
    END IF;

    UPDATE windowsill.plants SET shelf_position = NULL, sold_at = now() WHERE id = first_plant;
    INSERT INTO windowsill.leaf_ledger (player_id, request_id, line_no, reason, delta, garden_id, plant_id)
    VALUES (owner_id, request_id, 3, 'sale', 67, garden_id, first_plant);
    BEGIN
        INSERT INTO windowsill.leaf_ledger (player_id, request_id, line_no, reason, delta, garden_id, plant_id)
        VALUES (owner_id, request_id, 4, 'sale', 67, garden_id, first_plant);
        RAISE EXCEPTION 'credited the same plant twice';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    INSERT INTO windowsill.earned_achievements (player_id, achievement_key, content_version) VALUES (owner_id, 'bloom', 1);
    INSERT INTO windowsill.leaf_ledger (player_id, request_id, line_no, reason, delta, achievement_key)
    VALUES (owner_id, request_id, 4, 'achievement', 18, 'bloom');
    BEGIN
        INSERT INTO windowsill.leaf_ledger (player_id, request_id, line_no, reason, delta, achievement_key)
        VALUES (owner_id, request_id, 5, 'achievement', 18, 'bloom');
        RAISE EXCEPTION 'credited the same achievement twice';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;

    IF (SELECT balance FROM windowsill.wallets WHERE player_id = owner_id) <> 86 - 28 + 67 + 18
        OR NOT EXISTS (SELECT 1 FROM windowsill.plant_album AS a WHERE a.garden_id = smoke.garden_id
            AND a.species_key = 'chamomile' AND a.mature_count = 1 AND a.rare_count = 1 AND a.best_quality = 90)
        OR jsonb_array_length(windowsill.read_shared_shelf(token)->'plants') IS DISTINCT FROM 1 THEN
        RAISE EXCEPTION 'sale, wallet, album or shared shelf is inconsistent';
    END IF;

    UPDATE windowsill.gardens SET visibility = 'private', share_token = NULL, published_at = NULL WHERE id = garden_id;
    IF windowsill.read_shared_shelf(token) IS NOT NULL THEN
        RAISE EXCEPTION 'old link is accessible after withdrawal';
    END IF;
END;
$$;

ROLLBACK;
