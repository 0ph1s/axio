/* =========================================================================
   AXIO // main.js
   Vanilla ES6+ · GSAP + ScrollTrigger · WebGL (GLSL) ASCII/CRT
   -------------------------------------------------------------------------
   1. Utilidades e estado
   2. Boot, cursor, HUD e navegação
   3. Renderer WebGL: shader ASCII + CRT (fundo e logo do hero)
   4. Animações de scroll (ScrollTrigger)
   5. Monitor de telemetria dos projetos (Canvas 2D)
   6. Contato (copiar e-mail, formulário)
   7. Init
   ========================================================================= */

'use strict';

/* -------------------------------------------------------------------------
   1. Utilidades e estado
   ------------------------------------------------------------------------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const root = document.documentElement;

const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const mqFine = window.matchMedia('(hover: hover) and (pointer: fine)');
const reduced = () => mqReduced.matches;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const pad = (n, len = 2) => String(Math.max(0, Math.floor(n))).padStart(len, '0');

const COLORS = {
  glass: '#120D08',
  amber: '#FFB547',
  hot: '#FFE6B3',
  text: '#EBCB98',
  dim: '#A97B4B',
  wire: '#5A3B1F',
  wire2: '#35230F',
  hazard: '#FF5A36',
};

const state = {
  // ponteiro em px CSS (viewport)
  mouse: { x: window.innerWidth * 0.5, y: window.innerHeight * 0.4, moved: false, last: 0 },
  speed: 0,
  fps: 60,
  bootedAt: performance.now(),
};

/** Loop único: usa o ticker do GSAP quando disponível (um só rAF para tudo). */
const loop = {
  fns: new Set(),
  add(fn) { this.fns.add(fn); },
  start() {
    let prev = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      this.fns.forEach((fn) => fn(now / 1000, dt));
    };
    if (hasGSAP) {
      gsap.ticker.add(tick);
    } else {
      const raf = () => { tick(); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  },
};

/** Decodifica um texto: caracteres ainda não revelados viram glifos aleatórios. */
const SCRAMBLE_GLYPHS = '01<>/\\[]{}=+*#%_-:;!?ABCDEFXZ';
function scramble(el, finalText, { duration = 0.7, keepWhitespace = true } = {}) {
  return new Promise((resolve) => {
    if (reduced() || !el) {
      if (el) el.textContent = finalText;
      resolve();
      return;
    }
    cancelAnimationFrame(el._scrambleRaf);
    const len = finalText.length;
    const t0 = performance.now();
    const step = (now) => {
      const p = clamp((now - t0) / (duration * 1000), 0, 1);
      const revealed = Math.floor(p * len);
      let out = finalText.slice(0, revealed);
      for (let i = revealed; i < len; i++) {
        const ch = finalText[i];
        out += keepWhitespace && /\s/.test(ch)
          ? ch
          : SCRAMBLE_GLYPHS[(Math.random() * SCRAMBLE_GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (p < 1) el._scrambleRaf = requestAnimationFrame(step);
      else { el.textContent = finalText; resolve(); }
    };
    el._scrambleRaf = requestAnimationFrame(step);
  });
}

/** Decodificação "em diagonal" para arte ASCII multilinha. */
function decodeArt(el, duration = 0.9) {
  if (!el || reduced()) return;
  const original = el._art || (el._art = el.textContent);
  const lines = original.split('\n');
  const maxKey = lines.reduce((m, l, r) => Math.max(m, l.length + r * 3), 1);
  cancelAnimationFrame(el._artRaf);
  const t0 = performance.now();
  const step = (now) => {
    const p = clamp((now - t0) / (duration * 1000), 0, 1);
    el.textContent = lines.map((line, r) => Array.from(line, (ch, c) => {
      if (ch === ' ') return ch;
      const k = (c + r * 3) / maxKey;
      if (k < p - 0.12) return ch;
      if (k < p + 0.05) return SCRAMBLE_GLYPHS[(Math.random() * SCRAMBLE_GLYPHS.length) | 0];
      return ' ';
    }).join('')).join('\n');
    if (p < 1) el._artRaf = requestAnimationFrame(step);
    else el.textContent = original;
  };
  el._artRaf = requestAnimationFrame(step);
}

/** Digita um texto caractere a caractere (tween do GSAP para ficar no mesmo relógio). */
function typeInto(el, text, cps = 42) {
  return new Promise((resolve) => {
    if (!hasGSAP || reduced()) { el.textContent = text; resolve(); return; }
    const o = { n: 0 };
    gsap.to(o, {
      n: text.length,
      duration: Math.max(0.15, text.length / cps),
      ease: 'none',
      onUpdate: () => { el.textContent = text.slice(0, Math.round(o.n)); },
      onComplete: resolve,
    });
  });
}

/* -------------------------------------------------------------------------
   2. Boot, cursor, HUD e navegação
   ------------------------------------------------------------------------- */

function runBoot(onDone) {
  const boot = $('.boot');
  const log = $('.boot__log');

  if (!hasGSAP || reduced() || !boot) {
    root.classList.add('is-booted');
    onDone();
    return;
  }

  const threads = navigator.hardwareConcurrency || '?';
  const lines = [
    ['AXIO core v2.6  (c) ' + new Date().getFullYear() + ' Axio', ''],
    ['cpu threads ................ ' + threads, ''],
    ['memory check ............... ', 'OK'],
    ['mount /core/data-science ... ', 'OK'],
    ['mount /core/web ............ ', 'OK'],
    ['mount /core/apps ........... ', 'OK'],
    ['compile ascii.frag crt.frag  ', 'OK'],
    ['link telemetry ............. ', 'OK'],
    ['', ''],
    ['boot complete.', ''],
  ];

  const tl = gsap.timeline({
    onComplete: () => {
      root.classList.add('is-booted');
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
      onDone();
    },
  });

  lines.forEach(([text, ok]) => {
    tl.call(() => {
      const row = document.createElement('div');
      row.textContent = text;
      if (ok) {
        const s = document.createElement('span');
        s.className = 'ok';
        s.textContent = ok;
        row.appendChild(s);
      }
      log.appendChild(row);
    }, null, '+=0.085');
  });

  // desligamento CRT da tela de boot: colapsa numa linha e some
  tl.to(boot, { scaleY: 0.004, duration: 0.22, ease: 'power3.in' }, '+=0.25')
    .to(boot, { scaleX: 0, backgroundColor: COLORS.hot, duration: 0.18, ease: 'power2.in' })
    .set(boot, { autoAlpha: 0 });

  function skip() { tl.progress(1); }
  window.addEventListener('pointerdown', skip, { once: true });
  window.addEventListener('keydown', skip, { once: true });
}

function initCursor() {
  if (!hasGSAP || !mqFine.matches) return;
  root.classList.add('has-cursor');

  const el = $('.cursor');
  const label = $('.cursor__label');
  const xTo = gsap.quickTo(el, 'x', { duration: 0.16, ease: 'power3.out' });
  const yTo = gsap.quickTo(el, 'y', { duration: 0.16, ease: 'power3.out' });
  gsap.set(el, { x: state.mouse.x, y: state.mouse.y });

  window.addEventListener('pointermove', (e) => {
    xTo(e.clientX);
    yTo(e.clientY);
    el.classList.remove('is-hidden');
  }, { passive: true });

  const INTERACTIVE = 'a, button, [role="tab"], .pane, input, textarea';
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest(INTERACTIVE);
    const isText = !!t && (t.matches('input, textarea'));
    el.classList.toggle('is-text', isText);
    el.classList.toggle('is-hover', !!t && !isText && !t.matches('.pane'));
    label.textContent = t && t.dataset.cursor ? t.dataset.cursor.toUpperCase() : '';
    label.style.display = label.textContent ? '' : 'none';
  });
  document.addEventListener('pointerdown', () => el.classList.add('is-down'));
  document.addEventListener('pointerup', () => el.classList.remove('is-down'));
  document.documentElement.addEventListener('pointerleave', () => el.classList.add('is-hidden'));
}

function trackPointer() {
  let lx = state.mouse.x;
  let ly = state.mouse.y;
  window.addEventListener('pointermove', (e) => {
    state.mouse.x = e.clientX;
    state.mouse.y = e.clientY;
    state.mouse.moved = true;
    state.mouse.last = performance.now();
    state.speed += Math.hypot(e.clientX - lx, e.clientY - ly);
    lx = e.clientX;
    ly = e.clientY;
  }, { passive: true });
}

function initHUD() {
  const clocks = $$('[data-clock]');
  const shortClocks = $$('[data-clock-short]');
  const uptime = $('[data-diag-uptime]');
  const mx = $('[data-mx]');
  const my = $('[data-my]');
  const fpsEls = $$('[data-fps]');
  const progress = $('[data-progress]');

  const tickClock = () => {
    const d = new Date();
    const hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
    clocks.forEach((c) => { c.textContent = hm + ':' + pad(d.getSeconds()); });
    shortClocks.forEach((c) => { c.textContent = hm; });
    if (uptime) {
      const s = (performance.now() - state.bootedAt) / 1000;
      uptime.textContent = pad(s / 3600) + ':' + pad((s / 60) % 60) + ':' + pad(s % 60);
    }
  };
  tickClock();
  setInterval(tickClock, 1000);

  // diagnóstico real do navegador de quem visita
  const threads = $('[data-diag-threads]');
  const display = $('[data-diag-display]');
  if (threads) threads.textContent = navigator.hardwareConcurrency ? String(navigator.hardwareConcurrency) : 'n/d';
  if (display) display.textContent = `${screen.width}×${screen.height} @${(window.devicePixelRatio || 1).toFixed(1)}x`;
  const year = $('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());

  // telemetria do HUD inferior: atualiza só quando muda, FPS a ~4 Hz
  let lastX = -1;
  let lastY = -1;
  let acc = 0;
  let frames = 0;
  loop.add((t, dt) => {
    acc += dt;
    frames++;
    if (acc >= 0.25) {
      state.fps = frames / acc;
      const v = String(Math.round(state.fps));
      fpsEls.forEach((el) => { el.textContent = v; });
      acc = 0;
      frames = 0;
    }
    const x = Math.round(state.mouse.x);
    const y = Math.round(state.mouse.y);
    if (x !== lastX && mx) { mx.textContent = pad(x, 4); lastX = x; }
    if (y !== lastY && my) { my.textContent = pad(y, 4); lastY = y; }
  });

  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function initNav() {
  const header = $('.hud--top');
  const menuBtn = $('.menu-btn');

  const closeMenu = () => {
    header.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded', 'false');
  };
  menuBtn.addEventListener('click', () => {
    const open = !header.classList.contains('is-open');
    header.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  // rolagem suave para âncoras internas
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const target = id === '#top' ? $('#top') : $(id);
      if (!target) return;
      e.preventDefault();
      closeMenu();
      const y = id === '#top' ? 0 : target.getBoundingClientRect().top + window.scrollY;
      if (hasGSAP && window.ScrollToPlugin) {
        gsap.to(window, { scrollTo: { y, autoKill: true }, duration: reduced() ? 0 : 1.1, ease: 'power3.inOut' });
      } else {
        window.scrollTo({ top: y, behavior: reduced() ? 'auto' : 'smooth' });
      }
      // foco acompanha a navegação (teclado e leitores de tela)
      if (id !== '#top') {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
      history.replaceState(null, '', id);
    });
  });

  // marca a seção atual na navegação
  const links = $$('[data-nav]');
  const setCurrent = (id) => links.forEach((l) => l.classList.toggle('is-current', l.getAttribute('href') === '#' + id));
  const sections = $$('main section[id]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) setCurrent(en.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => io.observe(s));
  }
}

/* -------------------------------------------------------------------------
   3. Renderer WebGL: shader ASCII + CRT
   Duas passadas:
     A) "scene": roda na resolução da grade (1 pixel = 1 célula de texto).
        Calcula campo topográfico, lente do mouse e logo → luminância,
        índice do glifo, acento e máscara do logo (RGBA8).
     B) "ascii": tela cheia. Busca o glifo no atlas (1:1, NEAREST) e aplica
        halo de fósforo, scanlines, banda de varredura, vinheta e grão.
   ------------------------------------------------------------------------- */

// glifos do atlas: 0-9 rampa de luminância, 10-12 bordas, 13-14 bits, 15 marcador
const ATLAS_GLYPHS = [' ', '.', ':', '-', '=', '+', '*', '#', '%', '@', '|', '/', '\\', '0', '1', 'x'];

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG_SCENE = `
precision highp float;

uniform vec2  uGrid;       // colunas, linhas
uniform vec2  uCell;       // tamanho da célula (px do dispositivo)
uniform vec2  uView;       // tamanho do canvas (px do dispositivo)
uniform float uTime;
uniform vec2  uMouse;      // px do dispositivo, origem no topo
uniform float uMouseAmt;
uniform vec4  uLogo;       // retângulo do logo: x, y, w, h
uniform float uLogoAlpha;
uniform float uReveal;
uniform float uGlitch;
uniform float uFade;
uniform float uScroll;
uniform sampler2D uLogoTex;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p, float t) {
  float v = 0.0;
  float a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p + t * vec2(0.11, -0.07) * float(i + 1));
    p = r * p * 2.03;
    a *= 0.5;
  }
  return v;
}

// campo com domain warping: relevo "fluido" para as curvas de nível
float field(vec2 q, float t) {
  vec2 w = vec2(fbm(q + vec2(0.0, t * 0.05), t), fbm(q + vec2(5.2, 1.3) - t * 0.04, t));
  return fbm(q + 1.5 * w, t);
}

// escolhe a barra, as diagonais ou o hífen pela direção da tangente
// (tangente já normalizada pelo tamanho da célula; eixo y para baixo)
float edgeGlyph(vec2 tangent) {
  float a = atan(tangent.y, tangent.x);
  if (a < 0.0) a += 3.14159265;
  if (a < 0.3927 || a > 2.7489) return 3.0;   // hífen
  if (a < 1.1781) return 12.0;                // barra invertida
  if (a < 1.9635) return 10.0;                // barra vertical
  return 11.0;                                // barra
}

void main() {
  vec2 cell = vec2(gl_FragCoord.x - 0.5, uGrid.y - gl_FragCoord.y - 0.5);
  vec2 p = (cell + 0.5) * uCell;
  float t = uTime;

  // ---- lente do mouse -------------------------------------------------
  vec2 dm = p - uMouse;
  float md = length(dm);
  float R = 0.14 * uView.y + 40.0 * uCell.y / 15.0;
  float lens = exp(-(md * md) / (R * R)) * uMouseAmt;

  // ---- fundo: curvas de nível de um relevo de dados ---------------------
  float s = 1.0 / (uView.y * 0.6);
  vec2 q = vec2(p.x, p.y + uScroll * 0.3) * s;
  q -= dm * s * lens * 0.4;                    // magnifica sob o cursor

  float e = uCell.y * s * 0.5;
  float n  = field(q, t);
  float nx = field(q + vec2(e, 0.0), t);
  float ny = field(q + vec2(0.0, e), t);
  vec2 g = vec2(nx - n, ny - n) * s / e;       // gradiente por px

  float K = 9.0;
  float v = n * K;
  float level = floor(v + 0.5);
  float dl = abs(fract(v + 0.5) - 0.5);
  float dpx = dl / (length(g) * K + 1e-6);     // distância em px até a isolinha
  float onLine = 1.0 - step(uCell.y * 0.55, dpx);
  float major = 1.0 - step(0.5, mod(level, 4.0));

  float pulse = 0.5 + 0.5 * sin(level * 1.7 + t * 0.9 - (p.x + p.y) * 0.003);
  float lum = onLine * mix(0.2, 0.42, major) * (0.55 + 0.45 * pulse);
  float idx = edgeGlyph(vec2(-g.y, g.x) / uCell);

  if (onLine < 0.5) {
    lum = smoothstep(0.58, 0.9, n) * 0.24;     // pontilhado nos picos
    idx = floor(clamp(lum, 0.0, 0.99) * 10.0);
  }

  // bits esparsos piscando
  float hb = hash(cell + floor(t * 1.3 + hash(cell * 0.37) * 9.0));
  if (hb > 0.9965) {
    idx = hb > 0.9982 ? 13.0 : 14.0;
    lum = 0.42;
  }

  // retícula tracejada girando em volta do cursor
  float ring = abs(md - R * 0.92);
  float dash = step(0.45, fract(atan(dm.y, dm.x) * 2.546 + t * 0.15));
  if (ring < uCell.y * 0.5 && uMouseAmt > 0.05 && dash > 0.5) {
    idx = edgeGlyph(vec2(-dm.y, dm.x) / uCell);
    lum = 0.55 * uMouseAmt;
  }

  lum = (lum + lens * 0.3 * step(0.5, idx)) * uFade;
  float acc = lens * 0.9;
  float logoFlag = 0.0;

  // ---- logo AXIO -------------------------------------------------------
  vec2 luv = (p - uLogo.xy) / uLogo.zw;
  if (uLogoAlpha > 0.01 && luv.x > -0.08 && luv.x < 1.08 && luv.y > -0.15 && luv.y < 1.15) {
    // glitch: desloca linhas inteiras
    float tg = floor(t * 14.0);
    float gk = step(1.0 - 0.3 * uGlitch, hash(vec2(cell.y, tg)));
    luv.x += gk * (hash(vec2(tg, cell.y)) - 0.5) * 0.14 * uGlitch;

    // lente: puxa a amostragem para o cursor (as letras incham)
    vec2 dl2 = p - uMouse;
    float rr = uLogo.w * 0.6;
    float push = exp(-dot(dl2, dl2) / (rr * rr)) * uMouseAmt;
    luv -= (dl2 / uLogo.zw) * push * 0.22;

    vec2 cu = uCell / uLogo.zw;
    float c = 0.25 * (
      texture2D(uLogoTex, luv + cu * vec2(-0.25, -0.25)).r +
      texture2D(uLogoTex, luv + cu * vec2( 0.25, -0.25)).r +
      texture2D(uLogoTex, luv + cu * vec2(-0.25,  0.25)).r +
      texture2D(uLogoTex, luv + cu * vec2( 0.25,  0.25)).r);
    float sh = texture2D(uLogoTex, luv).g;
    float gxl = texture2D(uLogoTex, luv + vec2(cu.x * 0.5, 0.0)).r - texture2D(uLogoTex, luv - vec2(cu.x * 0.5, 0.0)).r;
    float gyl = texture2D(uLogoTex, luv + vec2(0.0, cu.y * 0.5)).r - texture2D(uLogoTex, luv - vec2(0.0, cu.y * 0.5)).r;
    float edge = length(vec2(gxl, gyl));

    float lIdx = -1.0;
    float lLum = 0.0;
    if (edge > 0.32 && c > 0.12 && c < 0.88) {
      lIdx = edgeGlyph(vec2(-gyl, gxl));
      lLum = 1.0;
    } else if (c > 0.5) {
      float tex = vnoise(cell * 0.33 + vec2(t * 0.7, -t * 0.35));
      lIdx = floor(clamp(0.62 + 0.38 * tex, 0.0, 0.99) * 10.0);
      lLum = 0.78 + 0.22 * tex;
      float hf = hash(cell + floor(t * 7.0));
      if (hf > 0.982) lIdx = hf > 0.991 ? 13.0 : 14.0;
    } else if (sh > 0.5) {
      lIdx = 2.0;
      lLum = 0.32;
    } else if (c > 0.06) {
      lIdx = 1.0;
      lLum = 0.4;
    }

    // revelação: células "decodificam" em ordem aleatória
    float hv = hash(cell * 1.37 + 7.0);
    if (lIdx >= 0.0 && hv > uReveal) {
      if (uReveal > 0.0 && hv < uReveal + 0.22) {
        lIdx = hash(cell + floor(t * 24.0)) > 0.5 ? 13.0 : 14.0;
        lLum = 0.55;
      } else {
        lIdx = -1.0;
      }
    }
    // dissolve ao rolar a página
    if (lIdx >= 0.0 && hash(cell * 0.71 + 3.0) > uLogoAlpha) lIdx = -1.0;

    if (lIdx >= 0.0) {
      idx = lIdx;
      lum = lLum;
      acc = push;
      logoFlag = 1.0;
    }
  }

  gl_FragColor = vec4(clamp(lum, 0.0, 1.0), clamp(acc, 0.0, 1.0), idx / 255.0, logoFlag);
}
`;

const FRAG_ASCII = `
precision highp float;

uniform sampler2D uData;
uniform sampler2D uAtlas;
uniform vec2  uGrid;
uniform vec2  uCell;
uniform vec2  uView;
uniform vec2  uAtlasSize;
uniform float uTime;
uniform float uDpr;
uniform float uFlash;
uniform vec3  uBg;
uniform vec3  uDim;
uniform vec3  uAmber;
uniform vec3  uHot;

vec4 cellData(vec2 c) {
  return texture2D(uData, vec2((c.x + 0.5) / uGrid.x, 1.0 - (c.y + 0.5) / uGrid.y));
}

void main() {
  vec2 fc = vec2(gl_FragCoord.x, uView.y - gl_FragCoord.y);
  vec2 cell = floor(fc / uCell);
  vec2 inC = fc - cell * uCell;
  vec4 d = cellData(cell);

  float idx = floor(d.b * 255.0 + 0.5);
  float glyph = texture2D(uAtlas, vec2((idx * uCell.x + inC.x) / uAtlasSize.x, inC.y / uAtlasSize.y)).r;

  float lum = d.r;
  vec3 col = mix(uDim, uAmber, smoothstep(0.0, 0.55, lum));
  col = mix(col, uHot, d.a * smoothstep(0.55, 1.0, lum));
  col = mix(col, uHot, d.g * 0.75);
  vec3 c = col * glyph * (0.3 + lum * 1.05);

  // halo de fósforo: luminância bilinear das células vizinhas
  vec2 gp = fc / uCell - 0.5;
  vec2 i0 = floor(gp);
  vec2 f = fract(gp);
  float h = mix(
    mix(cellData(i0).r, cellData(i0 + vec2(1.0, 0.0)).r, f.x),
    mix(cellData(i0 + vec2(0.0, 1.0)).r, cellData(i0 + vec2(1.0, 1.0)).r, f.x), f.y);
  c += uAmber * h * h * 0.11;

  // scanlines (período de 2px CSS)
  c *= 0.9 + 0.1 * sin(fc.y * 3.14159265 / uDpr);

  // banda de varredura descendo a tela
  float y01 = fc.y / uView.y;
  float band = exp(-pow((y01 - fract(uTime * 0.06)) * 8.0, 2.0));
  c *= 1.0 + band * 0.4;
  c += uAmber * band * 0.012;

  // vinheta
  vec2 uv = fc / uView;
  c *= pow(16.0 * uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y), 0.2);

  // grão
  float gr = fract(sin(dot(fc + fract(uTime * 7.0) * 113.0, vec2(12.9898, 78.233))) * 43758.5453);
  c += (gr - 0.5) * 0.022;

  // flash (feedback de ações, ex.: e-mail copiado)
  c += uAmber * uFlash * 0.08;

  gl_FragColor = vec4(uBg + c, 1.0);
}
`;

const hexToVec3 = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

function createRenderer() {
  const canvas = $('#gl');
  const logoEl = $('[data-logo]');
  const gl = canvas && canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: 'high-performance',
  });
  if (!gl) return null;

  // parâmetros animados pelo GSAP
  const params = { reveal: 0, glitch: 0, flash: 0 };

  let maxDpr = 1.5;
  let dpr = 1;
  let W = 0;
  let H = 0;
  let cellW = 9;
  let cellH = 15;
  let cols = 1;
  let rows = 1;
  let atlasKey = '';
  let atlasSize = [1, 1];
  let logoDoc = { x: 0, y: 0, w: 1, h: 1 };
  let lost = false;
  let progScene;
  let progAscii;
  let dataTex;
  let atlasTex;
  let logoTex;
  let fbo;

  // ponteiro suavizado e "piloto automático" quando não há mouse
  const probe = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.35, amt: 0 };

  function compile(type, src) {
    const sh = gl.createShader(type);
    // GLSL ES 1.0 aceita só ASCII: remove acentos dos comentários
    gl.shaderSource(sh, src.replace(/[^\x00-\x7F]/g, ''));
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(sh));
    }
    return sh;
  }

  function program(fragSrc) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragSrc));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      u[info.name] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  }

  function texture(filter) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    return t;
  }

  function setup() {
    progScene = program(FRAG_SCENE);
    progAscii = program(FRAG_ASCII);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    dataTex = texture(gl.NEAREST);
    atlasTex = texture(gl.NEAREST);
    logoTex = texture(gl.LINEAR);
    fbo = gl.createFramebuffer();
    atlasKey = '';
  }

  function buildAtlas() {
    const key = cellW + 'x' + cellH;
    if (key === atlasKey) return;
    atlasKey = key;
    const c = document.createElement('canvas');
    c.width = cellW * ATLAS_GLYPHS.length;
    c.height = cellH;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const size = Math.min(cellH * 0.95, cellW / 0.6);
    ctx.font = `500 ${size}px "IBM Plex Mono", ui-monospace, monospace`;
    ATLAS_GLYPHS.forEach((g, i) => ctx.fillText(g, i * cellW + cellW / 2, cellH * 0.54));
    atlasSize = [c.width, c.height];
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  }

  /** Textura do logo: R = letras, G = sombra deslocada (estilo ANSI shadow). */
  function buildLogo() {
    if (!logoEl) return;
    const r = logoEl.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const tw = Math.min(2048, Math.round(r.width * Math.min(dpr, 1.25)));
    const th = Math.max(2, Math.round(tw * (r.height / r.width)));
    const c = document.createElement('canvas');
    c.width = tw;
    c.height = th;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, tw, th);

    const font = (px) => `700 ${px}px "IBM Plex Mono", ui-monospace, monospace`;
    ctx.font = font(100);
    const m = ctx.measureText('AXIO');
    const capH = (m.actualBoundingBoxAscent || 72) + (m.actualBoundingBoxDescent || 0);
    const size = Math.min((tw * 0.94) / m.width, (th * 0.8) / capH) * 100;
    ctx.font = font(size);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const mm = ctx.measureText('AXIO');
    const asc = mm.actualBoundingBoxAscent || size * 0.7;
    const desc = mm.actualBoundingBoxDescent || 0;
    const y = th / 2 + (asc - desc) / 2 - size * 0.03;

    ctx.fillStyle = '#00ff00';
    ctx.fillText('AXIO', tw / 2 + size * 0.07, y + size * 0.07);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#ff0000';
    ctx.fillText('AXIO', tw / 2, y);

    gl.bindTexture(gl.TEXTURE_2D, logoTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  }

  function measure() {
    if (!logoEl) return;
    const r = logoEl.getBoundingClientRect();
    logoDoc = { x: r.left, y: r.top + window.scrollY, w: r.width, h: r.height };
  }

  function resize() {
    if (lost) return;
    dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const cw = canvas.clientWidth || window.innerWidth;
    const ch = canvas.clientHeight || window.innerHeight;
    W = Math.max(1, Math.round(cw * dpr));
    H = Math.max(1, Math.round(ch * dpr));
    canvas.width = W;
    canvas.height = H;

    const cssH = cw < 640 ? 12 : cw < 1100 ? 14 : 15;
    cellH = Math.max(6, Math.round(cssH * dpr));
    cellW = Math.max(4, Math.round(cellH * 0.6));
    cols = Math.ceil(W / cellW);
    rows = Math.ceil(H / cellH);

    gl.bindTexture(gl.TEXTURE_2D, dataTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, dataTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    buildAtlas();
    measure();
    buildLogo();
  }

  const colors = {
    bg: hexToVec3(COLORS.glass),
    dim: hexToVec3('#6B4524'),
    amber: hexToVec3(COLORS.amber),
    hot: hexToVec3(COLORS.hot),
  };

  let time = 0;
  let nextGlitch = 3;
  let slowFor = 0;

  function frame(now, dt) {
    if (lost || !W) return;
    time += dt * (reduced() ? 0.12 : 1);

    // ponteiro: segue o mouse; sem mouse (toque) ou ocioso, orbita o logo
    const vh = window.innerHeight;
    const sy = window.scrollY;
    const idle = (performance.now() - state.mouse.last) / 1000;
    const auto = !state.mouse.moved || idle > 6;
    let tx = state.mouse.x;
    let ty = state.mouse.y;
    if (auto) {
      tx = logoDoc.x + logoDoc.w * (0.5 + 0.42 * Math.sin(time * 0.35));
      ty = logoDoc.y - sy + logoDoc.h * (0.5 + 0.35 * Math.sin(time * 0.53 + 1.3));
    }
    const k = 1 - Math.pow(auto ? 0.04 : 0.0005, dt);
    probe.x = lerp(probe.x, tx, k);
    probe.y = lerp(probe.y, ty, k);
    const targetAmt = auto ? 0.75 : clamp(1.15 - idle * 0.12, 0.45, 1);
    probe.amt = lerp(probe.amt, targetAmt, 1 - Math.pow(0.1, dt));

    // glitch: picos com a velocidade do mouse + rajadas ocasionais
    if (!reduced()) {
      params.glitch = Math.min(1, params.glitch * Math.pow(0.04, dt) + state.speed * 0.0006);
      nextGlitch -= dt;
      if (nextGlitch < 0) {
        params.glitch = Math.max(params.glitch, 0.7 + Math.random() * 0.3);
        nextGlitch = 4 + Math.random() * 5;
      }
    } else {
      params.glitch = 0;
    }
    state.speed = 0;
    params.flash *= Math.pow(0.02, dt);

    // qualidade adaptativa: abaixo de ~40 fps por 2s, reduz a resolução
    if (state.fps < 40 && maxDpr > 1) {
      slowFor += dt;
      if (slowFor > 2) { maxDpr = 1; slowFor = 0; resize(); }
    } else {
      slowFor = 0;
    }

    const fade = 1 - 0.55 * clamp(sy / vh, 0, 1);
    const logoAlpha = 1 - clamp((sy - vh * 0.1) / (vh * 0.55), 0, 1);

    // passada A → FBO na resolução da grade
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, cols, rows);
    gl.useProgram(progScene.p);
    const a = progScene.u;
    gl.uniform2f(a.uGrid, cols, rows);
    gl.uniform2f(a.uCell, cellW, cellH);
    gl.uniform2f(a.uView, W, H);
    gl.uniform1f(a.uTime, time);
    gl.uniform2f(a.uMouse, probe.x * dpr, probe.y * dpr);
    gl.uniform1f(a.uMouseAmt, probe.amt);
    gl.uniform4f(a.uLogo, logoDoc.x * dpr, (logoDoc.y - sy * 0.92) * dpr, logoDoc.w * dpr, logoDoc.h * dpr);
    gl.uniform1f(a.uLogoAlpha, logoAlpha);
    gl.uniform1f(a.uReveal, params.reveal);
    gl.uniform1f(a.uGlitch, params.glitch);
    gl.uniform1f(a.uFade, fade);
    gl.uniform1f(a.uScroll, sy * dpr);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, logoTex);
    gl.uniform1i(a.uLogoTex, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // passada B → tela
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(progAscii.p);
    const b = progAscii.u;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, dataTex);
    gl.uniform1i(b.uData, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.uniform1i(b.uAtlas, 1);
    gl.uniform2f(b.uGrid, cols, rows);
    gl.uniform2f(b.uCell, cellW, cellH);
    gl.uniform2f(b.uView, W, H);
    gl.uniform2f(b.uAtlasSize, atlasSize[0], atlasSize[1]);
    gl.uniform1f(b.uTime, time);
    gl.uniform1f(b.uDpr, dpr);
    gl.uniform1f(b.uFlash, params.flash);
    gl.uniform3fv(b.uBg, colors.bg);
    gl.uniform3fv(b.uDim, colors.dim);
    gl.uniform3fv(b.uAmber, colors.amber);
    gl.uniform3fv(b.uHot, colors.hot);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    setup();
    resize();
  });

  try {
    setup();
  } catch (err) {
    console.warn('[AXIO] WebGL indisponível:', err);
    return null;
  }

  let resizeRaf = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(resize);
  });

  // refaz atlas e logo (ex.: quando as webfonts terminam de carregar)
  const rebuild = () => { atlasKey = ''; resize(); };

  return { params, resize, measure, rebuild, frame };
}

