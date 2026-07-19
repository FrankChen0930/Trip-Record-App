# STATUS — Travel Record App 重構進度與交接

> 最後更新：2026-07-20（**P6 前半：成員角色 + 身分組可見性**已上線 `cfde22f`，p8/p9 migrations 皆已跑。
> 豆腐=admin 可直接建成員/管身分組；成員只見同組成員；女友上車＝新增成員勾 💘 → 她輸 PIN。
> P2b 仍擱置等成員信箱到齊；P6 後半（email 邀請、RLS 引用 role）依賴 P2b。）
> 用途：任何新的 Claude / Claude Code session 讀這份就能接手，不必重問。
> 完整藍圖見 `REDESIGN_ARCHITECTURE.md`；Auth/RLS 步驟見 `P2_AUTH_RLS_RUNBOOK.md`。

---

## 專案一句話

環島旅行記錄 Web App（`my-trip-app`）。正在做「前端 + 架構重構 + 功能擴充」。
技術棧：Next.js 16 (App Router, 全 client component) · React 19 · TypeScript · Tailwind 4 ·
Supabase (Postgres + Auth + Storage + Realtime) · TanStack Query · Zustand · dnd-kit ·
leaflet/react-leaflet(P5 地圖) · Google Places API(伺服器代理) · OSRM(交通時間) · xlsx。

---

## 進度總覽

| 階段 | 內容 | 狀態 |
| :-- | :-- | :-- |
| P0 | 地基：design tokens、TanStack Query、Zustand、Supabase client 分層、UI primitives、feature 骨架 | ✅ 完成 |
| P1 | 資料層遷移：journal / members / expenses / groups / 首頁 / trip 主頁 / plan 全改用 feature hooks；結清演算法抽純函式 + 單元測試 | ✅ 完成（photos 頁刻意留給 P3） |
| P2a | Auth 程式：/login(Magic Link)、useSession、綁定橋接（user_id→email→PIN 認領）、SQL、runbook | ✅ 程式完成（含自助 PIN 認領），**尚未啟用** |
| P2b | 開啟 RLS + 未登入導向 /login 閘門 | ⏸ **擱置中**：使用者這幾天陸續讓成員登入綁定，到齊後再做（SQL 已備好） |
| P3 | 照片改存 Cloudflare R2（建 bucket、presigned 上傳、從 Google Drive 遷移約 1.76GB、重寫 photos 頁） | ✅ 完成（2026-07-16；543 檔上線，Drive 原檔留作備份待使用者確認後自行處理） |
| P4 | 視覺重構：把「湖水青旅」設計系統套到所有頁面 | ✅ 完成（2026-07-15；photos 頁除外，留給 P3 重寫時套） |
| P5a | 內建地圖（Leaflet + CARTO tile） | ✅ 完成（2026-07-16；migration 已跑、已上線） |
| P5b | 建議景點 + 交通時間（Google Places + OSRM） | ✅ 完成（2026-07-16；金鑰/env 就緒、端到端實測通過） |
| P5d | 規劃頁互動打磨：雙向拖曳、卡片編輯/刪除、地圖提示（對標 Funliday/去趣） | ✅ 完成（2026-07-16，使用者已試用） |
| P5e | Plan 頁改版：常駐地圖 2/3 + 視窗化行程表 + inline 搜尋/探索/定位 | ✅ 完成（2026-07-16，含 z-index/h-dvh 回饋修正） |
| — | 探索清單 wish_places（/places 頁、來源/發現者/限時/存活檢查、Plan 匯入） | ✅ 完成（2026-07-16；p7 migration 已跑、部署 200） |
| — | 分享入口（PWA share target + /places 預填） | ✅ 程式完成（2026-07-16；**IG 實測待使用者**，iOS 需捷徑） |
| P5c | AI 行程建議 | ⬜ 未開始（最後、可選） |
| P6 | 成員管理與權限：email 邀請成員、身分組分級控制權限（2026-07-15 使用者新需求） | ⬜ 未開始，**依賴 P2b**（權限強制力靠 RLS） |

---

## 架構慣例（之後每頁都照這個，勿回退）

**目錄**：`app/` 只放路由與組裝（薄）；邏輯放 `features/<name>/`：
```
features/<name>/
  api.ts        # 集中此功能的 Supabase 查詢/寫入（頁面不再直接 supabase.from）
  hooks/        # 用 TanStack Query 包成 useXxx（查詢）與 mutation
  components/   # 此功能專屬 UI（目前多為空，P4 會用到）
```

