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
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return null;
  return m[1]
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
