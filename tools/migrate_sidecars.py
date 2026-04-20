#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
為沒有 article.json sidecar 的舊文章補產 sidecar。

舊文章（這次改版前發佈的）在 article/<slug>/ 資料夾裡只有 index.html，
沒有 article.json。後台編輯功能讀 sidecar 才能載回表單。

此腳本掃描所有 local 文章，補產 sidecar（從 index.html 和 article_list.json 反推）。

執行：
  cd /Users/fnte/Downloads/matrix-dailycoffee
  python3 tools/migrate_sidecars.py            # dry-run，只顯示會做什麼
  python3 tools/migrate_sidecars.py --apply    # 真的寫入

完成後：
  git add article/*/article.json
  git commit -m "chore: 為舊文章補 article.json sidecar"
  git push origin main
"""

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARTICLE_DIR = ROOT / "article"
ARTICLE_LIST = ROOT / "article_list.json"


def extract_body_html(html):
    """從文章 HTML 抽出 .article-body 或 .container 內的主體。"""
    # 先試新版模板：<div class="article-body">
    m = re.search(r'<div\s+class="article-body"[^>]*>([\s\S]*?)</div>\s*</div>\s*</body>', html)
    if m:
        return m.group(1).strip()

    # 舊版模板：整個 <div class="container"> 內容
    m = re.search(r'<div\s+class="container"[^>]*>([\s\S]*?)</div>\s*</body>', html, re.I)
    if m:
        body = m.group(1)
        # 剝掉開頭的 meta 行（日期、分類 tag 那區）
        body = re.sub(r'<div\s+class="meta"[^>]*>[\s\S]*?</div>', '', body, count=1)
        return body.strip()

    return html


def extract_meta(html, name_or_prop):
    """抽 <meta name/property="..."> content。"""
    for attr in ("name", "property"):
        m = re.search(
            rf'<meta\s+{attr}=["\']{re.escape(name_or_prop)}["\']\s+content=["\']([^"\']*)["\']',
            html,
        )
        if m:
            return m.group(1)
    return ""


def extract_title(html):
    m = re.search(r'<title>([^<]+)</title>', html)
    if m:
        title = m.group(1)
        # 常見後綴 "| Daily Coffee" 拿掉
        title = re.sub(r'\s*[|｜]\s*Daily Coffee.*$', '', title)
        return title.strip()
    return ""


def migrate_one(slug, list_entry, apply=False):
    folder = ARTICLE_DIR / slug
    idx = folder / "index.html"
    sidecar_path = folder / "article.json"

    if sidecar_path.exists():
        return ("skip", "已有 article.json")
    if not idx.exists():
        return ("error", "index.html 不存在")

    html = idx.read_text(encoding="utf-8", errors="replace")

    # 組 sidecar
    categories = list_entry.get("category")
    if isinstance(categories, str):
        categories = [categories]
    elif not isinstance(categories, list):
        categories = []

    title = list_entry.get("title") or extract_title(html)
    description = list_entry.get("description") or extract_meta(html, "description")
    tags = list_entry.get("tags") or []
    date = list_entry.get("date") or ""

    body_html = extract_body_html(html)

    sidecar = {
        "_schema_version": 1,
        "title": title,
        "slug": slug,
        "description": description,
        "categories": categories,
        "tags": tags,
        "date": date,
        "date_modified": None,
        "body_html": body_html,
        "body_mode": "html_source",  # 舊文保守起見用 html_source 比較不會被洗掉結構
        "products": [],  # 舊文沒有商品資料，空陣列
        "source": "local",
        "_migrated": True,
        "_migration_note": "由 tools/migrate_sidecars.py 從 index.html 反推，商品資料無法還原",
    }

    if apply:
        sidecar_path.write_text(
            json.dumps(sidecar, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        return ("done", f"已寫入（body 長度 {len(body_html)}）")
    else:
        return ("would_do", f"會寫入（body 長度 {len(body_html)}）")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="真的寫入；不加只顯示")
    args = ap.parse_args()

    data = json.loads(ARTICLE_LIST.read_text(encoding="utf-8"))
    local_entries = [e for e in data if e.get("source") == "local" and e.get("slug")]
    print(f"找到 {len(local_entries)} 篇 local 文章")
    print()

    done = skipped = errored = 0
    for e in local_entries:
        slug = e["slug"]
        status, msg = migrate_one(slug, e, apply=args.apply)
        tag = {"done": "✅", "would_do": "🔜", "skip": "⏭️ ", "error": "❌"}[status]
        print(f"  {tag} {slug:40s} → {msg}")
        if status == "done":
            done += 1
        elif status == "skip":
            skipped += 1
        elif status == "error":
            errored += 1

    print()
    if args.apply:
        print(f"完成：寫入 {done}、跳過 {skipped}、失敗 {errored}")
        print()
        print("下一步：")
        print("  git add article/*/article.json")
        print("  git commit -m 'chore: 為舊文章補 article.json sidecar'")
        print("  git push origin main")
    else:
        print(f"預演：會寫 {len([1 for e in local_entries if (ARTICLE_DIR / e['slug'] / 'article.json').exists() is False])} 個")
        print()
        print("真的要寫請加 --apply")


if __name__ == "__main__":
    main()