**資料流規範**：
- 伺服器資料一律走 `api.ts` + TanStack Query hook，**頁面裡不要再出現 `supabase.from(...)`**。
- 共用查詢已存在並跨頁複用：`useTrip`、`useMembers`、`useGroups`/`useGroupMembers`（靠 queryKey 共享快取）。
- Realtime 訂閱收在對應 hook 內（見 `features/expenses/useExpenses.ts`、`features/itinerary/useItinerary.ts`）。
- 寫入用 mutation，成功後 `invalidateQueries` 讓相關 key 重抓；需要即時手感的用 `setQueryData` 樂觀更新（見 `features/memo`、`features/plan`）。
- 跨頁小狀態用 Zustand（`stores/ui.ts`、`stores/session.ts`）。
- 設計系統 primitives 從 `@/components/ui` 取（Button/Card/Badge/Input）；顏色用 CSS 變數（見下）。

**設計 tokens（湖水青旅，明亮冷色）**在 `app/globals.css`：
`--color-primary #1D9E75`、`--color-primary-strong #0F6E56`、`--color-primary-soft #CDEEE2`、
`--color-bg-page #F2FAF7`、`--color-surface #FFFFFF`、`--color-ink #1F2A27`、`--color-ink-muted #6B7C77`、
圓角 `--radius-card 12px` / `--radius-control 9px` / `--radius-pill 999px`。舊 tokens 仍在，P4 逐頁換掉。

**遷移一頁的範式**（P1 已做 7 頁，可照抄）：
1. 在 `features/X/api.ts` 寫查詢/寫入；`hooks/` 寫 `useX`(query) 與 mutation。
2. 頁面移除 `fetchData()` 與所有 `supabase.from`，改呼叫 hooks；`loading` 取自 query 的 `isLoading`。
3. mutation 的 `catch` 用型別安全寫法：`error instanceof Error ? error.message : '未知錯誤'`（勿用 `catch (e: any)`）。
4. 跑 `npm run typecheck` 與（若動到帳務）`npm test` 驗證。

---

## 驗證指令

- `npm run typecheck` — 型別檢查（用 `tsconfig.check.json`，見下方環境註記）。
- `npm test` — settle 結清演算法單元測試（`features/expenses/settle.test.ts`，目前 4/4 綠）。
- `npm run lint` — ESLint。
- `npm run build` / `npm run dev` — Next 建置 / 開發。

> **環境註記（重要）**：這些檔案先前是在一個「檔案掛載會間歇截斷寫入」的沙盒環境編輯的，
> 因此 Next 產生的 `.next/dev/types/routes.d.ts` 偶爾會被截斷，讓一般 `tsc` 誤報。
> 為此加了 `tsconfig.check.json` + `env.check.d.ts`，`npm run typecheck` 會跳過 `.next` 只檢查原始碼。
> **在 Claude Code（本機終端機）沒有這個掛載問題**，可以放心直接用 `tsc --noEmit`、`next build`；
> `tsconfig.check.json` / `env.check.d.ts` 留著無妨，不想要可刪。

---

## 目前卡在哪 / 各階段下一步

### P2（Auth + RLS）— 找到登入後讀不到資料的根因，等一個 SQL 步驟（2026-07-15）

**🔴 根因（2026-07-15 確診）：建站初期遺留的 RLS + anon-only policy**
- 專案最初建表時就開了 RLS，policy 只授權 `anon` 角色（見 README「配置正確的 anon 存取權限」）。
- 未登入時走 anon → 一切正常，所以先前誤判「RLS 未開」；
  **登入後**改用 authenticated 角色 → 沒有任何 policy 適用 → 所有表回 `200 []`（不報錯）。
- 症狀對照：認領畫面顯示「所有成員都已被認領」（成員名單被 RLS 濾成空）＝此因；
  先前「登入過的瀏覽器旅程/成員消失、Clear site data 恢復」也是此因
  （清資料＝登出＝變回 anon），**並非**舊 session 殘留——舊結論已修正。
- 已驗證：DB 內 4 位成員 `user_id` 全為 null（沒有被誤認領）；anon REST 查詢正常；
  部署 bundle 為最新版且指向正確 Supabase 專案。

**待辦（接手先看這裡）**：
1. **【使用者手動】Supabase SQL Editor 執行 `supabase/migrations/p2a_disable_legacy_rls.sql`**
   （關閉所有遺留 RLS；腳本內含事前/事後驗證查詢）。跑完不用重寄信，重新整理頁面即可。