/* -------------------------------------------------------------------------
   4. Animações de scroll (ScrollTrigger)
   Uma metáfora só: cada seção é um comando. Ao entrar na tela, o prompt
   digita o comando e a saída "imprime" linha a linha, como num terminal.
   ------------------------------------------------------------------------- */

function initScroll(renderer) {
  if (!hasGSAP) return;
  const motion = !reduced();

  // seções: prompt digitado + saída em sequência
  $$('.section').forEach((section) => {
    const prompt = $('[data-prompt]', section);
    const cmd = prompt && $('.prompt__cmd', prompt);
    const outs = $$('[data-out]', section);
    const title = $('.section__title', section);
    const titleText = title ? title.textContent : '';

    if (!motion) {
      if (prompt) prompt.classList.add('is-done');
      return;
    }

    const cmdText = cmd ? cmd.textContent : '';
    if (cmd) cmd.textContent = '';
    gsap.set(outs, { autoAlpha: 0 });

    let done = false;
    const run = async () => {
      if (done) return;
      done = true;
      if (cmd) {
        prompt.classList.add('is-typing');
        await typeInto(cmd, cmdText);
        prompt.classList.remove('is-typing');
        prompt.classList.add('is-done');
      }
      if (title) scramble(title, titleText, { duration: 0.8 });
      gsap.to(outs, { autoAlpha: 1, duration: 0.01, stagger: 0.1 });
      if (section.id === 'servicos') {
        gsap.from('.pane, .tmux__status', { autoAlpha: 0, duration: 0.01, stagger: 0.12, delay: 0.15 });
        decodeArt($('.pane.is-active [data-art]'), 1);
      }
    };

    const st = ScrollTrigger.create({ trigger: section, start: 'top 78%', onEnter: run });
    if (st.scroll() > st.start) run(); // página recarregada no meio do scroll
  });

  // manifesto: palavras "carregam" o fósforo conforme a leitura avança
  const man = $('[data-manifesto]');
  if (man && motion) {
    const words = man.textContent.trim().split(/\s+/);
    man.textContent = '';
    words.forEach((w, i) => {
      const s = document.createElement('span');
      s.className = 'w';
      s.textContent = w;
      man.appendChild(s);
      if (i < words.length - 1) man.appendChild(document.createTextNode(' '));
    });
    gsap.fromTo($$('.w', man), { opacity: 0.14 }, {
      opacity: 1,
      ease: 'none',
      stagger: 0.08,
      scrollTrigger: { trigger: man, start: 'top 82%', end: 'bottom 52%', scrub: 0.6 },
    });
  }

  // rodapé: o logo ANSI decodifica uma vez
  ScrollTrigger.create({
    trigger: '.footer',
    start: 'top 85%',
    once: true,
    onEnter: () => decodeArt($('.ansi--footer'), 1.2),
  });

  if (renderer) ScrollTrigger.addEventListener('refresh', renderer.measure);
}

