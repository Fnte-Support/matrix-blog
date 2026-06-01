# DailyCoffee — Session 交接紀錄

> 每次 session 結束時更新此檔案，下次接手直接讀完這份就能繼續工作。

---

## 🔴 新 session 必讀：目前在做「文章發布後台」（/admin/）

最近幾個 session 都在做一套 **網頁版文章 CMS**（在 `admin/index.html`，純前端 ~2300 行 + Vercel serverless）。
這是現在的主要工作。**不要碰 `editor/` 資料夾**（那是 gosakurajp 旅遊站的 Flask 編輯器，未追蹤、只當 AI 串接參考，跟 Daily Coffee 不相容）。

### 系統架構（檔案職責）
| 檔案 | 做什麼 |
|---|---|
| `admin/index.html` | 編輯器 UI。頂部 3 模式分頁：🤖 AI 一鍵產文 / ✍️ 手動撰寫 / 📋 草稿與文章。header 有版本號（目前 **v1.17.0**，改完記得 bump）|
| `api/publish.js` | 發布主引擎：GitHub Git Data API 原子 commit；產文章 HTML（含 SEO meta/OG/JSON-LD Article+Breadcrumb，自動偵測 `<details>` 產 FAQPage、structured_data.howto 產 HowTo、偵測 instagram-media 注入 IG embed.js）；更新 article_list.json + sitemap.xml + 每篇 article.json sidecar。支援 overwrite。雙 token（ADMIN/OPENCLAW）|
| `api/generate-article.js` | AI 一鍵產文（OpenAI，模型 `EDITOR_TEXT_MODEL` 預設 gpt-5.5）。回傳 title/description/tags/cover/body_markdown/images。內含繁中規範+元件指令 |
| `api/generate-cover.js` | AI 產圖（MiniMax image-01 優先 → OpenAI dall-e-3 fallback），provider 可選 |
| `api/generate-slug.js` / `fetch-product.js` / `delete-article.js` | slug 翻譯 / 抓商品 OG / 刪文（刪文只接受 ADMIN_TOKEN，擋 OPENCLAW）|
| `article-components.css` | **視覺元件庫**（dc-quick/callout/compare/steps/check/quote/info-card/related/sources + H2/表格/FAQ 樣式）。發布文章模板與後台預覽都 `<link>` 這支（root-absolute `/article-components.css`）|
| `tools/health_check.py` + `.github/workflows/` | 每週健康檢查 + 發文後驗證，有問題開 issue |
| `dailycoffee-OPENCLAW-SPEC.md` | 給 OpenClaw（小龍蝦 AI）的發文 API 規格 |
| `dailycoffee-PUBLISH-SOP.md` | 給人類同事的後台使用教學 |

### Vercel 環境變數（都已設）
`ADMIN_TOKEN`（人類，值 `fUTikaVyQvtV7NTS7ii4goTs2AW4dU`）、`OPENCLAW_TOKEN`（AI，值 `hoRuDBTdbOGSgDee4bCZZ0mxQrd334gh`）、`GITHUB_TOKEN`、`GITHUB_REPO`、`OPENAI_API_KEY`、`MINIMAX_API_KEY`。選填 `EDITOR_TEXT_MODEL`（換產文模型，預設 gpt-5.5）。本機備忘：`/Users/fnte/Downloads/dc-admin-setup.txt`。

### 編輯器三模式運作
- **AI 一鍵產文**：基本資訊欄位 DOM 搬進 AI 面板（單一標題框，不被 AI 覆蓋）、封面=「圖1」配圖卡、內文載入 Markdown 分頁、配圖卡（AI/IG/不放、可選供應商、插到游標處）
- **手動撰寫**：獨立的基本資訊 + 封面圖 + 內文（富文字/Markdown/貼草稿/HTML 四分頁 + 原樣HTML模式）
- **草稿與文章**：💾 暫存草稿（localStorage）的草稿區 + 已發布文章管理（編輯/刪除，非彈窗）