2. **完成認領流程 end-to-end 驗證**（原步驟不變）：登入後認領畫面列出 4 位成員（豆腐/芙芙/LuBu/銅魔像）
   → 錯誤 PIN 被拒 → 正確 PIN 綁定成功 → 重新整理不再出現認領畫面 →
   Supabase 查 `trip_members` 確認 `user_id`/`email` 已寫入。
   （注意 email rate limit：內建 SMTP 每小時只能寄 2~4 封；已有 session 就不用重寄。）
3. 其餘 3 位成員陸續登入綁定（**2026-07-15 決定：不趕，這幾天慢慢加，P2b 擱置到到齊為止**）。
   兩種上車方式（現有功能即可，不需新程式）：
   - A：成員自己 /login 寄信登入 → 認領畫面選自己 + 輸入 PIN。
   - B：管理者先在 Supabase Table Editor 幫該成員填 `email` → 對方登入即自動綁定（跳過認領畫面）。
4. 全員綁定後 → 執行 P2b（跑 `p2b_enable_rls.sql` + 加未登入導向閘門 + 移除 localStorage 橋接）。

**2026-07-15 已完成的程式修正**：
- `ClaimMember`：空名單（異常，多為權限問題）與「全被認領」分開顯示，前者提供重試。
- `p2b_enable_rls.sql`：開頭加「drop 掉 public schema 全部舊 policy」，避免撞名 +
  防止遺留 anon policy 讓未登入者繞過 RLS。
- **首頁登入入口完成**：`features/auth/components/AuthStatus.tsx` 放在 Sidebar 底部——
  未登入顯示「登入」連結；已登入顯示綁定成員暱稱（未綁定則 email）+ 登出鈕
  （登出會清 `localStorage.my_member_id`）。

**已驗證正常（排查結論，勿重查）**：
- Vercel Git 整合曾斷線（4/7 後的 push 都沒觸發部署），使用者已重新連結，現在 push 會自動部署。
- 部署 bundle 的 Supabase URL/anon key 與本機一致且有效；資料都在；CORS 正常。
- Supabase 後台：Email provider 已啟用、Site URL 與 Redirect URLs 已設好（trip-record-app.vercel.app）。

**SMTP 註記**：正式讓大家綁定前，若 rate limit 很煩，可在 Supabase → Project Settings → Auth 接自訂 SMTP
（如 Resend 免費額度），限額就能自己調；4 人自用平時夠用，只是測試期密集寄信會撞牆。

#### 原始規劃備忘
- 已完成：`features/auth/`(api、useSession、AuthBridge、components/ClaimMember)、`app/login/page.tsx`；
  `trip_members` 已加 `email`、`user_id` 欄位（**使用者已在 Supabase 執行 `p2a_add_member_auth_columns.sql`**，欄位就位，RLS 未開）。
- **自助 PIN 認領已實作**（2026-07-15）。`AuthBridge` 對應順序：
  1. `user_id` 找成員（已綁定者換 email 也認得）→ 2. email 對得到且未綁定 → 自動綁定 →
  3. 都對不到 → 顯示 `ClaimMember` 全螢幕認領畫面（選未綁定成員 + 輸入 4 位 PIN，
     PIN 與「未被認領」都放在 update 的 where 條件一次驗證）。成功後寫 `localStorage.my_member_id`。
  P2a 期間認領畫面保留「稍後再說」可關閉（RLS 未開，不綁也能用）；P2b 時移除。
- 註：PIN 為明碼且名冊對登入者可讀，認領防「選錯人/誤綁」而非惡意攻擊（朋友團自用可接受）。
- 之後才做 P2b：先確認大家都綁定 → 跑 `supabase/migrations/p2b_enable_rls.sql`（`trip_members` policy 為
  登入者全可讀寫，認領流程開 RLS 後仍可運作，已確認）→ 加「未登入導向 /login」閘門、移除 localStorage 橋接。
- 啟用前提：Supabase 後台需開 Email 登入 provider 並設定 Redirect URLs（見 runbook 階段 A 第 1 步）。

### P3（R2 照片）— ✅ 完成（2026-07-16）

**已完成（2026-07-16）**：
- 使用者已建好 R2：bucket `trip-photos`、API token；憑證在 `.env.local`（`R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET`/`NEXT_PUBLIC_R2_PUBLIC_URL`）。
- 伺服器端：`lib/r2.ts`（S3 client，secret 只在伺服器）＋ `app/api/photos/presign`（簽發 PUT URL，白名單副檔名）＋ `app/api/photos/object`（DELETE，只允許 `trips/` 前綴）。
- 前端：`features/photos/`（api.ts + usePhotos + usePhotoMutations + lib/compress.ts）。
  上傳流程＝瀏覽器 canvas 壓 WebP（長邊 2560、q0.82、EXIF 方向校正）→ presigned PUT 直傳 R2 → insert `trip_photos`。
  影片（mp4/mov）原檔直傳；Lightbox 已支援影片播放。
