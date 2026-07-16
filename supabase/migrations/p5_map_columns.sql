-- P5a/P5b：地圖與建議景點所需欄位
-- 全部使用 IF NOT EXISTS，可重複執行；trip_itinerary 的 lat/lng 建表時已存在故只補 place_id。

ALTER TABLE trip_itinerary ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE trip_itinerary ADD COLUMN IF NOT EXISTS lng double precision;
ALTER TABLE trip_itinerary ADD COLUMN IF NOT EXISTS place_id text;

ALTER TABLE trip_bucket_list ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE trip_bucket_list ADD COLUMN IF NOT EXISTS lng double precision;
ALTER TABLE trip_bucket_list ADD COLUMN IF NOT EXISTS place_id text;
ALTER TABLE trip_bucket_list ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE trip_bucket_list ADD COLUMN IF NOT EXISTS rating numeric;

-- 事後驗證：兩張表應各自看得到上述欄位
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_name IN ('trip_itinerary', 'trip_bucket_list')
  AND column_name IN ('lat', 'lng', 'place_id', 'address', 'rating')
ORDER BY table_name, column_name;
