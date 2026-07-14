-- ============================================================
-- P2a：為 trip_members 加上 Auth 連結欄位
-- 性質：純新增欄位，不開 RLS、不影響現有匿名存取。可安全執行。
-- 執行位置：Supabase Dashboard → SQL Editor
-- ============================================================

alter table trip_members add column if not exists email text;
alter table trip_members add column if not exists user_id uuid references auth.users(id);

-- email 唯一（忽略大小寫、允許多個 NULL）
create unique index if not exists trip_members_email_unique
  on trip_members (lower(email))
  where email is not null;

-- 之後請在 trip_members 為每位成員填入其 email（即他們登入時會收 Magic Link 的信箱）。
-- 範例：
--   update trip_members set email = 'someone@example.com' where nickname = '阿明';
