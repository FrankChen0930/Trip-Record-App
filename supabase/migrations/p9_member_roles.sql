-- p9: 成員角色（admin/member）+ 資料歸位（2026-07-20）
-- 在 Supabase SQL Editor 執行。**先跑這份再部署新前端**。

-- 1. 成員角色：admin 有完整管理權（名冊/身分組增刪改），member 唯讀。
--    注意：P2b（RLS）啟用前這只有 UI 層效力；P2b 的 policy 會引用此欄位補上強制力。
alter table trip_members add column if not exists role text not null default 'member'
  check (role in ('admin', 'member'));

-- 豆腐 = 管理員（發起人，email 已綁定 Auth）
update trip_members set role = 'admin' where nickname = '豆腐';

-- 2. 資料歸位：現有旅程全部屬於「小港人」（原本 group_id 都是 null ＝公開，任何身分組都看得到）
update trips
set group_id = '5250131e-0c9f-4157-b8d9-be1ab54350ab'  -- 小港人
where group_id is null;

-- 3. 豆腐加入 💘 身分組（之後掛在 💘 的旅程豆腐與女友都看得到）
insert into group_members (group_id, member_id)
values ('aaf87af0-59df-4e08-b3c0-cd8cc687cf66', '144a9ab4-aa04-4bea-a965-f9ba6c53109e')
on conflict (group_id, member_id) do nothing;

-- 事後驗證：
-- select nickname, role from trip_members;                -- 豆腐=admin，其餘=member
-- select name, group_id from trips;                       -- 四個旅程都有 group_id
-- select * from group_members where group_id = 'aaf87af0-59df-4e08-b3c0-cd8cc687cf66';
