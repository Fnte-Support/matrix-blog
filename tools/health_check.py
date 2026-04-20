#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Daily Coffee 文章健康檢查

檢查項目：
  1. article/<slug>/ 資料夾 ↔ article_list.json 條目一致
  2. sitemap.xml 有列出所有本地文章，且沒有幽靈 URL
  3. 每篇文章 index.html 必備元素：title / description / canonical / og:image / 單一 h1
  4. 本地圖片引用都存在（檔案真的在 repo 裡）
  5. <img> 標籤都有 alt
  6. 分類代碼都在白名單內
  7. slug 格式正確
  8. hero 圖大小合理（不超過 600KB）
  9. 封面圖 URL 不是外部臨時 CDN（aliyun / hailuo 等）

執行：
  python3 tools/health_check.py                        # 印 JSON
  python3 tools/health_check.py --markdown-out x.md    # 產 Markdown 報告
  python3 tools/health_check.py --json-out x.json
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
ARTICLE_DIR = ROOT / "article"
ARTICLE_LIST = ROOT / "article_list.json"
SITEMAP = ROOT / "sitemap.xml"

VALID_CATEGORIES = {"knowledge", "map", "news", "events", "kol", "cbtj"}
SLUG_RE = re.compile(r"^[a-z][a-z0-9-]{2,59}$")
SLUG_RE_CHINESE_OK = re.compile(r"^[a-z0-9\u4e00-\u9fff\-%]{2,80}$", re.I)  # 舊文可能有中文 slug，比較寬鬆

BAD_HOST_PATTERNS = [
    "aliyuncs.com",
    "hailuo-image",
    "oss-cn-",
    "dfs-alpha-gateway",
    "Expires=",  # 帶過期參數
]

SEVERITY_ERROR = "error"
SEVERITY_WARN = "warning"
SEVERITY_INFO = "info"


def add_issue(issues, severity, slug, category, message, detail=None):
    issues.append({
        "severity": severity,
        "slug": slug,
        "category": category,
        "message": message,
        "detail": detail,
    })


# ── 1. list ↔ 資料夾 一致性 ─────────────────────────
def check_list_vs_folders(issues):
    if not ARTICLE_LIST.exists():
        add_issue(issues, SEVERITY_ERROR, None, "list", "article_list.json 不存在")
        return {}
    try:
        data = json.loads(ARTICLE_LIST.read_text(encoding="utf-8"))
    except Exception as e:
        add_issue(issues, SEVERITY_ERROR, None, "list", f"article_list.json 解析失敗：{e}")
        return {}
    if not isinstance(data, list):
        add_issue(issues, SEVERITY_ERROR, None, "list", "article_list.json 不是陣列")
        return {}

    local_entries = {}
    for e in data:
        slug = e.get("slug")
        if not slug:
            add_issue(issues, SEVERITY_ERROR, None, "list", "有條目缺 slug", detail=str(e)[:200])
            continue
        src = e.get("source", "external")
        if src == "local":
            local_entries[slug] = e

    # 對比資料夾
    folder_slugs = set()
    if ARTICLE_DIR.exists():
        for p in ARTICLE_DIR.iterdir():
            if p.is_dir():
                folder_slugs.add(p.name)

    list_slugs = set(local_entries.keys())
    orphan_folders = folder_slugs - list_slugs
    ghost_entries = list_slugs - folder_slugs

    for s in sorted(orphan_folders):
        add_issue(issues, SEVERITY_WARN, s, "sync",
                  f"資料夾 article/{s}/ 存在，但 article_list.json 沒有此 slug")
    for s in sorted(ghost_entries):
        add_issue(issues, SEVERITY_ERROR, s, "sync",
                  f"article_list.json 有 {s}，但 article/{s}/ 資料夾不存在")

    return local_entries


# ── 2. sitemap 同步 ─────────────────────────────────
def check_sitemap(issues, local_entries):
    if not SITEMAP.exists():
        add_issue(issues, SEVERITY_ERROR, None, "sitemap", "sitemap.xml 不存在")
        return
    raw = SITEMAP.read_text(encoding="utf-8")
    # 找 /article/<slug>/ 型式的 <loc>
    locs = re.findall(r"<loc>\s*https?://[^/]+/article/([^/<\s]+)/\s*</loc>", raw)
    sitemap_slugs = set(locs)
    list_slugs = set(local_entries.keys())

    for s in sorted(list_slugs - sitemap_slugs):
        add_issue(issues, SEVERITY_ERROR, s, "sitemap",
                  f"文章 {s} 沒列入 sitemap.xml")
    for s in sorted(sitemap_slugs - list_slugs):
        add_issue(issues, SEVERITY_WARN, s, "sitemap",
                  f"sitemap.xml 有 URL /article/{s}/，但文章已不存在（幽靈 URL）")