/** Painéis estilo tmux: hover/foco ativa o painel e a barra de status. */
function initPanes() {
  const panes = $$('[data-pane]');
  const tabs = $$('[data-goto]');
  let current = 0;

  const activate = (i) => {
    if (i === current) return;
    current = i;
    panes.forEach((p, k) => p.classList.toggle('is-active', k === i));
    tabs.forEach((b, k) => b.classList.toggle('is-active', k === i));
    decodeArt($('[data-art]', panes[i]), 0.8);
  };

  panes.forEach((p, i) => {
    p.addEventListener('pointerenter', () => activate(i));
    p.addEventListener('focusin', () => activate(i));
  });
  tabs.forEach((b, i) => b.addEventListener('click', () => {
    activate(i);
    panes[i].focus();
  }));
}

/** Entrada do hero, depois do boot: o logo decodifica e o texto é "rasterizado". */
function heroIntro(renderer) {
  const lines = $$('[data-hero-line]');
  const cmd = $('[data-hero-cmd]');

  if (!hasGSAP || reduced()) {
    if (renderer) renderer.params.reveal = 1;
    return;
  }

  const cmdText = cmd.textContent;
  cmd.textContent = '';
  const tl = gsap.timeline();
  tl.add(() => typeInto(cmd, cmdText, 30), 0);
  if (renderer) tl.to(renderer.params, { reveal: 1, duration: 1.9, ease: 'power2.inOut' }, 0.1);
  tl.to(lines, {
    clipPath: 'inset(0% 0% 0% 0%)',
    duration: 0.55,
    ease: 'steps(9)',
    stagger: 0.16,
    clearProps: 'clipPath',
  }, 0.75);
}

