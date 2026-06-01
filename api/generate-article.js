// 呼叫 OpenAI 從標題產出「整篇咖啡文章草稿」（文字 + 配圖 prompt）
//
// 需在 Vercel 設 OPENAI_API_KEY。模型用 EDITOR_TEXT_MODEL（預設 gpt-5.5）。
//
// POST /api/generate-article
// body: { title: "...", category?: "knowledge", topic?: "..." }
// → {
//   title, description, tags: [...],
//   body_markdown: "## ...",            // 內文 markdown（給 Markdown 分頁）
//   images: [ { prompt, alt, placement } ]   // 配圖建議（只給 prompt，不在這裡生圖）
// }
//
// 設計：只產「文字 + 配圖 prompt」，圖片由前端逐張呼叫 /api/generate-cover 生成（gosakura 模式）。

const MODEL = process.env.EDITOR_TEXT_MODEL || "gpt-5.5";

const VALID_CATEGORIES = {
  knowledge: "咖啡知識／教學／攻略",
  map: "咖啡地圖（店家介紹）",
  news: "新聞動態",
  events: "活動展覽",
  kol: "達人實測",
  cbtj: "CBTI 咖啡人格",
};

function buildSystemPrompt() {
  return [
    "你是 Daily Coffee（台灣繁體中文咖啡內容網站）的資深編輯。",
    "你產出的文章必須是可直接上線的最終版本，不可混入內部備註、交接語氣、操作說明。",
    "",
    "【硬性規範】",
    "1. 全文純繁體中文（台灣用字）。絕對不可有簡體字（黃非黄、發非发、體非体、風非风、學非学、為非为、從非从、與非与、經非经、過非过、會非会、時非时）。",
    "2. 咖啡術語用台灣精品咖啡圈慣用詞：手沖（非手衝）、拿鐵（非拿提）、濾杯（非滤杯）、磨豆機、Espresso／濃縮咖啡（非义式）、單品咖啡。",
    "3. 語氣像跟朋友分享咖啡經驗，專業但不生硬，用第二人稱（你）。自然帶入關鍵字，不硬塞。",
    "4. 結構：30 秒重點框 → 開場引言 → 5–8 個 H2 段落（每段有實質資訊）→ FAQ → 結語。",
    "5. 不要硬塞外部引用。但若文中用到具體數據／研究，文末用「## 資料來源」段落誠實列出參考依據（markdown 連結或來源名稱皆可）；沒有引用就不用加，不可編造連結。",
    "6. 只輸出 JSON，不要任何其他文字、不要 markdown code fence。",
    "",
    "【篇幅與深度】正文（body_markdown 去掉 HTML 標籤後的純文字）至少 3000 字、目標 3000–5000 字。",
    "分 5–8 個 H2，每段都要有紮實內容與實例，不可灌水湊字數、不可空泛重複。",
    "",
    "【現代讀者看不了長文，必須用視覺化元件，不要整篇都是文字段落】",
    "搭配 5–8 個 H2，平均每 1–2 段就穿插一個視覺元件，讓長文有層次不無聊。",
    "body_markdown 內可直接寫以下 HTML 元件（class 名稱要完全一致）：",
    '- 開頭必放 30 秒重點框：<div class="dc-quick"><p>💡 30 秒重點｜<簡短主題></p><ul><li><strong>核心結論：</strong>…</li><li><strong>適合對象：</strong>…</li><li><strong>關鍵重點：</strong>…</li></ul></div>',
    '- 提示框（綠，建議/推薦）：<div class="dc-callout tip"><p>💡 標題</p><p>內容</p></div>',
    '- 警告框（橘，雷點/注意）：<div class="dc-callout warn"><p>⚠️ 標題</p><p>內容</p></div>',
    '- 資訊框（藍，補充）：<div class="dc-callout info"><p>ℹ️ 標題</p><p>內容</p></div>',
    '- 比較卡（兩方案並排）：<div class="dc-compare"><div class="dc-compare-card"><span class="label">A</span><h3>標題</h3><ul><li>…</li></ul></div><div class="dc-compare-card"><span class="label">B</span><h3>標題</h3><ul><li>…</li></ul></div></div>',
    '- 步驟卡（流程教學，自動編號）：<div class="dc-steps"><div class="dc-step"><h3>步驟標題</h3><p>說明</p></div>…</div>',
    '- 檢查清單：<ul class="dc-check"><li>項目</li>…</ul>',
    '- 大引言金句：<p class="dc-quote">一句話</p>',
    '- 資訊卡（單一資訊如時間/地點/價格/數據，不要用表格）：<div class="dc-info-card"><span class="ic-icon">📍</span><div class="ic-body"><p>標題</p><p>內容</p></div></div>',
    "至少用到 4 種不同元件。",
    "",
    "【表格規範】表格只用在「多項目橫向比較」（例如不同粉水比/烘焙度/器材對照），至少 3 欄 × 3 列、欄位對齊、每格填實。",
    "單一資訊（時間、地點、價格、單一數據）一律用上面的資訊卡 dc-info-card，絕對不要用表格呈現。",
  ].join("\n");
}