- **欄位決策（與原規劃不同，勿改回）**：沒加新欄位。沿用 `storage_path`＝R2 key（`trips/{tripId}/day{N}/{id}.webp`）、
  `is_storage=true`；顯示網址由 `photoDisplayUrl()` 用 `NEXT_PUBLIC_R2_PUBLIC_URL + storage_path` 組出（將來換自訂網域只改 env）。
  外部連結照片照舊走 `url` 欄位。
- photos 頁重寫完成：進 feature 層 + TanStack Query、Lagoon Teal、多檔上傳含進度、影片卡片。typecheck/build ✅。
- 遷移：環島 Drive 資料夾（Day 0–7，543 檔＝535 JPG + 8 影片，1.8GB）已全數下載並壓縮上傳到 R2
  （腳本在 session scratchpad：drive_list.py / drive_download.py / compress_upload.py / db_insert.py）。
  DB 寫入（db_insert.py）等公開網址才能跑：`created_at`＝EXIF 拍攝時間（頁面按 created_at 排序＝拍攝順序），
  並會刪掉舊的「Drive 資料夾連結」row（ca640873…）。

**收尾驗證（2026-07-16，全綠）**：
- 使用者已完成：Public Development URL（`https://pub-84a828852afa4fe6ac6fc6de5e5ce4ec.r2.dev`，
  已更新 `.env.local` 的 `NEXT_PUBLIC_R2_PUBLIC_URL`）、bucket CORS、Vercel 五個 R2 env vars。
- 公開網址 HEAD 測試 200 image/webp；CORS preflight（PUT from trip-record-app.vercel.app）204 通過。
- db_insert.py 已跑：543 rows 寫入 `trip_photos`，每日張數 Day0–7 = 31/17/89/93/154/96/61/2
  與 Drive 資料夾一致；舊「Drive 資料夾連結」row 已刪。
- **Google Drive 原檔尚未刪除**：留作備份，使用者在網頁確認後自行決定；
  本機備份在 session scratchpad `drive/`（暫存目錄，會被系統清掉，別當長期備份）。
- R2 用量：約 817 MB / 免費 10 GB。

### P4（視覺重構）— ✅ 完成（2026-07-15）
- 已把湖水青旅 tokens 套到全部頁面：globals.css 主題層（Toast/Modal/Confirm/BottomTabs/badges/hero 漸層）、
  Sidebar/Skeleton/AuthStatus、首頁、members、groups、trip 主頁、plan、memo、journal、expense、SpreadsheetImport。
- 特色元件保留（只換色不動互動）：trip 主頁 3D 日期選擇器、交通色帶、支出墊付進度條、封面視差。
- **語意色刻意保留，勿「統一」掉**：交通工具色（機車藍/汽車綠/火車橙/高鐵紫/步行灰）、
  行程分類卡（食=橙、宿=indigo/紫、移動=indigo、OPTIONAL=藍、票券=amber）、欠款紅、自訂分攤橙。
- 驗證：typecheck ✅ / test 4/4 ✅ / build ✅ / lint 前後同為 65 個 pre-existing 問題（無新增回歸，
  多為 SpreadsheetImport 的 no-explicit-any 與 set-state-in-effect 舊警告，可日後專門清）。
- photos 頁未動（P3 重寫時直接用新設計）。深色模式未做（可後補）。

### P5a 地圖 / P5b 建議景點 — ✅ 完成（2026-07-16）

**使用者已完成（2026-07-16）**：migration 已跑、Vercel 已加 `GOOGLE_PLACES_API_KEY`、
台南備選池 21 筆已補定位、當日地圖已看到。

**架構決策（勿改回）**：
- 金鑰只在伺服器：`lib/places.ts` + `app/api/places/search|nearby`（FieldMask 限縮在低價 SKU、
  maxResultCount 8/12；前端「送出才查」+ TanStack Query 永久快取，控制在每月免費 5,000 次內）。
- 底圖：CARTO Voyager raster tile（免費、免金鑰），**沒有**用 MapTiler/Mapbox（使用者同意，省一把金鑰）。
- 交通時間：OSRM 公開服務（routing.openstreetmap.de，免費免金鑰）——機車/汽車=driving、步行=foot、
  火車/高鐵不估（道路路由不適用）。**沒有**用 Google Directions。
