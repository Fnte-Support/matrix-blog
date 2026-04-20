// 呼叫 MiniMax image_generation API 產封面圖
// 需在 Vercel 設：
//   MINIMAX_API_KEY = <API key>
//   MINIMAX_GROUP_ID = <group id>  （選填，某些方案需要）
//
// POST /api/generate-cover  body: { prompt: "..." }
//   → { image_base64: "data:image/jpeg;base64,...", width, height }
//
// 前端拿到後會用 canvas 裁成 1200×630 webp。

const MINIMAX_ENDPOINT = "https://api.minimaxi.chat/v1/image_generation";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }

  if (!process.env.MINIMAX_API_KEY) {
    return res.status(500).json({ error: "伺服器未設 MINIMAX_API_KEY" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  const prompt = (body.prompt || "").trim();
  if (!prompt) return res.status(400).json({ error: "缺少 prompt" });
  if (prompt.length > 500) return res.status(400).json({ error: "prompt 過長（上限 500 字）" });

  try {
    const apiReq = {
      model: "image-01",
      prompt,
      aspect_ratio: "16:9",
      response_format: "url",
      n: 1,
      prompt_optimizer: true,
    };
    if (process.env.MINIMAX_GROUP_ID) {
      apiReq.group_id = process.env.MINIMAX_GROUP_ID;
    }

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
      return res.status(502).json({ error: `MiniMax 回應 ${r.status}: ${errText.slice(0, 300)}` });
    }

    const data = await r.json();
    const imageUrl =
      data?.data?.image_urls?.[0] ||
      data?.data?.[0]?.url ||
      data?.image_urls?.[0] ||
      null;

    if (!imageUrl) {
      return res.status(502).json({
        error: "MiniMax 回應格式異常，找不到圖片 URL",
        debug: JSON.stringify(data).slice(0, 500),
      });
    }

    // 後端下載（避免瀏覽器 CORS + 避免 URL 過期）
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      return res.status(502).json({ error: `下載 MiniMax 圖片失敗: ${imgRes.status}` });
    }
    const arrayBuf = await imgRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuf).toString("base64");
    const mime = imgRes.headers.get("content-type") || "image/jpeg";

    return res.status(200).json({
      image_base64: `data:${mime};base64,${base64}`,
      bytes: arrayBuf.byteLength,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
