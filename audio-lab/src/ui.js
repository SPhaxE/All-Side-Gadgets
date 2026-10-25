// Page logic: render every sound once, draw waveforms, play single sounds / loops / the whole video timeline.
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const all = [...SFX.map((s) => ({ ...s, kind: 'sfx' })), ...LOOPS.map((s) => ({ ...s, kind: 'loops' })), ...LOOPS_EXTRA.map((s) => ({ ...s, kind: 'loops' }))];
  const bufs = {};
  let tab = 'sfx';
  let ac = null, playing = null, raf = 0;

  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}

  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      try { ac = new AC({ sampleRate: SR }); } catch (e) { ac = new AC(); } // buffers are 44.1 kHz; the browser resamples if needed
    }
    if (ac.state !== 'running') ac.resume(); // also recovers 'interrupted' (iOS) after a call or app switch
    return ac;
  }
  function toBuffer(f32) {
    const b = ctx().createBuffer(1, f32.length, SR);
    b.getChannelData(0).set(f32);
    return b;
  }

  function fit(canvas) {
    const r = canvas.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(10, Math.round(r.width * d)); canvas.height = Math.max(10, Math.round(r.height * d));
    return { c: canvas.getContext('2d'), w: canvas.width, h: canvas.height, d };
  }

  // min/max bars of buf over [t0, t1] seconds into the pixel box (x0..x1)
  function bars(c, buf, x0, x1, mid, amp, color, glow, d) {
    c.fillStyle = color;
    if (glow) { c.shadowColor = color; c.shadowBlur = glow * d; }
    const n = buf.length, px = Math.max(1, Math.round(x1 - x0));
    const step = Math.max(1, Math.floor(1.6 * d));
    for (let x = 0; x < px; x += step) {
      const a = Math.floor((x / px) * n), b = Math.max(a + 1, Math.floor(((x + step) / px) * n));
      let mn = 0, mx = 0;
      for (let i = a; i < b && i < n; i++) { const v = buf[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
      const h = Math.max(1 * d, (mx - mn) * 0.5 * amp);
      c.fillRect(x0 + x, mid - h / 2, Math.max(1, step - (d > 1 ? 0.6 : 0)), h);
    }
    c.shadowBlur = 0;
  }
  function ghostLine(c, ref, x0, x1, mid, amp, color, d) {
    c.strokeStyle = color; c.lineWidth = 1.3 * d; c.setLineDash([4 * d, 3 * d]);
    for (const sgn of [-1, 1]) {
      c.beginPath();
      ref.forEach((v, i) => { const x = x0 + (i / (ref.length - 1)) * (x1 - x0), y = mid + sgn * v * amp * 0.5; i ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.stroke();
    }
    c.setLineDash([]);
  }

  let ghostOn = true;
  function drawCard(s) {
    const cv = $('#cv-' + s.id); if (!cv || !bufs[s.id]) return;
    const { c, w, h, d } = fit(cv);
    c.clearRect(0, 0, w, h);
    const color = s.kind === 'sfx' ? cssVar('--warm') : cssVar('--teal');
    c.strokeStyle = cssVar('--line'); c.lineWidth = d; c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
    bars(c, bufs[s.id], 0, w, h / 2, h * 0.92, color, s.kind === 'sfx' ? 8 : 0, d);
    if (ghostOn && s.ref && REF_ENV[s.id]) ghostLine(c, REF_ENV[s.id], 0, w, h / 2, h * 0.92, cssVar('--ghost'), d);
  }

  // --- the strips that mimic each video's layout
  function drawStrip(kind) {
    const cv = $('#cv-strip-' + kind), { c, w, h, d } = fit(cv);
    c.clearRect(0, 0, w, h);
    if (kind === 'sfx') {
      const total = 19.7, mid = h * 0.52, warm = cssVar('--warm');
      c.strokeStyle = cssVar('--line'); c.lineWidth = d; c.beginPath(); c.moveTo(0, mid); c.lineTo(w, mid); c.stroke();
      SFX.forEach((s, i) => {
        if (!bufs[s.id]) return;
        const x0 = (s.ref[0] / total) * w, x1 = (s.ref[1] / total) * w;
        // the original strip draws each sound at its own loudness; keep the page's per-sound peak but cap the height
        bars(c, bufs[s.id], x0, x1, mid, h * 0.5, warm, 10, d);
        c.fillStyle = cssVar('--muted'); c.font = `${11 * d}px ${cssVar('--body')}`; c.textBaseline = 'alphabetic';
        const up = i % 2 === 0, lx = Math.min(x0, w - c.measureText(s.name).width - 4 * d);
        c.fillText(s.name, Math.max(2 * d, lx), up ? mid - h * 0.3 : mid + h * 0.38);
      });
    } else {
      const clipLen = (s) => (s.ref ? s.ref[1] - s.ref[0] : s.len);
      const total = LOOPS.reduce((a, s) => a + clipLen(s), 0), top = h * 0.2, lane = h * 0.62;
      let x = 0;
      LOOPS.forEach((s) => {
        const wd = (clipLen(s) / total) * w;
        c.fillStyle = cssVar('--bg'); c.strokeStyle = cssVar('--teal'); c.lineWidth = d; c.setLineDash(s.filled ? [4 * d, 3 * d] : []);
        c.fillRect(x + 1, top, wd - 2, lane); c.strokeRect(x + 1, top, wd - 2, lane); c.setLineDash([]);
        if (bufs[s.id]) bars(c, bufs[s.id], x + 3, x + wd - 3, top + lane * 0.62, lane * 0.7, cssVar('--teal'), 0, d);
        c.fillStyle = cssVar('--fg'); c.font = `${10.5 * d}px ${cssVar('--body')}`; c.textBaseline = 'top';
        c.save(); c.beginPath(); c.rect(x + 3, top, wd - 6, 16 * d); c.clip();
        c.fillText(`${s.num} ${s.name}`, x + 6 * d, top + 3 * d); c.restore();
        x += wd;
      });
    }
  }

  // --- playback
  const phEls = {};
  // every source goes through a gain so starts, stops and loop cuts never click
  function voice(buf, when, { loop = false, dur = null, fadeIn = 0.008 } = {}) {
    const a = ctx(), src = a.createBufferSource(), g = a.createGain();
    src.buffer = toBuffer(buf); src.loop = loop;
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(1, when + fadeIn);
    src.connect(g); g.connect(a.destination); src.start(when);
    if (dur != null) {
      const e = when + dur;
      g.gain.setValueAtTime(1, Math.max(when + fadeIn + 0.001, e - 0.012)); g.gain.linearRampToValueAtTime(0, e);
      src.stop(e + 0.005);
    }
    return { src, g };
  }
  function stopAll() {
    if (playing) {
      const now = ac.currentTime;
      playing.nodes.forEach(({ src, g }) => { try { g.gain.setTargetAtTime(0, now, 0.004); src.stop(now + 0.03); } catch (e) {} });
      playing = null;
    }
    cancelAnimationFrame(raf);
    document.querySelectorAll('.row.playing').forEach((r) => r.classList.remove('playing'));
    document.querySelectorAll('.ph').forEach((p) => (p.style.display = 'none'));
    $('#playall').textContent = '▶ 按视频时间轴播放';
  }
  function tickPlayhead() {
    if (!playing) return;
    const t = ac.currentTime - playing.t0;
    playing.marks.forEach((m) => {
      const el = m.el; if (!el) return;
      const u = m.loop ? ((t % m.dur) / m.dur) : (t - m.start) / m.dur;
      if (u < 0 || u > 1) { el.style.display = 'none'; return; }
      el.style.display = 'block'; el.style.left = (u * 100).toFixed(2) + '%';
    });
    if (playing.end && t > playing.end) { stopAll(); return; }
    raf = requestAnimationFrame(tickPlayhead);
  }
  function playOne(s) {
    const was = playing && playing.id === s.id; stopAll(); if (was) return;
    const a = ctx(), loop = s.kind === 'loops';
    const t0 = a.currentTime + 0.05, dur = bufs[s.id].length / SR;
    const v = voice(bufs[s.id], t0, { loop, fadeIn: loop ? 0.008 : 0.001 });
    playing = { id: s.id, nodes: [v], t0, end: loop ? 0 : dur + 0.05, marks: [{ el: phEls[s.id], dur, loop, start: 0 }] };
    $('#row-' + s.id).classList.add('playing');
    if (!loop) v.src.onended = () => { if (playing && playing.id === s.id) stopAll(); };
    raf = requestAnimationFrame(tickPlayhead);
  }
  function playTimeline(kind) {
    const was = playing && playing.id === 'timeline-' + kind; stopAll(); if (was) return;
    const a = ctx(), t0 = a.currentTime + 0.08, nodes = [], marks = [];
    const list = kind === 'sfx' ? SFX : LOOPS;
    let acc = 0, end = 0;
    list.forEach((s) => {
      const dur = bufs[s.id].length / SR, at = kind === 'sfx' ? s.ref[0] : acc;
      if (kind === 'sfx') {
        nodes.push(voice(bufs[s.id], t0 + at, { fadeIn: 0.001 }));
        marks.push({ el: phEls[s.id], dur, loop: false, start: at });
        end = Math.max(end, at + dur);
      } else {
        // each loop fills exactly its clip in the video (looped, with 8 ms fade in / 12 ms fade out): no gaps, no overlaps
        const len = s.ref ? s.ref[1] - s.ref[0] : s.len;
        nodes.push(voice(bufs[s.id], t0 + at, { loop: true, dur: len }));
        marks.push({ el: phEls[s.id], dur: len, loop: false, start: at });
        end = Math.max(end, at + len); acc += len;
      }
    });
    const sp = $('#ph-strip-' + kind); const total = kind === 'sfx' ? 19.7 : acc;
    marks.push({ el: sp, dur: total, loop: false, start: 0 });
    playing = { id: 'timeline-' + kind, nodes, t0, end: end + 0.1, marks };
    $('#playall').textContent = '■ 停止时间轴';
    raf = requestAnimationFrame(tickPlayhead);
  }

  // --- build the DOM
  const playIcon = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1.5v13l11-6.5z"/></svg>';
  function makeRow(s, kind, list, i) {
    const row = document.createElement('div'); row.className = 'row'; row.id = 'row-' + s.id;
    const fact = s.ref ? `<span>原视频 ${s.ref[0].toFixed(2)}–${s.ref[1].toFixed(2)}s</span><span id="cor-${s.id}"></span>` : '<span class="fill">补充 · 视频里没有这个编号</span>';
    row.innerHTML = `<div class="meta"><div class="name"><span class="no">${s.num || String(i + 1).padStart(2, '0')}</span>${s.name}</div>
      <div class="facts"><span id="dur-${s.id}"></span>${fact}</div></div>
      <div class="cv"><canvas id="cv-${s.id}"></canvas><div class="ph" id="ph-${s.id}"></div></div>
      <button class="play" disabled aria-label="播放 ${s.name}">${playIcon}</button>`;
    list.appendChild(row);
    phEls[s.id] = row.querySelector('.ph');
    row.querySelector('.play').addEventListener('click', () => { if (bufs[s.id]) playOne({ ...s, kind }); });
    row.querySelector('.cv').addEventListener('click', () => { if (bufs[s.id]) playOne({ ...s, kind }); });
  }
  function build() {
    for (const kind of ['sfx', 'loops']) {
      const strip = $('#strip-' + kind); const ph = document.createElement('div'); ph.className = 'ph'; ph.id = 'ph-strip-' + kind; strip.appendChild(ph);
      (kind === 'sfx' ? SFX : LOOPS).forEach((s, i) => makeRow(s, kind, $('#list-' + kind), i));
    }
    LOOPS_EXTRA.forEach((s, i) => makeRow(s, 'loops', $('#list-extra'), i));
  }

  async function renderAll() {
    const st = $('#status'); let done = 0;
    const order = all.slice().sort((x, y) => (x.kind === tab ? 0 : 1) - (y.kind === tab ? 0 : 1));
    for (const s of order) {
      await new Promise((r) => setTimeout(r, 0));
      const f32 = s.render(); bufs[s.id] = f32;
      if (s.ref) { const sc = envScore(f32, s.id, s.ref, s.kind); $('#cor-' + s.id).textContent = '包络相似度 ' + Math.round(sc * 100) + '%'; }
      const dur = f32.length / SR;
      $('#dur-' + s.id).textContent = (s.kind === 'loops' ? '循环 ' : '') + dur.toFixed(2) + 's';
      drawCard(s); done++;
      document.querySelectorAll('#row-' + s.id + ' .play').forEach((b) => (b.disabled = false));
      st.textContent = `正在合成 ${done}/${all.length}…`;
    }
    st.textContent = `已合成 ${all.length} 个声音(采样率 ${SR} Hz,单声道)。点击播放。iPhone 的静音键打开时可能没有声音。`;
    drawStrip('sfx'); drawStrip('loops');
  }

  function redrawAll() { all.forEach(drawCard); drawStrip('sfx'); drawStrip('loops'); }

  function setTab(t) {
    stopAll(); tab = t;
    $('#pane-sfx').hidden = t !== 'sfx'; $('#pane-loops').hidden = t !== 'loops';
    $('#tab-sfx').setAttribute('aria-selected', t === 'sfx'); $('#tab-loops').setAttribute('aria-selected', t === 'loops');
    try { history.replaceState(null, '', '#' + t); } catch (e) {}
    requestAnimationFrame(redrawAll);
  }
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  $('#ghost').addEventListener('click', (e) => { ghostOn = !ghostOn; e.currentTarget.setAttribute('aria-pressed', ghostOn); redrawAll(); });
  $('#playall').addEventListener('click', () => { if (Object.keys(bufs).length === all.length) playTimeline(tab); });
  $('#stop').addEventListener('click', stopAll);
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(redrawAll, 120); });
  if (location.hash === '#loops') setTab('loops');
  document.addEventListener('pointerdown', () => { try { const a = ctx(), b = a.createBuffer(1, 1, SR), s = a.createBufferSource(); s.buffer = b; s.connect(a.destination); s.start(); } catch (e) {} }, { once: true });
  build();
  renderAll();
})();
