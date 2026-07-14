-- ============================================================
-- P2b：開啟 Row Level Security (RLS)
-- ⚠️ 只在「所有人都已登入並完成 user_id 綁定」後才執行。
-- 執行後，未登入（anon）將完全無法存取資料；登入後依下列規則授權。
-- 存取規則：無群組的旅程 → 所有登入者可存取；有群組的 → 僅該群組成員。
-- 成員 / 群組名冊 → 所有登入者可讀寫（共用）。
-- 執行位置：Supabase Dashboard → SQL Editor
-- ============================================================

-- 判斷目前登入者是否可存取某趟旅程（security definer：略過內部表的 RLS，避免遞迴）
create or replace function public.can_access_trip(t uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from trips tr
    where tr.id = t and (
      tr.group_id is null
      or exists (
        select 1
        from group_members gm
        join trip_members m on m.id = gm.member_id
        where gm.group_id = tr.group_id and m.user_id = auth.uid()
      )
    )
  );
$$;

-- ---- 以 trip_id 為主的資料表：用 can_access_trip 控管 ----
alter table trip_itinerary       enable row level security;
alter table trip_photos          enable row level security;
alter table trip_expenses        enable row level security;
alter table trip_bucket_list     enable row level security;
alter table trip_accommodations  enable row level security;
alter table trip_memos           enable row level security;
alter table trip_journals        enable row level security;

create policy itinerary_access      on trip_itinerary      for all to authenticated using (can_access_trip(trip_id)) with check (can_access_trip(trip_id));
create policy photos_access         on trip_photos         for all to authenticated using (can_access_trip(trip_id)) with check (can_access_trip(trip_id));
create policy expenses_access       on trip_expenses       for all to authenticated using (can_access_trip(trip_id)) with check (can_access_trip(trip_id));
create policy bucket_access         on trip_bucket_list    for all to authenticated using (can_access_trip(trip_id)) with check (can_access_trip(trip_id));
create policy accommodations_access on trip_accommodations for all to authenticated using (can_access_trip(trip_id)) with check (can_access_trip(trip_id));
create policy memos_access          on trip_memos          for all to authenticated using (can_access_trip(trip_id)) with check (can_access_trip(trip_id));
create policy journals_access       on trip_journals       for all to authenticated using (can_access_trip(trip_id)) with check (can_access_trip(trip_id));

-- ---- trips 本身 ----
alter table trips enable row level security;
create policy trips_access on trips for all to authenticated
  using (
    group_id is null
    or exists (select 1 from group_members gm join trip_members m on m.id = gm.member_id
               where gm.group_id = trips.group_id and m.user_id = auth.uid())
  )
  with check (
    group_id is null
    or exists (select 1 from group_members gm join trip_members m on m.id = gm.member_id
               where gm.group_id = trips.group_id and m.user_id = auth.uid())
  );

-- ---- 票券狀態：透過所屬行程的 trip 判斷 ----
alter table trip_member_ticket_status enable row level security;
create policy ticket_status_access on trip_member_ticket_status for all to authenticated
  using (exists (select 1 from trip_itinerary i where i.id = itinerary_id and can_access_trip(i.trip_id)))
  with check (exists (select 1 from trip_itinerary i where i.id = itinerary_id and can_access_trip(i.trip_id)));

-- ---- 共用名冊：所有登入者可讀寫 ----
alter table trip_members  enable row level security;
alter table groups        enable row level security;
alter table group_members enable row level security;

create policy members_access       on trip_members  for all to authenticated using (true) with check (true);
create policy groups_access        on groups        for all to authenticated using (true) with check (true);
create policy group_members_access on group_members for all to authenticated using (true) with check (true);

-- ============================================================
-- 緊急回滾（如出問題，逐表停用 RLS）：
--   alter table trip_itinerary disable row level security;
--   ...（其餘表同理）
-- 注意：trip-covers / trip-photos 等 Storage bucket 的存取是另一套
-- （storage.objects 的 policy），若原本設為 public 仍維持 public；
-- 照片儲存將於 P3 改為 Cloudflare R2。
-- ============================================================