# ── 3. 單篇文章內容檢查 ─────────────────────────────
def check_article(slug, entry, issues):
    folder = ARTICLE_DIR / slug
    idx = folder / "index.html"

    if not idx.exists():
        add_issue(issues, SEVERITY_ERROR, slug, "file", "index.html 不存在")
        return

    html = idx.read_text(encoding="utf-8", errors="replace")

    # ── slug 格式 ──
    if not SLUG_RE.match(slug) and not SLUG_RE_CHINESE_OK.match(slug):
        add_issue(issues, SEVERITY_WARN, slug, "slug",
                  "slug 格式不符新規範（小寫字母開頭、a-z 0-9 -，3-60 字）")

    # ── 分類 ──
    cats = entry.get("category")
    cats_list = cats if isinstance(cats, list) else ([cats] if cats else [])
    for c in cats_list:
        if c not in VALID_CATEGORIES:
            add_issue(issues, SEVERITY_WARN, slug, "category",
                      f"分類代碼 '{c}' 不在白名單內（{', '.join(sorted(VALID_CATEGORIES))})")

    # ── meta 必備 ──
    if not re.search(r"<title>[^<]{5,}</title>", html):
        add_issue(issues, SEVERITY_ERROR, slug, "meta", "缺 <title> 或過短")
    m = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', html)
    if not m:
        add_issue(issues, SEVERITY_ERROR, slug, "meta", "缺 meta description")
    elif len(m.group(1)) < 30:
        add_issue(issues, SEVERITY_WARN, slug, "meta",
                  f"meta description 太短（{len(m.group(1))} 字）")
    elif len(m.group(1)) > 160:
        add_issue(issues, SEVERITY_WARN, slug, "meta",
                  f"meta description 太長（{len(m.group(1))} 字，Google 會截）")

    if not re.search(r'<link\s+rel="canonical"', html):
        add_issue(issues, SEVERITY_WARN, slug, "meta", "缺 canonical 連結")
    if not re.search(r'<meta\s+property="og:image"', html):
        add_issue(issues, SEVERITY_WARN, slug, "meta", "缺 og:image")

    # ── h1 單一 ──
    h1_count = len(re.findall(r"<h1\b[^>]*>", html, re.I))
    if h1_count == 0:
        add_issue(issues, SEVERITY_WARN, slug, "structure", "沒有 <h1>")
    elif h1_count > 1:
        add_issue(issues, SEVERITY_ERROR, slug, "structure",
                  f"有 {h1_count} 個 <h1>（SEO 規定只能一個）")

    # ── 本地圖片都要存在 ──
    local_img_re = re.compile(r'["\'\s]/article/' + re.escape(slug) + r'/([^"\'\s]+)')
    for m in local_img_re.finditer(html):
        filename = m.group(1).split("?")[0]
        p = folder / filename
        if not p.exists():
            add_issue(issues, SEVERITY_ERROR, slug, "image",
                      f"引用了本地檔 {filename} 但檔案不存在")

    # ── <img> 都要有 alt ──
    img_no_alt = 0
    for img_tag in re.findall(r"<img\b[^>]*>", html, re.I):
        if not re.search(r'\balt\s*=', img_tag, re.I):
            img_no_alt += 1
    if img_no_alt > 0:
        add_issue(issues, SEVERITY_WARN, slug, "image",
                  f"{img_no_alt} 個 <img> 缺 alt 屬性")

    # ── 封面圖 URL 是否為外部臨時 CDN ──
    cover_img = entry.get("image", "")
    for bad in BAD_HOST_PATTERNS:
        if bad in cover_img:
            add_issue(issues, SEVERITY_ERROR, slug, "image",
                      f"封面圖 URL 含外部臨時參數，會過期：{bad}",
                      detail=cover_img[:200])
            break
    # 也查文章內的 hero
    if re.search(r'<meta\s+property="og:image"\s+content="[^"]*aliyuncs\.com', html):
        add_issue(issues, SEVERITY_ERROR, slug, "image",
                  "og:image 指向 aliyuncs.com 臨時 URL（會過期）")

    # ── hero 圖大小 ──
    for name in ("hero.webp", "hero.jpg", "hero.jpeg", "hero.png"):
        p = folder / name
        if p.exists():
            size_kb = p.stat().st_size / 1024
            if size_kb > 600:
                add_issue(issues, SEVERITY_WARN, slug, "image",
                          f"{name} 大小 {size_kb:.0f}KB 偏大（建議 ≤ 300KB）")
            break
    else:
        # 純遠端封面沒有本地 hero 不算錯
        pass

    # ── JSON-LD schema 驗證 ──
    check_schemas(slug, html, issues)


