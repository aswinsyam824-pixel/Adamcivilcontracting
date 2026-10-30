/* Adam Civil Contracting — shared site script (no dependencies) */

/* Set when the corrected profile PDF is approved (HOME-FR-04). Leave url empty to keep the download hidden. */
const PROFILE = { url: "", sizeLabel: "" };

/* Service groups: query value -> approved label (CONTACT-FR-02) */
const SERVICE_GROUPS = {
  "civil-construction-infrastructure": "Civil Construction and Infrastructure",
  "mechanical-electrical-cooling": "Mechanical, Electrical and Cooling Systems",
  "fire-safety-gas-piping": "Fire Safety, Gas and Specialized Piping",
  "equipment-structural-works": "Equipment and Structural Works",
  "landscaping-pools": "Landscaping and Pools",
  "cleaning-insulation": "Cleaning and Insulation"
};
const CONTACT_EMAIL = "info@adamcivilcontractingt.ae";

(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- Lenis smooth scroll ---------- */
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let lenis = null;
  if (window.Lenis && !reduceMotion) {
    lenis = new Lenis({
      autoRaf: true,          // Lenis runs its own requestAnimationFrame loop
      lerp: 0.1,              // smoothness (lower = smoother/slower)
      smoothWheel: true,
      anchors: { offset: -16 } // smooth-scroll in-page links like #about, #top, #enquiry
    });
    window.lenis = lenis;     // handy for debugging in the console
  }

  /* Opening files straight from disk (file://): make /clean/ links point at index.html files.
     On a real server nothing changes. */
  if (location.protocol === "file:") {
    $$("a[href]").forEach(a => {
      const h = a.getAttribute("href");
      if (/^([a-z]+:|#|\/\/)/i.test(h)) return;          // skip mailto:, tel:, http:, #anchors
      const m = h.match(/^([^?#]*)(.*)$/);
      let p = m[1];
      if (p === "" ) return;
      if (p.endsWith("/")) p += "index.html";
      else if (p === "." || p === "..") p += "/index.html";
      a.setAttribute("href", p + m[2]);
    });
  }

  /* ---------- Services dropdown (SH-FR-02) ---------- */
  const btn = $("#svcBtn"), menu = $("#svcMenu");
  const mm = $("#mmenu"), mb = $("#menuBtn");
  const setDrop = open => { btn.setAttribute("aria-expanded", open); menu.hidden = !open; };
  if (btn && menu) {
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") !== "true";
      setDrop(open);
      if (open) $("a", menu).focus();
    });
    menu.addEventListener("keydown", e => {
      const links = $$("a", menu), i = links.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); links[(i + 1) % links.length].focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); links[(i - 1 + links.length) % links.length].focus(); }
    });
    document.addEventListener("click", e => { if (!menu.hidden && !btn.parentElement.contains(e.target)) setDrop(false); });
    menu.addEventListener("focusout", e => { if (!e.relatedTarget || !btn.parentElement.contains(e.relatedTarget)) setDrop(false); });
  }

  /* ---------- Mobile menu ---------- */
  const closeMenu = (restore = true) => {
    mm.hidden = true; mb.setAttribute("aria-expanded", "false"); document.body.style.overflow = "";
    if (lenis) lenis.start();
    if (restore) mb.focus();
  };
  if (mm && mb) {
    mb.addEventListener("click", () => {
      mm.hidden = false; mb.setAttribute("aria-expanded", "true"); document.body.style.overflow = "hidden"; if (lenis) lenis.stop(); $("#menuClose").focus();
    });
    $("#menuClose").addEventListener("click", () => closeMenu());
    $$("a", mm).forEach(a => a.addEventListener("click", () => closeMenu(false)));
    mm.addEventListener("keydown", e => {             // keep focus inside the open menu
      if (e.key !== "Tab") return;
      const f = $$("a, button", mm), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (menu && !menu.hidden) { setDrop(false); btn.focus(); }
    if (mm && !mm.hidden) closeMenu();
  });

  /* ---------- Home: hero motion (clean video if supplied, otherwise animated illustration) ---------- */
  const vid = $("#heroVideo"), vt = $("#videoToggle"), vtl = $("#videoToggleLabel");
  if (vid && vt) {
    const hero = vid.closest("section");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = navigator.connection && navigator.connection.saveData;
    let paused = false;
    if (!reduce) vt.hidden = false;                       // pause control for the >5 s animation (WCAG 2.2.2)
    const startVideo = () => {
      const small = matchMedia("(max-width:767px)").matches;
      const srcs = small && vid.dataset.srcMobile
        ? [[vid.dataset.srcMobileWebm, "video/webm"], [vid.dataset.srcMobile, "video/mp4"]]
        : [[vid.dataset.srcWebm, "video/webm"], [vid.dataset.srcMp4, "video/mp4"]];
      let last;
      srcs.forEach(([src, type]) => { if (!src) return; last = document.createElement("source"); last.src = src; last.type = type; vid.appendChild(last); });
      vid.addEventListener("playing", () => { vid.classList.add("is-ready"); if (paused) vid.pause(); }, { once: true });
      if (last) last.addEventListener("error", () => vid.remove());   // no video file: the animated drawing stays
      vid.load(); vid.play().catch(() => {});
    };
    if (!reduce && !saveData) {
      if (document.readyState === "complete") startVideo(); else addEventListener("load", startVideo, { once: true });
    }
    vt.addEventListener("click", () => {
      paused = !paused;
      hero.classList.toggle("is-paused", paused);
      if (vid.isConnected) paused ? vid.pause() : vid.play().catch(() => {});
      vt.setAttribute("aria-pressed", paused);
      vtl.textContent = paused ? "Play background animation" : "Pause background animation";
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([e]) => {
        if (!vid.isConnected || paused) return;
        e.isIntersecting ? vid.play().catch(() => {}) : vid.pause();
      }).observe(hero);
    }
  }

  /* ---------- Home: approach tabs ---------- */
  const tabs = $$('[role="tab"]');
  if (tabs.length) {
    const selectTab = (i, focus) => {
      i = (i + tabs.length) % tabs.length;
      tabs.forEach((t, k) => {
        const on = k === i;
        t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
      if (focus) tabs[i].focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => selectTab(i));
      t.addEventListener("keydown", e => {
        if (["ArrowRight", "ArrowDown"].includes(e.key)) { e.preventDefault(); selectTab(i + 1, true); }
        if (["ArrowLeft", "ArrowUp"].includes(e.key)) { e.preventDefault(); selectTab(i - 1, true); }
      });
    });
    $$(".stepper button").forEach(b => b.addEventListener("click", () => {
      const cur = tabs.findIndex(t => t.getAttribute("aria-selected") === "true");
      selectTab(cur + Number(b.dataset.step));
    }));
  }

  /* ---------- Home: services accordion ---------- */
  const accs = $$(".acc");
  if (accs.length) {
    const openAcc = acc => accs.forEach(a => {
      const on = a === acc;
      a.classList.toggle("is-open", on);
      $(".acc__btn", a).setAttribute("aria-expanded", on);
    });
    accs.forEach(a => {
      $(".acc__btn", a).addEventListener("click", () => {
        if (matchMedia("(max-width:860px)").matches && a.classList.contains("is-open")) {
          a.classList.remove("is-open"); $(".acc__btn", a).setAttribute("aria-expanded", false);
        } else openAcc(a);
      });
      a.addEventListener("mouseenter", () => { if (matchMedia("(hover:hover) and (min-width:861px)").matches) openAcc(a); });
    });
  }

  /* ---------- Home: process stepper ---------- */
  const stepsData = $("#stepsData");
  if (stepsData) {
    const steps = JSON.parse(stepsData.textContent);
    let s = 0;
    const dots = $("#stepDots");
    dots.innerHTML = steps.map(() => "<i></i>").join("");
    const render = () => {
      $("#stepNum").textContent = String(s + 1).padStart(2, "0");
      $("#stepText").textContent = steps[s].text;
      $("#stepName").textContent = steps[s].name;
      $("#stepCount").textContent = `Stage ${s + 1} of ${steps.length}`;
      $$("i", dots).forEach((d, k) => d.classList.toggle("on", k <= s));
    };
    $("#stepPrev").addEventListener("click", () => { s = (s - 1 + steps.length) % steps.length; render(); });
    $("#stepNext").addEventListener("click", () => { s = (s + 1) % steps.length; render(); });
    render();
  }

  /* ---------- Home: profile download (only when the real PDF exists) ---------- */
  const pl = $("#profileLink");
  if (pl && PROFILE.url) {
    pl.href = PROFILE.url; pl.textContent = "Download our company profile"; pl.setAttribute("download", "");
    $("#profileMeta").textContent = `PDF${PROFILE.sizeLabel ? ", " + PROFILE.sizeLabel : ""}`;
  }

  /* ---------- Contact: selected service + email draft (CONTACT-FR-01/02) ---------- */
  const picker = $("#servicePicker");
  if (picker) {
    const label = $("#selectedService"), mail = $("#mailDraft");
    const chips = $$("button[data-service]", picker);
    const select = (slug, updateUrl) => {
      const name = SERVICE_GROUPS[slug];                  // unknown values are ignored
      chips.forEach(c => c.setAttribute("aria-pressed", c.dataset.service === slug && !!name));
      label.textContent = name || "Not selected yet";     // textContent: URL input is never rendered as HTML
      const subject = name ? `Quotation request: ${name}` : "Quotation request";
      const body = [
        `Service: ${name || ""}`, "Project location:", "Scope of work:", "Timeline:",
        "Preferred contact method:", "", "Name:", "Company:", "Phone:"
      ].join("\n");
      mail.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      if (updateUrl && name && history.replaceState) {
        const u = new URL(location.href); u.searchParams.set("service", slug); history.replaceState(null, "", u);
      }
    };
    chips.forEach(c => c.addEventListener("click", () => select(c.dataset.service, true)));
    select(new URLSearchParams(location.search).get("service"), false);
  }

  const yr = $("#yr");
  if (yr) yr.textContent = new Date().getFullYear();
})();
