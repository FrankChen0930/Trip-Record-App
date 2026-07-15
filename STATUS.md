# STATUS — Travel Record App 重構進度與交接

> 最後更新：2026-07-15（找到「所有成員都已被認領」根因＝遺留 RLS，待使用者跑 SQL；見 P2 段落）
> 用途：任何新的 Claude / Claude Code session 讀這份就能接手，不必重問。
> 完整藍圖見 `REDESIGN_ARCHITECTURE.md`；Auth/RLS 步驟見 `P2_AUTH_RLS_RUNBOOK.md`。

---

## 專案一句話

環島旅行記錄 Web App（`my-trip-app`）。正在做「前端 + 架構重構 + 功能擴充」。
技術棧：Next.js 16 (App Router, 全 client component) · React 19 · TypeScript · Tailwind 4 ·
Supabase (Postgres + Auth + Storage + Realtime) · TanStack Query · Zustand · dnd-kit · leaflet(已安裝待用) · xlsx。

---

## 進度總覽

| 階段 | 內容 | 狀態 |
| :-- | :-- | :-- |
| P0 | 地基：design tokens、TanStack Query、Zustand、Supabase client 分層、UI primitives、feature 骨架 | ✅ 完成 |
| P1 | 資料層遷移：journal / members / expenses / groups / 首頁 / trip 主頁 / plan 全改用 feature hooks；結清演算法抽純函式 + 單元測試 | ✅ 完成（photos 頁刻意留給 P3） |
| P2a | Auth 程式：/login(Magic Link)、useSession、綁定橋接（user_id→email→PIN 認領）、SQL、runbook | ✅ 程式完成（含自助 PIN 認領），**尚未啟用** |
| P2b | 開啟 RLS + 未登入導向 /login 閘門 | ⏸ **擱置中**：使用者這幾天陸續讓成員登入綁定，到齊後再做（SQL 已備好） |
| P3 | 照片改存 Cloudflare R2（建 bucket、presigned 上傳、從 Google Drive 遷移約 1.76GB、重寫 photos 頁） | ⬜ 未開始 |
| P4 | 視覺重構：把「湖水青旅」設計系統套到所有頁面（目前只有 /login 用了新樣式） | ⬜ 未開始 |
| P5a | 內建地圖（Leaflet） | ⬜ 未開始 |
| P5b | 建議景點 + 交通時間（Google Places，需 API 金鑰） | ⬜ 未開始 |
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

### P3（R2 照片）— photos 頁還沒遷移就是留給這裡
- `app/trip/[id]/photos/page.tsx` 仍直接用 `supabase.from` / `supabase.storage`（唯一還沒進 feature 層的頁面，故意的）。
- 現況：照片存個人 Google Drive，約 1.76GB；改 R2 可做縮圖/瀑布流並釋出空間。無自訂網域 → 先用 R2 內建 `*.r2.dev`。
- 做法：Next.js Route Handler(`app/api/photos/upload-url/route.ts`) 產生 R2 presigned PUT URL → 前端壓成 WebP 直傳 → 寫 `trip_photos`；
  讀取走 R2 公開網址。`trip_photos` 改欄位：`storage_provider`(`r2|gdrive|supabase`) / `r2_key` / `thumb_key` / `external_url`。
  遷移：一次性腳本從 Google Drive 下載 → 上傳 R2 → 更新 DB（1.76GB 在 R2 免費 10GB 內）。
- 需新增依賴：`@aws-sdk/client-s3`、`@aws-sdk/s3-request-presigner`；環境變數見架構文件第 7.5 節。

### P4（視覺重構）
- 把湖水青旅 tokens + `@/components/ui` primitives 套到全部頁面，統一 App Shell / 空狀態 / 載入 / 錯誤邊界；
  保留特色元件（trip 主頁 3D 日期選擇器、支出進度條）。行動優先、明亮為主（深色模式可後補）。
- 順手清掉 P1 遺留的 pre-existing lint 警告（`set-state-in-effect` 的 localStorage 讀取等，多會在改版時自然消失）。

### P5a 地圖 / P5b 建議景點 / P5c AI
- 地圖用已安裝的 Leaflet + 明亮 tile；POI 資料打 Google Places（伺服器端 Route Handler 代理隱藏金鑰）；
  `trip_itinerary` 加 `lat`/`lng`。使用者將自行申請 Google Places 金鑰。AI 行程排最後、可選。

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
- **photos 頁**還用直接 supabase（P3 才重寫，勿誤以為漏了）。
- **pre-existing lint 警告**（set-state-in-effect、封面 `<img>`、少數未用的 lucide import）是原本就有的，不是重構造成的回歸。
- 新程式碼（`features/`）目前 lint 全乾淨；請維持。
- `xlsx` 有已知安全告警但無可直接升級的修補版，**勿跑 `npm audit fix --force`**（會弄壞試算表匯入）；未來可換維護中的替代套件。
- 檔尾行結束符：專案曾出現 CRLF/LF 混雜，建議加 `.gitattributes` 統一。