- 舊行程不回填座標（使用者同意「過去的就過了」）；備選池舊項目（台南）靠「補定位」鈕補座標。

**程式落點**：
- `features/map/`：`TripMap.tsx`（Leaflet 封裝，頁面用 next/dynamic ssr:false 載入）、
  `DayRouteMap.tsx`（trip 主頁當日路線卡，無座標點時整卡隱藏）、
  ~~`MapPickerModal.tsx`~~（P5b 時的全螢幕地圖，**P5e 已刪除**，功能併入 `PlanMapPanel.tsx`）、
  `hooks/useOsrmRoute.ts`（useDayTravelTimes：相鄰定位點交通時間，回 `{目的地行程id: leg}`）。
- `features/suggestions/`：`api.ts`（打自家代理）、hooks（usePlaceSearch/useNearby，都是「送出才查」）、
  `PlaceCard.tsx`、`PlaceLocateField.tsx`（trip 主頁行程表單內的定位欄）。
- 資料流：備選池項目定位後 `lat/lng/place_id/address/rating` 入 `trip_bucket_list`；
  拖進行程表時 `useAssignBucket` 把座標一併帶進 `trip_itinerary`；行程表單也可直接定位。
- 驗證已全綠：typecheck / test 4/4 / build / lint（兩頁面既有問題 13→12，新檔案 0 問題）/
  代理端到端 curl 通（赤崁樓、台南牛肉湯）/ OSRM driving+foot 通 / 金鑰不在 client bundle。

### P5d 規劃頁互動打磨 — ✅ 程式完成（2026-07-16）
> 起因：使用者反映「卡片樣式的元素卻不能編輯/刪除/拖曳」，標準對標 **Funliday / 去趣**
> （已存長期記憶 ux-standard：卡片一律要能編輯/刪除/拖曳、操作鈕不能只靠 hover）。

- **雙向拖曳**：plan 頁行程格卡可拖到別格（改天/改時間，`useMoveItinerary` 樂觀更新）、
  拖回備選池（退回備選，保留名稱/備註/連結/座標，`useUnassignItinerary`，與 useAssignBucket 互為鏡像）。
- **點擊編輯**：行程格卡點擊開編輯 Modal（時間/名稱/交通/備註/Google 定位欄）；
  備選池卡點擊開編輯 Modal（名稱/分類/連結/金額/備註），卡上加常駐刪除鈕（confirm 保護）＋定位鈕。
- **主頁小修**：行程卡編輯/刪除鈕改常駐（原 hover 才顯示，手機摸不到）；
  當天沒定位點時顯示可關提示條（引導去定位/去規劃，session 內有效，不寫 localStorage）。
- 驗證：typecheck ✅ / test 4/4 ✅ / build ✅ / lint 既有問題 13→11（新程式碼 0 問題）。
- **後續**：使用者試用後要再討論「整體方便性對標市面 App」的下一輪改善清單。

### P5e Plan 頁改版 — ✅ 程式完成（2026-07-16，使用者已確認開工順序）
- 版面：`[常駐地圖 lg:flex-2] [行程表 lg:flex-1 視窗化內部捲動] [備選池 w-64]`；
  小螢幕上下堆疊（地圖 38vh、行程表 flex-1、備選池 h-56）。
- 新元件 `features/map/components/PlanMapPanel.tsx`：搜尋列（左上）、探索附近（右上）、
  浮動結果卡列（左側，可清除）、補定位模式橫幅；地圖同時畫已排行程點（深青、Day 編號）＋
  備選池定位點（靛藍小點）＋搜尋（青）/探索（橘）結果。
- **MapPickerModal 已刪除**（被 PlanMapPanel 完全取代；要找舊碼看 git history）。
- 行程表格線容器由 `max-w-full overflow-hidden` 改 `w-max`——原寫法會把超出寬度的天數裁掉，
  改後在視窗內雙向捲動（此為既有 bug，順手修）。
- 驗證：typecheck ✅ / test 4/4 ✅ / build ✅ / lint 新程式碼 0 問題。
- **2026-07-16 使用者回饋修正**：(1) 三處地圖容器（PlanMapPanel / DayRouteMap / places 頁）加 `isolate`——
  Leaflet 內部 z-index 400–1000 會蓋過側欄 z-200，isolate 把它關進自己的 stacking context；
  (2) plan 頁根元素 `min-h-screen`→`h-dvh` 鎖視窗高度，行程表/備選池只在面板內捲、地圖不動。

