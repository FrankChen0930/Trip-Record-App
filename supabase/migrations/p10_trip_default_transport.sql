-- p10: 旅程主要交通工具（2026-07-20）
-- 在 Supabase SQL Editor 執行。**先跑這份再部署新前端**（否則設定主要交通會因欄位不存在而失敗）。

-- 新增行程卡（拖入備選、格子 + 鈕、行程主頁表單）預設帶這個交通工具，不用每張卡改。
alter table trips add column if not exists default_transport text not null default '機車';

-- 事後驗證：
-- select name, default_transport from trips;