function buildUserPrompt({ title, category, topic }) {
  const catLabel = VALID_CATEGORIES[category] || "咖啡知識";
  return [
    `請為以下主題寫一篇完整文章，並回傳嚴格的 JSON 物件。`,
    ``,
    `文章標題：${title}`,
    `文章分類：${catLabel}`,
    topic ? `核心主題／角度：${topic}` : ``,
    ``,
    `JSON 結構（只回傳這個物件，不要包 code fence）：`,
    `{`,
    `  "title": "可微調過、更吸引人的繁中標題（≤ 40 字）",`,
    `  "description": "SEO meta description，80–120 字，繁中",`,
    `  "tags": ["3–6 個繁中關鍵字"],`,
    `  "cover": { "prompt": "封面圖英文生圖 prompt（橫幅 16:9，主視覺，不含文字）", "alt": "封面繁中說明" },`,
    `  "body_markdown": "完整內文，markdown + 上述視覺元件 HTML 混用。開頭先放 dc-quick 30 秒重點框，再寫引言（不加標題），接著 5–8 個 ## H2 段落，每 1–2 段穿插一個視覺元件。FAQ 用 <details><summary>Q：問題</summary>答案</details>。正文純文字至少 3000 字（目標 3000–5000），紮實有深度、不灌水。表格只用於多項目比較（≥3欄×3列），單一資訊用 dc-info-card。",`,
    `  "images": [`,
    `    { "prompt": "英文生圖 prompt，描述要畫什麼（不含風格詞，風格由系統統一加）", "alt": "繁中圖片說明", "placement": "放在哪一段（例：引言後 / 某H2標題段）" }`,
    `  ]`,
    `}`,
    ``,
    `images 給 2–4 張建議即可（封面另外處理，這裡是內文配圖）。`,
    `body_markdown 內不要自己插入圖片語法，圖片由系統依 images 清單另外插入。`,
  ].filter(Boolean).join("\n");
}

// 防禦式解析：去除可能的 code fence、抓出第一個 JSON 物件
function parseModelJson(text) {
  let s = (text || "").trim();
  // 去掉 ```json ... ``` 或 ``` ... ```
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  // 抓第一個 { 到最後一個 }
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first >= 0 && last > first) s = s.slice(first, last + 1);
  return JSON.parse(s);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "伺服器未設 OPENAI_API_KEY" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  const title = (body.title || "").trim();
  const category = (body.category || "knowledge").trim();
  const topic = (body.topic || "").trim();

  if (!title) return res.status(400).json({ error: "缺少 title" });
  if (title.length > 120) return res.status(400).json({ error: "title 過長" });
  if (!VALID_CATEGORIES[category]) return res.status(400).json({ error: "category 不在白名單" });

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: buildUserPrompt({ title, category, topic }) },
        ],
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      return res.status(502).json({ error: `OpenAI 回應 ${r.status}: ${errText.slice(0, 300)}` });
    }

    const data = await r.json();
    const raw = data.choices?.[0]?.message?.content || "";
    if (!raw) return res.status(502).json({ error: "OpenAI 回應為空" });

    let parsed;
    try {
      parsed = parseModelJson(raw);
    } catch (e) {
      return res.status(502).json({
        error: "AI 回傳格式無法解析成 JSON",
        debug: raw.slice(0, 500),
      });
    }

    // 正規化輸出
    const out = {
      title: String(parsed.title || title).trim(),
      description: String(parsed.description || "").trim(),
      tags: Array.isArray(parsed.tags) ? parsed.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 8) : [],
      cover: (parsed.cover && parsed.cover.prompt) ? { prompt: String(parsed.cover.prompt).trim(), alt: String(parsed.cover.alt || "").trim() } : null,
      body_markdown: String(parsed.body_markdown || "").trim(),
      images: Array.isArray(parsed.images) ? parsed.images.map((im) => ({
        prompt: String(im.prompt || "").trim(),
        alt: String(im.alt || "").trim(),
        placement: String(im.placement || "").trim(),
      })).filter((im) => im.prompt).slice(0, 6) : [],
      model: MODEL,
    };

    if (!out.body_markdown || out.body_markdown.length < 50) {
      return res.status(502).json({ error: "AI 產出的內文過短", debug: raw.slice(0, 300) });
    }

    return res.status(200).json(out);
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