/* -------------------------------------------------------------------------
   5. Monitor de telemetria dos projetos (Canvas 2D)
   Um canvas, três canais. Só desenha quando está visível.
   ------------------------------------------------------------------------- */

const MONO = '"IBM Plex Mono", ui-monospace, monospace';

/** Painel de leitura com fundo, para texto sobre o gráfico. */
function hudText(ctx, lines, x, y) {
  ctx.font = `11px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const lh = 16;
  const w = Math.max(...lines.map((l) => ctx.measureText(l[0]).width)) + 16;
  ctx.fillStyle = 'rgba(12, 8, 5, 0.78)';
  ctx.fillRect(x - 8, y - 6, w, lines.length * lh + 8);
  lines.forEach(([text, color], i) => {
    ctx.fillStyle = color || COLORS.dim;
    ctx.fillText(text, x, y + i * lh);
  });
}

/* CH1: varredura de radar classificando objetos próximos da Terra.
   Ilustra a ideia do projeto: uma saída sigmoide σ(z) separa perigoso/seguro. */
function vizAsteroids() {
  const rocks = [];
  let W = 1;
  let H = 1;
  let cx = 0;
  let cy = 0;
  let Rm = 1;
  let sweep = 0;
  let scanned = 0;
  let hazards = 0;
  let last = null;
  const sigmoid = (z) => 1 / (1 + Math.exp(-z));

  function spawn(r, initial) {
    const ang = Math.random() * Math.PI * 2;
    const b = (Math.random() * 2 - 1) * Rm; // parâmetro de impacto
    const dir = ang + Math.PI / 2;
    r.span = Math.hypot(W, H) * 0.6;
    r.size = Math.random();
    r.miss = Math.abs(b) / Rm;
    r.p = sigmoid(8 * r.size - 10 * r.miss - 3); // ~16% perigosos, classe rara
    r.haz = r.p >= 0.5;
    r.ox = cx + b * Math.cos(ang);
    r.oy = cy + b * Math.sin(ang);
    r.dx = Math.cos(dir);
    r.dy = Math.sin(dir);
    r.s = initial ? (Math.random() * 2 - 1) * r.span : -r.span;
    r.v = 12 + Math.random() * 24;
    r.known = false;
    r.lit = 0;
    return r;
  }

  return {
    resize(w, h) {
      W = w;
      H = h;
      cx = w * 0.56;
      cy = h * 0.52;
      Rm = Math.min(w, h) * 0.4;
      rocks.length = 0;
      for (let i = 0; i < 30; i++) rocks.push(spawn({}, true));
      scanned = 0;
      hazards = 0;
      last = null;
    },
    draw(ctx, w, h, t, dt) {
      sweep = (sweep + dt * 1.1) % (Math.PI * 2);
      ctx.lineWidth = 1;

      // anéis de distância e eixos
      ctx.strokeStyle = COLORS.wire;
      ctx.setLineDash([2, 5]);
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (Rm * i) / 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.strokeStyle = COLORS.wire2;
      ctx.beginPath();
      ctx.moveTo(cx - Rm * 1.12, cy);
      ctx.lineTo(cx + Rm * 1.12, cy);
      ctx.moveTo(cx, cy - Rm * 1.12);
      ctx.lineTo(cx, cy + Rm * 1.12);
      ctx.stroke();

      // feixe de varredura com rastro
      for (let k = 0; k < 26; k++) {
        const a = sweep - k * 0.024;
        ctx.strokeStyle = `rgba(255, 181, 71, ${(1 - k / 26) * 0.24})`;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * Rm * 1.06, cy + Math.sin(a) * Rm * 1.06);
        ctx.stroke();
      }

      // Terra
      ctx.fillStyle = COLORS.hot;
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `10px ${MONO}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = COLORS.dim;
      ctx.fillText('TERRA', cx + 8, cy - 7);

      // objetos
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const r of rocks) {
        r.s += r.v * dt;
        if (r.s > r.span) spawn(r, false);
        const x = r.ox + r.dx * r.s;
        const y = r.oy + r.dy * r.s;
        const d = Math.hypot(x - cx, y - cy);
        let diff = (sweep - Math.atan2(y - cy, x - cx)) % (Math.PI * 2);
        if (diff < 0) diff += Math.PI * 2;
        if (d < Rm * 1.06 && diff < 0.07) {
          if (!r.known) {
            r.known = true;
            scanned++;
            if (r.haz) hazards++;
            last = r;
          }
          r.lit = 1;
        }
        r.lit = Math.max(0, r.lit - dt * 0.5);
        if (d > Rm * 1.2) continue;

        const haz = r.known && r.haz;
        ctx.strokeStyle = 'rgba(169, 123, 75, 0.3)';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - r.dx * 16, y - r.dy * 16);
        ctx.stroke();

        ctx.globalAlpha = 0.5 + r.lit * 0.5;
        ctx.fillStyle = haz ? COLORS.hazard : r.known ? COLORS.amber : COLORS.dim;
        ctx.font = `${Math.round(11 + r.size * 7)}px ${MONO}`;
        ctx.fillText(haz ? 'x' : r.known ? '+' : '·', x, y);
        if (haz && r.lit > 0.05) {
          ctx.font = `10px ${MONO}`;
          ctx.fillText(`p=${r.p.toFixed(2)}`, x, y - 14);
        }
        ctx.globalAlpha = 1;
      }

      const lines = [
        ['σ(z) = 1 / (1 + e^-z)', COLORS.amber],
        [`varridos ${pad(scanned, 3)}  perigosos ${pad(hazards, 3)}`],
      ];
      if (last) {
        lines.push([
          `último alvo p=${last.p.toFixed(2)} ${last.haz ? 'PERIGOSO' : 'seguro'}`,
          last.haz ? COLORS.hazard : COLORS.text,
        ]);
      }
      hudText(ctx, lines, 18, 44);
    },
  };
}

