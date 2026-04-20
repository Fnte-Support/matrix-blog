// 文章發佈 endpoint：從 /admin/ 或 OpenClaw 皆用同一條路
//
// 必要環境變數（Vercel Settings → Environment Variables）：
//   ADMIN_TOKEN       — 任意 secret，請求時在 x-admin-token header 傳同值
//   GITHUB_TOKEN      — GitHub Personal Access Token，需 `repo` scope
//   GITHUB_REPO       — 例如 "Fnte-Support/matrix-blog"
//   GITHUB_BRANCH     — 預設 "main"
//   SITE_HOST         — 預設 "dailycoffee.matrix.com.tw"
//
// POST /api/publish
// Header: x-admin-token: <ADMIN_TOKEN>
// Body JSON:
// {
//   "title": "...",
//   "slug": "...",                      // 英文 slug
//   "description": "...",               // <= 120 字
//   "categories": ["knowledge"],        // 代碼陣列
//   "tags": ["..."],
//   "date": "2026-04-17",               // YYYY-MM-DD
//   "body_html": "<p>...</p>",          // 已 sanitize 的 HTML
//   "body_mode": "rich_text"|"html_source",
//   "cover_data_url": "data:image/webp;base64,...",  // 新文章必填；overwrite 模式選填
//   "products": [{url,name,image,price,price_old}],
//   "overwrite": false                  // true 時允許覆寫既有文章（slug 已存在不報錯）
// }
// 回應：{ ok: true, url: "https://.../article/<slug>/" } 或 { error: "..." }

const CATEGORY_MAP = {
  knowledge: "咖啡知識",
  map: "咖啡地圖",
  news: "新聞動態",
  events: "活動展覽",
  kol: "KOL 專訪",
  cbtj: "CBTI 人格",
};

const SITE_HOST = process.env.SITE_HOST || "dailycoffee.matrix.com.tw";
const SITE_BASE = `https://${SITE_HOST}`;

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function escapeAttr(s) { return escapeHtml(s); }

function jsonLdEscape(s) { return String(s ?? "").replace(/</g, "\\u003c"); }

// ── 驗證 payload ────────────────────────────
function validatePayload(p) {
  const errors = [];
  if (!p || typeof p !== "object") return ["payload 必須是 JSON object"];
  if (!p.title || typeof p.title !== "string") errors.push("title 必填");
  else if (p.title.length > 60) errors.push("title 不可超過 60 字");
  if (!p.slug || typeof p.slug !== "string") errors.push("slug 必填");
  else if (!/^[a-z][a-z0-9-]{2,59}$/.test(p.slug)) errors.push("slug 格式錯誤（小寫英文字母開頭、3-60 字元、僅 a-z 0-9 -）");
  if (!Array.isArray(p.categories) || p.categories.length === 0) errors.push("categories 必填（至少一個）");
  else if (p.categories.some((c) => !CATEGORY_MAP[c])) errors.push("categories 含未知代碼");
  if (!p.description || p.description.length > 120) errors.push("description 必填且 ≤ 120 字");
  if (!p.date || !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) errors.push("date 必填（YYYY-MM-DD）");
  if (!p.body_html || typeof p.body_html !== "string") errors.push("body_html 必填");
  else if (p.body_html.replace(/<[^>]+>/g, "").trim().length < 50) errors.push("body_html 內文過短");
  // cover_data_url：新文章必填；overwrite 模式選填（不給就保留原封面）
  if (p.cover_data_url) {
    if (!/^data:image\/[a-z]+;base64,/.test(p.cover_data_url)) errors.push("cover_data_url 必須是 data URL");
  } else if (!p.overwrite) {
    errors.push("cover_data_url 必填（新文章必須有封面）");
  }
  if (p.products && !Array.isArray(p.products)) errors.push("products 需為陣列");
  return errors;
}

