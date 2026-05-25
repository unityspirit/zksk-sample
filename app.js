// ============================================================
//  ZKSK — app.js   (ScrollCanvas Engine — Frame-based)
//  792 frames, 7 pages, synced to native scroll
// ============================================================

const TOTAL_FRAMES = 792;
const PAGE_COUNT   = 7;
const LERP         = 0.02;
const CONCURRENCY  = 48;
const isMobile     = innerWidth < 768;
const FRAME_DIR    = isMobile ? 'frames-mobile' : 'frames-webp';

// ---- DOM refs ----
const canvas  = document.getElementById('scrollCanvas');
const ctx     = canvas.getContext('2d');
const pages   = Array.from(document.querySelectorAll('.page'));
const navLinks    = document.querySelectorAll('.desktop-nav .nav-link');
const mobileLinks = document.querySelectorAll('.mobile-nav .nav-link');

// ---- State ----
const frames = new Array(TOTAL_FRAMES);
let loadedCount  = 0;
let isReady      = false;
let currentFrame = 0;
let targetFrame  = 0;

// ---- Canvas resize ----
function resizeCanvas() {
  canvas.width  = innerWidth;
  canvas.height = innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ============================================================
//  LOADER (created by JS, removed after all frames load)
// ============================================================
const loaderEl = document.createElement('div');
loaderEl.id = 'loader';
loaderEl.innerHTML = `
  <div class="loader-inner">
    <img src="logo-full.png" alt="ВАША КОМПАНИЯ" style="width:clamp(260px,60vw,500px);height:auto;object-fit:contain;margin-bottom:16px">
    <div class="loader-bar-wrap"><div class="loader-bar" id="loader-bar"></div></div>
    <div class="loader-pct" id="loader-pct">0%</div>
  </div>`;
document.body.appendChild(loaderEl);

const loaderCSS = document.createElement('style');
loaderCSS.textContent = `
  #loader {
    position:fixed; inset:0; z-index:9999;
    background:rgba(10,12,16,0.96);
    display:flex; align-items:center; justify-content:center;
    transition:opacity 0.8s ease;
    backdrop-filter:blur(8px);
  }
  #loader.fade-out { opacity:0; pointer-events:none; }
  .loader-inner { text-align:center; display:flex; flex-direction:column; align-items:center; gap:16px; }
  .loader-logo {
    font-family:'Montserrat',sans-serif;
    font-size:2.8rem; font-weight:700; letter-spacing:0.3em;
    color:#c9a84c;
    animation:loaderPulse 2s ease-in-out infinite;
  }
  @keyframes loaderPulse { 0%,100%{opacity:.6} 50%{opacity:1} }
  .loader-bar-wrap {
    width:260px; height:2px; background:rgba(201,168,76,.2);
    border-radius:2px; overflow:hidden;
  }
  .loader-bar {
    height:100%; width:0%;
    background:linear-gradient(90deg,#c9a84c,#e8c97a);
    border-radius:2px; transition:width 0.1s;
  }
  .loader-pct { font-size:.75rem; color:rgba(201,168,76,.6); letter-spacing:.15em; }
`;
document.head.appendChild(loaderCSS);

// ============================================================
//  FRAME LOADING
// ============================================================
function frameName(i) {
  return `${FRAME_DIR}/frame_${String(i + 1).padStart(6, '0')}.webp`;
}

async function loadFrame(idx) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      frames[idx] = img;
      loadedCount++;
      if (loadedCount === 1) { isReady = true; drawFrame(0); }
      const pct = Math.round((loadedCount / TOTAL_FRAMES) * 100);
      const bar = document.getElementById('loader-bar');
      const pctEl = document.getElementById('loader-pct');
      if (bar) bar.style.width = pct + '%';
      if (pctEl) pctEl.textContent = pct + '%';
      resolve();
    };
    img.onerror = () => { frames[idx] = null; loadedCount++; resolve(); };
    img.src = frameName(idx);
  });
}

