# DailyCoffee 咖啡用具專欄 — 專案規範

> 所有 AI agent（Claude、OpenClaw、ChatGPT 等）或人類編輯在修改本專案時，必須遵守以下規範。

---

## 🚨 新 session 必讀（順序重要）

1. **先讀 `dailycoffee-HANDOFF.md`** — 了解目前網站狀態、近期工作、待辦事項
2. **本檔案（CLAUDE.md）** — 通用行為規範和設計原則
3. **`dailycoffee-ARTICLE-SOP.md`** — 新增文章時必讀，逐條照做

---

## 行為準則

> **取捨原則：** 這些規範偏向「謹慎」而非「速度」。簡單任務可自行判斷鬆緊。

### 1. 先問再做（Think Before Coding）
- 不確定的事情直接問，不要自己花時間研究猜測
- 有多種解讀時列出選項，不要自己偷選
- 5 秒的提問勝過 30 分鐘的偵探工作
- 如果有更簡單的做法，主動提出；該推回的時候要推回
- 不清楚的地方直接停下來，說明哪裡不懂，然後問

### 2. 簡單優先（Simplicity First）
- 只寫解決問題的最少程式碼，不寫投機性程式碼
- 只做被要求的事，不加沒被要求的功能
- 不為單次使用的程式碼建立抽象
- 不做「為了彈性」「為了擴充」「為了可配置」的預先設計
- 不為不可能發生的情境加錯誤處理
- 如果寫了 200 行但 50 行就能搞定，重寫它
- 自問：「資深工程師會不會說這太複雜了？」如果會，就簡化

### 3. 手術式改動（Surgical Changes）
- 不要「順便改善」旁邊的程式碼、註解或格式
- 不重構沒壞的東西
- 配合現有程式碼風格，即使你會寫得不一樣
- 發現不相關的 dead code → 提出來，不要直接刪
- **自己造成的孤兒要清掉**：你的改動讓某個 import / 變數 / 函式變成沒用的，就刪掉它
- 不刪原本就存在的 dead code，除非被要求
- **檢驗標準：每一行改動都必須能追溯到使用者的需求**

### 4. 目標驅動（Goal-Driven Execution）
- 把任務轉成可驗證的目標再動手
- 改完要確認結果正確才算完成
- 多步驟任務先列計畫，每步附驗證方式

---

## ⛔ AI agent 絕對不可擅自修改的內容

> 這條規則是因為本專案曾被 OpenClaw 擅自改動過，造成設計一致性破壞。
> 任何 AI agent（包括 OpenClaw、Claude）接手後，**不經使用者同意**不可變更以下：

### 首頁 `index.html`
- **Header** 固定為單純 logo（`☕ Daily Coffee`），不可加副標、tagline、E-E-A-T 字樣、認證標誌
- **Footer** 固定 3 欄結構：
  - 分類（6 個固定連結）
  - 關於（關於我們 / 聯絡我們 / Matrix 官網）
  - 社群（Threads / Instagram / Facebook — 直連 URL）
  - **不可**加「矩陣世紀官網」「🌸 櫻花出行」或其他非 Matrix 品牌之連結

### JSON-LD publisher name
- 固定 `"name": "Daily Coffee"`，**不可**改為「Matrix 矩陣世紀」或其他字串

### `article_list.json`
- 保留 147 筆（7 本地 + 140 外連）為基準
- 新增文章時**追加**，不可批次改寫或「清理」
- 新增必須符合 `dailycoffee-ARTICLE-SOP.md` 的欄位規範

### `sitemap.xml`
- 只能含 `dailycoffee.matrix.com.tw` 網域的 URL
- **嚴禁**加入 `www.matrix.com.tw`、`gosakurajp.com` 或其他外部網域（子網域在 SEO 上為獨立網站）

### `robots.txt`
- 保留 AI crawler 白名單（GPTBot / ClaudeBot / OAI-SearchBot / PerplexityBot 等）

