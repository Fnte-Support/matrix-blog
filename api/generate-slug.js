// 呼叫 OpenAI 把中文標題翻成語意 slug
// 需要在 Vercel 設 OPENAI_API_KEY 環境變數
// POST /api/generate-slug  body: { title: "..." }  →  { slug: "..." }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }

  const { title } = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) || {};
  if (!title || typeof title !== "string" || title.length > 120) {
    return res.status(400).json({ error: "缺少 title 或格式錯誤" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "伺服器未設 OPENAI_API_KEY" });
  }

  const prompt = `把這個中文咖啡文章標題轉成符合 SEO 的英文 URL slug。
規則：
- 小寫英文字母、數字、連字號 (-) 分隔
- 6–50 個字元
- 抓語意重點關鍵字，不要逐字翻譯
- 不加 the/a/of 這類冠詞虛詞
- 年份可保留（如 2026）
- 只回傳 slug，不要其他文字

標題：${title}

slug：`;

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 60,
      }),
    });
    if (!r.ok) {
      const errText = await r.text();
      return res.status(502).json({ error: `OpenAI 回應 ${r.status}: ${errText.slice(0, 200)}` });
    }
    const data = await r.json();
    let slug = (data.choices?.[0]?.message?.content || "").trim();

    // 清理：只保留 [a-z0-9-]
    slug = slug.toLowerCase()
      .replace(/[\s_]+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);

    if (!slug || slug.length < 3) {
      return res.status(500).json({ error: "AI 產出的 slug 過短或為空" });
    }
    if (/^[0-9]/.test(slug)) {
      slug = "post-" + slug;
    }

    return res.status(200).json({ slug });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
