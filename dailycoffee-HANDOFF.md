# DailyCoffee — Session 交接紀錄

> 每次 session 結束時更新此檔案，下次接手直接讀。

---

## 最後更新：2026-04-17

### 本次完成

#### 網站定位釐清
- 確認採用「**C 方案**」：舊站 `matrix.com.tw/blog` 繼續運作，新站 `dailycoffee.matrix.com.tw` **只放真正新文章**，舊文章以卡片連結導回舊站。
- 消除了重複內容（duplicate content）的 SEO 風險。

#### article_list.json 重建
- 舊 JSON 有 66 筆混亂資料（41 筆幽靈 404、新舊格式混用、slug 含髒字元）。
- 新 JSON 共 **147 筆乾淨條目**：
  - **7 篇本地文章**（`source: local`）— 新站原創，有本地 HTML
  - **140 篇外連文章**（`source: external`）— 從舊站 `/news` `/coffeeexpertise` `/coffee_event` `/coffeemap` `/kol-yt-unboxing` 五個分類去重後的完整清單
- 欄位統一：`title`, `slug`, `category`, `date`, `tags`, `image`, `description`, `url`, `source`。
- 舊的 JSON 備份在 `article_list.json.bak`。
- 舊站完整清單保留在 `old_site_full_inventory.json`（含 meta keywords、og:image、description 原始抓取資料）。

#### 重複內容清理
- 原本 `article/` 有 25 個本地頁面，**其中 18 個是舊站已有文章的複製版**（OpenClaw 當初做的）。
- 已將這 18 筆轉為 `source: external`，並刪除對應的本地資料夾。
- 目前 `article/` 只剩 **7 個真正新站原創**的資料夾。

#### SEO 基礎建設
- **sitemap.xml** — 含首頁 + 7 篇本地文章
- **robots.txt** — 明確允許 GPTBot、ClaudeBot、PerplexityBot、Google-Extended 等 AI 爬蟲
- 每篇本地文章（cbti 除外）補上：
  - `<link rel="canonical">`
  - 完整 `og:` meta（title, description, image, url, type, site_name, locale）
  - `article:published_time`, `article:section`
  - 完整 `twitter:card` meta
  - JSON-LD Article schema（含 headline, image, datePublished, author, publisher, mainEntityOfPage）
  - `meta keywords`、`meta author`

#### 首頁改版
- 卡片新增**關鍵字標籤顯示**（米白色小徽章，每張最多 4 個）
- 卡片新增**外部連結標記**（`↗ 外部連結` 文字、右下角）
- 外連文章點擊開新分頁（`target="_blank" rel="noopener noreferrer"`）
- 新增**分頁功能**（9 張/頁，總 17 頁），含智慧省略號（例：1 … 5 6 7 … 17）
- `?cat=xxx` URL 參數支援（從 footer 分類連結點擊可直接過濾）
- 搜尋邏輯修正（支援陣列型 tags，描述改用 description 優先 excerpt 後備）

#### Footer 完整設計
- 3 欄佈局：分類捷徑（6 分類）／關於（關於我們、聯絡我們、Matrix 官網）／社群（Threads、IG、FB）
- 底部版權 + 小字 sitemap/robots 連結（AI 爬蟲友善）
- 手機版自動變單欄

#### 文章頁架構統一
- 6 篇文章（cbti 除外，因它是互動測驗頁特殊架構）都加上：
  - `.dc-header`（Daily Coffee logo + 回首頁連結，sticky）
  - `.dc-footer`（與首頁相同的 3 欄 footer）
- 移除重複的「返回首頁」連結（新 header 取代）

---

### 待辦 / 未完成

#### 🔴 高優先（會影響使用者體驗）
1. **修補 hero 圖片**：
   - `article/ethiopia-coffee-origin/` — 原圖用過期的阿里雲 URL（`&Expires=1776356438`）
   - `article/v60-brewing-ratio/` — 同上問題
   - 需要：找替代圖片放進資料夾（例：`hero.jpg`）並更新文章 HTML 與 `article_list.json` 的 `image` 欄位
   - 另外檢查 `article_list.json` 裡其他本地文章的 image URL 是否也用了這個會過期的阿里雲網域