# ── JSON-LD schema 驗證 ────────────────────────────
def extract_json_ld(html):
    """從 HTML 抽出所有 <script type="application/ld+json"> 區塊，解析成 dict 清單。"""
    results = []
    for m in re.finditer(
        r'<script\s+type=["\']application/ld\+json["\'][^>]*>([\s\S]*?)</script>',
        html, re.I,
    ):
        raw = m.group(1).strip()
        # publish.js 會把 < 轉成 \u003c 避免 HTML 解析問題，這裡反轉
        raw = raw.replace("\\u003c", "<").replace("\\u003e", ">")
        try:
            data = json.loads(raw)
            results.append(data)
        except json.JSONDecodeError as e:
            results.append({"_parse_error": str(e), "_raw": raw[:200]})
    return results


def check_schemas(slug, html, issues):
    schemas = extract_json_ld(html)
    types_found = []

    for s in schemas:
        if "_parse_error" in s:
            add_issue(issues, SEVERITY_ERROR, slug, "schema",
                      f"JSON-LD 解析失敗：{s['_parse_error']}",
                      detail=s.get("_raw", ""))
            continue

        # 處理 @graph 陣列格式
        items = s.get("@graph", [s]) if isinstance(s, dict) else [s]
        for item in items:
            if not isinstance(item, dict):
                continue
            t = item.get("@type")
            if isinstance(t, list):
                t = t[0]
            if not t:
                continue
            types_found.append(t)

            if t == "Article" or t.endswith("Article"):
                validate_article_schema(slug, item, issues)
            elif t == "FAQPage":
                validate_faq_schema(slug, item, issues)
            elif t == "BreadcrumbList":
                validate_breadcrumb_schema(slug, item, issues)

    # 必有 Article + BreadcrumbList
    if not any(t == "Article" or t.endswith("Article") for t in types_found):
        add_issue(issues, SEVERITY_ERROR, slug, "schema",
                  "缺 Article JSON-LD schema")
    if "BreadcrumbList" not in types_found:
        add_issue(issues, SEVERITY_WARN, slug, "schema",
                  "缺 BreadcrumbList JSON-LD schema")

    # 若內文含 <details><summary>（FAQ 模式）但沒有 FAQPage schema，警告
    details_count = len(re.findall(r"<details\b", html, re.I))
    if details_count >= 2 and "FAQPage" not in types_found:
        add_issue(issues, SEVERITY_WARN, slug, "schema",
                  f"內文有 {details_count} 組 <details> 看起來像 FAQ，但沒產出 FAQPage schema（發文時沒偵測到？）")


def validate_article_schema(slug, item, issues):
    """Article 必備欄位：headline, image, datePublished, author, publisher."""
    required = ["headline", "image", "datePublished", "author", "publisher"]
    missing = [k for k in required if not item.get(k)]
    if missing:
        add_issue(issues, SEVERITY_ERROR, slug, "schema",
                  f"Article schema 缺必備欄位：{', '.join(missing)}")
    # datePublished 格式
    dp = item.get("datePublished", "")
    if dp and not re.match(r"^\d{4}-\d{2}-\d{2}", str(dp)):
        add_issue(issues, SEVERITY_WARN, slug, "schema",
                  f"Article datePublished 格式建議 YYYY-MM-DD（現為 {dp}）")
    # image 不可是臨時 CDN
    img = item.get("image", "")
    if isinstance(img, dict):
        img = img.get("url", "")
    elif isinstance(img, list):
        img = img[0] if img else ""
    img = str(img or "")
    if img and any(bad in img for bad in ("aliyuncs.com", "hailuo", "Expires=")):
        add_issue(issues, SEVERITY_ERROR, slug, "schema",
                  f"Article image 為臨時 URL，會過期：{img[:100]}")


def validate_faq_schema(slug, item, issues):
    """FAQPage 必備：mainEntity 陣列、每組 Question 有 name + acceptedAnswer.text。"""
    me = item.get("mainEntity")
    if not isinstance(me, list):
        add_issue(issues, SEVERITY_ERROR, slug, "schema",
                  "FAQPage.mainEntity 必須是陣列")
        return
    if len(me) < 2:
        add_issue(issues, SEVERITY_WARN, slug, "schema",
                  f"FAQPage.mainEntity 只有 {len(me)} 組（Google 建議 ≥ 2）")
    for i, q in enumerate(me):
        if not isinstance(q, dict):
            continue
        if not q.get("name"):
            add_issue(issues, SEVERITY_ERROR, slug, "schema",
                      f"FAQPage 第 {i+1} 題缺 name")
        ans = q.get("acceptedAnswer") or {}
        if not (ans.get("text") if isinstance(ans, dict) else None):
            add_issue(issues, SEVERITY_ERROR, slug, "schema",
                      f"FAQPage 第 {i+1} 題缺 acceptedAnswer.text")