### 本地文章的 `/article/<slug>/` 資料夾
- 不可未經使用者同意新增或刪除
- 新增必須經使用者確認內容題材

### 社群連結（Footer）
直連 URL 固定：
```
Threads:   https://www.threads.com/@matrix.tw
Instagram: https://www.instagram.com/matrix.tw/
Facebook:  https://www.facebook.com/matrixscale.tw
```
不可改回 `matrix.com.tw/threads` 這類轉址網址。

---

## 專案基本資訊

- **品牌名稱**：Daily Coffee
- **網域**：https://dailycoffee.matrix.com.tw
- **類型**：咖啡用具與咖啡知識文章專欄網站
- **語言**：繁體中文（zh-TW）
- **技術棧**：**純靜態 HTML + 原生 CSS**（無 build step、無框架）
  - ⚠️ 舊版文件提過 Tailwind v3，**實際並未使用**（誤植）
  - 每頁自帶 `<style>` 區塊，色票用 CSS variables（`--coffee-dark` 等）
- **部署**：GitHub → Vercel 自動部署（push main 後自動上線）

---

## Git 工作流程

1. **每次開始操作前必須 `git pull origin main`**
2. commit message 用**繁體中文**描述（說明「為什麼」，不只是「做了什麼」）
3. 推送到 `main` 分支即自動部署
4. 避免 force push、不要 `--no-verify` 跳過 hooks
5. **不要 commit 任何 API key、token、密碼**

### Commit message 格式建議
```
<類型>: <描述>

類型：
  feat       — 新功能、新文章
  fix        — 修 bug / 還原錯誤變動
  refactor   — 重構、重寫
  docs       — 文件更新
  chore      — 雜項
  revert     — 還原特定 commit
```

---

## GitHub 協作注意事項

`Fnte-Support` 是**共用 GitHub 帳號**：人類使用者 + OpenClaw AI 都會以此身份 push。

看 commit log 分辨誰推的：
- `Jessie_Macmini <jessie_macmini@...>` = 使用者本機
- `Fnte Support <support@fnte.com.tw>` = OpenClaw AI

**如果看到未授權變動**（例如 footer 被改、publisher name 被改）→ 先告訴使用者，不要擅自還原或繼續蓋寫。

---

## SEO 規範

### Meta 標籤（每個頁面必備）
- `<title>`（格式：`標題 | Daily Coffee`）
- `<meta name="description">`（120-160 字）
- `<meta name="keywords">`
- `<meta name="author">` = "Daily Coffee"
- `<link rel="canonical">`（完整 URL）

### Open Graph / Twitter Card（完整）
- og:title / og:description / og:image / og:url / og:type / og:site_name / og:locale
- article:published_time / article:section（文章頁）
- twitter:card="summary_large_image" + title / description / image

### JSON-LD Article schema（文章頁必備）
- headline / description / image / datePublished / dateModified
- author / publisher（publisher 固定 "Daily Coffee"）
- mainEntityOfPage
- keywords

### HTML 語義化
- 單一 `<h1>` per page
- 使用 `<main>`, `<section>`, `<nav>`, `<footer>`, `<article>`
- 外部連結必加 `rel="noopener noreferrer"`
- 圖片必須有 `alt` 屬性（繁體中文描述）

### sitemap.xml
- 新增／刪除文章時必須同步更新
- `lastmod` 格式 `YYYY-MM-DD`
- **只能包含 dailycoffee.matrix.com.tw 網域**

---

## 設計系統

### 色票（CSS variables）
```css
--coffee-dark:  #2C1810   /* 深咖啡：header / footer / 主文字 */
--coffee-mid:   #6B4226   /* 中咖啡：nav bar / h2 */
--coffee-light: #C07A3E   /* 淺咖啡：hover / 強調色 */
--coffee-cream: #F5EDE0   /* 奶色：文章頁背景、標籤底 */
--coffee-bg:    #FDFBF8   /* 米白：首頁背景 */
--gray-light:   #f0ede8   /* 淺灰：分隔線 */
```

