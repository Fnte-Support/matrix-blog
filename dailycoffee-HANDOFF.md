# DailyCoffee — Session 交接紀錄

> 每次 session 結束時更新此檔案，下次接手直接讀完這份就能繼續工作。

---

## 最後更新：2026-04-17（下午 session）

## 🎯 新 session 接手 3 步驟

```bash
# 1. 進入專案
cd /Users/<user>/Downloads/matrix-dailycoffee  # 或你的實際路徑

# 2. 同步最新
git pull origin main

# 3. 啟動本地預覽
npx serve -l 5173 .
# 或用 Claude Code 的 preview_start（.claude/launch.json 已設定）
```

然後讀這份檔案的「目前網站狀態」和「待辦」就能接上。

---

## 目前網站狀態（production 上的樣子）

### 首頁 `/`
- **147 篇文章卡片**（7 本地 + 140 外連到舊站）
- 分類 nav：全部文章 / 📢最新消息 / 📖咖啡小學堂 / 🎪咖啡活動 / 🗺️咖啡地圖 / ⭐達人實測 / 🧪CBTJ / **💬咖啡人分享（連結到 /socialmedia/）**
- 分頁：9 張/頁 × 17 頁，含智慧省略號
- 每張卡片顯示：封面圖、分類標籤（可多個）、標題、關鍵字標籤（最多 4 個）、日期、外部連結標記
- 支援 `?cat=xxx` URL 參數直接過濾
- 3 欄 footer：分類 / 關於 / 社群

### 文章分類分布（多分類併存）
```
knowledge (咖啡小學堂):  71
news (最新消息):         60
events (咖啡活動):       25
kol (達人實測):          13
map (咖啡地圖):           9
cbtj:                    1
─────────────────────
實際文章數:              147（多分類文章重複計算，所以總和 > 147）
```

### 保留的 7 篇本地原創文章
```
article/
├── cbti/                          — CBTI 咖啡人格測驗（互動頁）
├── coffee-stopover/               — COFFEE STOPOVER 台中店家
├── ethiopia-coffee-origin/        — 衣索比亞咖啡
├── functional-coffee/             — 功能性咖啡
├── simple-kaffa/                  — 興波咖啡 Simple Kaffa
├── v60-brewing-ratio/             — V60 黃金比例
└── water-quality-coffee-flavor/   — 水質影響咖啡風味
```

### /socialmedia/ 頁（咖啡人真實分享）
- Tab 切換 Threads（6 則）和 Instagram（11 則）
- 用官方 embed.js（`blockquote` + script）
- **注意：** Threads embed 在 localhost 預覽看不到（需要 production domain），IG 可以

### SEO 基礎
- `sitemap.xml`：首頁 + 7 篇本地文章 + /socialmedia/ = 9 條 URL（只含 dailycoffee 網域）
- `robots.txt`：允許 GPTBot、ClaudeBot、OAI-SearchBot、PerplexityBot、Google-Extended、Applebot、FacebookBot 等
- 7 篇本地文章都有完整 canonical + og + twitter + JSON-LD Article schema
- 所有 JSON-LD publisher 都是 "Daily Coffee"

---

## ⚠️ 重要：OpenClaw 的狀況（務必先讀）

### 背景
- `Fnte-Support` GitHub 帳號同時被你（人類使用者）和 **OpenClaw（AI 自動化服務）** 使用
- OpenClaw 會自動從舊站抓文章、產圖、更新 JSON、push 到 main
- 它用 Personal Access Token（`ghp_*`）驗證
- 它會讀 `dailycoffee-ARTICLE-SOP.md` 作為規範（確認過它 commit message 寫「完全符合 SOP」）

### 目前狀態（2026-04-17 下午）
- ✅ **OpenClaw 的 token 已被使用者刪除**（`ghp_*` 類全部 Revoke）
- ✅ OpenClaw 目前無法 push，但服務本身還在
- ⚠️ **如果未來要重啟 OpenClaw**：
  - 建新 token 時**只給 `repo` scope**（不要 admin 全開）
  - 把新 SOP 規範告訴 OpenClaw，特別強調「不要動 footer / header / publisher」
  - 考慮開 Branch Protection + PR 流程（OpenClaw 和人類都走 PR）

