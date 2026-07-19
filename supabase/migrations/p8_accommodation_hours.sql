-- p8: 住宿入住/退房時間 + 行程卡營業時間快取（2026-07-19）
-- 在 Supabase SQL Editor 執行。**先跑這份再部署新前端**（否則住宿儲存會因欄位不存在而失敗）。

-- 1. 住宿卡：入住 / 退房時間（note 欄位早已存在，這次前端才開始用）
alter table trip_accommodations add column if not exists check_in  time;
alter table trip_accommodations add column if not exists check_out time;

-- 2. 行程卡營業時間快取：
--    有 place_id 的行程卡第一次顯示時會打 /api/places/hours（Google Place Details）
--    抓 regularOpeningHours，之後永久存這裡，不再耗 Google 配額。
--    格式：{ "weekdayDescriptions": ["星期一: 11:00 – 21:00", ...] }；
--    空陣列代表「查過了，該地點沒有營業時間資訊」（避免重複查）。
alter table trip_itinerary add column if not exists opening_hours jsonb;

-- 事後驗證：兩張表都該看到新欄位
-- select column_name from information_schema.columns where table_name = 'trip_accommodations';
-- select column_name from information_schema.columns where table_name = 'trip_itinerary';