async function loadAllFrames() {
  const queue = Array.from({ length: TOTAL_FRAMES }, (_, i) => i);
  async function worker() {
    while (queue.length > 0) {
      const idx = queue.shift();
      await loadFrame(idx);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
}

loadAllFrames().then(() => {
  isReady = true;
  const loader = document.getElementById('loader');
  if (loader) {
    loader.classList.add('fade-out');
    setTimeout(() => loader.remove(), 900);
  }
  if (pages[0]) pages[0].classList.add('is-active');
});

// ============================================================
//  DRAW FRAME (cover-fit to canvas)
// ============================================================
function drawFrame(idx) {
  const img = frames[Math.max(0, Math.min(idx, TOTAL_FRAMES - 1))];
  if (!img) return;
  const W = canvas.width, H = canvas.height;
  const r = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const iw = img.naturalWidth * r, ih = img.naturalHeight * r;
  const x = (W - iw) / 2, y = (H - ih) / 2;
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, x, y, iw, ih);
  // Vignette
  const vig = ctx.createRadialGradient(W/2, H/2, H*0.18, W/2, H/2, H*0.85);
  vig.addColorStop(0, 'rgba(10,12,16,0)');
  vig.addColorStop(1, 'rgba(10,12,16,0.7)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  // Bottom darkening
  const bot = ctx.createLinearGradient(0, H*0.6, 0, H);
  bot.addColorStop(0, 'rgba(10,12,16,0)');
  bot.addColorStop(1, 'rgba(10,12,16,0.85)');
  ctx.fillStyle = bot;
  ctx.fillRect(0, H*0.6, W, H*0.4);
}

// ============================================================
//  SCROLL → FRAME MAPPING
// ============================================================
window.addEventListener('scroll', () => {
  if (!isReady) return;
  const maxScroll = document.documentElement.scrollHeight - innerHeight;
  const progress = maxScroll > 0 ? scrollY / maxScroll : 0;
  targetFrame = progress * (TOTAL_FRAMES - 1);
}, { passive: true });

// ============================================================
//  RAF LOOP
// ============================================================
function animate() {
  requestAnimationFrame(animate);
  currentFrame += (targetFrame - currentFrame) * LERP;
  if (isReady) drawFrame(Math.round(currentFrame));
}
animate();

// ============================================================
//  INTERSECTION OBSERVER — section activation
// ============================================================
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const idx = pages.indexOf(entry.target);
      pages.forEach((p, i) => p.classList.toggle('is-active', i === idx));
      navLinks.forEach((l, i) => l.classList.toggle('active', i === idx));
      mobileLinks.forEach((l, i) => l.classList.toggle('active', i === idx));
      // Scroll indicator
      const ind = document.getElementById('scroll-indicator');
      if (ind) ind.classList.toggle('hide', idx > 0);
    }
  });
}, { root: null, rootMargin: '-40% 0px -40% 0px' });

pages.forEach(p => observer.observe(p));

// ============================================================
//  SCROLL-TO-SECTION (nav clicks)
// ============================================================
document.querySelectorAll('[data-page]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    const idx = parseInt(el.dataset.page);
    if (pages[idx]) pages[idx].scrollIntoView({ behavior: 'smooth' });
    // Close mobile nav
    const mobileNav = document.getElementById('mobile-nav');
    const burger = document.getElementById('burger');
    if (mobileNav) mobileNav.classList.remove('open');
    if (burger) burger.classList.remove('open');
  });
});

document.querySelectorAll('a[href="#contacts"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    if (pages[6]) pages[6].scrollIntoView({ behavior: 'smooth' });
  });
});

// ============================================================
//  BURGER
// ============================================================
document.getElementById('burger').addEventListener('click', () => {
  document.getElementById('burger').classList.toggle('open');
  document.getElementById('mobile-nav').classList.toggle('open');
});

// NAVBAR SCROLL EFFECT removed — header stays translucent

// ============================================================
//  COUNTER ANIMATION
// ============================================================
const counters = document.querySelectorAll('.stat-num, .geo-stat-num');
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting && !entry.target.dataset.animated) {
      entry.target.dataset.animated = 'true';
      const text = entry.target.textContent;
      const match = text.match(/(\d+)/);
      if (match) {
        const target = parseInt(match[1]);
        const suffix = text.replace(match[1], '');
        let current = 0;
        const step = Math.ceil(target / 40);
        const interval = setInterval(() => {
          current = Math.min(current + step, target);
          entry.target.textContent = current + suffix;
          if (current >= target) clearInterval(interval);
        }, 30);
      }
    }
  });
}, { threshold: 0.5 });
counters.forEach(c => counterObserver.observe(c));

