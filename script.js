/* ============================================================
   動画編集チーム ムビト — LP Scripts
   ============================================================ */
(function () {
  "use strict";

  /* ---------- ヘッダー:スクロールで背景を強調 ---------- */
  const header = document.getElementById("header");
  const onScroll = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 10);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- モバイルナビ ---------- */
  const navToggle = document.getElementById("navToggle");
  const nav = document.getElementById("nav");
  if (navToggle && nav) {
    navToggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      navToggle.classList.toggle("is-open", open);
      navToggle.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
    });
    // リンククリックで閉じる
    nav.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        nav.classList.remove("is-open");
        navToggle.classList.remove("is-open");
      })
    );
  }

  /* ---------- スクロールリベール(セクション別アニメーション) ---------- */
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!prefersReduced && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    const prep = (el, variant, delay) => {
      el.classList.add("reveal", "reveal--" + variant);
      if (delay) el.style.transitionDelay = delay + "ms";
      io.observe(el);
    };

    // セクション毎に異なる登場アニメーション
    const variantBySection = {
      pain: "right",      // お悩み: 右からスライド
      service: "zoom",    // サービス: ズームイン
      strength: "left",   // 強み: 左からスライド
      works: "blur",      // 制作事例: ブラー解除
      flow: "flip",       // 制作の流れ: フリップ
      price: "zoom",      // 料金: ズームイン
      contact: "up",      // お問い合わせ: 下から
    };
    const STAGGER = 100;  // 子要素の時間差(ms)

    document.querySelectorAll(".section").forEach((sec) => {
      const variant = variantBySection[sec.id] || "up";
      const container = sec.querySelector(":scope > .container");
      if (!container) return;
      [...container.children].forEach((el) => {
        if (el.matches(".section__label") || el.tagName === "SCRIPT") return;
        // グリッド・リスト類は子要素を時間差で登場させる
        if (el.matches(".grid, .pain-list, .flow-grid")) {
          [...el.children].forEach((child, i) => prep(child, variant, i * STAGGER));
        } else {
          prep(el, variant, 0);
        }
      });
    });

    // ヒーローは下からフェード
    document.querySelectorAll(".hero__inner > *").forEach((el, i) =>
      prep(el, "up", i * 120)
    );
  }

  /* ---------- ヒーロー: 3D宇宙ネットワーク ----------
     奥行きのある星々がゆっくり周回し、近い星同士が線でつながる。
     つながった線の上を光のパルスが走り「つながっていく」を表現 */
  const canvas = document.getElementById("heroCanvas");
  if (canvas && !prefersReduced) {
    const ctx = canvas.getContext("2d");
    const hero = canvas.closest(".hero");
    let W = 0, H = 0, dpr = 1, cx = 0, cy = 0;
    let stars = [], pulses = [], rot = 0;
    let rafId = null, running = false, lastT = 0, lastPulse = 0;
    const LINK_3D = 0.5;      // 3D空間での接続距離
    const CAM = 2.4;           // カメラ距離(遠近の強さ)

    // 星のグロースプライト(放射グラデーションを事前描画)
    const sprite = document.createElement("canvas");
    sprite.width = sprite.height = 64;
    const sctx = sprite.getContext("2d");
    const sg = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    sg.addColorStop(0, "rgba(255,255,255,1)");
    sg.addColorStop(0.25, "rgba(219,234,254,0.9)");
    sg.addColorStop(0.6, "rgba(147,197,253,0.35)");
    sg.addColorStop(1, "rgba(147,197,253,0)");
    sctx.fillStyle = sg;
    sctx.fillRect(0, 0, 64, 64);

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = hero.offsetWidth;
      H = hero.offsetHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W / 2; cy = H / 2;
      const count = Math.min(110, Math.max(55, Math.floor(W / 14)));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * 2 - 1,
        y: (Math.random() * 2 - 1) * 0.8,
        z: Math.random() * 2 - 1,
        vx: (Math.random() - 0.5) * 0.05,
        vy: (Math.random() - 0.5) * 0.05,
        vz: (Math.random() - 0.5) * 0.05,
        r: 2.0 + Math.random() * 3.0,
      }));
      pulses = [];
    };

    // Y軸回転 + 透視投影
    const project = (st) => {
      const cos = Math.cos(rot), sin = Math.sin(rot);
      const x = st.x * cos - st.z * sin;
      const z = st.x * sin + st.z * cos;
      const p = CAM / (CAM + z);
      return { sx: cx + x * p * (W * 0.46), sy: cy + st.y * p * (H * 0.62), p };
    };

    const step = (t) => {
      const dt = Math.min((t - lastT) / 1000, 0.05);
      lastT = t;
      rot += dt * 0.055;
      ctx.clearRect(0, 0, W, H);

      // 星の移動([-1,1]の宇宙をラップ)
      for (const st of stars) {
        st.x += st.vx * dt; st.y += st.vy * dt; st.z += st.vz * dt;
        if (st.x < -1) st.x = 1; else if (st.x > 1) st.x = -1;
        if (st.y < -0.85) st.y = 0.85; else if (st.y > 0.85) st.y = -0.85;
        if (st.z < -1) st.z = 1; else if (st.z > 1) st.z = -1;
      }
      const pts = stars.map(project);

      // つながり: 3D距離が近い星同士を線で結ぶ(奥は薄く、手前は太く)
      const frameLinks = [];
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const dx = stars[i].x - stars[j].x;
          const dy = stars[i].y - stars[j].y;
          const dz = stars[i].z - stars[j].z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < LINK_3D * LINK_3D) {
            const near = Math.min(pts[i].p, pts[j].p);
            const a = (1 - Math.sqrt(d2) / LINK_3D) * 0.62 * near;
            ctx.strokeStyle = `rgba(147, 197, 253, ${a.toFixed(3)})`;
            ctx.lineWidth = 1.6 * near;
            ctx.beginPath();
            ctx.moveTo(pts[i].sx, pts[i].sy);
            ctx.lineTo(pts[j].sx, pts[j].sy);
            ctx.stroke();
            frameLinks.push([i, j]);
          }
        }
      }

      // パルス: つながった線の上を光が走る(=想いが届く)
      if (t - lastPulse > 650 && frameLinks.length && pulses.length < 6) {
        const [i, j] = frameLinks[(Math.random() * frameLinks.length) | 0];
        pulses.push({ i, j, t: 0, dur: 0.9 + Math.random() * 0.7 });
        lastPulse = t;
      }
      ctx.globalCompositeOperation = "lighter";
      pulses = pulses.filter((pu) => {
        pu.t += dt / pu.dur;
        if (pu.t >= 1) return false;
        const e = pu.t < 0.5 ? 2 * pu.t * pu.t : 1 - Math.pow(-2 * pu.t + 2, 2) / 2;
        const a = pts[pu.i], b = pts[pu.j];
        const x = a.sx + (b.sx - a.sx) * e;
        const y = a.sy + (b.sy - a.sy) * e;
        const size = 16 * Math.min(a.p, b.p);
        ctx.globalAlpha = Math.sin(pu.t * Math.PI);
        ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
        return true;
      });

      // 星(手前ほど大きく明るく)
      for (let i = 0; i < stars.length; i++) {
        const { sx, sy, p } = pts[i];
        const size = stars[i].r * 5.0 * p;
        ctx.globalAlpha = 0.35 + 0.65 * Math.max(0, (p - 0.6) / 0.9);
        ctx.drawImage(sprite, sx - size / 2, sy - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      rafId = requestAnimationFrame(step);
    };

    const start = () => {
      if (!running) {
        running = true;
        lastT = performance.now();
        rafId = requestAnimationFrame(step);
      }
    };
    const stop = () => { running = false; if (rafId) cancelAnimationFrame(rafId); rafId = null; };

    resize();
    start();
    window.addEventListener("resize", resize, { passive: true });
    new IntersectionObserver((entries) => {
      entries[0].isIntersecting && !document.hidden ? start() : stop();
    }).observe(hero);
    document.addEventListener("visibilitychange", () => {
      document.hidden ? stop() : start();
    });
  }

  /* ---------- 制作事例: サムネイルクリックでモーダル再生 ---------- */
  const videoBoxes = document.querySelectorAll(".work-card__video[data-video-id]");
  if (videoBoxes.length) {
    const modal = document.createElement("div");
    modal.className = "video-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML =
      '<div class="video-modal__backdrop"></div>' +
      '<div class="video-modal__body" role="dialog" aria-modal="true" aria-label="動画再生">' +
      '<button type="button" class="video-modal__close" aria-label="閉じる">&#10005;</button>' +
      '<div class="video-modal__frame"></div>' +
      "</div>";
    document.body.appendChild(modal);
    const frame = modal.querySelector(".video-modal__frame");

    const closeModal = () => {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      frame.replaceChildren(); // iframeを破棄して再生を停止
      document.body.style.overflow = "";
    };
    const openModal = (id, title) => {
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
      iframe.title = title || "制作事例動画";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.referrerPolicy = "strict-origin-when-cross-origin"; // YouTubeはリファラー必須(エラー153対策)
      iframe.allowFullscreen = true;
      frame.replaceChildren(iframe);
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    };

    modal.querySelector(".video-modal__backdrop").addEventListener("click", closeModal);
    modal.querySelector(".video-modal__close").addEventListener("click", closeModal);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
    });

    videoBoxes.forEach((box) => {
      const btn = box.querySelector(".work-card__thumb");
      if (!btn) return;
      btn.addEventListener("click", () => openModal(box.dataset.videoId, box.dataset.videoTitle));
    });
  }

  /* ---------- お問い合わせフォーム(mailto) ---------- */
  const form = document.getElementById("contactForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const company = form.company.value.trim();
      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const message = form.message.value.trim();

      const to = "muvito0623@gmail.com";
      const subject = encodeURIComponent(`【お問い合わせ】${company} ${name}様`);
      const body = encodeURIComponent(
        `会社名: ${company}\nご担当者名: ${name}\nメールアドレス: ${email}\n\nご相談内容:\n${message}`
      );
      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    });
  }
})();