### ⚠️ 致命坑（一定要記住）
1. **JS 字串內不可有 `</script>`**：任何 inline `<script>` 裡的字串若含 `</script>`（如 IG embed.js），瀏覽器 parse 時會提前關閉 script → **整個編輯器 JS 靜默全死**。一律拆字 `'<scr'+'ipt>'`。已踩過一次、修過。
2. **`collectPayload` 的 activeTab** 要用內文 tabs 容器 `editorTabsEl.querySelector('button.active')`，不能用全域 `.tabs`（封面區也叫 .tabs，會抓錯）。
3. **內文 tab 切換用事件委派**（`document` 上監聽 `button[data-tab]`），別用 init 逐個掛。
4. **圖片用短碼**：插圖是 `![alt](dc-img-N)` 短 token（base64 存 `inlineImgMap`），`resolveInlineImages()` 在 collectPayload/預覽時換回 base64。草稿存/還原一併帶 inlineImgMap。
5. **預覽開新分頁**：`window.open("", "dcPreview")` 具名視窗，再按一次預覽會更新同一分頁。
6. **元件 CSS 有 3 處**：`article-components.css`（共用，link）、`api/publish.js` 模板 inline `<style>`、`admin/index.html` 的 `buildPreviewDoc` inline。元件覆蓋用 `!important` 蓋過 inline。改樣式優先改 `article-components.css`。

### 🧪 測試方式
- 改完 JS：抽主 script 做 `node --check`：
  `S=$(grep -n '^(function () {' admin/index.html|head -1|cut -d: -f1); E=$(awk -v s=$S 'NR>s&&/^<\/script>/{print NR;exit}' admin/index.html); sed -n "${S},$((E-1))p" admin/index.html > /tmp/s.js && node --check /tmp/s.js`
- 瀏覽器實測用 preview（`npx serve`，已設 .claude/launch.json `dailycoffee`）。**preview 工具會卡 viewport=0 或跑舊頁面**，重啟 server 拿乾淨 context；reload 後等 ~1.3s 再 eval。

---

## 🟡 待辦（接手就做這些）— 來自最新一次文章實測回饋

使用者用 AI 產了一篇「2026 珈琲與花物語」實測，給了視覺回饋。**CSS 區塊化部分已做**（H2 實心底色、引言區塊、資訊卡加框、FAQ 留白、延伸閱讀/資料來源統一區塊），**prompt 已改**（延伸閱讀不由 AI 編、資料來源用真實連結）。這些已 commit **但還沒 push**。

**還沒做（優先序）：**
1. **🔴 暫存草稿不能刪**：草稿區的 🗑️（`[data-deldraft]`）按了沒反應。要 debug `renderDrafts` 裡的刪除 handler（在 admin/index.html，搜 `data-deldraft`）。可能 saveDraftsArr 或事件綁定問題，先在瀏覽器測。
2. **🔴 配圖插入不防呆**：現在 AI 配圖是「插到 Markdown 游標處」，但使用者不知道要先點游標還是先產圖，流程混亂。要重新設計：建議改成「產圖後顯示縮圖 + 一顆『插入到游標處』按鈕」讓使用者自己決定時機，或產圖後預設插在文章末尾並提示可搬動（短碼好搬）。
3. **🟡 確認所有視覺元件都是底色區塊**：使用者要「所有視覺元件都用底色變成區塊更凸出」。已處理 H2/引言/資訊卡/FAQ/延伸閱讀/資料來源；callout/30秒框/比較卡/步驟卡本來就有底色。部署後再看實際 AI 產出有沒有都套到（AI 不一定每個都用對 class）。
4. **🟡 AI 產文品質驗證**：gpt-5.5 不一定完全聽 prompt。要實際產一篇看：有沒有到 3000–5000 字、有沒有用足元件、表格有沒有亂用（應只多項目比較）、資訊卡有沒有用對。不到位就再調 `api/generate-article.js` 的 prompt。
5. **🟢 舊文章不套新版型**：`article-components.css` 是發布時 link 進去的，舊文章 HTML 已寫死、不會自動變新樣式。只有新發布/重新編輯發布的才套。要全套需寫批次重刷腳本（讀每篇 article.json sidecar → 重新 POST /api/publish overwrite）。先確認新版 OK 再做。

**接手第一步**：`git push`（把已 commit 的 CSS 區塊化推上線），部署後實際產一篇文章看新版型，再從待辦 1、2 開始。

---

