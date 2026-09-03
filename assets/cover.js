/* Cover sheet: a printed plate with the title band. On "TriMind it." the sheet
   breaks into print tiles that lift on a ripple from the click and fall away,
   uncovering the page. Bare WebGL2, one instanced draw call, CPU gravity.
   Falls back to a fade when WebGL2 is missing or motion is reduced. */
(() => {
  const root = document.querySelector("[data-cover]");
  if (!root) return;

  const PAPER = "#f3eee2";
  const INK = "#123c34";
  const ACCENT = "#9b3d47";
  const SEEN_KEY = "bydi-cover";

  let seen = false;
  try {
    seen = window.sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    seen = false;
  }
  if (seen || new URLSearchParams(window.location.search).has("nocover")) {
    root.remove();
    return;
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sheet = root.querySelector("canvas");
  const button = root.querySelector("button");
  const ctx = sheet.getContext("2d");
  const state = { w: 0, h: 0, dpr: 1, img: null, buttonRect: null, painted: false };

  document.documentElement.classList.add("cover-open");
  const behind = [...document.body.children].filter((el) => el !== root);
  behind.forEach((el) => el.setAttribute("inert", ""));

  function plateSource() {
    const portrait = window.innerHeight > window.innerWidth * 1.05;
    return (portrait && root.dataset.platePortrait) || root.dataset.plate;
  }

  function loadPlate() {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = plateSource();
    });
  }

  // Cover-fit, then slide the plate so the figure sits below the paper band.
  // anchor: where the figure's head lies in the source, as a fraction of its height.
  function fitCover(img, w, h, bandBottom, anchor) {
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    const targetY = bandBottom + h * 0.11;
    let dy = targetY - anchor * dh;
    dy = Math.min(dy, h * 0.16);
    dy = Math.max(dy, h - dh);
    return { dx: (w - dw) / 2, dy, dw, dh };
  }

  function paint() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w < 2 || h < 2) {
      // no layout yet (hidden or background tab): paint when the viewport appears
      state.painted = false;
      return;
    }
    state.w = w;
    state.h = h;
    state.dpr = dpr;
    sheet.width = Math.round(w * dpr);
    sheet.height = Math.round(h * dpr);
    sheet.style.width = w + "px";
    sheet.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const narrow = w < 704;
    const titleSize = Math.max(30, Math.min(w * 0.072, 96));
    const monoSize = narrow ? 12 : 13;
    const bandH = titleSize * 2.15 + 128;
    const bandY = Math.round(h * 0.4 - bandH * 0.5);

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);
    if (state.img) {
      const portrait = state.img.naturalHeight > state.img.naturalWidth;
      const f = fitCover(state.img, w, h, bandY + bandH, portrait ? 0.6 : 0.55);
      ctx.drawImage(state.img, f.dx, f.dy, f.dw, f.dh);
    }

    // The paper band: exposed paper cutting through the plate.
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, bandY, w, bandH);
    ctx.fillStyle = INK;
    ctx.fillRect(0, bandY, w, 2);
    ctx.fillRect(0, bandY + bandH - 2, w, 2);

    // Kicker, mono, with the accent index.
    ctx.textBaseline = "alphabetic";
    ctx.font = `400 ${monoSize}px "IBM Plex Mono", ui-monospace, monospace`;
    const kickerY = bandY + 34;
    const kicker = "CLARITY COMES THROUGH TESTING";
    const kickerW = ctx.measureText(kicker).width + monoSize * 0.08 * kicker.length;
    const idxW = ctx.measureText("01").width + monoSize * 2;
    const kx = Math.round(w / 2 - (idxW + kickerW) / 2);
    ctx.fillStyle = ACCENT;
    ctx.fillText("01", kx, kickerY);
    ctx.fillStyle = "#4a6561";
    drawTracked(kicker, kx + idxW, kickerY, monoSize * 0.08);

    // Title in the display face, two lines, the second in the accent ink.
    ctx.font = `400 ${titleSize}px Literata, Georgia, serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = INK;
    const line1Y = kickerY + titleSize * 1.05;
    ctx.fillText("Before you decide it.", w / 2, line1Y);
    ctx.font = `italic 400 ${titleSize}px Literata, Georgia, serif`;
    ctx.fillStyle = ACCENT;
    const line2Y = line1Y + titleSize * 0.98;
    ctx.fillText("TriMind it.", w / 2, line2Y);
    ctx.textAlign = "left";

    // The printed label the visitor presses.
    ctx.font = `400 ${monoSize}px "IBM Plex Mono", ui-monospace, monospace`;
    const label = "TRIMIND IT";
    const labelW = ctx.measureText(label).width + monoSize * 0.1 * label.length;
    const bw = Math.round(labelW + 56);
    const bh = 48;
    const bx = Math.round(w / 2 - bw / 2);
    const by = Math.round(line2Y + titleSize * 0.42);
    ctx.fillStyle = INK;
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = PAPER;
    drawTracked(label, bx + 28, by + bh / 2 + monoSize * 0.36, monoSize * 0.1);
    state.buttonRect = { x: bx, y: by, w: bw, h: bh };

    button.style.left = bx + "px";
    button.style.top = by + "px";
    button.style.width = bw + "px";
    button.style.height = bh + "px";
    state.painted = true;
  }

  function drawTracked(text, x, y, tracking) {
    let cx = x;
    for (const ch of text) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + tracking;
    }
  }

  function finish() {
    try {
      window.sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* private mode: the cover simply shows again next time */
    }
    document.documentElement.classList.remove("cover-open");
    behind.forEach((el) => el.removeAttribute("inert"));
    root.remove();
    document.dispatchEvent(new CustomEvent("bydi:cover-done"));
    const target = document.querySelector("main h1");
    if (target) {
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    }
  }

  function fadeOut() {
    root.classList.add("is-leaving");
    window.setTimeout(finish, 420);
  }

  /* ---------- the drop ---------- */

  function shatter(cx, cy) {
    const gl = createGL();
    if (!gl) {
      fadeOut();
      return;
    }
    const { w, h, dpr } = state;
    const cell = Math.max(11, Math.min(w / 72, 20));
    const cols = Math.ceil(w / cell);
    const rows = Math.ceil(h / cell);
    const count = cols * rows;

    // Per-tile simulation state.
    const px = new Float32Array(count);
    const py = new Float32Array(count);
    const vx = new Float32Array(count);
    const vy = new Float32Array(count);
    const rot = new Float32Array(count);
    const vr = new Float32Array(count);
    const born = new Float32Array(count).fill(-1);
    const noise = new Float32Array(count);
    const cellIdx = new Float32Array(count * 2);
    const dyn = new Float32Array(count * 4);
    let seed = 1234567;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < count; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      px[i] = (c + 0.5) * cell;
      py[i] = (r + 0.5) * cell;
      noise[i] = (rnd() - 0.5) * cell * 6;
      cellIdx[i * 2] = c;
      cellIdx[i * 2 + 1] = r;
    }

    const maxDist = Math.max(
      Math.hypot(cx, cy),
      Math.hypot(w - cx, cy),
      Math.hypot(cx, h - cy),
      Math.hypot(w - cx, h - cy)
    );
    const rippleSeconds = 1.05;
    const gravity = 2600;
    const alive = new Uint8Array(count).fill(1);
    let aliveCount = count;

    const prog = buildProgram(gl.gl);
    const tex = gl.gl.createTexture();
    gl.gl.bindTexture(gl.gl.TEXTURE_2D, tex);
    gl.gl.pixelStorei(gl.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.gl.texImage2D(gl.gl.TEXTURE_2D, 0, gl.gl.RGBA, gl.gl.RGBA, gl.gl.UNSIGNED_BYTE, sheet);
    gl.gl.texParameteri(gl.gl.TEXTURE_2D, gl.gl.TEXTURE_MIN_FILTER, gl.gl.LINEAR);
    gl.gl.texParameteri(gl.gl.TEXTURE_2D, gl.gl.TEXTURE_MAG_FILTER, gl.gl.LINEAR);
    gl.gl.texParameteri(gl.gl.TEXTURE_2D, gl.gl.TEXTURE_WRAP_S, gl.gl.CLAMP_TO_EDGE);
    gl.gl.texParameteri(gl.gl.TEXTURE_2D, gl.gl.TEXTURE_WRAP_T, gl.gl.CLAMP_TO_EDGE);

    const G = gl.gl;
    const vao = G.createVertexArray();
    G.bindVertexArray(vao);
    const corner = G.createBuffer();
    G.bindBuffer(G.ARRAY_BUFFER, corner);
    G.bufferData(G.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), G.STATIC_DRAW);
    G.enableVertexAttribArray(0);
    G.vertexAttribPointer(0, 2, G.FLOAT, false, 0, 0);
    const cellBuf = G.createBuffer();
    G.bindBuffer(G.ARRAY_BUFFER, cellBuf);
    G.bufferData(G.ARRAY_BUFFER, cellIdx, G.STATIC_DRAW);
    G.enableVertexAttribArray(1);
    G.vertexAttribPointer(1, 2, G.FLOAT, false, 0, 0);
    G.vertexAttribDivisor(1, 1);
    const dynBuf = G.createBuffer();
    G.bindBuffer(G.ARRAY_BUFFER, dynBuf);
    G.bufferData(G.ARRAY_BUFFER, dyn, G.DYNAMIC_DRAW);
    G.enableVertexAttribArray(2);
    G.vertexAttribPointer(2, 4, G.FLOAT, false, 0, 0);
    G.vertexAttribDivisor(2, 1);

    G.useProgram(prog);
    G.uniform2f(G.getUniformLocation(prog, "uRes"), w, h);
    G.uniform2f(G.getUniformLocation(prog, "uGrid"), cols, rows);
    G.uniform2f(G.getUniformLocation(prog, "uCell"), cell / w, cell / h);
    G.uniform1f(G.getUniformLocation(prog, "uSize"), cell);
    G.uniform1i(G.getUniformLocation(prog, "uTex"), 0);
    G.enable(G.BLEND);
    G.blendFunc(G.SRC_ALPHA, G.ONE_MINUS_SRC_ALPHA);
    G.viewport(0, 0, Math.round(w * dpr), Math.round(h * dpr));

    // The sheet is now carried by the tiles; hide the flat drawing.
    sheet.style.visibility = "hidden";
    button.style.visibility = "hidden";
    root.classList.add("is-breaking");

    let last = performance.now();
    const start = last;
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - start) / 1000;
      const radius = (t / rippleSeconds) * maxDist;

      for (let i = 0; i < count; i++) {
        if (!alive[i]) {
          dyn[i * 4 + 3] = 0;
          continue;
        }
        if (born[i] < 0) {
          const d = Math.hypot(px[i] - cx, py[i] - cy) + noise[i];
          if (radius > d) {
            born[i] = t;
            vx[i] = (rnd() - 0.5) * 360;
            vy[i] = -(180 + rnd() * 320);
            vr[i] = (rnd() - 0.5) * 9;
          }
        }
        let scale = 1;
        if (born[i] >= 0) {
          const age = t - born[i];
          if (age < 0.28) {
            scale = 1 + Math.sin((age / 0.28) * Math.PI) * 0.35;
          }
          vy[i] += gravity * dt;
          px[i] += vx[i] * dt;
          py[i] += vy[i] * dt;
          rot[i] += vr[i] * dt;
          if (py[i] > h + cell * 3 || px[i] < -cell * 4 || px[i] > w + cell * 4) {
            alive[i] = 0;
            aliveCount--;
          }
        }
        dyn[i * 4] = px[i];
        dyn[i * 4 + 1] = py[i];
        dyn[i * 4 + 2] = rot[i];
        dyn[i * 4 + 3] = scale;
      }

      G.clearColor(0, 0, 0, 0);
      G.clear(G.COLOR_BUFFER_BIT);
      G.bindBuffer(G.ARRAY_BUFFER, dynBuf);
      G.bufferSubData(G.ARRAY_BUFFER, 0, dyn);
      G.drawArraysInstanced(G.TRIANGLE_STRIP, 0, 4, count);

      if (aliveCount > 0 && t < 6) {
        requestAnimationFrame(frame);
      } else {
        finish();
      }
    }
    requestAnimationFrame(frame);
  }

  function createGL() {
    const canvas = document.createElement("canvas");
    canvas.className = "cover-drop";
    canvas.width = sheet.width;
    canvas.height = sheet.height;
    canvas.style.width = state.w + "px";
    canvas.style.height = state.h + "px";
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false, antialias: false });
    if (!gl) return null;
    root.appendChild(canvas);
    return { canvas, gl };
  }

  function buildProgram(G) {
    const vs = `#version 300 es
      layout(location=0) in vec2 aCorner;
      layout(location=1) in vec2 aCell;
      layout(location=2) in vec4 aDyn; // x, y, rotation, scale
      uniform vec2 uRes; uniform vec2 uGrid; uniform vec2 uCell; uniform float uSize;
      out vec2 vUv; out float vAlpha;
      void main() {
        float c = cos(aDyn.z), s = sin(aDyn.z);
        vec2 local = aCorner * uSize * aDyn.w;
        vec2 p = aDyn.xy + vec2(local.x * c - local.y * s, local.x * s + local.y * c);
        vec2 clip = (p / uRes) * 2.0 - 1.0;
        gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
        vUv = (aCell + aCorner + 0.5) * uCell;
        vAlpha = aDyn.w > 0.0 ? 1.0 : 0.0;
      }`;
    const fs = `#version 300 es
      precision mediump float;
      uniform sampler2D uTex; in vec2 vUv; in float vAlpha; out vec4 o;
      void main() {
        if (vAlpha <= 0.0) discard;
        o = vec4(texture(uTex, vUv).rgb, 1.0);
      }`;
    const compile = (type, src) => {
      const sh = G.createShader(type);
      G.shaderSource(sh, src);
      G.compileShader(sh);
      return sh;
    };
    const prog = G.createProgram();
    G.attachShader(prog, compile(G.VERTEX_SHADER, vs));
    G.attachShader(prog, compile(G.FRAGMENT_SHADER, fs));
    G.linkProgram(prog);
    return prog;
  }

  /* ---------- boot ---------- */

  button.addEventListener("click", (event) => {
    if (!state.painted) return;
    if (reduceMotion) {
      fadeOut();
      return;
    }
    const r = state.buttonRect;
    const x = event.clientX || r.x + r.w / 2;
    const y = event.clientY || r.y + r.h / 2;
    shatter(x, y);
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && root.isConnected) fadeOut();
  });

  let resizeTimer = 0;
  function repaintSoon() {
    if (!root.isConnected || root.classList.contains("is-breaking")) return;
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(paint, 80);
  }
  window.addEventListener("resize", repaintSoon);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !state.painted) repaintSoon();
  });

  Promise.all([
    loadPlate(),
    document.fonts.load('400 40px Literata'),
    document.fonts.load('italic 400 40px Literata'),
    document.fonts.load('400 13px "IBM Plex Mono"')
  ]).then(([img]) => {
    state.img = img;
    paint();
    root.classList.add("is-ready");
  });
})();