### 探索清單 MVP — ✅ 完成（2026-07-16；p7 migration 已跑，anon REST 查 `wish_places` 回 200）
- 結構：`features/wishlist/`（api + useWishPlaces/wishStatus + mutations + useStaleStatusCheck）、
  `app/places/page.tsx`（地圖＋篩選＋卡片牆＋新增/編輯 Modal）、Sidebar 入口「探索清單」、
  Plan 頁備選池 Compass 鈕＝「從探索清單匯入」（place_id 去重、已結束/歇業降透明度仍可加）。
- 欄位：來源（IG/YT/朋友/去過/其他）＋來源連結、發現者（trip_members）、限時截止日
  （過期前端自動標「已結束」，見 `wishStatus()`）、`business_status`＋`status_checked_at`。
- 存活檢查：`api/places/details` 代理（FieldMask 只取 businessStatus，已實測 OPERATIONAL 回傳正常）；
  進頁自動補查「>30 天未檢查」前 5 筆＋卡片手動重查鈕；Google 查無此點回 `NOT_FOUND` 視同歇業。
- 驗證：typecheck ✅ / build ✅（/places、/api/places/details 已註冊）/ lint 新程式碼 0 問題。

### 分享入口 — ✅ 程式完成（2026-07-16）；**IG 端實測待使用者**（說要之後再測）
- `public/manifest.json` 加 `share_target`（GET → /places，params 對應 shared_title/text/url）。
- /places 頁掛載時讀 `?shared_*` 參數 → 自動開新增表單並預填（從 text 抽 URL、
  依網域自動選 IG/YT 來源、replaceState 清參數防重複觸發）。
- **Android 使用方式**：部署後用 Chrome 開網站 → 選單「加入主畫面（安裝應用程式）」→
  之後 IG 分享選單就會出現本 App。**iOS**：Safari 不支援 share target，
  需建捷徑（接收 URL → 開啟 `https://trip-record-app.vercel.app/places?shared_url=[捷徑輸入]`）。
- 注意：share target 只在**部署版**生效（PWA 需 HTTPS 安裝）。

### 2026-07-20 規劃頁打磨：凍結時間欄 + 主要交通工具 — ✅ 程式完成，**等 p10 migration 跑完才能部署**
> 使用者回饋：(1) 行程表水平捲到 Day 3 時時間欄跟著消失、對不到時間；
> (2) 這次出門開車，不想每張行程卡都手動把機車改汽車。

- **凍結時間欄**：時間欄 `sticky left-0 z-30`、天數列 `z-10→z-40`、左上角落格 `sticky left-0`（雙向凍結）、
  格內 + 鈕 `z-50→z-20`（原本就會蓋到 sticky 天數列，順手修）。
- **主要交通工具（p10）**：`trips.default_transport`（預設'機車'，**使用者要先跑
  `supabase/migrations/p10_trip_default_transport.sql`**）。
  規劃頁 header 新增「主要交通：X」鈕 → Modal 選 機車/汽車/火車/高鐵/步行 +
  可勾「同時套用到現有 N 張行程卡」（bulk update trip_itinerary.transport_type）。
  預設值吃進：`useAssignBucket`/`useInsertItinerary`（帶第二參數 defaultTransport）與
  行程主頁新增表單 resetForm。個別卡片編輯仍可改。
- 驗證：typecheck ✅ / test 4/4 ✅ / build ✅ / lint 9 個全為既有問題（新程式 0）。

### 2026-07-20 Google 地圖清單匯入備選池 — ✅ 完成（已上線 `87960b8`，正式站實測 14 點解析通過）
> 使用者需求：貼 Google Maps「已儲存清單」分享連結（maps.app.goo.gl/…）→ 整份清單倒進備選池。

- **原理（無官方 API，內部端點反解）**：跟隨短連結重導向 → 從最終網址抽清單 token
  （`!2s<token>!3e` 或 `/maps/placelists/list/<token>`）→ 打 `google.com/maps/preview/entitylist/getlist`
  （公開分享清單**免登入**）→ 去掉 `)]}'` 前綴解析巢狀陣列：`root[4]`=清單名、`root[8]`=項目、
  每項 `[2]`=名稱、`[3]`=使用者備註、`[1][4]`=地址、`[1][5][2..3]`=lat/lng。**沒有 ChIJ place_id**
  （只有 CID/feature id），故匯入項 place_id=null，之後可用備選池既有「補定位」鈕補。
  ⚠️ Google 改版格式就會壞——lib 內已包成單一友善錯誤，屆時重新抓一次頁面對欄位即可。
- 程式：`lib/googleList.ts`（host 白名單防 SSRF + 解析）、`app/api/places/import-list`（POST {url}）、
  plan 頁備選池 ListPlus 鈕 → Modal（貼連結→解析→勾選匯入，同名項預設不勾標「已在池中」、
  全選/全取消、名稱含民宿/飯店等自動歸 accommodation 分類）。
