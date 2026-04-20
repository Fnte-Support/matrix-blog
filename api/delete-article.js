// 刪除文章 endpoint
//
// POST /api/delete-article
// Header: x-admin-token: <ADMIN_TOKEN>
// Body JSON: { "slug": "..." }
//
// 動作（原子 commit）：
//   1. 刪除 article/<slug>/ 裡所有檔案
//   2. 從 article_list.json 移除條目
//   3. 從 sitemap.xml 移除 <url> 區塊
//
// 回應：{ ok: true, deleted_files: N }

const SITE_HOST = process.env.SITE_HOST || "dailycoffee.matrix.com.tw";
const SITE_BASE = `https://${SITE_HOST}`;

async function gh(method, path, body) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) throw new Error("伺服器未設 GITHUB_TOKEN / GITHUB_REPO");
  const r = await fetch(`https://api.github.com/repos/${repo}${path}`, {
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

// 列出資料夾下所有檔案（單層）
async function ghListFolder(folder, branch) {
  const data = await ghGetFile(folder, branch);
  if (!data) return [];
  if (!Array.isArray(data)) return [];
  return data.filter((x) => x.type === "file").map((x) => x.path);
}

function removeFromArticleList(raw, slug) {
  let arr;
  try { arr = JSON.parse(raw); } catch { throw new Error("article_list.json 壞了"); }
  if (!Array.isArray(arr)) throw new Error("article_list.json 不是陣列");
  const filtered = arr.filter((a) => a.slug !== slug);
  if (filtered.length === arr.length) {
    // 沒有找到（可能被手動刪過），不擋
  }
  return JSON.stringify(filtered, null, 2) + "\n";
}

function removeFromSitemap(raw, slug) {
  const loc = `${SITE_BASE}/article/${slug}/`;
  // 移除整個含此 loc 的 <url> 區塊
  return raw.replace(
    new RegExp(`  <url>\\s*<loc>${loc.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}</loc>[\\s\\S]*?</url>\\s*\\n?`, "g"),
    ""
  );
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }

  const token = req.headers["x-admin-token"];
  if (!process.env.ADMIN_TOKEN) return res.status(500).json({ error: "伺服器未設 ADMIN_TOKEN" });
  if (token !== process.env.ADMIN_TOKEN) return res.status(401).json({ error: "未授權" });

  let payload;
  try {
    payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "payload 不是有效 JSON" });
  }
  const slug = payload?.slug;
  if (!slug || !/^[a-z0-9][a-z0-9-]{1,80}$/i.test(slug)) {
    return res.status(400).json({ error: "slug 格式錯誤" });
  }

  const branch = process.env.GITHUB_BRANCH || "main";

  try {
    // 1. 列出資料夾下所有檔案
    const files = await ghListFolder(`article/${slug}`, branch);
    if (files.length === 0) {
      return res.status(404).json({ error: `資料夾 article/${slug}/ 不存在或為空` });
    }

    // 2. 取 article_list.json + sitemap.xml
    const listFile = await ghGetFile("article_list.json", branch);
    if (!listFile) return res.status(500).json({ error: "找不到 article_list.json" });
    const listRaw = Buffer.from(listFile.content, "base64").toString("utf8");
    const newListRaw = removeFromArticleList(listRaw, slug);

    const mapFile = await ghGetFile("sitemap.xml", branch);
    if (!mapFile) return res.status(500).json({ error: "找不到 sitemap.xml" });
    const mapRaw = Buffer.from(mapFile.content, "base64").toString("utf8");
    const newMapRaw = removeFromSitemap(mapRaw, slug);

    // 3. 取目前 HEAD
    const ref = await gh("GET", `/git/ref/heads/${branch}`);
    const latestCommitSha = ref.object.sha;
    const latestCommit = await gh("GET", `/git/commits/${latestCommitSha}`);
    const baseTreeSha = latestCommit.tree.sha;

    // 4. 建立 blob（僅 list + sitemap 是更新；article/<slug>/* 是刪除 sha: null）
    async function createBlob(content, encoding) {
      const r = await gh("POST", "/git/blobs", { content, encoding });
      return r.sha;
    }
    const [listSha, mapSha] = await Promise.all([
      createBlob(newListRaw, "utf-8"),
      createBlob(newMapRaw, "utf-8"),
    ]);

    const treeItems = [
      { path: "article_list.json", mode: "100644", type: "blob", sha: listSha },
      { path: "sitemap.xml", mode: "100644", type: "blob", sha: mapSha },
      // 刪除的檔案：sha = null
      ...files.map((p) => ({ path: p, mode: "100644", type: "blob", sha: null })),
    ];

    const newTree = await gh("POST", "/git/trees", {
      base_tree: baseTreeSha,
      tree: treeItems,
    });

    const newCommit = await gh("POST", "/git/commits", {
      message: `feat: 刪除文章 ${slug}\n\n含 ${files.length} 個檔案、同步更新 article_list.json、sitemap.xml`,
      parents: [latestCommitSha],
      tree: newTree.sha,
    });

    await gh("PATCH", `/git/refs/heads/${branch}`, { sha: newCommit.sha });

    return res.status(200).json({
      ok: true,
      slug,
      deleted_files: files.length,
      commit: newCommit.sha.slice(0, 7),
    });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
