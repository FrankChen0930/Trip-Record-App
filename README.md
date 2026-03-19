# 🚴‍♂️ Trip Record App (2026 環島實戰版)

這是一個專為環島旅行設計的 Web App，整合了行程規劃、票務管理與影像存儲。本專案不僅注重使用者體驗 (UX)，更在技術底層實作了資料即時同步與分散式存儲優化。

## 🚀 技術亮點 (Technical Highlights)

- **3.5D Curved Navigation**: 利用 CSS 3D Matrix Transform 實作弧形日期選取器，具備視差滾動與透明度動態保底邏輯。
- **Real-time Sync**: 基於 Supabase Realtime (Postgres Changes)，實現多端裝置零延遲同步行程狀態。
- **Hybrid Storage Strategy**: 
    - 採用精選縮圖 (Supabase Storage) 與 外部直連 (Google Drive Link) 雙模存儲，極大化雲端空間利用率。
    - 內建 Google Drive 網址轉換器，支援外部連結直接預覽。
- **Ticket Intel Hub**: 針對台灣大眾運輸 (高鐵/台鐵) 實作分票領票工作流，支援專屬連結分派與一鍵領票狀態更新。

## 🛠️ 技術棧 (Tech Stack)

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Deployment**: Vercel (CI/CD)

## 📊 資料庫架構 (Database Schema)

本專案採用正規化設計，確保資料一致性：

| Table | 說明 |
| :--- | :--- |
| `trips` | 旅程元資料 (名稱、日期、封面圖連結) |
| `trip_itinerary` | 行程詳情 (含交通工具過濾、行程/票券類別區分) |
| `trip_photos` | 混合雲影像索引 (含 `is_storage` 狀態判定) |
| `trip_member_ticket_status` | 票券領取狀態與專屬 PNR 連結存儲 |

## 📦 部署與環境設定

1. **環境變數**: 需於 `.env.local` 設定 `NEXT_PUBLIC_SUPABASE_URL` 與 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。
2. **RLS 政策**: 確保所有資料表已啟動 Row Level Security 並配置正確的 `anon` 存取權限。
3. **Storage**: Bucket 名稱需為 `trip-photos` 並設定為 Public。

---
*Developed by Frank Chen as a practical CS engineering project.*