/* CH2: PCA de verdade, calculada no navegador com dados do
   NASA Planetary Fact Sheet. Projeção 3D girando, como no repositório. */
function jacobiEigen(A) {
  const n = A.length;
  const a = A.map((r) => r.slice());
  const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => (i === j ? 1 : 0)));
  for (let sweepN = 0; sweepN < 80; sweepN++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
    if (off < 1e-14) break;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-15) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const tt = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(tt * tt + 1);
        const s = tt * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p];
          const vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq;
          V[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  return { values: a.map((r, i) => r[i]), vectors: V };
}

function vizPCA() {
  const names = ['Mercúrio', 'Vênus', 'Terra', 'Marte', 'Júpiter', 'Saturno', 'Urano', 'Netuno'];
  // massa (10^24 kg), diâmetro (km), densidade (kg/m³), gravidade (m/s²), v. de escape (km/s),
  // distância do Sol (10^6 km), período orbital (dias), temp. média (°C), anéis, campo magnético global
  const data = [
    [0.330, 4879, 5429, 3.7, 4.3, 57.9, 88.0, 167, 0, 1],
    [4.87, 12104, 5243, 8.9, 10.4, 108.2, 224.7, 464, 0, 0],
    [5.97, 12756, 5514, 9.8, 11.2, 149.6, 365.2, 15, 0, 1],
    [0.642, 6792, 3934, 3.7, 5.0, 228.0, 687.0, -65, 0, 0],
    [1898, 142984, 1326, 23.1, 59.5, 778.5, 4331, -110, 1, 1],
    [568, 120536, 687, 9.0, 35.5, 1432.0, 10747, -140, 1, 1],
    [86.8, 51118, 1270, 8.7, 21.3, 2867.0, 30589, -195, 1, 1],
    [102, 49528, 1638, 11.0, 23.5, 4515.0, 59800, -200, 1, 1],
  ];
  const logCols = new Set([0, 1, 5, 6]); // grandezas de várias ordens de magnitude
  const X = data.map((row) => row.map((v, j) => (logCols.has(j) ? Math.log10(v) : v)));
  const n = X.length;
  const m = X[0].length;

  // padroniza (z-score) e calcula a matriz de covariância
  const mean = Array.from({ length: m }, (_, j) => X.reduce((s, r) => s + r[j], 0) / n);
  const std = Array.from({ length: m }, (_, j) => Math.sqrt(X.reduce((s, r) => s + (r[j] - mean[j]) ** 2, 0) / (n - 1)) || 1);
  const Z = X.map((r) => r.map((v, j) => (v - mean[j]) / std[j]));
  const C = Array.from({ length: m }, (_, i) => Array.from({ length: m }, (__, j) => Z.reduce((s, r) => s + r[i] * r[j], 0) / (n - 1)));

  const { values, vectors } = jacobiEigen(C);
  const order = values.map((_, i) => i).sort((a, b) => values[b] - values[a]).slice(0, 3);
  const total = values.reduce((s, v) => s + Math.max(0, v), 0);
  const explained = order.map((i) => values[i] / total);
  const scores = Z.map((z) => order.map((i) => z.reduce((s, v, j) => s + v * vectors[j][i], 0)));
  // sinal dos autovetores é arbitrário: orienta Júpiter para o lado positivo
  for (let k = 0; k < 3; k++) if (scores[4][k] < 0) scores.forEach((s) => { s[k] = -s[k]; });
  const L = Math.max(...scores.flat().map(Math.abs)) * 1.15;

  let W = 1;
  let H = 1;
  let born = 0;

  const project = (p, yaw, pitch, scale, cx, cy) => {
    const [a, b, c] = p;
    const x1 = a * Math.cos(yaw) - c * Math.sin(yaw);
    const z1 = a * Math.sin(yaw) + c * Math.cos(yaw);
    const y2 = b * Math.cos(pitch) - z1 * Math.sin(pitch);
    const z2 = b * Math.sin(pitch) + z1 * Math.cos(pitch);
    return { x: cx + x1 * scale, y: cy - y2 * scale, z: z2 };
  };

  return {
    resize(w, h) { W = w; H = h; },
    reset() { born = -1; },
    draw(ctx, w, h, t) {
      if (born < 0) born = t;
      const e = 1 - Math.pow(1 - clamp((t - born) / 1.4, 0, 1), 3);
      const yaw = t * 0.28;
      const pitch = 0.42;
      const cx = w * 0.54;
      const cy = h * 0.56;
      const scale = (Math.min(w, h) * 0.36 / L) * e;
      const P = (p) => project(p, yaw, pitch, scale, cx, cy);

      ctx.lineWidth = 1;

      // grade do plano PC1 × PC3
      ctx.strokeStyle = COLORS.wire2;
      for (let i = -2; i <= 2; i++) {
        const v = (i / 2) * L;
        let a = P([-L, 0, v]);
        let b = P([L, 0, v]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        a = P([v, 0, -L]);
        b = P([v, 0, L]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }

      // eixos dos componentes
      ctx.font = `10px ${MONO}`;
      ctx.textBaseline = 'middle';
      [[L, 0, 0], [0, L, 0], [0, 0, L]].forEach((axis, k) => {
        const o = P([0, 0, 0]);
        const p = P(axis);
        const neg = P(axis.map((v) => -v));
        ctx.strokeStyle = COLORS.wire;
        ctx.beginPath(); ctx.moveTo(neg.x, neg.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.fillStyle = COLORS.amber;
        ctx.textAlign = p.x >= o.x ? 'left' : 'right';
        ctx.fillText(`PC${k + 1}`, p.x + (p.x >= o.x ? 6 : -6), p.y);
      });

      // planetas (ordenados por profundidade), com hastes até o plano
      const pts = scores.map((s, i) => ({ ...P(s), base: P([s[0], 0, s[2]]), i }));
      pts.sort((a, b) => a.z - b.z);
      const zMax = L || 1;
      pts.forEach((p) => {
        const depth = clamp(0.55 + (p.z / zMax) * 0.45, 0.25, 1);
        ctx.globalAlpha = depth;
        ctx.strokeStyle = COLORS.dim;
        ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.base.x, p.base.y); ctx.stroke();
        ctx.setLineDash([]);
        const giant = data[p.i][8] === 1;
        ctx.fillStyle = giant ? COLORS.hot : COLORS.amber;
        ctx.beginPath();
        ctx.arc(p.x, p.y, giant ? 4.5 : 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `11px ${MONO}`;
        ctx.textAlign = 'left';
        ctx.fillStyle = COLORS.text;
        ctx.fillText(names[p.i], p.x + 8, p.y - 1);
        ctx.globalAlpha = 1;
      });

      hudText(ctx, [
        ['variância explicada', COLORS.dim],
        [explained.map((v, k) => `PC${k + 1} ${(v * 100).toFixed(1)}%`).join('  '), COLORS.amber],
      ], 18, 44);
    },
  };
}

/* CH3: transições pixel-based, alternando padrões de varredura. */
function vizPixels() {
  const modes = ['dissolve', 'wipe', 'diagonal', 'radial', 'serpentina'];
  const CYCLE = 2.2;
  const HOLD = 0.8;
  let cols = 1;
  let rows = 1;
  let size = 10;
  let offX = 0;
  let offY = 0;
  let rnd = new Float32Array(1);
  let cycle = 0;
  let start = null;

  const threshold = (mode, x, y) => {
    switch (mode) {
      case 'dissolve': return rnd[y * cols + x];
      case 'wipe': return x / Math.max(1, cols - 1);
      case 'diagonal': return (x + y) / Math.max(1, cols + rows - 2);
      case 'radial': {
        const dx = x - (cols - 1) / 2;
        const dy = y - (rows - 1) / 2;
        return Math.hypot(dx, dy) / Math.hypot((cols - 1) / 2, (rows - 1) / 2);
      }
      default: { // serpentina: linha a linha, alternando o sentido
        const xx = y % 2 ? cols - 1 - x : x;
        return (y * cols + xx) / Math.max(1, cols * rows - 1);
      }
    }
  };

  return {
    resize(w, h) {
      size = Math.max(10, Math.round(w / 28));
      cols = Math.max(4, Math.floor((w - 36) / size));
      rows = Math.max(3, Math.floor((h - 130) / size));
      offX = (w - cols * size) / 2;
      offY = (h - rows * size) / 2 + 22;
      rnd = Float32Array.from({ length: cols * rows }, () => Math.random());
    },
    reset() { start = null; },
    draw(ctx, w, h, t) {
      if (start === null) start = t;
      let local = t - start;
      if (local > CYCLE + HOLD) {
        start = t;
        local = 0;
        cycle++;
        rnd = rnd.map(() => Math.random());
      }
      const p = clamp(local / CYCLE, 0, 1);
      const eased = p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2;
      const mode = modes[cycle % modes.length];
      const from = cycle % 2;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const k = clamp((eased * 1.35 - threshold(mode, x, y)) / 0.35, 0, 1);
          const v = Math.round((from ? 1 - k : k) * 4) / 4; // 5 estados discretos
          const px = offX + x * size;
          const py = offY + y * size;
          if (v === 0) {
            ctx.fillStyle = COLORS.wire2;
            ctx.fillRect(px + size / 2 - 1, py + size / 2 - 1, 2, 2);
            continue;
          }
          // a "imagem" de destino é um plasma animado, quantizado em 4 tons
          const img = 0.5 + 0.5 * Math.sin(x * 0.42 + t * 0.9) * Math.cos(y * 0.5 - t * 0.7);
          const tone = 0.2 + Math.round(img * 3) / 3 * 0.8;
          const s = Math.max(2, Math.round(size * 0.82 * v));
          ctx.fillStyle = `rgba(255, 181, 71, ${tone * (0.45 + v * 0.55)})`;
          ctx.fillRect(px + (size - s) / 2, py + (size - s) / 2, s, s);
        }
      }

      const byte = Math.round(eased * 255);
      hudText(ctx, [
        [`transição: ${mode}`, COLORS.amber],
        [`t = 0b${byte.toString(2).padStart(8, '0')}  ${pad(eased * 100, 3)}%`],
      ], 18, 44);
    },
  };
}

function createMonitor() {
  const canvas = $('[data-viz]');
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  const screenEl = canvas.parentElement;
  const staticEl = $('.monitor__static', screenEl);
  const chLabel = $('[data-viz-ch]');
  const caption = $('[data-viz-caption]');
  const tabs = $$('[data-channel]');
  const panels = tabs.map((tb) => document.getElementById(tb.getAttribute('aria-controls')));
  const vizzes = [vizAsteroids(), vizPCA(), vizPixels()];
  const captions = [
    'visualização ilustrativa: varredura e classificação por σ(z)',
    'PCA calculada ao vivo com dados do NASA Planetary Fact Sheet',
    'demonstração de transições pixel-based',
  ];
  let w = 0;
  let h = 0;
  let visible = false;
  let active = 0;
  let t = 0;

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width;
    h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    vizzes.forEach((v) => v.resize(w, h));
  }

  function setChannel(i, focusTab) {
    if (i === active) return;
    active = i;
    tabs.forEach((tb, k) => {
      const on = k === i;
      tb.classList.toggle('is-active', on);
      tb.setAttribute('aria-selected', String(on));
      tb.tabIndex = on ? 0 : -1;
    });
    panels.forEach((p, k) => p.classList.toggle('is-active', k === i));
    if (focusTab) tabs[i].focus();
    chLabel.textContent = 'CH' + (i + 1);
    caption.textContent = captions[i];
    if (vizzes[i].reset) vizzes[i].reset();

    // troca de canal: rajada de estática e título decodificando
    if (hasGSAP && !reduced()) {
      gsap.fromTo(staticEl, { opacity: 0.9 }, {
        opacity: 0,
        duration: 0.45,
        ease: 'steps(6)',
        onUpdate: () => {
          staticEl.style.backgroundPosition = `${(Math.random() * 160) | 0}px ${(Math.random() * 160) | 0}px`;
        },
      });
      const title = $('.readout__title', panels[i]);
      scramble(title, title._text || (title._text = title.textContent), { duration: 0.5 });
    }
  }

  tabs.forEach((tb, k) => {
    tb.addEventListener('click', () => setChannel(k));
    tb.addEventListener('keydown', (e) => {
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      let next = null;
      if (step) next = (k + step + tabs.length) % tabs.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = tabs.length - 1;
      if (next !== null) {
        e.preventDefault();
        setChannel(next, true);
      }
    });
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(screenEl);
  } else {
    visible = true;
  }
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize);
  resize();

  loop.add((now, dt) => {
    if (!visible || !w) return;
    t += dt * (reduced() ? 0.3 : 1);
    ctx.clearRect(0, 0, w, h);
    vizzes[active].draw(ctx, w, h, t, dt);
  });

  return { resize };
}