## 最後更新：2026-04-22（編輯器第三批：模式分頁 + 草稿 + 預覽新頁，v1.9→v1.15）

### 第三批做了什麼
- **模式分頁**：頂部 3 分頁「🤖 AI 一鍵產文 / ✍️ 手動撰寫 / 📋 草稿與文章」
- **AI 模式整合**：基本資訊欄位 DOM 搬進 AI 面板、封面變「圖1」（AI 同時建議封面 prompt）；
  手動模式才顯示獨立基本資訊/封面區塊；編輯既有文章自動切手動
- **配圖供應商下拉**：每張配圖卡（封面+內文）可選 自動/MiniMax/OpenAI
- **產文 prompt 強化**：字數 3000–5000、5–8 H2、每 1–2 段穿插元件、表格只用於多項目
  比較、單一資訊用 dc-info-card、移除硬性外部引用（改成有引用才列資料來源）
- **預覽改開新分頁**（window.open，連 article-components.css）；預覽只需有內文
- **產圖位置可自選**：AI 內文圖/IG 插到 Markdown 游標處（先在內文點位置）
- **暫存草稿**：💾 按鈕存 localStorage（整份表單），「📋 草稿與文章」分頁可還原/刪除
- **管理改內嵌**：「管理現有文章」從彈窗改成 manage 模式內嵌（草稿區 + 已發布文章）

### 第三批已知的坑
- **致命 bug 已修**：buildPreviewDoc 字串裡的 `</script>`（IG embed.js）會被瀏覽器當成
  真的關閉 inline script → 整個編輯器 JS 死掉。已用 `'<scr'+'ipt>'` 拆字修正。
  **教訓：任何 JS 字串內要寫 `</script>` 一律拆字，否則整頁 JS 崩。**
- **內文 tab 切換改用事件委派**（button[data-tab]），比 init 逐個掛監聽器穩。
- **草稿存 localStorage**：含封面/內嵌圖 base64，太大會超配額（已做砍最舊+try/catch）；
  換電腦/清快取會消失，這是「暫存」非「雲端草稿」。
- **collectPayload 的 activeTab** 要用內文 editorTabsEl 查，不能用全域 `.tabs`（會抓到封面區）。

---

## 上一批：2026-04-22（編輯器 AI 增強 + 視覺化元件 session）

### 🎯 第二批（v1.7.0 → v1.9.0）：視覺化版型元件

對齊 gosakurajp/shinygoods 那種「彩色雜誌版型」，讓文章不再是純文字長文：

1. **視覺化元件庫 `article-components.css`**（repo 根目錄，單一來源）
   - 發佈模板（api/publish.js）與後台預覽都 `<link>` 同一支
   - 元件：30秒重點框、彩色 callout（提示綠/警告橘/資訊藍/推薦咖啡）、
     比較卡 A/B、步驟卡（自動編號）、checklist、大引言、資訊卡、badge，全 RWD
2. **Markdown 分頁改版**（v1.8.0）
   - ① 移除右側即時預覽 → 全寬編輯，工具列「👁️ 預覽文章」走全螢幕預覽頁
   - ④ 新增「常用語法 & 視覺元件」速查表（12 張卡，點一下插入游標處、不跳頂）
   - Markdown 改用 `html_source`（relaxed 白名單）發佈，元件 class 才不被剝掉
3. **AI 產文直接吐彩色元件**（③）：generate-article prompt 要求開頭放 30秒重點框、
   至少用 3 種 dc-* 元件、FAQ 用 `<details>`
4. **配圖三選 + 新增**（②）：每張配圖卡可選 📷 AI生成 / 📱 IG嵌入 / 🚫 不放，
   可「＋ 新增配圖」；IG 嵌入會插 instagram-media blockquote，publish.js 偵測到
   會自動注入 IG embed.js

**驗證**：瀏覽器實測元件 CSS（computed style + 截圖確認雜誌版型）、速查插入、
配圖三選切換、IG 插入、預覽渲染全部通過。

### ⚠️ 第二批已知的坑
- **元件靠 `html_source` + relaxed 白名單**：Markdown 發佈走 html_source（保留 class）。
  relaxed 允許 class/id/style/data-*，但仍擋 script/iframe/onclick。
