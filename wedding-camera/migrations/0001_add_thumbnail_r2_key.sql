-- Run once on existing D1 databases: wrangler d1 execute wedding-camera-db --remote --file=./migrations/0001_add_thumbnail_r2_key.sql
ALTER TABLE photos ADD COLUMN thumbnail_r2_key TEXT;