/* -------------------------------------------------------------------------
   6. Contato
   ------------------------------------------------------------------------- */

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // fallback para contextos sem a Clipboard API
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }
}

function initContact(renderer) {
  const btn = $('[data-copy]');
  const label = $('[data-copy-label]');
  const addr = btn && $('.email__addr', btn);
  const log = $('[data-log]');
  let timer = 0;

  // a linha de log entra "rasterizada"; o texto completo vai de uma vez para o leitor de tela
  const print = (msg, isError) => {
    log.textContent = msg;
    log.classList.toggle('is-error', !!isError);
    if (hasGSAP && !reduced()) {
      gsap.fromTo(log, { clipPath: 'inset(0% 100% 0% 0%)' }, {
        clipPath: 'inset(0% 0% 0% 0%)',
        duration: 0.4,
        ease: 'steps(20)',
        clearProps: 'clipPath',
      });
    }
  };

  if (btn) {
    btn.addEventListener('click', async () => {
      const email = btn.dataset.copy;
      const ok = await copyText(email);
      clearTimeout(timer);
      if (ok) {
        btn.classList.add('is-copied');
        scramble(label, 'copiado ✓', { duration: 0.35 });
        print(`> ${email} copiado para a área de transferência.`);
        if (renderer) {
          renderer.params.flash = 1;
          renderer.params.glitch = 1;
        }
        if (hasGSAP && !reduced()) {
          gsap.fromTo(addr,
            { textShadow: '0 0 4px #FFE6B3, 0 0 30px rgba(255, 181, 71, 0.95)' },
            { textShadow: '0 0 10px rgba(255, 181, 71, 0.35)', duration: 1, ease: 'power2.out', clearProps: 'textShadow' });
        }
        timer = setTimeout(() => {
          btn.classList.remove('is-copied');
          scramble(label, 'copiar', { duration: 0.3 });
        }, 2600);
      } else {
        print('> Não foi possível copiar. O endereço está selecionado: use Ctrl+C.', true);
        const range = document.createRange();
        range.selectNodeContents(addr);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
  }

  // formulário: valida e abre o cliente de e-mail com tudo preenchido (sem backend)
  const form = $('[data-form]');
  const err = $('[data-form-error]');
  if (!form) return;
  const fields = {
    name: $('#f-name'),
    email: $('#f-email'),
    message: $('#f-msg'),
  };
  const rules = [
    ['name', (v) => v.length > 0, 'Informe seu nome.'],
    ['email', (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Informe um e-mail válido, por exemplo voce@empresa.com.'],
    ['message', (v) => v.length > 0, 'Escreva sua mensagem antes de enviar.'],
  ];

  Object.values(fields).forEach((f) => f.addEventListener('input', () => f.removeAttribute('aria-invalid')));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const values = {};
    Object.entries(fields).forEach(([k, f]) => { values[k] = f.value.trim(); });

    const failed = rules.find(([k, test]) => !test(values[k]));
    if (failed) {
      const [k, , msg] = failed;
      fields[k].setAttribute('aria-invalid', 'true');
      fields[k].focus();
      err.textContent = '> ' + msg;
      return;
    }

    err.textContent = '';
    const subject = `Contato pelo site: ${values.name}`;
    const body = `${values.message}\n\n${values.name}\n${values.email}`;
    print('> Abrindo seu cliente de e-mail com a mensagem pronta.');
    if (renderer) renderer.params.flash = 1;
    window.location.href = `mailto:axiodev.contact@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
}

/* -------------------------------------------------------------------------
   7. Init
   ------------------------------------------------------------------------- */

function init() {
  if (hasGSAP) {
    gsap.registerPlugin(ScrollTrigger);
    if (window.ScrollToPlugin) gsap.registerPlugin(ScrollToPlugin);
  }

  trackPointer();
  initHUD();
  initNav();
  initPanes();

  const renderer = createRenderer();
  const diagRender = $('[data-diag-render]');
  if (renderer) {
    loop.add(renderer.frame);
    renderer.resize();
    if (diagRender) diagRender.textContent = 'WEBGL';
  } else {
    root.classList.add('no-webgl');
    if (diagRender) diagRender.textContent = 'SEM WEBGL';
  }

  const monitor = createMonitor();
  initContact(renderer);

  if (hasGSAP) {
    if (!reduced()) gsap.set('[data-hero-line]', { clipPath: 'inset(0% 0% 100% 0%)' });
    initCursor();
    initScroll(renderer);
  } else {
    $$('[data-prompt]').forEach((p) => p.classList.add('is-done'));
  }

  loop.start();

  // com as webfonts carregadas: refaz atlas/logo e recalcula posições
  const fonts = document.fonts
    ? Promise.all([
      document.fonts.load(`700 100px ${MONO}`),
      document.fonts.load(`500 16px ${MONO}`),
      document.fonts.load('400 40px "VT323"'),
    ]).then(() => document.fonts.ready)
    : Promise.resolve();
  Promise.race([fonts.catch(() => {}), new Promise((r) => setTimeout(r, 3000))]).then(() => {
    if (renderer) renderer.rebuild();
    if (monitor) monitor.resize();
    if (hasGSAP) ScrollTrigger.refresh();
  });

  runBoot(() => heroIntro(renderer));
}

init();
