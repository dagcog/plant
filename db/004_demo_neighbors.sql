BEGIN;

INSERT INTO windowsill.players (id,auth_issuer,auth_subject,display_name) VALUES
    ('00000000-0000-4000-8000-000000000001','demo','fern','蕨姨 · 示范花架'),
    ('00000000-0000-4000-8000-000000000002','demo','slow','小杏 · 示范花架');

INSERT INTO windowsill.gardens (id,player_id,content_version,title,game_seconds,settled_at,visibility,share_token,published_at) VALUES
    ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001',1,'蕨姨的玻璃房',18,now(),'public','00000000-0000-4000-8000-000000000021',now()),
    ('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000002',1,'慢半拍的午后',18,now(),'public','00000000-0000-4000-8000-000000000022',now());

INSERT INTO windowsill.plants (garden_id,content_version,species_key,pot_key,variant_key,visual_seed,shelf_position,
    matured_at,displayed_at,growth,fit_samples,fit_sum,quality) VALUES
    ('00000000-0000-4000-8000-000000000011',1,'oxalis','glaze','normal',628,1,now(),now(),1,100,91,91),
    ('00000000-0000-4000-8000-000000000011',1,'lavender','porcelain','moon_white',947,2,now(),now(),1,100,96,96),
    ('00000000-0000-4000-8000-000000000012',1,'chamomile','clay','peach_dew',859,1,now(),now(),1,100,93,93),
    ('00000000-0000-4000-8000-000000000012',1,'chamomile','porcelain','normal',571,2,now(),now(),1,100,78,78),
    ('00000000-0000-4000-8000-000000000012',1,'lavender','clay','normal',239,3,now(),now(),1,100,76,76);

COMMIT;