// ── 從 HTML 抽 FAQ（偵測 <details><summary>...</summary>...</details> 模式）──
// 用於產出 FAQPage JSON-LD schema，讓 Google 搜尋結果出現可展開的 Q&A 卡片
function extractFaqFromHtml(html) {
  const faqs = [];
  const detailsRe = /<details\b[^>]*>([\s\S]*?)<\/details>/gi;
  let m;
  while ((m = detailsRe.exec(html)) !== null) {
    const inner = m[1];
    const sumMatch = inner.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i);
    if (!sumMatch) continue;
    const q = sumMatch[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
    const aRaw = inner.replace(/<summary\b[^>]*>[\s\S]*?<\/summary>/i, "");
    const a = aRaw.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
    if (q && a && q.length <= 500 && a.length >= 10) {
      faqs.push({ q, a });
    }
  }
  return faqs;
}

// 計算中文字數（去標籤、去空白，剩下字元數）
function countCjkWords(html) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, "").trim();
  return text.length;
}

// ── 從 body_html 抽出內嵌 base64 圖片 → 轉檔案清單 ────────────────────────
// 使用時間戳+序號命名，避免覆寫模式下與既有檔案撞名
function extractInlineImages(html) {
  const files = [];
  let newHtml = html;
  let idx = 1;
  const ts = Math.floor(Date.now() / 1000).toString(36);  // 短時間戳
  newHtml = newHtml.replace(
    /<img\b([^>]*?)\bsrc=["'](data:image\/([a-z]+);base64,([^"']+))["']([^>]*)>/gi,
    (m, pre, fullData, mime, b64, post) => {
      const ext = (mime === "jpeg" ? "jpg" : mime) || "png";
      const filename = `img-${ts}-${idx}.${ext}`;
      idx += 1;
      files.push({ filename, base64: b64, mime: `image/${mime}` });
      return `<img${pre} src="/article/SLUG_PLACEHOLDER/${filename}"${post}>`;
    }
  );
  return { html: newHtml, files };
}