#### 🟡 中優先
2. **cbti 也應該補 SEO meta**（canonical、og、JSON-LD）— 本次保留未動，因使用者指示不要動它，但建議之後補上
3. **7 篇本地文章各自 inline CSS 風格不同**，之後可考慮抽共用 CSS 到 `/assets/main.css`

#### 🟢 低優先
4. **Matrix 官網選單連動**：需要把舊站 matrix.com.tw 的「專欄」選單連結改指向 `dailycoffee.matrix.com.tw`（這要在 1shop 後台改）
5. **新文章產出流程**：目前 `article_list.json` 還是手動維護；長遠可寫腳本從 `article/*/index.html` 自動產生 JSON
6. **Google Search Console** 提交新站 + sitemap.xml，加速收錄

---

### 已知問題

- **hero 圖片失效**：ethiopia-coffee-origin、v60-brewing-ratio 兩篇（詳見待辦 #1）
- **7 篇文章各自的 inline CSS 風格差異大**：這是 OpenClaw 產生時每篇不同的 AI 生成樣式，沒辦法統一；如果要一致性需整篇重寫

---

### 重要備註

#### 專案基本資訊
- **網址**：https://dailycoffee.matrix.com.tw
- **GitHub**：https://github.com/Fnte-Support/matrix-blog
- **部署**：GitHub → Vercel（push main 自動部署）
- **聯絡信箱**：support@fnte.com.tw

#### 舊站
- **網址**：https://www.matrix.com.tw/blog
- **分類頁**：
  - `/news` — 最新消息（60 篇）
  - `/coffeeexpertise` — 咖啡小學堂（69 篇）
  - `/coffee_event` — 咖啡活動（25 篇，多數與 news 重複）
  - `/coffeemap` — 咖啡地圖（9 篇，含冠軍特刊）
  - `/kol-yt-unboxing` — KOL 評價回饋（13 篇，多數與 news 重複）
- **去重後總計：140 篇**
- 所有舊站連結都還活著（已驗證 42 個連結全 200）

#### 本地開發
```bash
# 預覽伺服器（需 Node.js）
npx serve -l 5173 .
# 瀏覽器開 http://localhost:5173
```
- 已設定 `.claude/launch.json`，用 Claude Code 的 preview_start 也可以啟動

#### 設計色票（index.html 的 CSS variables）
```css
--coffee-dark:  #2C1810   /* 深咖啡：header / footer / 主文字 */
--coffee-mid:   #6B4226   /* 中咖啡：nav bar / h2 */
--coffee-light: #C07A3E   /* 淺咖啡：hover / 強調 */
--coffee-cream: #F5EDE0   /* 奶色：文章頁背景、標籤底 */
--coffee-bg:    #FDFBF8   /* 米白：首頁背景 */
--gray-light:   #f0ede8   /* 淺灰：分隔線 */
```

#### 分類標籤色
| 分類 | key | 底色 / 文字 |
|---|---|---|
| 最新消息 | `news` | `#FFF3E0` / `#E65100` 橘 |
| 咖啡小學堂 | `knowledge` | `#E8F5E9` / `#2E7D32` 綠 |
| 咖啡活動 | `events` | `#E3F2FD` / `#1565C0` 藍 |
| 咖啡地圖 | `map` | `#F3E5F5` / `#6A1B9A` 紫 |
| 達人實測 | `kol` | `#FFEBEE` / `#C62828` 紅 |
| CBTJ | `cbtj` | `#FFF8E1` / `#F57F17` 黃 |

#### 新文章產出流程（建議）
1. 在 `article/<slug>/` 建資料夾，`slug` 用小寫連字號（如 `my-new-article`）
2. 放 `index.html`（含完整 SEO meta）和 `hero.jpg`
3. 在 `article_list.json` 加一筆：
   ```json
   {
     "title": "...",
     "slug": "my-new-article",
     "category": "knowledge",
     "date": "2026-04-20",
     "tags": ["tag1", "tag2"],
     "image": "https://dailycoffee.matrix.com.tw/article/my-new-article/hero.jpg",
     "description": "...",
     "url": "/article/my-new-article/",
     "source": "local"
   }
   ```
4. 更新 `sitemap.xml` 加新 URL
5. push main → Vercel 自動部署