// ============================================================
//  CONTACT FORM
// ============================================================
const form = document.getElementById('contact-form');
if (form) {
  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn = form.querySelector('.btn-primary');
    if (btn) {
      btn.textContent = '✓ Заявка отправлена!';
      btn.style.background = 'linear-gradient(135deg,#2dd4a8,#1fa882)';
      setTimeout(() => {
        btn.textContent = 'Отправить заявку';
        btn.style.background = '';
        form.reset();
      }, 3500);
    }
  });
}

// ============================================================
//  3D CAROUSEL (CodePen-style with lightbox)
// ============================================================
(function() {
  const cards = document.querySelectorAll('.carousel-card');
  const prevBtn = document.getElementById('carousel-prev');
  const nextBtn = document.getElementById('carousel-next');
  const dotsWrap = document.getElementById('carousel-dots');
  if (!cards.length) return;

  const total = cards.length;
  let currentIndex = 0;
  let isAnimating = false;
  const MAX_DOTS = 5;

  // Create dots
  const allDots = [];
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('button');
    dot.className = 'c-dot' + (i === 0 ? ' active' : '') + (i >= MAX_DOTS ? ' c-hidden' : '');
    dot.addEventListener('click', () => updateCarousel(i));
    dotsWrap.appendChild(dot);
    allDots.push(dot);
  }

  function updateVisibleDots(idx) {
    let start = Math.max(0, idx - Math.floor(MAX_DOTS / 2));
    if (start + MAX_DOTS > total) start = Math.max(0, total - MAX_DOTS);
    allDots.forEach((d, i) => {
      d.classList.toggle('c-hidden', i < start || i >= start + MAX_DOTS);
      d.classList.toggle('active', i === idx);
    });
  }

  function updateCarousel(newIndex) {
    if (isAnimating) return;
    isAnimating = true;
    currentIndex = ((newIndex % total) + total) % total;

    cards.forEach((card, i) => {
      const offset = ((i - currentIndex) % total + total) % total;
      card.classList.remove('center', 'left-1', 'left-2', 'right-1', 'right-2', 'c-hidden');

      if (offset === 0) card.classList.add('center');
      else if (offset === 1) card.classList.add('right-1');
      else if (offset === 2) card.classList.add('right-2');
      else if (offset === total - 1) card.classList.add('left-1');
      else if (offset === total - 2) card.classList.add('left-2');
      else card.classList.add('c-hidden');
    });

    updateVisibleDots(currentIndex);
    setTimeout(() => { isAnimating = false; }, 800);
  }

  prevBtn.addEventListener('click', () => updateCarousel(currentIndex - 1));
  nextBtn.addEventListener('click', () => updateCarousel(currentIndex + 1));

  // Click card to focus or open lightbox
  cards.forEach((card, i) => {
    card.addEventListener('click', () => {
      if (i === currentIndex) {
        openLightbox(i);
      } else {
        updateCarousel(i);
      }
    });
  });

  // Touch swipe on carousel
  let cTouchStartX = 0;
  const container = document.getElementById('carousel-container');
  container.addEventListener('touchstart', e => {
    cTouchStartX = e.changedTouches[0].screenX;
  }, { passive: true });
  container.addEventListener('touchend', e => {
    const diff = cTouchStartX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) updateCarousel(currentIndex + 1);
      else updateCarousel(currentIndex - 1);
    }
  }, { passive: true });

  // Init
  updateCarousel(0);

  // ---- LIGHTBOX ----
  const srcs = Array.from(cards).map(c => c.querySelector('img').src);
  let lightboxIdx = 0;
  let zoomLevel = 1, panX = 0, panY = 0;

  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `
    <button class="lightbox-close">✕</button>
    <button class="lightbox-nav lightbox-prev">←</button>
    <button class="lightbox-nav lightbox-next">→</button>
    <img class="lightbox-img" src="" alt="Gallery">
  `;
  document.body.appendChild(lb);
  const lbImg = lb.querySelector('.lightbox-img');

  function openLightbox(idx) {
    lightboxIdx = idx;
    lbImg.src = srcs[idx];
    resetZoom();
    lb.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    lb.classList.remove('active');
    document.body.style.overflow = '';
    resetZoom();
  }
  function showPhoto(idx) {
    lightboxIdx = Math.max(0, Math.min(idx, srcs.length - 1));
    lbImg.src = srcs[lightboxIdx];
    resetZoom();
  }
  function resetZoom() {
    zoomLevel = 1; panX = 0; panY = 0;
    lbImg.style.transform = 'scale(1) translate(0,0)';
    lbImg.classList.remove('zoomed');
  }
  function applyTransform() {
    lbImg.style.transform = `scale(${zoomLevel}) translate(${panX}px,${panY}px)`;
    lbImg.classList.toggle('zoomed', zoomLevel > 1);
  }

  lb.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
  lb.querySelector('.lightbox-prev').addEventListener('click', () => showPhoto(lightboxIdx - 1));
  lb.querySelector('.lightbox-next').addEventListener('click', () => showPhoto(lightboxIdx + 1));
  lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });

  lbImg.addEventListener('click', e => {
    e.stopPropagation();
    if (zoomLevel > 1) resetZoom();
    else { zoomLevel = 2.5; applyTransform(); }
  });

  lb.addEventListener('wheel', e => {
    e.preventDefault();
    zoomLevel = Math.max(1, Math.min(5, zoomLevel + (e.deltaY > 0 ? -0.3 : 0.3)));
    if (zoomLevel <= 1) { resetZoom(); return; }
    applyTransform();
  }, { passive: false });

  // Pan
  let isPanning = false, psx, psy, pox, poy;
  lbImg.addEventListener('mousedown', e => {
    if (zoomLevel <= 1) return;
    e.preventDefault(); isPanning = true;
    psx = e.clientX; psy = e.clientY; pox = panX; poy = panY;
  });
  window.addEventListener('mousemove', e => {
    if (!isPanning) return;
    panX = pox + (e.clientX - psx) / zoomLevel;
    panY = poy + (e.clientY - psy) / zoomLevel;
    applyTransform();
  });
  window.addEventListener('mouseup', () => { isPanning = false; });

  // Touch swipe in lightbox + pinch
  let lbTouchX = 0, lbTouchY = 0, lbTouchT = 0, lbSwiping = false, lastDist = 0;
  lb.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      lbSwiping = false;
    } else if (e.touches.length === 1 && zoomLevel <= 1) {
      lbTouchX = e.touches[0].clientX;
      lbTouchY = e.touches[0].clientY;
      lbTouchT = Date.now();
      lbSwiping = true;
    }
  }, { passive: true });
  lb.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      zoomLevel = Math.max(1, Math.min(5, zoomLevel + (dist - lastDist) * 0.01));
      lastDist = dist;
      if (zoomLevel <= 1) { resetZoom(); return; }
      applyTransform(); lbSwiping = false;
    }
  }, { passive: false });
  lb.addEventListener('touchend', e => {
    if (!lbSwiping || zoomLevel > 1) return;
    const dx = e.changedTouches[0].clientX - lbTouchX;
    const dy = e.changedTouches[0].clientY - lbTouchY;
    if (Math.abs(dx) > 50 && (Date.now() - lbTouchT) < 400 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) showPhoto(lightboxIdx + 1);
      else showPhoto(lightboxIdx - 1);
    }
    lbSwiping = false;
  }, { passive: true });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (lb.classList.contains('active')) {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') showPhoto(lightboxIdx - 1);
      if (e.key === 'ArrowRight') showPhoto(lightboxIdx + 1);
    } else if (document.getElementById('page-3')?.classList.contains('is-active')) {
      if (e.key === 'ArrowLeft') updateCarousel(currentIndex - 1);
      if (e.key === 'ArrowRight') updateCarousel(currentIndex + 1);
    }
  });
})();