### 分類標籤色
| 分類 | key | 底色 / 文字 |
|---|---|---|
| 最新消息 | `news` | `#FFF3E0` / `#E65100` 橘 |
| 咖啡小學堂 | `knowledge` | `#E8F5E9` / `#2E7D32` 綠 |
| 咖啡活動 | `events` | `#E3F2FD` / `#1565C0` 藍 |
| 咖啡地圖 | `map` | `#F3E5F5` / `#6A1B9A` 紫 |
| 達人實測 | `kol` | `#FFEBEE` / `#C62828` 紅 |
| CBTJ | `cbtj` | `#FFF8E1` / `#F57F17` 黃 |

### 字型
- Noto Sans TC（Google Fonts）或系統預設
- Google Fonts 用非阻塞載入：`media="print" onload="this.media='all'"`

### 圖片
- 格式優先 JPG / WebP（PNG 僅用於需透明 logo）
- hero.jpg 1200×630，檔案 ≤ 300KB
- 所有 `<img>` 必須有 `width` 和 `height`（防止 CLS）
- 首屏以下圖片加 `loading="lazy"` + `decoding="async"`
- **嚴禁使用會過期的臨時 URL**（如 `?Expires=` 參數）
- AI 產圖（MiniMax / DALL-E 等）必須立即下載為本地 `hero.jpg`

---

## 效能規範

- 第三方腳本（GA、GTM）延遲載入或放 `</body>` 前
- 大型 JSON 不要在 DOMContentLoaded 就 fetch，用 lazy loading
- 所有 `scroll` listener 用 `requestAnimationFrame` 節流

---

## 安全性

- JS 用 `textContent`（不用 `innerHTML`，防 XSS）
- 外部連結加 `rel="noopener noreferrer"`
- **絕不 commit** API key / token / 密碼
- 表單不要用 `GET` 提交使用者資料

---

## 文章發布

完整規範見 **`dailycoffee-ARTICLE-SOP.md`**，簡版：

1. Slug 用小寫連字號（`my-new-article`）
2. `article/<slug>/` 放 `index.html` + `hero.jpg`
3. HTML `<head>` 含完整 SEO meta + JSON-LD
4. HTML `<body>` 含 `.dc-header` + `.dc-footer`
5. `article_list.json` 新增條目
6. `sitemap.xml` 加新 URL
7. commit（繁中訊息）+ push

### 寫作風格
- 像在跟朋友分享咖啡經驗，專業但不生硬
- 第二人稱（你/妳）比第三人稱親切
- 自然帶入關鍵字，不硬塞
- 標題包含主題關鍵字

---

## 關聯專案

- **櫻花出行 gosakurajp**（gosakurajp.com）— 同一位擁有者的旅遊包車網站
  - 技術棧相同（純靜態 HTML）
  - 共用 `Fnte-Support` GitHub 帳號
  - **與本專案獨立，不可將兩專案連結混入**（例如此專案 footer 不該出現「🌸 櫻花出行」連結）

---

## 其他重要檔案

| 檔案 | 用途 |
|---|---|
| `dailycoffee-HANDOFF.md` | Session 交接紀錄（每次結束更新） |
| `dailycoffee-ARTICLE-SOP.md` | 文章發布規範（新增文章必讀） |
| `article_list.json` | 文章索引（147 筆） |
| `article_list.json.bak` | 舊版備份（本地保留，不 push） |
| `old_site_full_inventory.json` | 舊站完整清單（本地參考，不 push） |
| `sitemap.xml` | XML sitemap（只有 dailycoffee 網域） |
| `robots.txt` | 爬蟲規則（含 AI crawler 白名單） |
| `.gitignore` | 排除本地工作檔案 |
