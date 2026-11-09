BEGIN;

-- The second catalog shares the clock and growth algorithm. Existing plant rows keep their version.
INSERT INTO windowsill.content_releases
    (version, algorithm_key, opening_leaves, initial_game_seconds, offline_cap_seconds, clock_phases)
SELECT 2, algorithm_key, opening_leaves, initial_game_seconds, offline_cap_seconds, clock_phases
FROM windowsill.content_releases WHERE version = 1;

INSERT INTO windowsill.species_catalog
    (content_version, species_key, title, latin_name, description, seed_price, base_sale_value,
     base_growth_seconds, ideal_moisture, ideal_nutrition, ideal_light, render_config)
SELECT 2, species_key, title, latin_name, description, seed_price, base_sale_value,
    base_growth_seconds, ideal_moisture, ideal_nutrition, ideal_light, render_config
FROM windowsill.species_catalog WHERE content_version = 1;

INSERT INTO windowsill.species_catalog
    (content_version, species_key, title, latin_name, description, seed_price, base_sale_value,
     base_growth_seconds, ideal_moisture, ideal_nutrition, ideal_light, render_config)
VALUES
    (2, 'bear_paw', '熊童子', 'Cotyledon tomentosa', '偏爱干爽的土和明亮日光。', 20, 54, 135, 40, 56, 70, '{"kind":"procedural","model":"bear-paw"}'),
    (2, 'haworthia', '玉露', 'Haworthia cooperi', '喜欢柔和散射光，土壤微湿即可。', 24, 62, 150, 47, 54, 46, '{"kind":"glb","model":"haworthia","modelSet":"haworthia"}'),
    (2, 'peach_egg', '桃蛋', 'Graptopetalum amethystinum', '偏爱干爽的土和充足日光。', 26, 68, 165, 36, 55, 76, '{"kind":"procedural","model":"peach-egg"}');

INSERT INTO windowsill.species_variants (content_version, species_key, variant_key, title, is_rare, appearance)
SELECT 2, species_key, variant_key, title, is_rare, appearance
FROM windowsill.species_variants WHERE content_version = 1;

INSERT INTO windowsill.species_variants (content_version, species_key, variant_key, title, is_rare, appearance)
VALUES
    (2, 'bear_paw', 'normal', '常色', false, '{"leaf":"#81a865","petal":"#a46558","center":"#c7d7a0"}'),
    (2, 'bear_paw', 'honey_paw', '蜜糖熊爪', true, '{"leaf":"#e4cf82","petal":"#a46558","center":"#c7d7a0"}'),
    (2, 'haworthia', 'normal', '常色', false, '{"leaf":"#729c91","petal":"#b9cfcf","center":"#d8c1ae"}'),
    (2, 'haworthia', 'violet_glass', '紫晶露', true, '{"leaf":"#d8a8dc","petal":"#b9cfcf","center":"#d8c1ae"}'),
    (2, 'peach_egg', 'normal', '常色', false, '{"leaf":"#c88fa3","petal":"#e6b8c6","center":"#f5d9d8"}'),
    (2, 'peach_egg', 'violet_pearl', '紫雾桃珠', true, '{"leaf":"#b5a1d6","petal":"#e6b8c6","center":"#f5d9d8"}');

INSERT INTO windowsill.pot_catalog (content_version, pot_key, title, description, price, drainage, render_config)
SELECT 2, pot_key, title, description, price, drainage, render_config
FROM windowsill.pot_catalog WHERE content_version = 1;

INSERT INTO windowsill.slot_catalog (content_version, slot_key, title, display_order, light_offset, unlock_price)
SELECT 2, slot_key, title, display_order, light_offset, unlock_price
FROM windowsill.slot_catalog WHERE content_version = 1;

INSERT INTO windowsill.achievement_catalog (content_version, achievement_key, title, description, reward_leaves)
SELECT 2, achievement_key, title,
    CASE WHEN achievement_key = 'collection' THEN '记录洋甘菊、薰衣草和紫叶酢浆草' ELSE description END, reward_leaves
FROM windowsill.achievement_catalog WHERE content_version = 1;

INSERT INTO windowsill.achievement_catalog (content_version, achievement_key, title, description, reward_leaves)
VALUES (2, 'succulent_collection', '窗边多肉册', '记录熊童子、玉露和桃蛋', 24);

COMMIT;
