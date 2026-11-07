BEGIN;

INSERT INTO windowsill.content_releases
    (version, algorithm_key, opening_leaves, initial_game_seconds, offline_cap_seconds, clock_phases)
VALUES (1, 'growth_v1', 86, 18, 1800,
    '[{"id":"morning","seconds":80,"light":59},{"id":"noon","seconds":80,"light":88},{"id":"evening","seconds":80,"light":37}]');

INSERT INTO windowsill.species_catalog
    (content_version, species_key, title, latin_name, description, seed_price, base_sale_value,
     base_growth_seconds, ideal_moisture, ideal_nutrition, ideal_light, render_config)
VALUES
    (1, 'chamomile', '洋甘菊', 'Matricaria', '喜欢透亮的日光与微湿的土。', 13, 38, 100, 58, 57, 64, '{"kind":"procedural","model":"daisy"}'),
    (1, 'lavender', '薰衣草', 'Lavandula', '偏爱较干的土和充足日光。', 18, 49, 125, 43, 60, 76, '{"kind":"procedural","model":"spike"}'),
    (1, 'oxalis', '紫叶酢浆草', 'Oxalis', '喜欢略湿的土和柔和散射光。', 22, 56, 145, 66, 65, 48, '{"kind":"procedural","model":"clover"}');

INSERT INTO windowsill.species_variants
    (content_version, species_key, variant_key, title, is_rare, appearance)
VALUES
    (1, 'chamomile', 'normal', '常色', false, '{"petal":"#fff2cf","center":"#e8a02c","leaf":"#668644"}'),
    (1, 'chamomile', 'peach_dew', '蜜桃晨露', true, '{"petal":"#f4ae69","center":"#e8a02c","leaf":"#668644"}'),
    (1, 'lavender', 'normal', '常色', false, '{"petal":"#9682c8","center":"#c4a7e7","leaf":"#65846b"}'),
    (1, 'lavender', 'moon_white', '月白香穗', true, '{"petal":"#ffe6ee","center":"#c4a7e7","leaf":"#65846b"}'),
    (1, 'oxalis', 'normal', '常色', false, '{"petal":"#f3afbc","center":"#ffd383","leaf":"#8c4e77"}'),
    (1, 'oxalis', 'amber_leaf', '琥珀三叶', true, '{"petal":"#f9d897","center":"#ffd383","leaf":"#ba8249"}');

INSERT INTO windowsill.pot_catalog (content_version, pot_key, title, description, price, drainage, render_config)
VALUES
    (1, 'clay', '赤陶盆', '疏水快，适合偏干的品种。', 15, 1.18, '{"kind":"procedural","color":"#b9684d","rim":"#cf8b6b"}'),
    (1, 'glaze', '苔绿釉盆', '保水适中，釉面温润。', 22, 0.90, '{"kind":"procedural","color":"#6d8769","rim":"#a9b597"}'),
    (1, 'porcelain', '燕麦白瓷', '水分散失慢，适合喜湿植物。', 28, 0.72, '{"kind":"procedural","color":"#e2caab","rim":"#f6e3c9"}');

INSERT INTO windowsill.slot_catalog (content_version, slot_key, title, display_order, light_offset, unlock_price)
VALUES (1, 'left', '晨光位', 1, 0, 0), (1, 'middle', '明窗位', 2, 9, 0), (1, 'right', '窗影位', 3, -15, 48);

INSERT INTO windowsill.achievement_catalog (content_version, achievement_key, title, description, reward_leaves)
VALUES
    (1, 'bloom', '第一朵花', '让一株植物成熟', 18),
    (1, 'display', '窗边策展人', '把第一株植物摆上花架', 14),
    (1, 'sold', '带花回家', '售出第一株植物', 10),
    (1, 'rare', '意外之色', '培育出一株异色植物', 24),
    (1, 'full', '满窗皆绿', '解锁全部种植位', 10),
    (1, 'collection', '一本花簿', '记录全部品种', 20);

COMMIT;