### OpenClaw 做過的干擾（已還原）
本 session 修復了這些：
- ❌ 把 footer 加「矩陣世紀官網」「🌸 櫻花出行」連結 → 還原
- ❌ 把 publisher name 改成「Matrix 矩陣世紀」→ 改回 "Daily Coffee"
- ❌ 把 147 筆 JSON 砍到 53 筆 → 還原回 147 筆
- ❌ 產生 4 個新文章資料夾（altitude / coffee-acidity / coffee-water-chemistry / espresso-extraction）→ 全部刪除（使用者確認不要這 4 篇）
- ❌ header 加「Matrix 咖啡專欄｜E-E-A-T 認證內容」副標 → 移除
- ❌ sitemap 混入 43 條 matrix.com.tw 外連 URL → 只留 dailycoffee 網域

### 如果下個 session 看到 footer / header 又被改
檢查 git log：
```bash
git log --oneline --format='%ai %an %s' -20
```
Fnte Support = OpenClaw（不是使用者 Jessie）。如果看到它 push 了未授權變動，詢問使用者是否要還原。

---

## 本次 session 完成（full 清單）

### 網站定位
- 確認 **C 方案**：舊站 `matrix.com.tw/blog` 繼續運作，新站只放原創；外連到舊站文章

### article_list.json 重建
- 從 66 筆混亂資料 → 147 筆乾淨條目
- 統一欄位：title / slug / category / date / tags / image / description / url / source
- `source: local`（7 筆本地）/ `source: external`（140 筆外連）
- 備份：`article_list.json.bak`

### 多分類支援
- `category` 欄位可以是字串或陣列
- 31 筆多分類文章（例：展會紀實文章同屬 news + events + kol）
- 前端 `hasCategory()` / `primaryCategory()` 處理兩種格式
- 卡片顯示邏輯：過濾某分類時只顯示該分類；全部文章時顯示所有分類

### SEO 建設
- sitemap.xml（只有 dailycoffee 網域）
- robots.txt（含 AI 爬蟲白名單）
- 6 篇文章（cbti 除外）+ cbti 本身補完整 SEO meta

### 首頁改版
- 關鍵字標籤（最多 4 個徽章）
- 外部連結標記 + target="_blank" + rel="noopener noreferrer"
- 分頁（9 張/頁 × 17 頁，含智慧省略號）
- `?cat=xxx` URL 參數支援
- 搜尋支援陣列型 tags、description

### Footer 設計
- 3 欄（分類捷徑 / 關於 / 社群）+ 手機自動單欄
- 底部小字 sitemap / robots 連結（AI 爬蟲友善）
- 社群連結已改直連：
  - Threads: https://www.threads.com/@matrix.tw
  - Instagram: https://www.instagram.com/matrix.tw/
  - Facebook: https://www.facebook.com/matrixscale.tw

### 文章頁架構
- 7 篇本地文章統一 dc-header（sticky）+ dc-footer
- 移除重複的返回首頁連結
- ethiopia / v60 hero 圖從過期阿里雲 URL 改成 Unsplash 穩定 URL

### 新頁面：/socialmedia/
- Tab 切換 Threads（6 則）/ Instagram（11 則）
- 使用官方 embed.js
- RWD 3/2/1 欄
- 首頁 nav 加「💬 咖啡人分享」連結

### SOP 更新（`dailycoffee-ARTICLE-SOP.md`）
- 圖片規範修訂：允許 MiniMax / DALL-E 等 AI 產圖，但**必須立即下載為本地 hero.jpg**
- 明確禁止 `?Expires=` / `?Signature=` 簽章 URL 留在 commit
- 加入 pre-commit grep 自檢指令

---

## 待辦 / 未完成

### 🔴 高優先

1. **到 production 驗證 Threads embed 有沒有渲染**
   - 開 https://dailycoffee.matrix.com.tw/socialmedia/
   - 切到 Threads tab，6 則貼文應該顯示（本地 localhost 顯示不出來是 Threads 平台的限制）
   - 如果 production 也不行，可能要改用 iframe 手寫版或其他方案

2. **ethiopia-coffee-origin / v60-brewing-ratio 的 hero 圖目前用 Unsplash**
   - 按 SOP 規範應該下載本地 hero.jpg（MiniMax 產或自家素材）
   - Unsplash 雖穩定但非 Matrix 自家品牌素材

### 🟡 中優先

3. **Matrix 官網選單連動**：舊站 matrix.com.tw 的「專欄」選單要指向 `dailycoffee.matrix.com.tw`（1shop 後台工作）
4. **Facebook embed**：等使用者有 Meta Developers App ID 後可以加到 /socialmedia/ 新增 FB tab
5. **首頁彈窗廣告**：同事給了 Bootstrap 版本的 code，要整合需要引入 jQuery 或改寫純 JS

### 🟢 低優先