def validate_breadcrumb_schema(slug, item, issues):
    items = item.get("itemListElement")
    if not isinstance(items, list) or not items:
        add_issue(issues, SEVERITY_ERROR, slug, "schema",
                  "BreadcrumbList.itemListElement 為空或非陣列")
        return
    for i, li in enumerate(items):
        if not isinstance(li, dict):
            continue
        pos = li.get("position")
        if pos != i + 1:
            add_issue(issues, SEVERITY_WARN, slug, "schema",
                      f"BreadcrumbList position 應 1,2,3... 但第 {i+1} 個是 {pos}")


# ── 主流程 ─────────────────────────────────────────
def run_check():
    issues = []
    local_entries = check_list_vs_folders(issues)
    check_sitemap(issues, local_entries)
    for slug, entry in sorted(local_entries.items()):
        check_article(slug, entry, issues)

    # 統計
    by_severity = {}
    by_category = {}
    for i in issues:
        by_severity[i["severity"]] = by_severity.get(i["severity"], 0) + 1
        by_category[i["category"]] = by_category.get(i["category"], 0) + 1

    return {
        "checked_at": datetime.now().isoformat(timespec="seconds"),
        "total_articles": len(local_entries),
        "total_issues": len(issues),
        "by_severity": by_severity,
        "by_category": by_category,
        "issues": issues,
    }


# ── 輸出 ───────────────────────────────────────────
SEVERITY_EMOJI = {
    SEVERITY_ERROR: "🔴",
    SEVERITY_WARN: "🟡",
    SEVERITY_INFO: "🔵",
}


def to_markdown(report):
    lines = []
    t = report["checked_at"]
    lines.append(f"# 🩺 Daily Coffee 文章健康檢查報告")
    lines.append("")
    lines.append(f"- **檢查時間**：{t}")
    lines.append(f"- **掃描文章數**：{report['total_articles']}")
    lines.append(f"- **發現問題數**：{report['total_issues']}")
    lines.append("")

    if report["total_issues"] == 0:
        lines.append("✅ **全部通過，無須修正。**")
        return "\n".join(lines) + "\n"

    bs = report["by_severity"]
    lines.append("## 嚴重度分布")
    lines.append("")
    for sev in (SEVERITY_ERROR, SEVERITY_WARN, SEVERITY_INFO):
        n = bs.get(sev, 0)
        if n:
            lines.append(f"- {SEVERITY_EMOJI[sev]} **{sev}**：{n}")
    lines.append("")

    # 依 slug 分組
    by_slug = {}
    for i in report["issues"]:
        key = i["slug"] or "(全站)"
        by_slug.setdefault(key, []).append(i)

    lines.append("## 問題清單")
    lines.append("")
    for slug in sorted(by_slug.keys()):
        lines.append(f"### `{slug}`")
        lines.append("")
        for i in by_slug[slug]:
            emoji = SEVERITY_EMOJI.get(i["severity"], "•")
            lines.append(f"- {emoji} **[{i['category']}]** {i['message']}")
            if i.get("detail"):
                lines.append(f"  <details><summary>詳細</summary>\n\n  ```\n  {i['detail']}\n  ```\n\n  </details>")
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("此 issue 由 `.github/workflows/health-check.yml` 自動產生。修完後請手動關閉此 issue。")
    return "\n".join(lines) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json-out", help="輸出 JSON 報告到此路徑")
    ap.add_argument("--markdown-out", help="輸出 Markdown 報告到此路徑")
    ap.add_argument("--fail-on-error", action="store_true",
                    help="有 error 時 exit 1（預設 0，不中斷 Action）")
    args = ap.parse_args()

    report = run_check()

    if args.json_out:
        Path(args.json_out).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    if args.markdown_out:
        Path(args.markdown_out).write_text(to_markdown(report), encoding="utf-8")

    if not args.json_out and not args.markdown_out:
        print(json.dumps(report, ensure_ascii=False, indent=2))

    # 人類易讀總結印到 stderr
    print(f"檢查完成：{report['total_articles']} 篇文章，{report['total_issues']} 個問題", file=sys.stderr)

    if args.fail_on_error and report["by_severity"].get(SEVERITY_ERROR, 0) > 0:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