// ── 文章 HTML 模板 ────────────────────────────
function renderArticleHtml(p, inlineImagesResolvedHtml) {
  const pageUrl = `${SITE_BASE}/article/${p.slug}/`;
  const heroUrl = `${SITE_BASE}/article/${p.slug}/hero.webp`;
  const kwList = [...(p.tags || []), ...(p.categories || []).map((c) => CATEGORY_MAP[c])].filter(Boolean);
  const keywords = kwList.join(",");
  const categoryTags = p.categories.map((c) =>
    `<span class="cat-tag">${escapeHtml(CATEGORY_MAP[c])}</span>`
  ).join("");

  const productsHtml = (p.products && p.products.length) ? `
  <section class="products-section">
    <h2>推薦商品</h2>
    <div class="products-grid">
      ${p.products.map((pr) => `
        <a class="product-card" href="${escapeAttr(pr.url)}" target="_blank" rel="noopener noreferrer">
          <img src="${escapeAttr(pr.image)}" alt="${escapeAttr(pr.name)}" loading="lazy">
          <div class="p-name">${escapeHtml(pr.name)}</div>
          ${pr.price ? `<div class="p-price">NT$${escapeHtml(pr.price)}${pr.price_old ? `<span class="p-old">NT$${escapeHtml(pr.price_old)}</span>` : ""}</div>` : ""}
          <div class="p-cta">前往選購</div>
        </a>
      `).join("")}
    </div>
  </section>
  ` : "";

  const wordCount = countCjkWords(inlineImagesResolvedHtml);

  const schemaArticle = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": p.title,
    "description": p.description,
    "image": heroUrl,
    "datePublished": p.date,
    "dateModified": p.date_modified || p.date,
    "inLanguage": "zh-TW",
    "wordCount": wordCount,
    "author": { "@type": "Organization", "name": "Daily Coffee 編輯部", "url": SITE_BASE },
    "publisher": {
      "@type": "Organization",
      "name": "Daily Coffee",
      "url": "https://www.matrix.com.tw",
      "logo": { "@type": "ImageObject", "url": "https://www.matrix.com.tw/logo.png" },
    },
    "mainEntityOfPage": { "@type": "WebPage", "@id": pageUrl },
    "articleSection": CATEGORY_MAP[p.categories[0]],
    "keywords": keywords,
  };

  const schemaBreadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "首頁", "item": SITE_BASE + "/" },
      { "@type": "ListItem", "position": 2, "name": "文章", "item": SITE_BASE + "/" },
      { "@type": "ListItem", "position": 3, "name": p.title, "item": pageUrl },
    ],
  };

  // 自動偵測 <details><summary> FAQ 模式；≥ 2 組問答才產 FAQPage schema
  const faqs = extractFaqFromHtml(inlineImagesResolvedHtml);
  const schemaFaqPage = faqs.length >= 2 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((f) => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a },
    })),
  } : null;

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(p.title)} | Daily Coffee</title>
  <meta name="description" content="${escapeAttr(p.description)}">
  <meta name="keywords" content="${escapeAttr(keywords)}">
  <link rel="canonical" href="${pageUrl}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeAttr(p.title)}">
  <meta property="og:description" content="${escapeAttr(p.description)}">
  <meta property="og:image" content="${heroUrl}">
  <meta property="og:site_name" content="Daily Coffee">
  <meta property="og:locale" content="zh_TW">
  <meta property="article:published_time" content="${p.date}">
  <meta property="article:section" content="${escapeAttr(CATEGORY_MAP[p.categories[0]])}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeAttr(p.title)}">
  <meta name="twitter:description" content="${escapeAttr(p.description)}">
  <meta name="twitter:image" content="${heroUrl}">
  <script type="application/ld+json">${jsonLdEscape(JSON.stringify(schemaArticle))}</script>
  <script type="application/ld+json">${jsonLdEscape(JSON.stringify(schemaBreadcrumb))}</script>${schemaFaqPage ? `
  <script type="application/ld+json">${jsonLdEscape(JSON.stringify(schemaFaqPage))}</script>` : ""}
  <style>
    :root { --coffee-dark: #2C1810; --coffee-mid: #6B4226; --coffee-light: #C07A3E; --coffee-cream: #F5EDE0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", sans-serif; background: var(--coffee-cream); color: var(--coffee-dark); line-height: 1.8; }
    .hero { position: relative; height: 420px; overflow: hidden; }
    .hero img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .hero-overlay { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(44,24,16,0.85)); padding: 2rem 2rem 2.5rem; }
    .hero-overlay h1 { color: #fff; font-size: clamp(1.4rem, 4vw, 2rem); line-height: 1.3; max-width: 800px; margin: 0 auto; }
    .container { max-width: 760px; margin: 0 auto; padding: 2.5rem 1.5rem 4rem; }
    .meta { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(0,0,0,0.1); font-size: 0.85rem; color: #888; }
    .meta .cat-tag { background: #E8F5E9; color: #2E7D32; padding: 0.2rem 0.75rem; border-radius: 20px; font-size: 0.8rem; font-weight: 600; }
    .meta time { margin-left: 0.5rem; }
    .article-body h2 { font-size: 1.35rem; color: var(--coffee-mid); margin: 2.2rem 0 0.8rem; padding-left: 1rem; border-left: 4px solid var(--coffee-light); }
    .article-body h3 { font-size: 1.1rem; color: var(--coffee-dark); margin: 1.5rem 0 0.5rem; }
    .article-body p { margin-bottom: 1rem; }
    .article-body ul, .article-body ol { margin: 0 0 1rem 1.5rem; }
    .article-body li { margin-bottom: 0.4rem; }
    .article-body blockquote { border-left: 4px solid var(--coffee-light); padding: 0.75rem 1rem; margin: 1rem 0; background: #fff; color: var(--coffee-mid); border-radius: 0 8px 8px 0; }
    .article-body img { max-width: 100%; height: auto; border-radius: 8px; margin: 1rem 0; display: block; }
    .article-body table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.95rem; }
    .article-body th, .article-body td { padding: 0.6rem 0.75rem; text-align: left; border-bottom: 1px solid #eee; }
    .article-body th { background: var(--coffee-dark); color: #fff; font-weight: 600; }
    .article-body a { color: var(--coffee-light); }
    .back-link { display: inline-block; margin: 1rem 1.5rem; color: var(--coffee-mid); text-decoration: none; font-size: 0.9rem; }
    .products-section { margin-top: 3rem; padding-top: 2rem; border-top: 1px solid rgba(0,0,0,0.1); }
    .products-section h2 { color: var(--coffee-mid); font-size: 1.2rem; margin-bottom: 1rem; text-align: center; }
    .products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
    .product-card { background: #fff; border-radius: 8px; padding: 10px; text-decoration: none; color: inherit; display: block; transition: transform 0.15s; }
    .product-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .product-card img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 4px; background: var(--coffee-cream); }
    .product-card .p-name { font-size: 13px; font-weight: 500; margin: 8px 0 4px; line-height: 1.4; min-height: 36px; }
    .product-card .p-price { color: var(--coffee-light); font-weight: 700; font-size: 14px; }
    .product-card .p-price .p-old { color: #aaa; text-decoration: line-through; font-weight: 400; margin-left: 6px; font-size: 12px; }
    .product-card .p-cta { margin-top: 8px; background: var(--coffee-mid); color: #fff; text-align: center; padding: 6px; border-radius: 4px; font-size: 12px; }
  </style>
</head>
<body>
  <a href="${SITE_BASE}" class="back-link">← 返回首頁</a>
  <div class="hero">
    <img src="${heroUrl}" alt="${escapeAttr(p.title)}">
    <div class="hero-overlay">
      <h1>${escapeHtml(p.title)}</h1>
    </div>
  </div>
  <div class="container">
    <div class="meta">
      ${categoryTags}
      <time>${p.date}</time>
      <span>By Daily Coffee</span>
    </div>
    <div class="article-body">
${inlineImagesResolvedHtml}
    </div>
${productsHtml}
  </div>
</body>
</html>
`;
}

// ── GitHub API helpers ────────────────────────────
async function gh(method, path, body) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) throw new Error("伺服器未設 GITHUB_TOKEN / GITHUB_REPO");
  const url = `https://api.github.com/repos/${repo}${path}`;
  const r = await fetch(url, {
    method,
    headers: {
      "Authorization": `token ${token}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "matrix-blog-publisher",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const t = await r.text();
    const err = new Error(`GitHub ${method} ${path} ${r.status}: ${t.slice(0, 300)}`);
    err.status = r.status;
    throw err;
  }
  return await r.json();
}

async function ghGetFile(path, branch) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${branch}`;
  const r = await fetch(url, {
    headers: {
      "Authorization": `token ${token}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "matrix-blog-publisher",
    },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub GET contents ${path} ${r.status}`);
  return await r.json();
}

// ── 更新 article_list.json ────────────────────────────
function buildListEntry(p) {
  return {
    title: p.title,
    slug: p.slug,
    category: p.categories.length === 1 ? p.categories[0] : p.categories,
    date: p.date,
    image: `${SITE_BASE}/article/${p.slug}/hero.webp`,
    description: p.description,
    tags: p.tags || [],
    url: `/article/${p.slug}/`,
    source: "local",
  };
}

function updateArticleList(raw, newEntry) {
  let arr;
  try { arr = JSON.parse(raw); } catch { throw new Error("現有 article_list.json 壞了"); }
  if (!Array.isArray(arr)) throw new Error("article_list.json 不是陣列");
  // 重複 slug 則替換，否則插在最前面
  const idx = arr.findIndex((a) => a.slug === newEntry.slug);
  if (idx >= 0) arr[idx] = newEntry;
  else arr.unshift(newEntry);
  return JSON.stringify(arr, null, 2) + "\n";
}

// ── 更新 sitemap.xml ────────────────────────────
function updateSitemap(raw, slug, date) {
  const loc = `${SITE_BASE}/article/${slug}/`;
  const block = `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${date}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
  // 若已有相同 URL，替換 lastmod；否則插入到 </urlset> 前
  if (raw.includes(loc)) {
    return raw.replace(
      new RegExp(`  <url>\\s*<loc>${loc.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}</loc>[\\s\\S]*?</url>\\n?`),
      block
    );
  }
  return raw.replace("</urlset>", block + "</urlset>");
}

// ── 主 handler ────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }

  // ── Auth ──
  const token = req.headers["x-admin-token"];
  if (!process.env.ADMIN_TOKEN) {
    return res.status(500).json({ error: "伺服器未設 ADMIN_TOKEN" });
  }
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "未授權（x-admin-token 不符）" });
  }

  // ── Parse + validate ──
  let payload;
  try {
    payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "payload 不是有效 JSON" });
  }
  const errors = validatePayload(payload);
  if (errors.length) return res.status(400).json({ error: "驗證失敗", details: errors });

  const branch = process.env.GITHUB_BRANCH || "main";

  try {
    // ── Slug 唯一性檢查（新文章才檢查；overwrite 模式跳過）──
    const existing = await ghGetFile(`article/${payload.slug}/index.html`, branch);
    if (existing && !payload.overwrite) {
      return res.status(409).json({ error: `slug 已存在：${payload.slug}（要覆寫請帶 overwrite: true）` });
    }
    if (!existing && payload.overwrite) {
      return res.status(404).json({ error: `要覆寫的文章不存在：${payload.slug}` });
    }

    // ── 抽取內嵌圖片（raw_full 模式也要抽）──
    const { html: htmlWithPathPlaceholder, files: inlineImages } = extractInlineImages(payload.body_html);
    let resolvedHtml = htmlWithPathPlaceholder.replace(/SLUG_PLACEHOLDER/g, payload.slug);

    // ── 覆寫模式記錄 dateModified ──
    if (payload.overwrite) {
      payload.date_modified = new Date().toISOString().split("T")[0];
    }

    // ── raw_full 模式：若同事貼了完整 HTML 文件，抽出 <body> 內容 + 保留 <head> 的 style/script/link ──
    // 仍然套 Daily Coffee 文章模板（只是不 sanitize 內文，保留 <style>/<script>）
    const isRawFull = payload.body_mode === "raw_full";
    if (isRawFull) {
      const bodyMatch = resolvedHtml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) {
        const headMatch = resolvedHtml.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
        let extras = "";
        if (headMatch) {
          // 只保留 head 裡的 <style>、<script>、<link rel="stylesheet|preconnect">
          // 跳過 <title>/<meta>（避免跟模板 meta 重複）
          const matches = headMatch[1].matchAll(/<(style|script|link)\b[^>]*(?:\/>|>[\s\S]*?<\/\1>|>)/gi);
          for (const m of matches) {
            extras += m[0] + "\n";
          }
        }
        resolvedHtml = extras + bodyMatch[1];
      }
      // 若沒有 <body>，視為 body 片段，直接用
    }

    // 永遠套 Daily Coffee 模板（raw_full 只差在內文不 sanitize）
    const articleHtml = renderArticleHtml(payload, resolvedHtml);

    // ── 取得現有 article_list.json 與 sitemap.xml ──
    const listFile = await ghGetFile("article_list.json", branch);
    if (!listFile) return res.status(500).json({ error: "找不到 article_list.json" });
    const listRaw = Buffer.from(listFile.content, "base64").toString("utf8");
    const newListRaw = updateArticleList(listRaw, buildListEntry(payload));

    const mapFile = await ghGetFile("sitemap.xml", branch);
    if (!mapFile) return res.status(500).json({ error: "找不到 sitemap.xml" });
    const mapRaw = Buffer.from(mapFile.content, "base64").toString("utf8");
    const newMapRaw = updateSitemap(mapRaw, payload.slug, payload.date_modified || payload.date);

    // ── 解析 cover_data_url（overwrite 可略）──
    let coverBase64 = null, coverFilename = null;
    if (payload.cover_data_url) {
      const coverMatch = payload.cover_data_url.match(/^data:image\/([a-z]+);base64,(.+)$/);
      const coverExt = coverMatch[1] === "jpeg" ? "jpg" : coverMatch[1];
      coverBase64 = coverMatch[2];
      coverFilename = `hero.${coverExt}`;
    }

    // ── 建立所有 blob（image 用 base64，文字用 utf8）──
    const blobs = [];
    async function createBlob(content, encoding) {
      const res = await gh("POST", "/git/blobs", { content, encoding });
      return res.sha;
    }

    const articlePath = `article/${payload.slug}/index.html`;
    const sidecarPath = `article/${payload.slug}/article.json`;

    // ── 產出 sidecar JSON（編輯時載回用；不含 cover_data_url 避免肥大）──
    const sidecar = {
      _schema_version: 1,
      title: payload.title,
      slug: payload.slug,
      description: payload.description,
      categories: payload.categories,
      tags: payload.tags || [],
      date: payload.date,
      date_modified: payload.date_modified || null,
      body_html: resolvedHtml,  // 存已解析好路徑的版本
      body_mode: payload.body_mode || "rich_text",
      products: payload.products || [],
      source: payload.source || "admin",
    };
    const sidecarJson = JSON.stringify(sidecar, null, 2) + "\n";

    // 核心四個 blob（覆寫模式且無 cover 時，cover blob 跳過）
    const [articleSha, listSha, mapSha, sidecarSha] = await Promise.all([
      createBlob(articleHtml, "utf-8"),
      createBlob(newListRaw, "utf-8"),
      createBlob(newMapRaw, "utf-8"),
      createBlob(sidecarJson, "utf-8"),
    ]);
    blobs.push({ path: articlePath, sha: articleSha });
    blobs.push({ path: "article_list.json", sha: listSha });
    blobs.push({ path: "sitemap.xml", sha: mapSha });
    blobs.push({ path: sidecarPath, sha: sidecarSha });

    if (coverBase64) {
      const coverSha = await createBlob(coverBase64, "base64");
      blobs.push({ path: `article/${payload.slug}/${coverFilename}`, sha: coverSha });
    }

    for (const img of inlineImages) {
      const sha = await createBlob(img.base64, "base64");
      blobs.push({ path: `article/${payload.slug}/${img.filename}`, sha });
    }

    // ── 取得 branch ref + tree sha ──
    const ref = await gh("GET", `/git/ref/heads/${branch}`);
    const latestCommitSha = ref.object.sha;
    const latestCommit = await gh("GET", `/git/commits/${latestCommitSha}`);
    const baseTreeSha = latestCommit.tree.sha;

    // ── 建立 tree ──
    const treeItems = blobs.map((b) => ({
      path: b.path,
      mode: "100644",
      type: "blob",
      sha: b.sha,
    }));
    const newTree = await gh("POST", "/git/trees", { base_tree: baseTreeSha, tree: treeItems });

    // ── 建立 commit ──
    const verb = payload.overwrite ? "更新" : "新增";
    const commitMsg = `feat: ${verb}文章《${payload.title}》\n\nslug: ${payload.slug}\ncategories: ${payload.categories.join(", ")}\nsource: ${payload.source || "admin"}`;
    const newCommit = await gh("POST", "/git/commits", {
      message: commitMsg,
      parents: [latestCommitSha],
      tree: newTree.sha,
    });

    // ── 更新 branch ref ──
    await gh("PATCH", `/git/refs/heads/${branch}`, { sha: newCommit.sha });

    return res.status(200).json({
      ok: true,
      url: `${SITE_BASE}/article/${payload.slug}/`,
      commit: newCommit.sha.slice(0, 7),
      files_committed: blobs.length,
      inline_images: inlineImages.length,
    });
  } catch (err) {
    if (err.status === 409) return res.status(409).json({ error: err.message });
    return res.status(500).json({ error: String(err.message || err) });
  }
}