- 驗證：typecheck/build ✅、新程式 lint 0 問題（plan 頁剩 1 個 a2adda8 就存在的 set-state-in-effect）、
  本機 next start 實測使用者實際清單（嘉義/阿里山 14 點）解析正確、非 Google 網域被擋。
- 附帶：`bucketList` 包 useMemo（原每 render 新參考，讓下游 memo 失效）。

### 2026-07-20 P6 前半：成員角色 + 身分組可見性 — ✅ 完成（已部署 `cfde22f`；p9 migration 已跑，
> REST 驗證：豆腐=admin、四旅程掛小港人、💘 含豆腐；home/members 部署 200）
> 使用者需求：自己（豆腐）要有絕對掌控權、可直接建立成員（兩天後要跟女友出遊，對方還不在系統內）、
> 成員只能看見同身分組的成員。⚠️ P2b 前這些都只有 UI 層效力（STATUS 既有註記），RLS 開啟後由 policy 補強制力。

- **p9 migration（使用者要先跑）**`supabase/migrations/p9_member_roles.sql`：
  `trip_members.role`（admin|member，預設 member）、豆腐＝admin；
  四個既有旅程 `group_id` 從 null（公開）改掛「小港人」；豆腐加入「💘」身分組（使用者已自行建組，原本 0 成員）。
- **新 hooks**（`features/members/hooks/`）：`useCurrentMember`（localStorage.my_member_id → me/isAdmin）、
  `useVisibleMembers`（admin 全部；member 只看同組成員含自己；未驗證＝空）、
  `useTripMembers`（旅程掛組→該組成員；無組→可見成員。記帳/票券名單用這個，女友旅程不會再列出小港人全員）。
- **頁面權限**：成員頁（列表走可見性、新增/刪除限 admin、刪除鈕改常駐、admin 徽章、新增時可勾身分組——
  `useAddMember` 支援 groupIds，`membersApi.create` 改 `.select().single()` 回傳新 id）；
  身分組頁（非 admin 只見自己的組且唯讀）；首頁（admin 看全部旅程；未驗證身分看不到旅程，空狀態導去輸入 PIN）；
  places 頁發現者名單走可見成員。
- **女友上車流程**：豆腐在成員頁「+ 新增成員」（填暱稱/姓名/PIN、勾 💘）→ 她開網站 → 成員名冊輸 PIN
  → 首頁就只看得到掛在 💘 的旅程。之後要 email 綁定再走 P2a 流程（Table Editor 填 email 即自動綁）。
- 待辦（P6 後半，依賴 P2b）：email 邀請（service role）、RLS policy 引用 role、群組級 editor/viewer（需要再說）。

### 2026-07-19 使用回饋打磨（第一輪）— ✅ 完成（已部署，p8 migration 已跑）
> 使用者實際使用幾天後的回饋，全部完成：

1. **記帳頁**：卡片編輯/複製/刪除鈕改常駐（原 hover 才顯示，手機看不到，違反 ux-standard）；
   自訂分帳卡片直接顯示各人金額（原本要點編輯才看得到）。
2. **Modal 全域修**：`.modal-content` 加 `max-height: calc(100dvh - 2rem)` + `overflow-y: auto`——
   自訂分帳成員多時表單過長，原本超出螢幕且整頁鎖捲動（body overflow hidden）會卡死。
3. **建立旅程不再自動生成每日 21:00「🏨 預計住宿點」預設格**（useSaveTrip 移除、tripsApi.insertItinerary 刪除）；
   並已用 anon REST 清掉 DB 裡 618 筆未動過的舊預設格（location+自動備註都原樣才刪，Content-Range 618/驗證 0 筆殘留）。
4. **住宿卡升級**：`trip_accommodations` 加 `check_in`/`check_out`（p8 migration），`note` 欄位開放編輯；
   規劃頁 AccommodationCell 表單新增入住/退房時間+備註，行程主頁住宿卡顯示三者。
5. **行程卡營業時間**（有 place_id 才有）：`lib/places.ts` `placeOpeningHours()` +
   `app/api/places/hours` 代理（FieldMask 只取 `regularOpeningHours.weekdayDescriptions`，zh-TW）；
   `features/itinerary/hooks/useOpeningHours.ts` 第一次顯示時查一次 → **寫回 `trip_itinerary.opening_hours` 永久快取**
   （空陣列＝查過但無資訊，不重查；控制 Google 配額，每地點一生只查一次）；
   `features/itinerary/components/OpeningHours.tsx`：手機摺疊成一行今日營業時間（點擊展開整週）、md 以上直接全展開、今日高亮。
   已實測 Google 回傳（友利火鍋，中文星期格式正常）。
