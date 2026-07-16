-- 探索清單（旅程之外的「想去 / 值得再去」口袋名單）
-- 可重複執行。

CREATE TABLE IF NOT EXISTS wish_places (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  place_id text,                 -- Google Places ID（有定位才有）
  lat double precision,
  lng double precision,
  address text,
  rating numeric,
  found_by uuid REFERENCES trip_members(id) ON DELETE SET NULL,  -- 誰發現的
  source_type text DEFAULT 'other'
    CHECK (source_type IN ('instagram', 'youtube', 'friend', 'visited', 'other')),  -- 怎麼發現的
  source_url text,               -- 來源連結（IG 短片等）
  note text,
  expires_at date,               -- 限時活動截止日（過期前端自動標「已結束」）
  business_status text,          -- Google businessStatus：OPERATIONAL / CLOSED_TEMPORARILY / CLOSED_PERMANENTLY
  status_checked_at timestamptz, -- 上次存活檢查時間
  created_at timestamptz DEFAULT now()
);

-- 事後驗證
SELECT column_name FROM information_schema.columns WHERE table_name = 'wish_places' ORDER BY ordinal_position;
