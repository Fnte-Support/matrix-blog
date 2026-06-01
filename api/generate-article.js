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
    "4. 結構：開場引言 → 數個 H2 段落（可含 H3、清單、表格、blockquote 小撇步）→ FAQ → 結語。",
    "5. 知識／科學型文章至少要有 1 個外部權威引用（SCA、學術研究、World Coffee Research 等），用 markdown 連結語法。",
    "6. 只輸出 JSON，不要任何其他文字、不要 markdown code fence。",
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
    `  "body_markdown": "完整內文，markdown 格式。用 ## 當段落標題、### 當子標題。FAQ 段落用這個格式：每題寫成一行 '### Q：問題' 接著下一段是答案。至少 800 字。引言不要加標題直接寫。",`,
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
