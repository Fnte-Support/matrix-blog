// 呼叫 AI 產封面圖，MiniMax 優先，失敗 fallback 到 OpenAI DALL-E 3
//
// 必要環境變數（至少其一，兩個都設可 fallback）：
//   MINIMAX_API_KEY   — MiniMax 國際版 key（$0.01/張，api.minimax.io）
//   OPENAI_API_KEY    — OpenAI key（DALL-E 3，$0.08/張，當 MiniMax 失敗時使用）
//
// POST /api/generate-cover  body: { prompt: "...", provider?: "minimax"|"openai"|"auto" }
//   provider 預設 "auto"（MiniMax 優先，失敗 fallback OpenAI）
//   也可指定 "minimax" 或 "openai" 強制使用單一供應商（不 fallback）
//
// → { image_base64: "data:...", provider: "minimax"|"openai", fallback_used: bool }
//   前端拿到後用 canvas 裁成 1200×630 webp。

// MiniMax 國際版官方端點（api.minimax.io）
const MINIMAX_ENDPOINT = "https://api.minimax.io/v1/image_generation";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/images/generations";

// ── 把遠端圖片 URL 下載成 base64 data URL ──
async function downloadAsDataUrl(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`下載圖片失敗 ${r.status}`);
  const buf = await r.arrayBuffer();
  const mime = r.headers.get("content-type") || "image/jpeg";
  const base64 = Buffer.from(buf).toString("base64");
  return { dataUrl: `data:${mime};base64,${base64}`, bytes: buf.byteLength };
}

// ── MiniMax（api.minimax.io，image-01 模型）──
// 官方文件：https://platform.minimax.io/docs
async function generateWithMiniMax(prompt) {
  if (!process.env.MINIMAX_API_KEY) {
    throw new Error("未設 MINIMAX_API_KEY");
  }
  const apiReq = {
    model: "image-01",
    prompt,
    aspect_ratio: "16:9",
    response_format: "base64",     // 直接拿 base64，不用再下載
  };

  const r = await fetch(MINIMAX_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.MINIMAX_API_KEY}`,
    },
    body: JSON.stringify(apiReq),
  });
  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`MiniMax 回應 ${r.status}: ${errText.slice(0, 200)}`);
  }
  const data = await r.json();
  // 官方格式：data.data.image_base64 是 base64 字串陣列
  const imageBase64 =
    data?.data?.image_base64?.[0] ||
    data?.data?.image_urls?.[0] ||   // 保留 url 模式做 fallback
    null;
  if (!imageBase64) {
    throw new Error(`MiniMax 回應格式異常: ${JSON.stringify(data).slice(0, 200)}`);
  }

  // 如果回傳的是 http(s) URL，下載轉 base64；否則直接組 data URL
  if (imageBase64.startsWith("http")) {
    return await downloadAsDataUrl(imageBase64);
  }
  // MiniMax 預設回傳 jpeg
  const dataUrl = `data:image/jpeg;base64,${imageBase64}`;
  const bytes = Math.round(imageBase64.length * 0.75);
  return { dataUrl, bytes };
}

// ── OpenAI DALL-E 3 ──
async function generateWithOpenAI(prompt) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("未設 OPENAI_API_KEY");
  }
  // 1792×1024 是 DALL-E 3 最接近 16:9 的尺寸，前端會再裁成 1200×630
  const r = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1792x1024",
      quality: "standard",
      response_format: "url",
    }),
  });
  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`OpenAI 回應 ${r.status}: ${errText.slice(0, 200)}`);
  }
  const data = await r.json();
  const imageUrl = data?.data?.[0]?.url;
  if (!imageUrl) {
    throw new Error(`OpenAI 回應格式異常: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return await downloadAsDataUrl(imageUrl);
}

// ── Handler ──
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  const prompt = (body.prompt || "").trim();
  const provider = (body.provider || "auto").toLowerCase();

  if (!prompt) return res.status(400).json({ error: "缺少 prompt" });
  if (prompt.length > 500) return res.status(400).json({ error: "prompt 過長（上限 500 字）" });
  if (!["auto", "minimax", "openai"].includes(provider)) {
    return res.status(400).json({ error: "provider 必須是 auto / minimax / openai" });
  }

  const errors = [];

  // ── 強制指定 OpenAI ──
  if (provider === "openai") {
    try {
      const out = await generateWithOpenAI(prompt);
      return res.status(200).json({
        image_base64: out.dataUrl,
        bytes: out.bytes,
        provider: "openai",
        fallback_used: false,
      });
    } catch (err) {
      return res.status(502).json({ error: String(err.message || err), provider: "openai" });
    }
  }

  // ── MiniMax 先試（auto 或 minimax）──
  try {
    const out = await generateWithMiniMax(prompt);
    return res.status(200).json({
      image_base64: out.dataUrl,
      bytes: out.bytes,
      provider: "minimax",
      fallback_used: false,
    });
  } catch (err) {
    errors.push(String(err.message || err));
    if (provider === "minimax") {
      return res.status(502).json({ error: errors[0], provider: "minimax" });
    }
    // auto 模式：繼續試 OpenAI
  }

  // ── Fallback 到 OpenAI ──
  try {
    const out = await generateWithOpenAI(prompt);
    return res.status(200).json({
      image_base64: out.dataUrl,
      bytes: out.bytes,
      provider: "openai",
      fallback_used: true,
      minimax_error: errors[0],  // 讓前端可以提示 MiniMax 失敗原因
    });
  } catch (err) {
    errors.push(String(err.message || err));
    return res.status(502).json({
      error: "兩個 AI 供應商都失敗",
      details: {
        minimax: errors[0],
        openai: errors[1],
      },
    });
  }
}
