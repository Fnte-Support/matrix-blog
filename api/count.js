import { kv } from "@vercel/kv";

const KEY = "cbti_quiz_count";
const BASE = 3927; // 起始種子數

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method === "POST") {
      const n = await kv.incr(KEY);
      return res.status(200).json({ count: n + BASE });
    }
    const n = (await kv.get(KEY)) || 0;
    return res.status(200).json({ count: n + BASE });
  } catch (err) {
    // KV 尚未綁定或故障 — 回傳 fallback（BASE + 日期差 * 穩定亂數）
    const days = Math.max(
      0,
      Math.floor((Date.now() - new Date("2026-04-16").getTime()) / 86400000)
    );
    const pseudo = days * 7 + (days % 13);
    return res.status(200).json({ count: BASE + pseudo, fallback: true });
  }
}
