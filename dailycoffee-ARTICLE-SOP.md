# Daily Coffee — 文章發布 SOP

> 所有 AI agent（OpenClaw、Claude、ChatGPT 等）或人類編輯發布文章時，**必須**遵循此規範。
> 違反任何一項即視為未完成，不得 merge。

---

## 0. 發布前檢查清單（TL;DR）

每篇新文章發布前，以下每項都必須 ✅：

- [ ] Slug 符合命名規則（小寫、連字號、純 ASCII、不以數字開頭）
- [ ] `article/<slug>/index.html` 存在且結構完整
- [ ] `article/<slug>/hero.jpg` 存在（檔案大小 < 300KB、尺寸 1200×630）
- [ ] HTML `<head>` 含完整 SEO meta（含 canonical、OG、Twitter、JSON-LD）
- [ ] HTML `<body>` 含 `.dc-header` 和 `.dc-footer`（見模板）
- [ ] `article_list.json` 新增一筆，欄位完整
- [ ] `sitemap.xml` 新增對應 URL
- [ ] 圖片全部本地化（不可用會過期的 CDN URL，如阿里雲 Aliyun OSS 簽章 URL）
- [ ] 內部連結用絕對路徑（`/article/xxx/`），外部連結加 `target="_blank" rel="noopener noreferrer"`
- [ ] `git pull origin main` 後才開始工作
- [ ] commit message 使用繁體中文
- [ ] 不得 commit 任何 API key、token、密碼

---

## 1. Slug 命名規則（強制）

### 格式
- **小寫英文**、**連字號** `-` 分隔、**不可用底線** `_`、**不可含空白**、**不可含中文或 URL 編碼**
- 不以數字開頭（年份可放中段或結尾，如 `taipei-coffee-expo-2025`）
- 長度 ≤ 60 字元

### ✅ 好的 slug
```
v60-brewing-ratio
ethiopia-coffee-origin
2026-taiwan-coffee-expo     # 數字不在最前面也可以接受
hario-alpha-switch-review-2026
```

### ❌ 壞的 slug
```
BREWING_BASICS_SWITCH       # 不可全大寫或底線
%E8%88%8A-TradeIn           # 不可 URL 編碼
2023coffee                  # 太短，沒資訊
coffee guide                # 不可含空白
/news/article2025050801     # 不可含斜線、不可用日期編號
```

---

## 2. 資料夾結構

每篇文章放在獨立資料夾：

```
article/<slug>/
├── index.html        # 文章 HTML（必要）
├── hero.jpg          # 封面圖 1200×630（必要）
├── logo.jpg          # 品牌 logo（選配，店家/活動文用）
└── img-1.jpg         # 文章內嵌圖（選配，依需要）
```

**絕對路徑原則：** 文章內所有圖片引用都用 `/article/<slug>/xxx.jpg`，不可用相對路徑 `./xxx.jpg`（某些伺服器設定會壞掉）。

---

## 3. 圖片規範

### 3.1 圖片產生來源（允許）

AI 產圖服務都可以用，但**產完必須立即下載到本地，不可直接引用臨時 URL**：

| 來源 | 允許用途 | 必要步驟 |
|---|---|---|
| **MiniMax / 海螺 (hailuo)** | 產 hero、內文插圖 | 產完立即下載為 `article/<slug>/hero.jpg` |
| **DALL-E / Midjourney / SDXL** | 同上 | 同上 |
| **Unsplash / Pexels** | 手上真的找不到原創圖時的備援 | 下載為本地檔案（不可直接 hotlink） |
| **自家拍攝 / 設計** | 首選 | 直接放 `article/<slug>/` |

### 3.2 規格要求

| 欄位 | 尺寸 | 格式 | 大小 | 備註 |
|---|---|---|---|---|
| hero.jpg | 1200×630（OG 標準） | JPG / WebP | ≤ 300KB | **必須是本地檔案** |
| 內文圖 | 寬度 ≤ 1000px | JPG / WebP | ≤ 200KB | quality 72 足夠 |
| logo | 方形 400×400 | JPG / PNG | ≤ 100KB | 透明背景用 PNG |

### 3.3 ❌ 嚴禁的做法（會讓圖片幾天後掛掉）

**任何含下列特徵的 URL 都不可**出現在上線的 `index.html`、文章頁 HTML 或 `article_list.json` 裡：

