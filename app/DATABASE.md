1. trips (旅程主檔案)
這是每趟旅行的「根」，所有行程與照片都掛在它下面。
| 欄位名 | 型別 | 說明 |
| :--- | :--- | :--- |
| id | uuid | 主鍵 (Primary Key) |
| name | text | 旅程名稱 (例：2026 畢業環島) |
| start_date | date | 開始日期 |
| end_date | date | 結束日期 |
| cover_url | text | 封面圖連結 (Unsplash 或自訂) |
| group_id | uuid | 關聯到 groups.id (身分組) |

2. trip_itinerary (行程細節)
記錄每一天、每一格的具體計畫。
| 欄位名 | 型別 | 說明 |
| :--- | :--- | :--- |
| id | uuid | 主鍵 |
| trip_id | uuid | 關聯到 trips.id (外鍵) |
| day | int4 | 第幾天 (Day 1, Day 2...) |
| start_time | time | 開始時間 |
| end_time | time | 結束時間 (可為空) |
| location | text | 地點名稱或車次 |
| transport_type| text | 交通工具 (機車, 汽車, 火車, 高鐵, 步行) |
| item_type | text | 類別 (activity: 一般行程, ticket: 交通票券) |
| note | text | 備註或席位資訊 |
| map_url | text | Google Maps 連結 |

3. trip_photos (影像紀錄)
儲存上傳到 Storage 的照片索引。
| 欄位名 | 型別 | 說明 |
| :--- | :--- | :--- |
| id | uuid | 主鍵 |
| trip_id | uuid | 關聯到 trips.id |
| day | int4 | 這張照片屬於第幾天 |
| url | text | 照片的公開存取網址 (Public URL) |
| storage_path | text | 檔案在 Storage 裡的位址 (刪除檔案用) |
| is_storage | bool | 是否儲存在我們的 Supabase 空間 |

4. trip_member_ticket_status (票券與成員狀態)
處理「分票」與「領票進度」的邏輯表。
| 欄位名 | 型別 | 說明 |
| :--- | :--- | :--- |
| id | uuid | 主鍵 |
| itinerary_id | uuid | 關聯到 trip_itinerary.id |
| member_name | text | 成員名稱 (阿明, 小華...) |
| ticket_link | text | 該成員專屬的領票網址 |
| is_ready | bool | 是否已取票成功 |

5. trip_members (成員名冊)
| 欄位名 | 型別 | 說明 |
| :--- | :--- | :--- |
| id | uuid | 主鍵 |
| real_name | text | 真實姓名 |
| nickname | text | 顯示暱稱 |
| pin | text | 4 位數 PIN 碼 |
| created_at | timestamptz | 建立時間 |

6. trip_expenses (支出紀錄)
| 欄位名 | 型別 | 說明 |
| :--- | :--- | :--- |
| id | uuid | 主鍵 |
| trip_id | uuid | 關聯到 trips.id |
| item_name | text | 項目名稱 |
| amount | numeric | 金額 |
| payer | text | 代墊成員 |
| participants | text[] | 分攤對象陣列 |
| created_at | timestamptz | 建立時間 |

7. groups (身分組) ✨ NEW
類似 Discord 的身分組，用來分隔不同旅行團體。
| 欄位名 | 型別 | 說明 |
| :--- | :--- | :--- |
| id | uuid | 主鍵 |
| name | text | 群組名稱 (例：家庭、大學好友) |
| color | text | 標籤顏色 (預設 #3b82f6) |
| icon | text | 顯示 emoji (預設 👥) |
| created_at | timestamptz | 建立時間 |

8. group_members (群組成員關聯) ✨ NEW
多對多關係表，一個成員可屬於多個群組。
| 欄位名 | 型別 | 說明 |
| :--- | :--- | :--- |
| id | uuid | 主鍵 |
| group_id | uuid | 關聯到 groups.id |
| member_id | uuid | 關聯到 trip_members.id |
| UNIQUE | | (group_id, member_id) |

9. trip_journals (每日日記) ✨ NEW
每趟旅程每天一篇日記。
| 欄位名 | 型別 | 說明 |
| :--- | :--- | :--- |
| id | uuid | 主鍵 |
| trip_id | uuid | 關聯到 trips.id |
| day | int4 | 第幾天 |
| content | text | 日記內容 |
| created_at | timestamptz | 建立時間 |
| updated_at | timestamptz | 最後修改時間 |
| UNIQUE | | (trip_id, day) |

---
## 建表 SQL（在 Supabase SQL Editor 執行）

```sql
-- 身分組表
CREATE TABLE groups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  color text DEFAULT '#3b82f6',
  icon text DEFAULT '👥',
  created_at timestamptz DEFAULT now()
);

-- 成員與群組的多對多關係
CREATE TABLE group_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  member_id uuid REFERENCES trip_members(id) ON DELETE CASCADE,
  UNIQUE(group_id, member_id)
);

-- 旅程加入 group_id 關聯
ALTER TABLE trips ADD COLUMN group_id uuid REFERENCES groups(id);

-- 每日日記表
CREATE TABLE trip_journals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  day int4 NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(trip_id, day)
);
```