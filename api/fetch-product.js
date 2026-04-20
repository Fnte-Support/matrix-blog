// 抓取 matrix.com.tw 商品頁的 OG image 和 <h1>，回傳 {title, image, url}
// 只接受 matrix.com.tw 網域，擋掉其他連結避免被濫用成 SSRF

const ALLOWED_HOST = "www.matrix.com.tw";

function parseMeta(html, property) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const m = html.match(re);
  return m ? m[1] : null;
}

function parseFirstH1(html) {
  // 先剝掉 <script> / <style> 內容，避免 h1 regex 誤匹配到 JS 模板字串
  const cleaned = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "");
  const m = cleaned.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return null;
  let text = m[1]
    .replace(/<[^>]+>/g, "")   // 剝內層標籤
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
  // 限制最多 80 字（避免有人把整段介紹塞進 h1）
  if (text.length > 80) text = text.slice(0, 80) + "…";
  return text || null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const url = (req.query.url || "").trim();
  if (!url) return res.status(400).json({ error: "missing url" });

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: "invalid url" });
  }

  if (parsed.hostname !== ALLOWED_HOST) {
    return res
      .status(400)
      .json({ error: `只接受 ${ALLOWED_HOST} 的商品連結` });
  }

  try {
    const r = await fetch(parsed.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 MatrixBlogBot" },
    });
    if (!r.ok) {
      return res.status(502).json({ error: `商品頁回應 ${r.status}` });
    }
    const html = await r.text();

    const title = parseFirstH1(html) || parseMeta(html, "og:title") || "";
    const image = parseMeta(html, "og:image") || "";

    return res.status(200).json({
      url: parsed.toString(),
      title,
      image,
      note: "1shop 商品頁的價格是 JS 渲染，無法自動抓取，請手動輸入",
    });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
