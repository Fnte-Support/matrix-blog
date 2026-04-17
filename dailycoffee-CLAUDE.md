# DailyCoffee 咖啡用具專欄 — 專案規範

> 所有 Claude agent 在修改本專案時，必須遵守以下規範。

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
- 多步驟任務先列計畫，每步附驗證方式：
  ```
  1. [步驟] → 驗證：[檢查方式]
  2. [步驟] → 驗證：[檢查方式]
  3. [步驟] → 驗證：[檢查方式]
  ```
- 明確的成功標準讓你能獨立迭代；模糊的標準（「讓它能動」）需要不斷確認

---

**這些規範有效的指標：** diff 裡不必要的改動變少、因過度設計而重寫的次數變少、釐清問題發生在動手之前而非犯錯之後。

---

## 專案基本資訊

- **品牌名稱**：DailyCoffee（暫定，依實際品牌調整）
- **網域**：https://dailycoffee.matrix.com.tw
- **類型**：咖啡用具文章專欄網站
- **語言**：繁體中文（zh-TW）
- **技術棧**：純靜態 HTML + Tailwind CSS v3（本地預編譯）
- **部署**：GitHub → Vercel 自動部署（push main 後自動上線）

---

## Git 工作流程

1. **每次操作前必須 `git pull origin main`**
2. commit message 用繁體中文描述
3. 推送到 `main` 分支即自動部署
4. 避免 force push
5. **不要 commit 任何 API key、token、密碼**

---

## SEO 規範

### Meta 標籤
- 每個頁面必須有 `<title>`、`<meta name="description">`、`<meta name="keywords">`
- OG / Twitter Card meta 必須完整（title, description, image, type）
- `<link rel="canonical">` 使用完整 URL

### HTML 語義化
- 單一 `<h1>` per page
- 使用 `<main>`, `<section>`, `<nav>`, `<footer>`, `<article>`
- 外部連結加 `rel="noopener noreferrer"`
- 圖片必須有 `alt` 屬性（繁體中文描述）

### sitemap.xml
- 新增/刪除文章時必須同步更新
- lastmod 格式 YYYY-MM-DD

---

## 設計系統

### CSS
- 使用 Tailwind CSS **v3**（不是 v4）
- ❌ 不要安裝 `@tailwindcss/cli`（v4），會覆蓋 v3

### 字型
- Noto Sans TC（Google Fonts）或依實際設定調整
- Google Fonts 用 `media="print" onload="this.media='all'"` 非阻塞載入

### 圖片
- 格式優先 WebP，寬度 800px，quality 72
- 所有 `<img>` 必須有 `width` 和 `height` 屬性（防止 CLS）
- 首屏以下圖片加 `loading="lazy"` + `decoding="async"`

---

## 效能規範

- 第三方腳本（GA、GTM）延遲載入或放 `</body>` 前
- 大型 JSON 不要在 DOMContentLoaded 就 fetch，用 lazy loading
- 所有 `scroll` listener 用 `requestAnimationFrame` 節流

---

## 安全性

- JS 用 `textContent`（不用 `innerHTML`）
- 外部連結加 `rel="noopener noreferrer"`
- **絕不 commit API key / token / 密碼**

---

## 文章規範

### 寫作風格
- 像在跟朋友分享咖啡經驗，專業但不生硬
- 自然帶入關鍵字，不硬塞
- 標題包含主題關鍵字

---

## 關聯專案

- **櫻花出行 gosakurajp**（gosakurajp.com）— 同一位擁有者的旅遊包車網站，技術棧相同
