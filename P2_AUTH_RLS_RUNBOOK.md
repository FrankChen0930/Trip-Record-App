# P2：Supabase Auth + RLS 操作手冊（兩階段安全切換）

> 目標：把「PIN + localStorage」升級為 Email Magic Link 登入，並用 RLS 保護資料。
> 策略：分兩階段，避免把人鎖在外面。
> 決策：自助 PIN 認領綁定（email 對得到則自動綁定）、無群組旅程＝登入即可存取、兩階段切換。

---

## 名詞

- **綁定**：把某位 `trip_members` 成員的 `user_id` 設成其登入帳號的 `auth.uid()`，從此該帳號＝該成員。
- **對應方式**（依序嘗試）：
  1. **user_id**：已綁定過的帳號直接認出（換 email 登入也認得）。
  2. **email 自動綁定**：登入 email 恰好對到某位未綁定成員 → 自動綁定。
  3. **自助 PIN 認領**：都對不到 → 顯示認領畫面，使用者選自己是哪位成員＋輸入該成員的 4 位 PIN，驗證通過即綁定 `user_id` 與 `email`。**不需事先收集 email。**

---

## 階段 A（現在就能做，不影響現有使用）

此階段只新增登入能力與欄位，**不開 RLS**，現有匿名存取照常運作。

1. **啟用 Email 登入**
   Supabase Dashboard → Authentication → Providers → 開啟 **Email**（Magic Link 即可，不需密碼）。
   再到 Authentication → URL Configuration 設定：
   - Site URL：你的正式網址（沒有就先填 `http://localhost:3000`）
   - Redirect URLs：加入 `http://localhost:3000` 與正式網址。

2. **新增欄位**
   SQL Editor 執行 `supabase/migrations/p2a_add_member_auth_columns.sql`（加 `email`、`user_id`，安全）。

2.5 **關閉遺留 RLS（重要，2026-07-15 發現）**
   建站初期曾開 RLS 且 policy 只授權 `anon`，導致**登入後**所有查詢回空資料
   （症狀：認領畫面顯示「所有成員都已被認領」、登入後旅程/成員消失）。
   SQL Editor 執行 `supabase/migrations/p2a_disable_legacy_rls.sql` 全部關閉；
   P2b 會重新以正確規則開啟。

3. **（可選）幫成員預填 email**
   已改採「自助 PIN 認領」，**不需要**事先收集/填寫 email。
   若想讓某些人跳過認領畫面，仍可在 Table Editor 的 `trip_members` 預填 email（登入時會自動綁定）。

4. **部署並測試登入**
   `npm install`（若還沒裝新套件）→ `npm run dev`。
   開 `/login` → 輸入你的 email → 收信點連結 → 導回後：
   - email 對得到成員 → 自動綁定完成；
   - 對不到 → 出現認領畫面：選自己是哪位成員＋輸入 4 位 PIN → 綁定完成。
   驗證：綁定後重新整理不再出現認領畫面（已以 user_id 認出）；PIN 輸錯應被拒絕。
   可重複讓每位成員各自登入一次。

> 階段 A 期間，沒登入的人仍可照舊使用（RLS 未開），所以可以慢慢讓大家都登入綁定。

---

## 階段 B（等所有人都綁定後再做）

此階段開啟 RLS。**執行後未登入將無法存取**，所以務必先確認大家都綁定完成。

1. **確認綁定狀況**
   ```sql
   select nickname, email, user_id from trip_members order by nickname;
   ```
   每位「還在用」的成員都應有 `user_id`（非 NULL）。沒綁定的人在開 RLS 後會被擋。

2. **開啟 RLS**
   SQL Editor 執行 `supabase/migrations/p2b_enable_rls.sql`。
   （腳本開頭會先 drop 掉 public schema 所有舊 policy——包含建站初期的 anon policy，
   避免撞名、也避免未登入者透過殘留 policy 繞過保護。）

3. **加上登入閘門（建議，搭配本階段）**
   開 RLS 後，未登入會讀不到任何資料。建議讓 App 在未登入時導向 `/login`
   （這一步我可以在進入階段 B 時幫你加上，並移除過渡用的 localStorage 橋接）。

4. **逐頁測試**
   登入後：首頁、行程、支出、備忘錄、規劃、群組、成員都正常；
   登出後：應被導向登入頁、讀不到資料。

### 緊急回滾
若開 RLS 後出問題，可逐表停用：
```sql
alter table trips disable row level security;
alter table trip_itinerary disable row level security;
-- ...其餘表同理
```

---

## 存取規則摘要（RLS 開啟後）

| 資料 | 誰能存取 |
| :--- | :--- |
| 無群組的旅程及其行程/支出/照片… | 所有已登入者 |
| 有群組的旅程及其資料 | 僅該群組成員 |
| 成員名冊 / 群組 / 群組成員 | 所有已登入者可讀寫（共用） |
| 票券狀態 | 依其所屬行程的旅程權限 |
| 未登入（anon） | 一律無法存取 |

> 註：`trip-covers` 等 Supabase Storage 圖片的存取是另一套 policy；照片儲存將於 P3 改為 Cloudflare R2 一併處理。