- 驗證：typecheck ✅ / test 4/4 ✅ / build ✅（/api/places/hours 已註冊）/ 新改動 lint 0 問題。
- **部署順序（重要）**：先在 Supabase SQL Editor 跑 `supabase/migrations/p8_accommodation_hours.sql`
  （加 `trip_accommodations.check_in/check_out` 與 `trip_itinerary.opening_hours`），再 push 部署；
  順序反了住宿儲存與營業時間快取寫回都會因欄位不存在而報錯。

### 🏁 P5 階段收尾（2026-07-17）
- 全部上線：commit `2edcb7c`（28 檔、+2122 行）push → Vercel 自動部署，`/places` 部署驗證 200。
- migrations 皆已執行（p5_map_columns、p7_wish_places，REST 驗證過）；`GOOGLE_PLACES_API_KEY` 本機＋Vercel 就緒。
- **唯一未驗收項**：IG 分享入口實測（使用者說之後再測；Android 要先把部署版「加入主畫面」安裝成 PWA，iOS 要建捷徑——教學可現寫）。
- 下一階段候選（依使用者當時意願）：
  1. 下一輪「方便性對標市面 App」打磨——使用者會收集實際使用的不順手清單再討論。
  2. P2b 開 RLS（等成員全數登入綁定）→ 接 P6 成員管理與權限。
  3. P5c AI 行程建議（最後、可選）。

### P5c AI 行程建議 — ⬜ 未開始（最後、可選）

### P6（成員管理與權限）— 2026-07-15 使用者新需求，排在介面（P4）完成後
> 使用者原話：介面完成之後，前端要能直接操作成員設定，例如「發郵件邀請誰」、
> 「不同身分組有不同的控制權限」。

**⚠️ 依賴**：權限的強制力來自 RLS policy 檢查角色，**必須在 P2b 之後**做；
P2b 前只能做 UI 層的顯示/隱藏（拿 anon key 即可繞過，僅裝飾）。

**6.1 Email 邀請成員**
- 需要 `SUPABASE_SERVICE_ROLE_KEY`（只放 Vercel 環境變數 + 本機 `.env.local`，**絕不進前端 bundle**）。
- `app/api/invite/route.ts`（Route Handler，伺服器端）：
  驗證呼叫者已登入且為 admin → `supabase.auth.admin.inviteUserByEmail(email)` +
  建立/更新 `trip_members`（暱稱 + email）→ 對方點邀請信 → 既有 AuthBridge email 自動綁定直接生效。
- UI：成員名冊頁加「邀請成員」（輸入暱稱 + email），成員列表顯示狀態：未邀請 / 已邀請 / 已綁定。
- 建議此時一併接 Resend 自訂 SMTP（順便解掉內建信箱 rate limit）。

**6.2 身分組權限**
- MVP 先做兩級全站角色：`trip_members.role`（`admin` | `member`）——
  admin 才能：邀請/刪除成員、刪除旅程、管理身分組；member 一般使用。
- 身分組（groups）已控制「看得到哪些旅程」；若需更細，再加 `group_members.role`
  （`editor` | `viewer`）決定該群組旅程能否編輯（等真的需要再做，勿過度設計）。
- 實作兩層：RLS policy 引用 role（升級 p2b 的 policy）＋ 前端依 role 顯示/隱藏操作按鈕。
- 待決事項（做的時候再問使用者）：誰是 admin（預設發起人豆腐？）、
  member 能否自行新增旅程/成員。

---

## 坑 / 注意事項
- **photos 頁已進 feature 層**（2026-07-16 P3 重寫）；全站已無頁面直接 `supabase.from`。
- 刪照片流程：先刪 R2 物件再刪 DB row（`useDeletePhoto`）；R2 免費額度 10GB，這批 WebP 後遠低於上限。
- **pre-existing lint 警告**（set-state-in-effect、封面 `<img>`、少數未用的 lucide import）是原本就有的，不是重構造成的回歸。
- 新程式碼（`features/`）目前 lint 全乾淨；請維持。
- `xlsx` 有已知安全告警但無可直接升級的修補版，**勿跑 `npm audit fix --force`**（會弄壞試算表匯入）；未來可換維護中的替代套件。
- 檔尾行結束符：專案曾出現 CRLF/LF 混雜，建議加 `.gitattributes` 統一。