6. **Google Search Console** 提交新站 + sitemap.xml
7. **自動化 JSON 產出**：目前 article_list.json 手動維護，長遠可寫腳本從 `article/*/index.html` 自動產生

---

## 已知問題

- **Threads embed 本地預覽不渲染**（IG 可以）— production 應該可以，但待驗證
- **Footer 社群 icon 沒有 icon**（只有文字）— 如果要加 SVG icon 是小工程
- **7 篇文章 inline CSS 風格差異大** — 這是 OpenClaw 當初用 AI 產生時每篇不同的樣式，要統一得整篇重寫
- **article_list.json 還是手動維護**，新增文章時容易漏更新 sitemap

---

## 重要備註

### 專案基本資訊

| 項目 | 值 |
|---|---|
| 網址 | https://dailycoffee.matrix.com.tw |
| GitHub | https://github.com/Fnte-Support/matrix-blog |
| 擁有者帳號 | Fnte-Support |
| 部署 | GitHub → Vercel（push main 自動部署） |
| 聯絡信箱 | support@fnte.com.tw |

### GitHub 身份（兩個同時在用）

| 作者 | 身份 | git commit 裡的顯示 |
|---|---|---|
| **Jessie_Macmini** | 使用者本機（你） | `Jessie_Macmini <jessie_macmini@...>` |
| **Fnte Support** | OpenClaw AI 服務 | `Fnte Support <support@fnte.com.tw>` |

**驗證方式**（判斷某個 commit 是你還是 OpenClaw 推的）：
```bash
git log --format='%an <%ae>  %s' -10
```

### 本機 push 授權方式
- 使用者這台 Mac 用的是 `gh` CLI 的 **OAuth token**（`gho_*`），不是手動建的 PAT
- `https://github.com/settings/applications` 可看到 GitHub CLI 授權
- 撤銷 GitHub CLI 授權會讓本機無法 push（除非重新 `gh auth login`）

### 舊站對照

| 分類頁 | URL | 篇數 |
|---|---|---|
| 最新消息 | `/news` | 60 |
| 咖啡小學堂 | `/coffeeexpertise` | 69 |
| 咖啡活動 | `/coffee_event` | 25 |
| 咖啡地圖 | `/coffeemap` | 9 |
| KOL 評價回饋 | `/kol-yt-unboxing` | 13 |

**去重後總計：140 篇**（分類間有重複）
所有舊站連結都還活著（42 連結全 200 OK）

### 本地開發

```bash
# 本機預覽（需 Node.js）
npx serve -l 5173 .

# 或 Claude Code
# preview_start with name="dailycoffee"
```

### 設計色票（index.html CSS variables）
```css
--coffee-dark:  #2C1810   /* 深咖啡：header / footer / 主文字 */
--coffee-mid:   #6B4226   /* 中咖啡：nav bar / h2 */
--coffee-light: #C07A3E   /* 淺咖啡：hover / 強調 */
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

### 新文章發布流程
**完整規範看 `dailycoffee-ARTICLE-SOP.md`**，簡版：

1. 在 `article/<slug>/` 建資料夾（slug 小寫連字號）
2. 放 `index.html`（含完整 SEO meta + dc-header + dc-footer）和 `hero.jpg`（1200×630，≤300KB）
3. 在 `article_list.json` 加一筆（`source: local`）
4. 更新 `sitemap.xml` 加新 URL
5. `git pull → add → commit (繁中訊息) → push`
6. Vercel 自動部署

### 關聯專案
- **櫻花出行 gosakurajp**（gosakurajp.com）
  - 同一位擁有者的旅遊包車網站
  - 技術棧相同（純靜態 HTML）
  - 共用 `Fnte-Support` GitHub 帳號
  - 有另一個 AI 服務（「Gosakura Seo」token）在管理
  - 工作目錄可能是 `/Users/fnte/Downloads/sakura`

---

## 這個 session 的最後 commit（驗證用）

```
48e6fd5  feat: 新增「咖啡人真實分享」頁（Threads + Instagram 嵌入牆）
7cb74d2  feat: 文章支援多分類並存
3910a5a  fix: 修正分類歸屬（KOL 3→13、活動 3→23）
af8b282  revert: 還原為 147 筆完整版（7 本地 + 140 外連）
6f16cbe  fix: 還原 Daily Coffee 原設計 + SEO 清理
ba93d07  docs(sop): 修訂圖片規範，允許 MiniMax/DALL-E 等產圖但必須本地化
```

新 session 第一件事：`git log --oneline -5` 確認 HEAD 是 `48e6fd5` 或更新。
