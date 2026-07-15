-- ============================================================
-- P2a 修正：關閉建站初期遺留的 RLS（anon-only policy）
-- 背景：專案最初建表時開了 RLS 且 policy 只授權給 anon 角色，
--   導致登入後（authenticated 角色）所有查詢都回空資料——
--   症狀包含「所有成員都已被認領」與「登入後旅程/成員消失」。
-- P2a 階段的設計前提是「RLS 未開」，故先全部關閉；
--   P2b 時由 p2b_enable_rls.sql 重新以正確規則開啟。
-- 執行位置：Supabase Dashboard → SQL Editor
-- ============================================================

-- （選擇性）先確認現況：哪些表開了 RLS、policy 授權給誰
-- select tablename, rowsecurity from pg_tables where schemaname = 'public';
-- select tablename, policyname, roles, cmd from pg_policies where schemaname = 'public';

-- 關閉所有 public 表的 RLS（舊 policy 留著不生效，P2b 會一併清除）
do $$
declare r record;
begin
  for r in
    select tablename from pg_tables
    where schemaname = 'public' and rowsecurity
  loop
    execute format('alter table public.%I disable row level security', r.tablename);
  end loop;
end $$;

-- 驗證：rowsecurity 應全部為 false
select tablename, rowsecurity from pg_tables where schemaname = 'public';