- 含 `?Expires=` 或 `?Signature=` 的臨時簽章 URL
- `hailuo-image-algeng-data.oss-cn-wulanchabu.aliyuncs.com/*` — MiniMax 的臨時 URL
- `oaidalleapiprodscus.blob.core.windows.net/*` — DALL-E 的臨時 URL
- `replicate.delivery/*` 帶簽章參數的變體
- 任何 CDN 平台的「預簽章」URL（presigned URL / signed URL）

**這些 URL 只能用在「產圖 → 下載到本地」的中間步驟，不能留在 commit 裡。**

### 3.4 正確流程（以 MiniMax 為例）

```
1. 呼叫 MiniMax API 產圖
   → 拿到: https://hailuo-image-algeng-data...?Expires=1776356438
2. 立即下載到本地:
   curl -o article/<slug>/hero.jpg "<上面那個 URL>"
3. 壓到 ≤300KB:
   （用 ImageMagick 或其他工具壓縮到 1200×630 / quality 72）
4. HTML / JSON 引用本地路徑:
   "image": "https://dailycoffee.matrix.com.tw/article/<slug>/hero.jpg"
5. 原始的 hailuo URL 只出現在步驟 1-2 之間的記憶體中，
   不可寫進任何 commit 的檔案。
```

### 3.5 ✅ 允許出現在 commit 裡的圖片 URL

- `https://dailycoffee.matrix.com.tw/article/<slug>/<檔名>.jpg` ← 本地圖
- `https://dailycoffee.matrix.com.tw/assets/<檔名>.jpg` ← 共用素材
- `https://www.matrix.com.tw/...` 的圖片 ← 自家 CDN
- `https://images.unsplash.com/photo-xxxxxx?w=1400&q=80`（**去除 `?Expires=`** 的穩定 URL 可以暫用，但優先下載成本地）

### 3.6 所有 `<img>` 標籤必要屬性

```html
<img src="/article/<slug>/hero.jpg"
     alt="描述文字（繁中）"
     width="1200"
     height="630"
     loading="lazy"
     decoding="async">
```

> `width` 和 `height` **必填**，避免 CLS（頁面跳動）。  
> 首屏第一張圖不加 `loading="lazy"`，其餘都加。

### 3.7 發布前圖片自檢

commit 前務必跑一次：

```bash
# 檢查是否有殘留的臨時簽章 URL
grep -rE "Expires=|Signature=|hailuo-image-algeng-data|oaidalleapiprodscus" article/ article_list.json index.html
# 沒輸出 = 乾淨；有輸出 = 還有臨時 URL 沒本地化，禁止 commit
```

---

## 4. HTML 文章模板

以下是**必要的最小結構**。各文章的內文樣式可客製，但 `<head>` 和 header/footer 必須一致。

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- 基本 SEO -->
  <title>{文章標題} | Daily Coffee</title>
  <meta name="description" content="{120-160 字描述，含主關鍵字}">
  <meta name="keywords" content="{tag1}, {tag2}, {tag3}">
  <meta name="author" content="Daily Coffee">
  <link rel="canonical" href="https://dailycoffee.matrix.com.tw/article/{slug}/">

  <!-- Open Graph -->
  <meta property="og:type" content="article">
  <meta property="og:title" content="{文章標題}">
  <meta property="og:description" content="{同 description}">
  <meta property="og:url" content="https://dailycoffee.matrix.com.tw/article/{slug}/">
  <meta property="og:image" content="https://dailycoffee.matrix.com.tw/article/{slug}/hero.jpg">
  <meta property="og:site_name" content="Daily Coffee">
  <meta property="og:locale" content="zh_TW">
  <meta property="article:published_time" content="{YYYY-MM-DD}">
  <meta property="article:section" content="{category}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{文章標題}">
  <meta name="twitter:description" content="{同 description}">
  <meta name="twitter:image" content="https://dailycoffee.matrix.com.tw/article/{slug}/hero.jpg">

  <!-- JSON-LD Article Schema -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "{文章標題}",
    "description": "{同 description}",
    "image": "https://dailycoffee.matrix.com.tw/article/{slug}/hero.jpg",
    "datePublished": "{YYYY-MM-DD}",
    "dateModified": "{YYYY-MM-DD}",
    "author": { "@type": "Organization", "name": "Daily Coffee" },
    "publisher": {
      "@type": "Organization",
      "name": "Daily Coffee",
      "url": "https://dailycoffee.matrix.com.tw"
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "https://dailycoffee.matrix.com.tw/article/{slug}/"
    },
    "keywords": "{tag1}, {tag2}, {tag3}"
  }
  </script>

  <!-- 字型：用非阻塞方式載入 -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap"
        rel="stylesheet"
        media="print"
        onload="this.media='all'">

  <style>
    /* 文章自己的樣式寫在這裡 */
  </style>