- **IG 嵌入**：發佈文章偵測到 instagram-media 才注入 embed.js；本地預覽看不到 IG 渲染
  （跟 /socialmedia/ 一樣是 IG 平台限制），要 production 才會出現。
- **`article-components.css` 路徑**：用 root-absolute `/article-components.css`，
  發佈文章（/article/<slug>/）與後台（/admin/）都能解析；Vercel 從 repo 根目錄 serve。

---

### 🎯 第一批（v1.5.0 → v1.7.0）：AI 產文 + Markdown 分頁

在現有的網頁發文後台 `admin/index.html` 加了三件事：

1. **AI 一鍵產文**（新 endpoint `api/generate-article.js`）
   - 頂部新面板：填標題＋選分類＋選填角度 → OpenAI（gpt-5.5，env `EDITOR_TEXT_MODEL` 可換）產出整篇咖啡文章草稿
   - 自動回填 標題/摘要/標籤、勾分類、內文載入 Markdown 分頁
   - 內建繁中台灣用字規範（手沖非手衝、零簡體），對齊 OPENCLAW-SPEC
2. **Markdown 編輯分頁**（左寫右預覽）
   - 第 4 個內文分頁「📝 Markdown」，marked + DOMPurify 即時預覽
   - 工具列：H2/H3/粗體/清單/引言/連結/FAQ 模板/插入圖片
   - 發佈時 markdown → HTML（strict 白名單）→ rich_text 模式
3. **AI 配圖（逐張）**
   - 產文後列出 2–4 張配圖建議，每張可改 prompt/alt
   - 按「產生並插入」→ 重用 `api/generate-cover` 生圖 → 插入 markdown 內文末尾（gosakura 模式：只給 prompt，手動決定生不生）

**驗證**：瀏覽器 stub fetch 端到端實測整條前端流程（回填/分類/Markdown/配圖/逐張生圖插入）全通過。後端 endpoint 語法 + JSON parser 單測通過。**真實 OpenAI/MiniMax 回應需部署後才能測。**

### ⏭️ 下一步要做什麼

1. **部署後實測 AI 產文**：設好 env 後，打開 `/admin/` 用 AI 面板產一篇，確認 gpt-5.5 真的可用、產出繁中無簡體、配圖能生成
2. **確認 `gpt-5.5` 這個 model 名稱在 OPENAI_API_KEY 帳號下可用**（若 402/404，改 Vercel env `EDITOR_TEXT_MODEL` 成可用的 model）
3. （選配）AI 產文的 prompt 還可再調：目前 FAQ 用 `### Q：` 格式，若想自動產 `<details>` FAQPage schema，要讓產文輸出 `<details><summary>` 或在發佈前轉換

### ⚠️ 已知的坑

- **`gpt-5.5` 模型可用性未驗證**：endpoint 預設用它（因為使用者說在用 gpt-5.5），但沒在 Vercel 上實跑過。掛了就設 `EDITOR_TEXT_MODEL` env。
- **Vercel body size 上限 ~4.5MB**：AI 配圖採「逐張生成插入 base64」，若一篇插太多大圖，發佈時 `/api/publish` 的 payload 可能超標 → 目前靠「手動逐張、不一次全生」緩解，但沒硬性擋。
- **兩套編輯器並存**：`admin/`（網頁，**線上正式用的**）vs `editor/`（Flask，**gosakurajp 旅遊站遺留，Daily Coffee 不用**，只當 AI 串接參考）。別搞混；`editor/lib/publish.py` 全是 gosakurajp 專屬（articles.json、npm build、寫死 `/Users/fnte/Downloads/sakura`）。
- **產文 model 回傳非 JSON 風險**：endpoint 有防禦式 parser（去 code fence、抓首個 JSON 物件），但若 gpt-5.5 大幅偏離格式仍可能 502，會回 `debug` 欄位協助排查。

### 🔑 環境變數現況（Vercel Production）

`ADMIN_TOKEN` / `OPENCLAW_TOKEN` / `GITHUB_TOKEN` / `GITHUB_REPO` / `OPENAI_API_KEY` / `MINIMAX_API_KEY` 都已設。
新功能**沒有新增必要 env**（`EDITOR_TEXT_MODEL` 選填，不設預設 gpt-5.5）。

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
