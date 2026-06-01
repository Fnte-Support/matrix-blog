/* ============================================================
   Daily Coffee 文章目錄 TOC
   單一來源：發佈文章模板（api/publish.js）與後台預覽（admin buildPreviewDoc）
   都用 <script src="/article-toc.js" defer> 引入。
   從 .article-body 的 <h2> 自動產生目錄：桌機左側 fixed 卡片（捲進文章才淡入）、
   手機浮動按鈕 + 底部 overlay；支援平滑捲動與捲動高亮（scroll spy）。
   ============================================================ */
(function () {
  function init() {
    var body = document.querySelector(".article-body");
    if (!body) return;
    var heads = [].slice.call(body.querySelectorAll("h2"));
    if (heads.length < 2) return; // 少於 2 個小標就不顯示目錄

    var items = heads.map(function (h, i) {
      if (!h.id) h.id = "sec-" + (i + 1);
      return { id: h.id, text: (h.textContent || "").trim() };
    });
    function esc(s) {
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    function fill(ul) {
      if (!ul) return;
      ul.innerHTML = items
        .map(function (it) {
          return '<li><a href="#' + it.id + '" data-toc="' + it.id + '">' + esc(it.text) + "</a></li>";
        })
        .join("");
    }

    var side = document.getElementById("dc-toc-side");
    var sideList = document.getElementById("dc-toc-list");
    var sheetList = document.getElementById("dc-toc-sheet-list");
    var fab = document.getElementById("dc-toc-fab");
    var overlay = document.getElementById("dc-toc-overlay");

    fill(sideList);
    fill(sheetList);
    if (fab) fab.style.display = "";

    function closeSheet() { if (overlay) overlay.classList.remove("open"); }

    // 點目錄：平滑捲動到該段 + 關閉手機 overlay
    document.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest("a[data-toc]") : null;
      if (!a) return;
      e.preventDefault();
      var t = document.getElementById(a.getAttribute("data-toc"));
      if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
      closeSheet();
    });

    if (fab) fab.addEventListener("click", function () { if (overlay) overlay.classList.add("open"); });
    var cb = document.getElementById("dc-toc-close");
    if (cb) cb.addEventListener("click", closeSheet);
    if (overlay) overlay.addEventListener("click", function (e) { if (e.target === overlay) closeSheet(); });

    // 桌機：捲進文章才淡入側欄（避開頂部 hero 大圖）
    function onScroll() {
      if (!side) return;
      var hero = document.querySelector(".hero");
      var trigger = hero ? hero.offsetHeight - 130 : 180;
      if (window.scrollY > trigger) side.classList.add("show");
      else side.classList.remove("show");
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // 捲動高亮（scroll spy）
    var links = {};
    if (sideList) {
      [].slice.call(sideList.querySelectorAll("a[data-toc]")).forEach(function (a) {
        links[a.getAttribute("data-toc")] = a;
      });
    }
    if (window.IntersectionObserver) {
      var spy = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) {
              for (var k in links) links[k].classList.remove("active");
              if (links[en.target.id]) links[en.target.id].classList.add("active");
            }
          });
        },
        { rootMargin: "-12% 0px -78% 0px" }
      );
      heads.forEach(function (h) { spy.observe(h); });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
