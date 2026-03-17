1. trips (旅程主檔案)
這是每趟旅行的「根」，所有行程與照片都掛在它下面。
| 欄位名 | 型別 | 說明 |
| :--- | :--- | :--- |
| id | uuid | 主鍵 (Primary Key) |
| name | text | 旅程名稱 (例：2026 畢業環島) |
| start_date | date | 開始日期 |
| end_date | date | 結束日期 |
| cover_url | text | 封面圖連結 (Unsplash 或自訂) |

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