</head>
<body>

  <!-- ========== HEADER（複製貼上，不要改） ========== -->
  <header class="dc-header">
    <a href="/" class="dc-logo">☕ Daily <span>Coffee</span></a>
    <a href="/" class="dc-back">← 回首頁</a>
  </header>
  <style>
    .dc-header { background: #2C1810; color: #fff; padding: 0 1.5rem; height: 56px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
    .dc-header .dc-logo { color: #fff; text-decoration: none; font-weight: 700; font-size: 1.1rem; letter-spacing: 0.5px; }
    .dc-header .dc-logo span { color: #C07A3E; }
    .dc-header .dc-back { color: rgba(255,255,255,0.8); text-decoration: none; font-size: 0.9rem; }
    .dc-header .dc-back:hover { color: #C07A3E; }
  </style>

  <!-- ========== 文章內容（自由發揮） ========== -->
  <main>
    <article>
      <!-- Hero -->
      <img src="/article/{slug}/hero.jpg"
           alt="{描述}"
           width="1200" height="630">

      <!-- 只能有一個 h1，且要含主關鍵字 -->
      <h1>{文章標題}</h1>

      <!-- 文章內容：h2, h3, p, ul, ol, blockquote 等 -->
      <h2>小節標題</h2>
      <p>段落內容...</p>
    </article>
  </main>

  <!-- ========== FOOTER（複製貼上，不要改） ========== -->
  <footer class="dc-footer">
    <div class="dc-footer-inner">
      <div class="dc-footer-col">
        <h4>分類</h4>
        <ul>
          <li><a href="/?cat=news">📢 最新消息</a></li>
          <li><a href="/?cat=knowledge">📖 咖啡小學堂</a></li>
          <li><a href="/?cat=events">🎪 咖啡活動</a></li>
          <li><a href="/?cat=map">🗺️ 咖啡地圖</a></li>
          <li><a href="/?cat=kol">⭐ 達人實測</a></li>
          <li><a href="/?cat=cbtj">🧪 CBTJ</a></li>
        </ul>
      </div>
      <div class="dc-footer-col">
        <h4>關於</h4>
        <ul>
          <li><a href="https://www.matrix.com.tw/about-us" target="_blank" rel="noopener">關於我們</a></li>
          <li><a href="https://www.matrix.com.tw/contact" target="_blank" rel="noopener">聯絡我們</a></li>
          <li><a href="https://www.matrix.com.tw" target="_blank" rel="noopener">Matrix 官網</a></li>
        </ul>
      </div>
      <div class="dc-footer-col">
        <h4>社群</h4>
        <ul>
          <li><a href="https://www.threads.com/@matrix.tw" target="_blank" rel="noopener">Threads</a></li>
          <li><a href="https://www.instagram.com/matrix.tw/" target="_blank" rel="noopener">Instagram</a></li>
          <li><a href="https://www.facebook.com/matrixscale.tw" target="_blank" rel="noopener">Facebook</a></li>
        </ul>
      </div>
    </div>
    <div class="dc-footer-bottom">
      <p>© 2026 Daily Coffee · Matrix 咖啡專欄 · <a href="https://dailycoffee.matrix.com.tw">dailycoffee.matrix.com.tw</a></p>
      <p class="dc-footer-meta"><a href="/sitemap.xml">sitemap</a>·<a href="/robots.txt">robots</a></p>
    </div>
  </footer>
  <style>
    .dc-footer { background: #2C1810; color: rgba(255,255,255,0.6); font-size: 0.88rem; margin-top: 3rem; }
    .dc-footer-inner { max-width: 1200px; margin: 0 auto; padding: 2.5rem 1.5rem 1.5rem; display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; }
    .dc-footer-col h4 { color: #C07A3E; font-size: 0.95rem; font-weight: 600; margin-bottom: 0.75rem; letter-spacing: 0.5px; }
    .dc-footer-col ul { list-style: none; padding: 0; margin: 0; }
    .dc-footer-col li { margin-bottom: 0.5rem; }
    .dc-footer-col a { color: rgba(255,255,255,0.7); text-decoration: none; transition: color .2s; }
    .dc-footer-col a:hover { color: #C07A3E; }
    .dc-footer-bottom { border-top: 1px solid rgba(255,255,255,0.1); padding: 1.2rem 1.5rem 1.5rem; text-align: center; font-size: 0.8rem; color: rgba(255,255,255,0.5); }
    .dc-footer-bottom a { color: rgba(255,255,255,0.6); text-decoration: none; }
    .dc-footer-bottom a:hover { color: #C07A3E; }
    .dc-footer-meta { margin-top: 0.4rem; font-size: 0.72rem; color: rgba(255,255,255,0.35); }
    .dc-footer-meta a { color: rgba(255,255,255,0.4); margin: 0 0.4rem; }
    @media (max-width: 640px) { .dc-footer-inner { grid-template-columns: 1fr; gap: 1.5rem; } }
  </style>

</body>
</html>
```

---

## 5. HTML 語義化要求

### 單一 H1
- 每頁只能有**一個** `<h1>`，通常是文章標題
- Header 的 logo 用 `<a>` 或 `<span>`，**不可**用 `<h1>`

### 標題層級
```
h1 → h2 → h3
```
不可跳級（不可 h1 之後直接用 h3）。

### 必要語義化標籤
- `<main>`、`<article>`、`<header>`、`<footer>`、`<nav>` — 有就用
- 段落用 `<p>` 包，不要空 `<div>` 擠行高
- 列表用 `<ul>` / `<ol>` / `<li>`，不要用 `<br>` + 空白縮排

### 連結規則
| 連結類型 | 寫法 |
|---|---|
| 站內連結 | `<a href="/article/xxx/">...</a>`（絕對路徑） |
| 站外連結 | `<a href="https://..." target="_blank" rel="noopener noreferrer">...</a>` |
| 錨點 | `<a href="#section-id">...</a>` |

---

## 6. `article_list.json` 新增條目

**每篇新文章發布時必須**在 `article_list.json` **陣列最前面**（讓它出現在首頁第一頁）新增一筆：

```json
{
  "title": "文章標題",
  "slug": "my-new-article",
  "category": "knowledge",
  "date": "2026-04-20",
  "tags": ["關鍵字1", "關鍵字2", "關鍵字3"],
  "image": "https://dailycoffee.matrix.com.tw/article/my-new-article/hero.jpg",
  "description": "120-160 字的文章描述，含主關鍵字，首頁搜尋會吃到",
  "url": "/article/my-new-article/",
  "source": "local"
}
```

### 欄位規則
| 欄位 | 必填 | 型別 | 說明 |
|---|---|---|---|
| `title` | ✅ | string | 與 HTML `<title>` 一致（可省略 ` | Daily Coffee` 後綴） |
| `slug` | ✅ | string | 資料夾名，與 HTML canonical / url 一致 |
| `category` | ✅ | string | `news` / `knowledge` / `events` / `map` / `kol` / `cbtj` **六選一** |
| `date` | ✅ | string | 格式 `YYYY-MM-DD` |
| `tags` | ✅ | array | **必須是陣列**，3-6 個，每個 ≤ 10 字 |
| `image` | ✅ | string | hero 完整 URL（https 絕對） |
| `description` | ✅ | string | 與 HTML meta description 一致 |
| `url` | ✅ | string | 本地 `/article/<slug>/` |
| `source` | ✅ | string | 新站原創固定 `"local"`（舊站外連是 `"external"`） |

### ❌ 嚴禁
- `tags` 寫成字串（`"a,b,c"` 或 `"\"a\",\"b\""`）
- `date` 用 `/` 分隔（必須 `-`）
- `url` 指向舊站（這是 `source:external` 的規則）
- `category` 用中文或其他值（只能六選一）

---

## 7. `sitemap.xml` 更新

**每篇新文章都要更新 sitemap.xml**：

```xml
<url>
  <loc>https://dailycoffee.matrix.com.tw/article/my-new-article/</loc>
  <lastmod>2026-04-20</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>
```

放在 `</urlset>` 前。**優先順序放在其他文章之後**（首頁永遠第一筆）。

---

## 8. 寫作風格

### 內容風格
- 像在跟朋友分享咖啡經驗，**專業但不生硬**
- 第二人稱（你/妳）比第三人稱（讀者/使用者）親切
- 自然帶入關鍵字，**不硬塞**
- 標題包含主題關鍵字（對 SEO 和使用者都好）

### 字數建議
| 分類 | 建議字數 |
|---|---|
| 咖啡小學堂（knowledge） | 1500-3000 字，深度內容 |
| 最新消息（news） | 500-1500 字 |
| 咖啡活動（events） | 800-1500 字 |
| 咖啡地圖（map） | 600-1200 字 |
| 達人實測（kol） | 1000-2000 字 |
| CBTJ | 依測驗需求 |

### 結構建議
1. **開場**：一段 hook，點出痛點或好奇心（100-200 字）
2. **分段內文**：用 `<h2>` 切 3-5 個大段，每段 `<h3>` 切 2-3 個小節
3. **重點框**：關鍵資訊可用 `<blockquote>` 或 `<div class="highlight-box">` 強調
4. **結語**：收束、下一步行動（CTA）

---

## 9. 效能規範

- 第三方腳本（GA、GTM）放 `</body>` 前，並加 `defer` 或 `async`
- 大型 JSON 不要在 `DOMContentLoaded` 就 `fetch`，用 lazy loading
- 所有 `scroll` listener 用 `requestAnimationFrame` 節流
- 圖片優先 WebP，其次 JPG，**絕不**用未壓縮 PNG（除非是 logo 需要透明）

---

## 10. 安全規範

- JS 用 `textContent`（不用 `innerHTML`，防 XSS）
- 外部連結加 `rel="noopener noreferrer"`（防 reverse tabnabbing）
- **絕不 commit** API key / token / 密碼
- 表單不要用 `GET` 提交使用者資料

---

## 11. Git 工作流程

```bash
# 1. 開始前拉最新
git pull origin main

# 2. 建立文章
mkdir article/my-new-article
# ...放 index.html 和 hero.jpg

# 3. 更新索引
# 編輯 article_list.json、sitemap.xml

# 4. 本地預覽（必要）
npx serve -l 5173 .
# 開 http://localhost:5173 確認首頁卡片有出現、點擊正常、文章頁顯示正常

# 5. commit（繁體中文訊息，描述「為什麼」）
git add article/my-new-article article_list.json sitemap.xml
git commit -m "feat: 咖啡小學堂 — 我的新文章標題"

# 6. push，Vercel 會自動部署
git push origin main
```

### Commit message 格式
```
<類型>: <分類> — <文章標題>

類型：
  feat    — 新文章
  fix     — 修 bug / 補漏
  refactor — 重構、內容大改
  docs    — 文件更新
```

---

## 12. 發布後驗證

Push 後 2-5 分鐘 Vercel 會部署完成。以下必須都 ✅：

### 網頁層
- [ ] 首頁第一頁能看到新文章卡片
- [ ] 卡片上有關鍵字標籤、分類標籤、封面圖
- [ ] 點擊卡片能正常進入文章頁
- [ ] 文章頁 header 有「回首頁」連結
- [ ] 文章頁 footer 完整（3 欄 + 版權）
- [ ] 圖片全部正常顯示（不可以有破圖）

### SEO 層（用瀏覽器開發者工具 Network tab 檢查）
- [ ] HTML `<head>` 有 canonical、og:*、twitter:*、JSON-LD 齊全
- [ ] `view-source:https://dailycoffee.matrix.com.tw/sitemap.xml` 能看到新 URL

### 分享測試
- [ ] 複製文章 URL 貼到 Facebook / Line 聊天室，預覽卡要正確顯示（標題、描述、封面圖）
- [ ] 用 Google Rich Results Test (https://search.google.com/test/rich-results) 輸入 URL，確認 Article schema 通過

---

## 13. 常見錯誤範例（反面教材）

### ❌ 範例 1：slug 不符規範
```
article/NEW_PRODUCT_LAUNCH_2026/index.html
```
→ 全大寫 + 底線，改成 `new-product-launch-2026`

### ❌ 範例 2：tags 是字串
```json
"tags": "\"咖啡\",\"教學\",\"新手\""
```
→ 搜尋會壞掉，改成 `["咖啡", "教學", "新手"]`

### ❌ 範例 3：hero 用臨時 CDN
```html
<img src="https://hailuo-image.../img.jpeg?Expires=1776356438&...">
```
→ 幾天後會失效，必須下載存成 `/article/<slug>/hero.jpg`

### ❌ 範例 4：少了 canonical
```html
<head>
  <title>...</title>
  <meta name="description" content="...">
  <!-- 沒有 canonical，直接 <style> -->
```
→ Google 會把 `/article/xxx/` 和 `/article/xxx/index.html` 當兩頁

### ❌ 範例 5：category 用中文
```json
"category": "咖啡小學堂"
```
→ 前端過濾會壞，必須用英文 key：`"knowledge"`

---

## 14. 版本記錄

| 日期 | 版本 | 改動 |
|---|---|---|
| 2026-04-17 | 1.0 | 初版，制定基本規範 |

---

## 15. 有問題找誰

- 技術問題：support@fnte.com.tw
- GitHub Issues：https://github.com/Fnte-Support/matrix-blog/issues
