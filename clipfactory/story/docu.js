// docu.js: dark documentary motion-graphics (16:9 first) — maps, big numbers, title cards, comparisons.
// One renderer, scene.kind picks the layout. Pure function of time; words sync through api.wordAt(word).
import * as M from './motion.js';

export const TOK = { ink: '#0C1117', ink2: '#141B23', sea: '#13202B', land: '#232B33', parchment: '#ECE2CC', dim: '#8A9099', gold: '#C9A45C', mace: '#D0552B', atlantic: '#6FA3C7' };
const SERIF = 'Lora', SANS = 'Poppins';

// ---------------------------------------------------------------- geo: TopoJSON decode + hand-traced Banda islands
function topoPolys(topo) {
  const { scale: [kx, ky], translate: [dx, dy] } = topo.transform;
  const arcs = topo.arcs.map((a) => { let x = 0, y = 0; return a.map(([qx, qy]) => { x += qx; y += qy; return [x * kx + dx, y * ky + dy]; }); });
  const ring = (ids) => { const out = []; ids.forEach((id) => { const a = id < 0 ? arcs[~id].slice().reverse() : arcs[id]; a.forEach((p, i) => { if (i || !out.length) out.push(p); }); }); return out; };
  const polys = [];
  const obj = Object.values(topo.objects)[0];
  (obj.geometries || [obj]).forEach((g) => {
    const list = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
    list.forEach((p) => p.forEach((r, k) => { if (k) return; const pts = ring(r); let off = 0; for (let i = 1; i < pts.length; i++) { const dx = pts[i][0] + off - pts[i - 1][0]; if (dx > 180) off -= 360; else if (dx < -180) off += 360; if (off) pts[i] = [pts[i][0] + off, pts[i][1]]; } polys.push(withBox(pts)); }));
  });
  return polys;
}
function withBox(pts) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; pts.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }); pts.box = [x0, y0, x1, y1]; return pts; }
// approximate outlines (km-scaled blobs); replaced by OpenStreetMap data when geo/banda.json exists
function blob(lon, lat, rxKm, ryKm, rot, seed, n = 40) {
  const kLat = 1 / 110.6, kLon = 1 / (111.3 * Math.cos(lat * Math.PI / 180)); const pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, r = 1 + (M.noise1(i * 0.6, seed) - 0.5) * 0.35; const x = Math.cos(a) * rxKm * r, y = Math.sin(a) * ryKm * r;
    pts.push([lon + (x * Math.cos(rot) - y * Math.sin(rot)) * kLon, lat + (x * Math.sin(rot) + y * Math.cos(rot)) * kLat]); }
  pts.push(pts[0]); return withBox(pts);
}
function crescent(pts, wKm, lat) {
  const kLon = 1 / (111.3 * Math.cos(lat * Math.PI / 180)), kLat = 1 / 110.6; const L = [], R = [];
  pts.forEach((p, i) => { const q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)]; const dx = (q[0] - o[0]) / kLon, dy = (q[1] - o[1]) / kLat, d = Math.hypot(dx, dy) || 1;
    const w = wKm * Math.sin(Math.PI * (0.15 + 0.7 * i / (pts.length - 1))); L.push([p[0] - dy / d * w * kLon, p[1] + dx / d * w * kLat]); R.push([p[0] + dy / d * w * kLon, p[1] - dx / d * w * kLat]); });
  const ring = [...L, ...R.reverse()]; ring.push(ring[0]); return withBox(ring);
}
export const BANDA = {
  run: blob(129.683, -4.554, 1.6, 0.55, 0.35, 3), nailaka: blob(129.701, -4.537, 0.22, 0.16, 0, 5, 18),
  ai: blob(129.776, -4.527, 1.25, 1.0, 0.2, 7), neira: blob(129.897, -4.526, 0.8, 1.6, 0.15, 9),
  gunungapi: blob(129.871, -4.506, 1.4, 1.35, 0, 11), syahrir: blob(129.918, -4.478, 0.4, 0.3, 0, 13, 20),
  onrust: blob(106.7356, -6.0353, 0.19, 0.15, 0.3, 21, 30), cipir: blob(106.7402, -6.0392, 0.13, 0.09, 0.2, 23, 24),
  kelor: blob(106.7469, -6.0272, 0.08, 0.07, 0, 25, 20), bidadari: blob(106.7495, -6.0375, 0.16, 0.1, -0.3, 27, 24),
  besar: crescent([[129.872, -4.548], [129.90, -4.556], [129.93, -4.562], [129.96, -4.56], [129.985, -4.548], [130.0, -4.53]], 1.1, -4.55),
};
export const PLACES = { run: [129.683, -4.554], ai: [129.778, -4.526], neira: [129.899, -4.516], gunungapi: [129.882, -4.521], besar: [129.93, -4.556], banda: [129.86, -4.54], nailaka: [129.701, -4.537],
  maluku: [129.0, -3.3], manhattan: [-73.97, 40.78], newyork: [-74.0, 40.71], london: [-0.12, 51.5], amsterdam: [4.9, 52.37], malaka: [102.25, 2.2], venesia: [12.33, 45.44], breda: [4.78, 51.59], grenada: [-61.68, 12.12], ambon: [128.18, -3.69],
  onrust: [106.7356, -6.0353], cipir: [106.7402, -6.0392], kelor: [106.7469, -6.0272], bidadari: [106.7495, -6.0375], batavia: [106.81, -6.13], jakarta: [106.83, -6.17], priok: [106.88, -6.105],
  mekkah: [39.83, 21.42], jeddah: [39.17, 21.54], rangoon: [96.16, 16.8], jatim: [112.6, -7.6], jateng: [110.4, -7.1], jabar: [107.6, -6.9], bandung: [107.61, -6.91], berlin: [13.4, 52.52], amsterdam2: [4.9, 52.37] };

// ---------------------------------------------------------------- renderer
export async function makeDocu(mainCtx, W, H, base = '/story/') {
  let ctx = mainCtx;
  const fonts = [[SERIF, 'lora-600.woff2', '600', 'normal'], [SERIF, 'lora-700.woff2', '700', 'normal'], [SERIF, 'lora-600i.woff2', '600', 'italic'],
    [SANS, 'poppins-500.woff2', '500', 'normal'], [SANS, 'poppins-600.woff2', '600', 'normal'], [SANS, 'poppins-800.woff2', '800', 'normal']];
  await Promise.all(fonts.map(async ([fam, f, w, st]) => { const ff = new FontFace(fam, `url(${base}fonts/${f})`, { weight: w, style: st }); await ff.load(); document.fonts.add(ff); }));
  const [w50, w10] = await Promise.all(['land-50m.json', 'land-10m.json'].map((f) => fetch(base + 'geo/' + f).then((r) => r.json())));
  const LAND50 = topoPolys(w50), LAND10 = topoPolys(w10);
  let bandaPolys = BANDA, JAKARTA = null;
  try { const jk = await fetch(base + 'geo/jakarta.json').then((r) => (r.ok ? r.json() : null)); if (jk) JAKARTA = jk.map((r) => withBox(r)); } catch { /* optional */ }
  try { const osm = await fetch(base + 'geo/banda.json').then((r) => (r.ok ? r.json() : null)); if (osm) bandaPolys = { nailaka: BANDA.nailaka, syahrir: BANDA.syahrir, onrust: BANDA.onrust, cipir: BANDA.cipir, kelor: BANDA.kelor, bidadari: BANDA.bidadari, ...Object.fromEntries(Object.entries(osm).map(([k, v]) => [k, withBox(v)])) }; } catch { /* keep approximations */ }
  const u = H / 1080, LAND = W > H;
  const { E, prog, clamp, lerp } = M;
  const ease = E.inOutCubic;
  const font = (fam, w, size, it = false) => `${it ? 'italic ' : ''}${w} ${Math.round(size)}px ${fam}`;
  const txt = (s, x, y, f, col, align = 'center', spacing = 0) => { ctx.font = f; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = col; if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`; ctx.fillText(s, x, y); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; };
  // text entrance: fade + rise 20 px over 0.4 s
  const enter = (t, t0) => { const k = ease(clamp((t - t0) / 0.4)); return { a: k, dy: (1 - k) * 20 * u }; };
  const NOISE = []; for (let k = 0; k < 4; k++) { const n = document.createElement('canvas'); n.width = n.height = 256; const c = n.getContext('2d'); const id = c.createImageData(256, 256); for (let i = 0; i < id.data.length; i += 4) { const v = (M.hash01(i + k * 7919, 3) * 255) | 0; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } c.putImageData(id, 0, 0); NOISE.push(n); }

  function background(t, dimK = 0) {
    const g = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H / 2, Math.max(W, H) * 0.75); g.addColorStop(0, TOK.sea); g.addColorStop(1, TOK.ink);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (dimK) { ctx.fillStyle = `rgba(0,0,0,${dimK})`; ctx.fillRect(0, 0, W, H); }
  }
  function finish(t) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = 0.1; ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = ctx.createPattern(NOISE[Math.floor(t * 15) % 4], 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  function chapterTag(s, t, t0) {
    if (!s.chapter) return; const e = enter(t, t0);
    ctx.save(); ctx.globalAlpha = e.a;
    ctx.fillStyle = TOK.gold; ctx.fillRect(70 * u, 66 * u + e.dy, 4 * u, 34 * u);
    txt(s.chapter.toUpperCase(), 90 * u, 84 * u + e.dy, font(SANS, 600, 24 * u), TOK.gold, 'left', 0.3 * 24 * u);
    ctx.restore();
  }
  // ---- map
  const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180 / Math.PI;
  function camAt(s, t, api) {
    const keys = (s.mapcam || [{ at: 0, lon: 120, lat: 0, zoom: 1 }]).map((k) => ({ ...k, t: k.word ? (api.wordAt(k.word) ?? api.span[0]) - api.span[0] + (k.at || 0) : (k.at || 0) }));
    const lt = t - api.span[0];
    let a = keys[0], b = keys[0];
    for (let i = 0; i < keys.length; i++) { if (keys[i].t <= lt) { a = keys[i]; b = keys[i + 1] || keys[i]; } }
    const k = b === a ? 1 : ease(clamp((lt - b.t + (b.dur ?? 1.6)) / (b.dur ?? 1.6)));
    if (b !== a && lt < b.t - (b.dur ?? 1.6)) b = a;
    const lz = lerp(Math.log(a.zoom), Math.log(b.zoom), k);
    // constant slow drift so a map never sits still: push in a few percent and pan a little
    const kk = clamp(lt / Math.max(1, api.span[1] - api.span[0])), z = Math.exp(lz) * (1 + (s.drift ?? 0.07) * E.inOutSine(kk));
    return { lon: lerp(a.lon, b.lon, k) + (s.pan ?? 0.03) * (360 / z) * (kk - 0.5), lat: lerp(a.lat, b.lat, k), zoom: z };
  }
  function project(cam) {
    const s = cam.zoom * W / 360, cy = merc(cam.lat);
    return { s, f: (lon, lat) => [W / 2 + (lon - cam.lon) * s, H / 2 - (merc(lat) - cy) * s], view: [cam.lon - W / 2 / s, cam.lon + W / 2 / s] };
  }
  function drawPolys(polys, P, fill, stroke, lw, glow) {
    [0, -360, 360].forEach((o) => { drawPolysAt(polys, o ? { ...P, f: (x, y) => P.f(x + o, y), view: [P.view[0] - o, P.view[1] - o] } : P, fill, stroke, lw, glow); });
  }
  function drawPolysAt(polys, P, fill, stroke, lw, glow) {
    const [v0, v1] = P.view; const pad = 2;
    ctx.beginPath();
    polys.forEach((poly) => { const b = poly.box; if (b[3] < -60 || b[2] < v0 - pad || b[0] > v1 + pad) return; const [ax, ay] = P.f(b[0], b[3]), [bx, by] = P.f(b[2], b[1]);
      if (by < -50 || ay > H + 50 || bx - ax < 0.6) return;
      poly.forEach(([x, y], i) => { const [px, py] = P.f(x, y); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.closePath(); });
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.save(); if (glow) { ctx.shadowColor = stroke; ctx.shadowBlur = glow; } ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore(); }
  }
  function mapScene(s, t, api) {
    const cam = camAt(s, t, api), P = project(cam);
    const lt = t - api.span[0];
    // coordinate grid (0.05° near Banda, coarser when zoomed out)
    const stepDeg = cam.zoom > 400 ? 0.05 : cam.zoom > 40 ? 1 : cam.zoom > 8 ? 5 : 30;
    ctx.save(); ctx.strokeStyle = 'rgba(201,164,92,0.07)'; ctx.lineWidth = 1;
    const lonA = Math.floor(P.view[0] / stepDeg) * stepDeg; for (let lon = lonA; lon < P.view[1]; lon += stepDeg) { const [x] = P.f(lon, 0); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let lat = -80; lat <= 80; lat += stepDeg) { const [, y] = P.f(cam.lon, lat); if (y < -2 || y > H + 2) continue; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();
    const nearJakarta = JAKARTA && cam.zoom > 450 && Math.abs(cam.lon - 106.78) < 0.5 && Math.abs(cam.lat + 6.08) < 0.35;
    const polys = nearJakarta ? JAKARTA : cam.zoom > 6 ? LAND10 : LAND50;
    // shallow-water halo near islands when zoomed in
    if (cam.zoom > 150) drawPolys(Object.values(bandaPolys), P, null, 'rgba(111,163,199,0.18)', 18 * u, 0);
    drawPolys(polys, P, TOK.land, TOK.gold, Math.max(0.8, 1.5 * u), 6 * u);
    if (cam.zoom > 60) {
      const hlOn = !s.highlightWord || t >= (api.wordAt(s.highlightWord) ?? Infinity); const hl = new Set(hlOn ? s.highlight || [] : []), colorOf = s.colors || {};
      Object.entries(bandaPolys).forEach(([id, poly]) => {
        let col = TOK.land; const c = colorOf[id];
        if (c) { const k = c.word ? ease(clamp((t - (api.wordAt(c.word) ?? t)) / 0.8)) : c.at != null ? ease(clamp((lt - c.at) / 0.8)) : 1; col = mix(TOK.land, TOK[c.color] || c.color, k); }
        if (hl.has(id)) { const pulse = 0.5 + 0.5 * Math.sin(t * 3); col = mix(col, TOK.mace, 0.75 + 0.25 * pulse); }
        drawPolys([poly], P, col, hl.has(id) ? TOK.mace : TOK.gold, (hl.has(id) ? 2.2 : 1.4) * u, hl.has(id) ? 14 * u : 5 * u);
      });
    }
    // arcs
    (s.arcs || []).forEach((a) => {
      const t0 = a.word ? (api.wordAt(a.word) ?? api.span[0]) : api.span[0] + (a.at || 0), k = ease(clamp((t - t0) / (a.dur || 1.4))); if (k <= 0) return;
      const [x0, y0] = P.f(...(PLACES[a.from] || a.from)), [x1, y1] = P.f(...(PLACES[a.to] || a.to)); const mx = (x0 + x1) / 2, my = Math.min(y0, y1) - Math.abs(x1 - x0) * 0.25;
      ctx.save(); ctx.setLineDash([10 * u, 9 * u]); ctx.lineWidth = 2.4 * u; ctx.strokeStyle = TOK[a.color] || a.color || TOK.parchment; ctx.beginPath();
      for (let i = 0; i <= 60 * k; i++) { const f = i / 60; const x = (1 - f) ** 2 * x0 + 2 * (1 - f) * f * mx + f * f * x1, y = (1 - f) ** 2 * y0 + 2 * (1 - f) * f * my + f * f * y1; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke(); ctx.restore();
    });
    // ships
    (s.ships || []).forEach((sp, i) => {
      const t0 = sp.word ? (api.wordAt(sp.word) ?? api.span[0]) : api.span[0] + (sp.at || 0), k = ease(clamp((t - t0) / (sp.dur || 3)));
      const from = PLACES[sp.from] || sp.from, to = PLACES[sp.to] || sp.to; const lon = lerp(from[0], to[0], k), lat = lerp(from[1], to[1], k);
      const [x, y] = P.f(lon, lat); const [x1] = P.f(to[0], to[1]); ship(x, y + Math.sin(t * 2 + i) * 2 * u, (sp.size || 1) * u, TOK[sp.color] || sp.color || TOK.parchment, x1 < x);
    });
    // pins + labels
    (s.pins || []).forEach((pn) => {
      const t0 = pn.word ? (api.wordAt(pn.word) ?? api.span[0]) : api.span[0] + (pn.at || 0); const e = enter(t, t0); if (e.a <= 0) return;
      const [x, y] = P.f(...(PLACES[pn.place] || pn.lonlat)); const col = TOK[pn.color] || pn.color || TOK.mace;
      ctx.save(); ctx.globalAlpha = e.a;
      const pr = (t * 1.1 + (pn.phase || 0)) % 1; ctx.strokeStyle = col; ctx.globalAlpha = e.a * (1 - pr); ctx.lineWidth = 2.5 * u; ctx.beginPath(); ctx.arc(x, y, (10 + pr * 34) * u, 0, 7); ctx.stroke();
      ctx.globalAlpha = e.a; ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 16 * u; ctx.beginPath(); ctx.arc(x, y, 8 * u, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      if (pn.label) { const side = pn.side || 1; txt(pn.label, x + side * 22 * u, y - 4 * u + e.dy, font(SERIF, 700, (pn.size || 34) * u), TOK.parchment, side > 0 ? 'left' : 'right');
        if (pn.sub) txt(pn.sub, x + side * 22 * u, y + 30 * u + e.dy, font(SANS, 500, 20 * u), TOK.dim, side > 0 ? 'left' : 'right'); }
      ctx.restore();
    });
    // floating island labels (Banda)
    (s.labels || []).forEach((lb) => {
      const t0 = lb.word ? (api.wordAt(lb.word) ?? api.span[0]) : api.span[0] + (lb.at || 0); const e = enter(t, t0); if (e.a <= 0) return;
      const [x, y] = P.f(...(PLACES[lb.place] || lb.lonlat)); ctx.save(); ctx.globalAlpha = e.a;
      txt(lb.text, x + (lb.dx || 0) * u, y + (lb.dy ?? -46) * u + e.dy, font(lb.serif === false ? SANS : SERIF, lb.serif === false ? 600 : 700, (lb.size || 30) * u), lb.color ? TOK[lb.color] || lb.color : TOK.parchment);
      ctx.restore();
    });
    if (s.counter) { const c = s.counter, k = clamp((t - api.span[0] - (c.at || 0.5)) / Math.max(1, api.span[1] - api.span[0] - (c.at || 0.5) - 0.5));
      ctx.save(); txt(Math.round(lerp(c.from || 0, c.to, E.inOutSine(k))).toLocaleString('id-ID'), W - 110 * u, H * 0.42, font(SERIF, 700, 120 * u), TOK.parchment, 'right');
      txt((c.label || 'HARI').toUpperCase(), W - 110 * u, H * 0.42 + 80 * u, font(SANS, 600, 24 * u), TOK.gold, 'right', 7 * u); ctx.restore(); }
    if (s.big) { const t0 = s.bigWord ? (api.wordAt(s.bigWord) ?? api.span[0]) : api.span[0] + (s.bigAt ?? 0.3); const e = enter(t, t0); if (e.a > 0) { ctx.save(); ctx.globalAlpha = e.a;
      txt(s.big, W / 2, H * 0.16 + e.dy, font(SERIF, 700, (s.bigSize || 96) * u), s.bigColor ? TOK[s.bigColor] : TOK.parchment); if (s.bigSub) txt(s.bigSub, W / 2, H * 0.16 + 70 * u + e.dy, font(SANS, 600, 24 * u), TOK.gold, 'center', 7 * u); ctx.restore(); } }
    // HUD: north arrow, scale bar, coordinates
    ctx.save(); ctx.globalAlpha = 0.85;
    const nx = W - 90 * u, ny = 110 * u; ctx.strokeStyle = TOK.gold; ctx.fillStyle = TOK.gold; ctx.lineWidth = 2 * u;
    ctx.beginPath(); ctx.moveTo(nx, ny - 30 * u); ctx.lineTo(nx + 10 * u, ny + 8 * u); ctx.lineTo(nx, ny); ctx.lineTo(nx - 10 * u, ny + 8 * u); ctx.closePath(); ctx.fill();
    txt('U', nx, ny + 30 * u, font(SANS, 600, 18 * u), TOK.gold);
    const kmPerPx = 111.32 * Math.cos(cam.lat * Math.PI / 180) / P.s; const nice = [1, 5, 10, 50, 100, 500, 1000, 2000, 5000].find((v) => v / kmPerPx > 90 * u) || 5000; const len = nice / kmPerPx;
    const sx = W - 70 * u - len, sy = H - 70 * u; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + len, sy); ctx.moveTo(sx, sy - 6 * u); ctx.lineTo(sx, sy + 6 * u); ctx.moveTo(sx + len, sy - 6 * u); ctx.lineTo(sx + len, sy + 6 * u); ctx.stroke();
    txt(`${nice} km`, sx + len / 2, sy - 20 * u, font(SANS, 500, 18 * u), TOK.gold);
    const ns = cam.lat < 0 ? 'LS' : 'LU', ew = cam.lon < 0 ? 'BB' : 'BT';
    txt(`${Math.abs(cam.lat).toFixed(2)}° ${ns}   ${Math.abs(cam.lon).toFixed(2)}° ${ew}`, 70 * u, H - 64 * u, font(SANS, 500, 18 * u), TOK.dim, 'left', 2 * u);
    ctx.restore();
  }
  function mix(a, b, k) { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const c = (s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k); return `rgb(${c(16)},${c(8)},${c(0)})`; }
  function ship(x, y, s, col, flip = false) {
    ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -s : s, s); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(26, 0); ctx.lineTo(18, 10); ctx.lineTo(-20, 10); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -40); ctx.stroke(); ctx.beginPath(); ctx.moveTo(2, -38); ctx.quadraticCurveTo(22, -24, 2, -8); ctx.closePath(); ctx.globalAlpha = 0.85; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-2, -32); ctx.quadraticCurveTo(-18, -22, -2, -10); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // ---- icons (flat line icons in parchment)
  const ICON = {
    makanan(s) { ctx.beginPath(); ctx.ellipse(0, 10, 46, 14, 0, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 4, 30, Math.PI, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(0, -34); ctx.stroke(); },
    obat(s) { ctx.strokeRect(-18, -20, 36, 50); ctx.strokeRect(-10, -36, 20, 16); ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 16); ctx.moveTo(-10, 6); ctx.lineTo(10, 6); ctx.stroke(); },
    wabah(s) { ctx.beginPath(); ctx.arc(0, 0, 22, 0, 7); ctx.stroke(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 22, Math.sin(a) * 22); ctx.lineTo(Math.cos(a) * 34, Math.sin(a) * 34); ctx.stroke(); ctx.beginPath(); ctx.arc(Math.cos(a) * 37, Math.sin(a) * 37, 4, 0, 7); ctx.fill(); } },
    timbangan(s) { ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(0, 30); ctx.moveTo(-20, 30); ctx.lineTo(20, 30); ctx.moveTo(-40, -22); ctx.lineTo(40, -22); ctx.stroke(); [-1, 1].forEach((d) => { ctx.beginPath(); ctx.moveTo(d * 40, -22); ctx.lineTo(d * 52, 4); ctx.lineTo(d * 28, 4); ctx.closePath(); ctx.stroke(); }); ctx.fillStyle = TOK.gold; ctx.fillRect(28, -6, 24, 8); ctx.fillStyle = '#8A5A2A'; ctx.beginPath(); ctx.arc(-40, -2, 7, 0, 7); ctx.fill(); },
    orang(s) { ctx.beginPath(); ctx.arc(0, -16, 9, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(-12, 22); ctx.lineTo(-10, -2); ctx.quadraticCurveTo(0, -8, 10, -2); ctx.lineTo(12, 22); ctx.closePath(); ctx.fill(); },
    tikus(s) { ctx.beginPath(); ctx.ellipse(0, 6, 34, 20, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(32, 0, 16, 12, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(30, -12, 7, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(-34, 8); ctx.quadraticCurveTo(-60, 20, -54, -12); ctx.stroke(); },
    kamera(s) { ctx.strokeRect(-36, -18, 72, 46); ctx.beginPath(); ctx.arc(0, 5, 14, 0, 7); ctx.stroke(); ctx.strokeRect(-14, -28, 22, 10); },
    surat(s) { ctx.strokeRect(-26, -34, 52, 68); for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-16, -18 + i * 12); ctx.lineTo(16, -18 + i * 12); ctx.stroke(); } ctx.beginPath(); ctx.arc(12, 24, 7, 0, 7); ctx.fill(); },
    kapal(s) { ctx.beginPath(); ctx.moveTo(-40, 6); ctx.lineTo(40, 6); ctx.lineTo(30, 22); ctx.lineTo(-32, 22); ctx.closePath(); ctx.stroke(); ctx.strokeRect(-20, -10, 30, 16); ctx.strokeRect(-4, -30, 10, 20); },
    benteng(s) { ctx.strokeRect(-36, -10, 72, 40); for (let i = -36; i < 36; i += 18) ctx.strokeRect(i, -22, 10, 12); ctx.beginPath(); ctx.arc(0, 30, 10, Math.PI, 0); ctx.stroke(); },
  };
  function icon(name, x, y, s, a, col = TOK.parchment) { if (a <= 0) return; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; (ICON[name] || ICON.orang)(s); ctx.restore(); }
  function nutmeg(x, y, s, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(Math.sin(t * 0.6) * 0.25);
    const g = ctx.createRadialGradient(-20, -24, 6, 0, 0, 90); g.addColorStop(0, '#9C6A42'); g.addColorStop(1, '#4A2E1A');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 70, 82, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(30,15,5,0.45)'; ctx.lineWidth = 3; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(0, 0, 70 - i * 2, 82, (i - 4) * 0.18, -1.2, 1.2); ctx.stroke(); }
    ctx.strokeStyle = TOK.mace; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.shadowColor = TOK.mace; ctx.shadowBlur = 12;
    for (let i = 0; i < 7; i++) { ctx.beginPath(); const a0 = -1.4 + i * 0.45; ctx.moveTo(Math.cos(a0) * 20, -80); ctx.bezierCurveTo(Math.cos(a0) * 90, -40 + i * 6, Math.cos(a0 + 0.6) * 85, 30, Math.cos(a0 + 0.3) * 30 * (i % 2 ? 1 : -1), 78); ctx.stroke(); }
    ctx.restore();
  }
  // ---- layouts
  function titleCard(s, t, t0) {
    const e = enter(t, t0 + 0.2); ctx.save(); ctx.globalAlpha = e.a;
    txt(s.heading, W / 2, H * 0.44 + e.dy, font(SERIF, 700, (s.size || 150) * u), TOK.parchment);
    const lk = ease(clamp((t - t0 - 0.5) / 0.8)); ctx.fillStyle = TOK.gold; ctx.fillRect(W / 2 - 140 * u * lk, H * 0.44 + 100 * u, 280 * u * lk, 3 * u);
    if (s.sub) { const e2 = enter(t, t0 + 0.7); ctx.globalAlpha = e2.a; txt(s.sub, W / 2, H * 0.44 + 160 * u + e2.dy, font(SANS, 500, 34 * u), TOK.dim); }
    ctx.restore();
  }
  function bigNumber(s, t, api) {
    const t0 = s.word ? (api.wordAt(s.word) ?? api.span[0] + 0.2) : api.span[0] + (s.at ?? 0.2);
    const e = enter(t, t0); ctx.save(); ctx.globalAlpha = e.a;
    let v = s.value;
    if (s.count) { const k = E.outCubic(clamp((t - t0) / (s.countDur || 2))); const n = Math.round(s.count * k); v = n.toLocaleString('id-ID') + (s.suffix || ''); }
    txt(v, W / 2, H * 0.42 + e.dy, font(SERIF, 700, (s.size || 220) * u), s.color ? TOK[s.color] || s.color : TOK.parchment);
    if (s.label) { const e2 = enter(t, t0 + 0.35); ctx.globalAlpha = e2.a; txt(s.label.toUpperCase(), W / 2, H * 0.42 + 150 * u + e2.dy, font(SANS, 600, 30 * u), TOK.gold, 'center', 0.3 * 30 * u); }
    if (s.tagline) { const t2 = s.lineWord ? (api.wordAt(s.lineWord) ?? t0 + 0.8) : t0 + 0.8; const e3 = enter(t, t2); ctx.globalAlpha = e3.a; txt(s.tagline, W / 2, H * 0.42 + 220 * u + e3.dy, font(SERIF, 600, 40 * u, true), s.lineColor ? TOK[s.lineColor] : TOK.parchment); }
    if (s.note) { ctx.globalAlpha = e.a * 0.9; txt(s.note, W / 2, H - 120 * u, font(SANS, 500, 22 * u), TOK.dim); }
    ctx.restore();
    (s.dots ? [s.dots] : []).forEach((n) => { for (let i = 0; i < n; i++) { const k = clamp((t - t0 - 0.3 - i * 0.03) / 0.3); icon('orang', W / 2 - (13 * 50 * u) / 2 + (i % 13) * 50 * u, H * 0.78 + Math.floor(i / 13) * 56 * u - 40 * u, 0.9 * u, k, i < (s.dotsHi || 0) ? TOK.mace : TOK.parchment); } });
  }
  function compare(s, t, api) {
    const t0 = api.span[0]; const L = s.left, R = s.right;
    [[L, W * 0.27, TOK.mace], [R, W * 0.73, TOK.atlantic]].forEach(([side, x, col], i) => {
      const e = enter(t, t0 + 0.2 + i * 0.3); ctx.save(); ctx.globalAlpha = e.a;
      ctx.strokeStyle = col; ctx.lineWidth = 2 * u; ctx.strokeRect(x - 330 * u, H * 0.22 + e.dy, 660 * u, H * 0.56);
      txt(side.title, x, H * 0.42 + e.dy, font(SERIF, 700, 96 * u), TOK.parchment);
      txt((side.label || '').toUpperCase(), x, H * 0.31 + e.dy, font(SANS, 600, 24 * u), col, 'center', 7 * u);
      if (side.sub) txt(side.sub, x, H * 0.56 + e.dy, font(SERIF, 600, 34 * u, true), col);
      if (side.sub2) txt(side.sub2, x, H * 0.64 + e.dy, font(SANS, 500, 24 * u), TOK.dim);
      ctx.restore();
    });
    if (s.noSign) return;
    // middle sign: swap arrows, optionally cracking into a question mark
    const crackT = s.crackWord ? api.wordAt(s.crackWord) : (s.crack ? t0 + s.crack : null);
    const ck = crackT != null ? ease(clamp((t - crackT) / 0.8)) : 0; const cx = W / 2, cy = H / 2, e = enter(t, t0 + 0.7);
    ctx.save(); ctx.globalAlpha = e.a * (1 - ck); ctx.strokeStyle = TOK.gold; ctx.fillStyle = TOK.gold; ctx.lineWidth = 4 * u;
    [[-1, -16], [1, 16]].forEach(([d, oy]) => { ctx.beginPath(); ctx.moveTo(cx - d * 46 * u, cy + oy * u); ctx.lineTo(cx + d * 46 * u, cy + oy * u); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + d * 46 * u, cy + oy * u); ctx.lineTo(cx + d * 30 * u, cy + (oy - 10) * u); ctx.lineTo(cx + d * 30 * u, cy + (oy + 10) * u); ctx.fill(); });
    ctx.restore();
    if (ck > 0) { ctx.save(); ctx.globalAlpha = ck; txt('?', cx, cy, font(SERIF, 700, 140 * u), TOK.gold); if (s.crackText) txt(s.crackText, cx, H * 0.86, font(SERIF, 600, 44 * u, true), TOK.parchment); ctx.restore(); }
  }
  function statement(s, t, api) {         // big serif line, then a sans line (e.g. "Bukan pertukaran." / "Pengakuan.")
    const t0 = api.span[0] + 0.2; const e = enter(t, t0); ctx.save(); ctx.globalAlpha = e.a;
    txt(s.big, W / 2, H * 0.43 + e.dy, font(SERIF, 700, (s.size || 120) * u), TOK.parchment);
    if (s.small) { const t2 = s.smallWord ? (api.wordAt(s.smallWord) ?? t0 + 1) : t0 + (s.smallAt ?? 1); const e2 = enter(t, t2); ctx.globalAlpha = e2.a; txt(s.small, W / 2, H * 0.43 + 130 * u + e2.dy, font(SANS, 800, 60 * u), s.smallColor ? TOK[s.smallColor] : TOK.mace, 'center', 6 * u); }
    if (s.note) { ctx.globalAlpha = e.a; txt(s.note, W / 2, H - 120 * u, font(SANS, 500, 22 * u), TOK.dim); }
    ctx.restore();
  }
  function lowerThird(s, t, api) {
    if (!s.lower) return; const t0 = s.lower.word ? (api.wordAt(s.lower.word) ?? api.span[0]) : api.span[0] + (s.lower.at ?? 0.5); const e = enter(t, t0); if (e.a <= 0) return;
    ctx.save(); ctx.globalAlpha = e.a; const x = 110 * u, y = H - 210 * u;
    ctx.fillStyle = TOK.mace; ctx.fillRect(x, y - 44 * u, 5 * u, 96 * u);
    txt(s.lower.name, x + 28 * u, y - 10 * u + e.dy, font(SERIF, 700, 52 * u), TOK.parchment, 'left');
    if (s.lower.sub) txt(s.lower.sub, x + 28 * u, y + 34 * u + e.dy, font(SANS, 500, 24 * u), TOK.dim, 'left');
    ctx.restore();
  }
  function iconRow(s, t, api) {
    const items = s.icons || []; const gap = 300 * u, x0 = W / 2 - (items.length - 1) * gap / 2;
    items.forEach((it, i) => { const t0 = it.word ? (api.wordAt(it.word) ?? api.span[0] + i) : api.span[0] + 0.3 + i * 0.8; const e = enter(t, t0);
      icon(it.icon, x0 + i * gap, H * 0.45 + e.dy, 1.8 * u, e.a, it.color ? TOK[it.color] : TOK.parchment);
      ctx.save(); ctx.globalAlpha = e.a; txt((it.label || '').toUpperCase(), x0 + i * gap, H * 0.45 + 130 * u + e.dy, font(SANS, 600, 24 * u), TOK.gold, 'center', 6 * u); ctx.restore(); });
  }
  function nutmegScene(s, t, api) {
    const e = enter(t, api.span[0] + 0.2); ctx.save(); ctx.globalAlpha = e.a; nutmeg(W / 2, H * 0.47, 2.2 * u, t); ctx.restore();
    [['PALA', -1, s.w1 || 'pala'], ['FULI', 1, s.w2 || 'fuli']].forEach(([lbl, d, w]) => { const t0 = api.wordAt(w) ?? api.span[0] + 1; const e2 = enter(t, t0); ctx.save(); ctx.globalAlpha = e2.a;
      const x = W / 2 + d * 340 * u, y = H * 0.47; ctx.strokeStyle = d < 0 ? TOK.parchment : TOK.mace; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(W / 2 + d * 180 * u, y + (d < 0 ? 40 : -60) * u); ctx.lineTo(x - d * 30 * u, y); ctx.stroke();
      txt(lbl, x, y + e2.dy, font(SERIF, 700, 64 * u), d < 0 ? TOK.parchment : TOK.mace, d < 0 ? 'right' : 'left'); ctx.restore(); });
  }
  function streetSign(s, t, api) {
    const e = enter(t, api.span[0] + 0.3); ctx.save(); ctx.globalAlpha = e.a; const cx = W / 2, cy = H * 0.45 + e.dy;
    ctx.fillStyle = '#5A5F66'; ctx.fillRect(cx - 10 * u, cy, 20 * u, 420 * u);
    ctx.fillStyle = '#1F5E3A'; ctx.beginPath(); ctx.roundRect(cx - 420 * u, cy - 90 * u, 840 * u, 180 * u, 18 * u); ctx.fill();
    ctx.strokeStyle = TOK.parchment; ctx.lineWidth = 6 * u; ctx.beginPath(); ctx.roundRect(cx - 400 * u, cy - 72 * u, 800 * u, 144 * u, 12 * u); ctx.stroke();
    txt(s.text || 'JALAN MANHATTAN', cx, cy + 4 * u, font(SANS, 800, 72 * u), TOK.parchment, 'center', 4 * u);
    ctx.restore();
  }
  function oldMap(s, t, api) {   // archive substitute: Banda drawn as an aged chart, gold frame, slow zoom
    const k = clamp((t - api.span[0]) / Math.max(1, api.span[1] - api.span[0])); const z = 1 + 0.08 * k;
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
    ctx.fillStyle = '#CDB98F'; ctx.fillRect(W * 0.14, H * 0.1, W * 0.72, H * 0.8);
    const g = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.5); g.addColorStop(0, 'rgba(255,240,200,0.35)'); g.addColorStop(1, 'rgba(90,60,25,0.45)'); ctx.fillStyle = g; ctx.fillRect(W * 0.14, H * 0.1, W * 0.72, H * 0.8);
    const P = project({ lon: 129.84, lat: -4.53, zoom: 4200 * (W / 1920) / (W / 360) * 0.36 });
    ctx.save(); ctx.beginPath(); ctx.rect(W * 0.14, H * 0.1, W * 0.72, H * 0.8); ctx.clip();
    drawPolys(Object.values(bandaPolys), P, 'rgba(120,90,50,0.35)', '#5A4020', 2 * u, 0);
    ctx.strokeStyle = 'rgba(90,64,32,0.25)'; for (let i = 0; i < 16; i++) { ctx.beginPath(); const a = i / 16 * Math.PI * 2; ctx.moveTo(W / 2, H / 2); ctx.lineTo(W / 2 + Math.cos(a) * W, H / 2 + Math.sin(a) * W); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = TOK.gold; ctx.lineWidth = 3 * u; ctx.strokeRect(W * 0.14, H * 0.1, W * 0.72, H * 0.8); ctx.strokeRect(W * 0.14 + 12 * u, H * 0.1 + 12 * u, W * 0.72 - 24 * u, H * 0.8 - 24 * u);
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = 'rgba(128,128,128,0.35)'; ctx.fillRect(0, 0, W, H); ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, W, H);
    if (s.caption) txt(s.caption, W / 2, H - 50 * u, font(SANS, 500, 20 * u), TOK.dim);
  }
  function quiet(s, t, api) { const e = enter(t, api.span[0] + 0.6); ctx.save(); ctx.globalAlpha = e.a * 0.9; txt(s.text || '', W / 2, H / 2, font(SERIF, 600, 40 * u, true), TOK.dim); ctx.restore(); }
  function endScreen(s, t, api) {
    const e = enter(t, api.span[0] + 0.3); ctx.save(); ctx.globalAlpha = e.a;
    [-1, 1].forEach((d) => { ctx.strokeStyle = TOK.gold; ctx.lineWidth = 2 * u; ctx.strokeRect(W / 2 + d * 420 * u - 360 * u, H * 0.3, 720 * u, 405 * u); txt(d < 0 ? 'VIDEO BERIKUTNYA' : 'PLAYLIST', W / 2 + d * 420 * u, H * 0.3 + 202 * u, font(SANS, 600, 26 * u), TOK.dim, 'center', 6 * u); });
    ctx.fillStyle = TOK.mace; ctx.beginPath(); ctx.roundRect(W / 2 - 170 * u, H * 0.78, 340 * u, 76 * u, 38 * u); ctx.fill(); txt('SUBSCRIBE', W / 2, H * 0.78 + 40 * u, font(SANS, 800, 30 * u), TOK.parchment, 'center', 4 * u);
    ctx.restore();
  }
  // ---------------------------------------------------------------- more scene kinds (illustrations)
  // ambient: a faint drifting map behind text-only layouts so nothing sits on a flat backdrop
  function ambient(s, t, api) {
    const k = (t - api.span[0]);
    const where = s.ambient === 'banda' ? { lon: 129.84 + Math.sin(k * 0.05) * 0.02, lat: -4.53, zoom: 520 + k * 6 } : s.ambient === 'atlantic' ? { lon: -40 + k * 0.4, lat: 30, zoom: 1.6 } : { lon: 95 + k * 0.5, lat: 5, zoom: 1.5 + k * 0.004 };
    const P = project(where); ctx.save(); ctx.globalAlpha = 0.16;
    drawPolys(s.ambient === 'banda' ? Object.values(bandaPolys) : LAND50, P, null, TOK.gold, 1.2 * u, 0); ctx.restore();
  }
  function sea(t, horizon, speed = 1) {
    const g = ctx.createLinearGradient(0, horizon, 0, H); g.addColorStop(0, '#16313F'); g.addColorStop(1, '#0B1820'); ctx.fillStyle = g; ctx.fillRect(0, horizon, W, H - horizon);
    for (let layer = 0; layer < 7; layer++) {
      const y0 = horizon + (layer + 1) * (H - horizon) / 8, amp = (3 + layer * 2.2) * u, len = (120 + layer * 60) * u, off = (t * (20 + layer * 14) * speed * u) % len;
      ctx.strokeStyle = `rgba(201,164,92,${0.08 + layer * 0.035})`; ctx.lineWidth = (1 + layer * 0.35) * u; ctx.beginPath();
      for (let x = -len; x < W + len; x += 8 * u) { const y = y0 + Math.sin((x + off) / len * Math.PI * 2) * amp; x === -len ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }
  const FLAG = { nl: ['#AE1C28', '#FFFFFF', '#21468B'], en: null, pt: ['#046A38', '#DA291C'] };
  function flagRect(x, y, w, h, kind, wave = 0) {
    ctx.save(); ctx.translate(x, y);
    const path = () => { ctx.beginPath(); ctx.moveTo(0, 0); for (let i = 0; i <= 10; i++) ctx.lineTo(w * i / 10, Math.sin(i * 0.7 + wave) * h * 0.06); for (let i = 10; i >= 0; i--) ctx.lineTo(w * i / 10, h + Math.sin(i * 0.7 + wave) * h * 0.06); ctx.closePath(); };
    path(); ctx.clip();
    if (kind === 'en') { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(-5, -5, w + 10, h + 10); ctx.fillStyle = '#C8102E'; ctx.fillRect(w * 0.4, -5, w * 0.2, h + 10); ctx.fillRect(-5, h * 0.38, w + 10, h * 0.24); }
    else if (kind === 'nl') { FLAG.nl.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(-5, -5 + i * h / 3, w + 10, h / 3 + 6); }); }
    else if (kind === 'jp') { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(-5, -5, w + 10, h + 10); ctx.fillStyle = '#BC002D'; ctx.beginPath(); ctx.arc(w / 2, h / 2, h * 0.3, 0, 7); ctx.fill(); }
    else if (kind === 'pt') { ctx.fillStyle = FLAG.pt[0]; ctx.fillRect(-5, -5, w * 0.4, h + 10); ctx.fillStyle = FLAG.pt[1]; ctx.fillRect(w * 0.4, -5, w, h + 10); }
    else { ctx.fillStyle = kind || TOK.parchment; ctx.fillRect(-5, -5, w + 10, h + 10); }
    ctx.restore();
  }
  function galleon(x, y, s, t, flag, phase = 0) {
    ctx.save(); ctx.translate(x, y + Math.sin(t * 1.4 + phase) * 5 * s); ctx.rotate(Math.sin(t * 1.1 + phase) * 0.025); ctx.scale(s, s);
    ctx.fillStyle = '#2A1E16'; ctx.strokeStyle = TOK.gold; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-170, -10); ctx.lineTo(150, -10); ctx.quadraticCurveTo(190, -30, 200, -60); ctx.lineTo(210, -60); ctx.quadraticCurveTo(200, 30, 120, 50); ctx.lineTo(-130, 50); ctx.quadraticCurveTo(-180, 30, -190, -40); ctx.lineTo(-170, -40); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(201,164,92,0.5)'; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-110 + i * 45, 18, 6, 0, 7); ctx.stroke(); }
    [-90, 10, 110].forEach((mx, i) => {
      const h = [230, 290, 200][i]; ctx.strokeStyle = '#4A3626'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(mx, -10); ctx.lineTo(mx, -10 - h); ctx.stroke();
      [0, 1].forEach((k) => { const top = -10 - h + 20 + k * h * 0.42, bh = h * 0.36, bw = 120 - k * 10, billow = 14 + Math.sin(t * 2 + i + k) * 4;
        ctx.fillStyle = '#E8DDC4'; ctx.strokeStyle = 'rgba(58,34,20,0.6)'; ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(mx - bw / 2, top); ctx.quadraticCurveTo(mx, top + 8, mx + bw / 2, top); ctx.quadraticCurveTo(mx + bw / 2 + billow, top + bh / 2, mx + bw / 2, top + bh); ctx.quadraticCurveTo(mx, top + bh + 10, mx - bw / 2, top + bh); ctx.quadraticCurveTo(mx - bw / 2 + billow, top + bh / 2, mx - bw / 2, top); ctx.fill(); ctx.stroke(); });
      if (i === 1 && flag) flagRect(mx + 4, -10 - h - 4, 70, 44, flag, t * 4 + phase);
    });
    ctx.restore();
  }
  function shipScene(s, t, api) {
    const hz = H * 0.62; ctx.fillStyle = 'rgba(201,164,92,0.05)'; ctx.fillRect(0, 0, W, hz);
    const lt = t - api.span[0], len = Math.max(3, api.span[1] - api.span[0]);
    (s.ships || [{ flag: s.flag || 'en' }]).forEach((sp, i) => {
      const k = clamp((lt - (sp.at || i * 0.6)) / (len * 0.95)); const x = lerp(sp.fromX ?? -0.25, sp.toX ?? 0.6, E.outCubic(k)) * W + i * 60 * u; const sc = (sp.scale || 1) * u * (1 - i * 0.18);
      galleon(x, hz + (40 + i * -30) * u, sc, t, sp.flag, i * 1.7);
    });
    sea(t, hz + 10 * u, s.speed || 1);
    if (s.label) { const e = enter(t, api.span[0] + 0.5); ctx.save(); ctx.globalAlpha = e.a; txt(s.label, W / 2, H * 0.16 + e.dy, font(SERIF, 700, 72 * u), TOK.parchment); if (s.labelSub) txt(s.labelSub, W / 2, H * 0.16 + 66 * u + e.dy, font(SANS, 600, 24 * u), TOK.gold, 'center', 7 * u); ctx.restore(); }
  }
  function fortScene(s, t, api) {
    const lt = t - api.span[0], hz = H * 0.68; sea(t, hz, 0.6);
    ctx.fillStyle = '#1C2620'; ctx.beginPath(); ctx.moveTo(W * 0.12, hz + 6); ctx.quadraticCurveTo(W * 0.5, hz - 160 * u, W * 0.88, hz + 6); ctx.closePath(); ctx.fill();
    const k = E.inOutCubic(clamp(lt / 3.5)); const cx = W / 2, by = hz - 90 * u;
    const P = [[-300, 0], [-300, -150], [-230, -150], [-230, -190], [-160, -190], [-160, -150], [-60, -150], [-60, -230], [60, -230], [60, -150], [160, -150], [160, -190], [230, -190], [230, -150], [300, -150], [300, 0]];
    let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    ctx.save(); ctx.translate(cx, by); ctx.scale(u, u); ctx.strokeStyle = TOK.gold; ctx.lineWidth = 4; ctx.setLineDash([L * k, L]); ctx.fillStyle = `rgba(40,48,44,${0.9 * k})`;
    ctx.beginPath(); P.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    if (k > 0.9) { ctx.strokeStyle = 'rgba(201,164,92,0.25)'; ctx.lineWidth = 1.5; for (let y = -140; y < 0; y += 28) { ctx.beginPath(); ctx.moveTo(-290, y); ctx.lineTo(290, y); ctx.stroke(); } }
    const ct = s.cannonWord ? (api.wordAt(s.cannonWord) ?? api.span[0] + 2) - api.span[0] : 2.5;
    [-200, -100, 100, 200].forEach((x, i) => { const ck = E.outBack(clamp((lt - ct - i * 0.15) / 0.5), 1.4); if (ck <= 0) return; ctx.save(); ctx.translate(x, -150); ctx.scale(ck, ck); ctx.fillStyle = '#111'; ctx.fillRect(-6, -18, 46, 14); ctx.beginPath(); ctx.arc(0, -8, 10, 0, 7); ctx.fill(); ctx.restore(); });
    if (s.flag) { ctx.strokeStyle = '#4A3626'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, -230); ctx.lineTo(0, -330); ctx.stroke(); if (k > 0.6) flagRect(3, -330, 80, 50, s.flag, t * 3); }
    ctx.restore();
    if (s.label) { const e = enter(t, api.span[0] + 0.6); ctx.save(); ctx.globalAlpha = e.a; txt(s.label, W / 2, H * 0.16 + e.dy, font(SERIF, 700, 72 * u), TOK.parchment); if (s.labelSub) txt(s.labelSub, W / 2, H * 0.16 + 66 * u + e.dy, font(SANS, 600, 24 * u), TOK.gold, 'center', 7 * u); ctx.restore(); }
  }
  function kebunScene(s, t, api) {
    const lt = t - api.span[0]; const rows = 6, cols = 11;
    const gx = W * 0.12, gy = H * 0.34, gw = W * 0.76, gh = H * 0.5;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, k = E.outBack(clamp((lt - 0.3 - i * 0.035) / 0.5), 1.6); if (k <= 0) continue;
      const x = gx + (c + 0.5) * gw / cols + (r % 2) * 12 * u, y = gy + (r + 0.5) * gh / rows, rr = 26 * u * k * (0.9 + 0.2 * M.hash01(i, 3));
      ctx.fillStyle = '#2F5A36'; ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(201,164,92,0.5)'; ctx.lineWidth = 1.5 * u; ctx.stroke();
      if (M.hash01(i, 9) > 0.5) { ctx.fillStyle = TOK.mace; ctx.beginPath(); ctx.arc(x + rr * 0.35, y - rr * 0.2, 4 * u * k, 0, 7); ctx.fill(); }
    }
    const fk = clamp((lt - 1.5) / 2); if (fk > 0) { ctx.save(); ctx.strokeStyle = TOK.gold; ctx.lineWidth = 2.5 * u; ctx.setLineDash([12 * u, 8 * u]);
      [[0, 0, 0.5, 0.5], [0.5, 0, 1, 0.5], [0, 0.5, 0.33, 1], [0.33, 0.5, 0.66, 1], [0.66, 0.5, 1, 1]].forEach(([a, b, c2, d2], i) => { const kk = clamp(fk * 5 - i); if (kk <= 0) return; ctx.globalAlpha = kk; ctx.strokeRect(gx + a * gw, gy + b * gh, (c2 - a) * gw, (d2 - b) * gh); });
      ctx.restore(); }
    if (s.label) { const e = enter(t, api.span[0] + 0.4); ctx.save(); ctx.globalAlpha = e.a; txt(s.label, W / 2, H * 0.17 + e.dy, font(SERIF, 700, 72 * u), TOK.parchment); if (s.labelSub) txt(s.labelSub, W / 2, H * 0.17 + 64 * u + e.dy, font(SANS, 600, 24 * u), TOK.gold, 'center', 7 * u); ctx.restore(); }
  }
  function silhouette(s, t, api) {
    const lt = t - api.span[0], z = 1 + 0.06 * clamp(lt / 8); const cx = W * (s.x ?? 0.34), cy = H * 0.5;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(z * u, z * u);
    ctx.strokeStyle = TOK.gold; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, 0, 230, 300, 0, 0, 7); ctx.stroke(); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, 0, 244, 314, 0, 0, 7); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 226, 296, 0, 0, 7); ctx.clip();
    const g = ctx.createRadialGradient(0, -60, 20, 0, 0, 320); g.addColorStop(0, '#2C3A44'); g.addColorStop(1, '#10171D'); ctx.fillStyle = g; ctx.fillRect(-240, -310, 480, 620);
    ctx.fillStyle = '#05080B';
    ctx.beginPath(); ctx.ellipse(0, -60, 70, 88, 0, 0, 7); ctx.fill();                                   // head
    if (s.hat === 'peci') { ctx.beginPath(); ctx.moveTo(-66, -110); ctx.lineTo(-60, -170); ctx.quadraticCurveTo(0, -180, 60, -170); ctx.lineTo(66, -110); ctx.closePath(); ctx.fill(); }
    else { ctx.beginPath(); ctx.ellipse(0, -138, 150, 26, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(-70, -140); ctx.quadraticCurveTo(0, -260, 80, -140); ctx.fill(); }   // hat
    ctx.beginPath(); ctx.moveTo(-200, 300); ctx.quadraticCurveTo(-190, 60, -40, 20); ctx.lineTo(40, 20); ctx.quadraticCurveTo(190, 60, 200, 300); ctx.closePath(); ctx.fill();   // coat
    ctx.fillStyle = '#E8DDC4'; ctx.beginPath(); ctx.moveTo(-40, 24); ctx.lineTo(0, 90); ctx.lineTo(40, 24); ctx.closePath(); ctx.fill();   // collar
    ctx.restore(); ctx.restore();
    const e = enter(t, api.span[0] + 0.5); ctx.save(); ctx.globalAlpha = e.a; const tx = W * 0.6;
    txt(s.name || '', tx, H * 0.44 + e.dy, font(SERIF, 700, 76 * u), TOK.parchment, 'left');
    txt((s.role || '').toUpperCase(), tx, H * 0.44 + 70 * u + e.dy, font(SANS, 600, 24 * u), TOK.gold, 'left', 7 * u);
    if (s.note) txt(s.note, tx, H * 0.44 + 120 * u + e.dy, font(SANS, 500, 20 * u), TOK.dim, 'left');
    ctx.restore();
  }
  function calendar(s, t, api) {
    const lt = t - api.span[0], len = Math.max(2, api.span[1] - api.span[0] - 0.5); const k = E.inOutSine(clamp((lt - 0.4) / len));
    const v = Math.round(lerp(s.from || 1, s.to || 1400, k)); const cx = W / 2, cy = H * 0.48;
    for (let i = 3; i >= 0; i--) { ctx.save(); ctx.translate(cx + i * 10 * u, cy + i * 10 * u); ctx.fillStyle = i ? '#1E262E' : '#ECE2CC'; ctx.beginPath(); ctx.roundRect(-230 * u, -250 * u, 460 * u, 500 * u, 18 * u); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = TOK.mace; ctx.beginPath(); ctx.roundRect(cx - 230 * u, cy - 250 * u, 460 * u, 110 * u, [18 * u, 18 * u, 0, 0]); ctx.fill();
    txt((s.head || 'HARI KE-').toUpperCase(), cx, cy - 195 * u, font(SANS, 800, 40 * u), TOK.parchment, 'center', 8 * u);
    const flip = (lt * 12) % 1; ctx.save(); ctx.globalAlpha = 0.85 + 0.15 * flip; txt(v.toLocaleString('id-ID'), cx, cy + 40 * u, font(SERIF, 700, 160 * u), '#1A1A1A'); ctx.restore();
    if (s.label) txt(s.label, cx, cy + 190 * u, font(SANS, 600, 17 * u), '#5A5046', 'center', 2 * u);
    [-120, 120].forEach((dx) => { ctx.fillStyle = '#5A4632'; ctx.beginPath(); ctx.roundRect(cx + dx * u - 12 * u, cy - 270 * u, 24 * u, 50 * u, 8 * u); ctx.fill(); });
  }
  function scroll(s, t, api) {
    const lt = t - api.span[0]; const k = E.inOutCubic(clamp((lt - 0.2) / 1.6)); const cx = W / 2, cy = H * 0.5, w = 820 * u, h = 640 * u * k + 40 * u;
    ctx.save(); ctx.fillStyle = '#D9C9A3'; ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
    const g = ctx.createRadialGradient(cx, cy, 100 * u, cx, cy, w * 0.7); g.addColorStop(0, 'rgba(255,245,220,0.3)'); g.addColorStop(1, 'rgba(110,80,40,0.35)'); ctx.fillStyle = g; ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
    [-1, 1].forEach((d2) => { ctx.fillStyle = '#8A6A44'; ctx.beginPath(); ctx.roundRect(cx - w / 2 - 20 * u, cy + d2 * h / 2 - 22 * u, w + 40 * u, 44 * u, 22 * u); ctx.fill(); });
    if (k > 0.85) {
      txt(s.heading || '', cx, cy - 210 * u, font(SERIF, 700, 58 * u), '#3A2414');
      if (s.sub) txt(s.sub, cx, cy - 150 * u, font(SERIF, 600, 32 * u, true), '#5A4030');
      for (let i = 0; i < 7; i++) { const lk = clamp((lt - 1.8 - i * 0.35) / 0.5); if (lk <= 0) continue; const lw2 = (560 - (i % 3) * 70) * u * lk; ctx.strokeStyle = 'rgba(58,36,20,0.55)'; ctx.lineWidth = 4 * u; ctx.beginPath(); ctx.moveTo(cx - 290 * u, cy - 80 * u + i * 42 * u); for (let x = 0; x < lw2; x += 10 * u) ctx.lineTo(cx - 290 * u + x, cy - 80 * u + i * 42 * u + Math.sin(x * 0.08 + i) * 2 * u); ctx.stroke(); }
      const st = s.sealWord ? (api.wordAt(s.sealWord) ?? api.span[0] + 4) : api.span[0] + 4; const sk = E.outBack(clamp((t - st) / 0.35), 2.2);
      if (sk > 0) { ctx.save(); ctx.translate(cx + 250 * u, cy + 200 * u); ctx.scale(sk, sk); ctx.fillStyle = '#9E1F1F'; ctx.beginPath(); for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, r = (i % 2 ? 56 : 62) * u; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); txt(s.seal || '1667', 0, 2 * u, font(SERIF, 700, 30 * u), '#E8C9A0'); ctx.restore(); }
    }
    ctx.restore();
  }
  function chain(s, t, api) {
    const nodes = s.nodes || []; const n = nodes.length, x0 = W * 0.1, x1 = W * 0.9, base = H * 0.72;
    nodes.forEach((nd, i) => {
      const t0 = nd.word ? (api.wordAt(nd.word) ?? api.span[0] + 0.5 + i) : api.span[0] + 0.4 + i * 0.9; const e = enter(t, t0); if (e.a <= 0) return;
      const x = x0 + (x1 - x0) * i / Math.max(1, n - 1), bh = (40 + Math.pow(i + 1, 1.7) * 26) * u * E.outCubic(clamp((t - t0) / 0.8));
      ctx.save(); ctx.globalAlpha = e.a;
      if (i) { ctx.strokeStyle = 'rgba(201,164,92,0.6)'; ctx.lineWidth = 2 * u; ctx.setLineDash([8 * u, 8 * u]); ctx.beginPath(); ctx.moveTo(x0 + (x1 - x0) * (i - 1) / (n - 1) + 40 * u, base + 40 * u); ctx.lineTo(x - 40 * u, base + 40 * u); ctx.stroke(); ctx.setLineDash([]); }
      for (let c = 0; c < Math.round(bh / (14 * u)); c++) { ctx.fillStyle = c % 2 ? '#C9A45C' : '#B08D48'; ctx.beginPath(); ctx.ellipse(x, base - c * 14 * u, 34 * u, 9 * u, 0, 0, 7); ctx.fill(); }
      txt(nd.name, x, base + 44 * u + e.dy, font(SERIF, 700, 34 * u), i === 0 ? TOK.mace : TOK.parchment);
      if (nd.sub) txt(nd.sub, x, base + 84 * u + e.dy, font(SANS, 500, 20 * u), TOK.dim);
      ctx.restore();
    });
    if (s.label) { const e = enter(t, api.span[0] + 0.3); ctx.save(); ctx.globalAlpha = e.a; txt(s.label, W / 2, H * 0.17 + e.dy, font(SERIF, 700, 64 * u), TOK.parchment); ctx.restore(); }
  }
  function flagSwap(s, t, api) {
    const lt = t - api.span[0]; const sw = s.swapWord ? (api.wordAt(s.swapWord) ?? api.span[0] + 3) - api.span[0] : 3;
    const cx = W * 0.5, top = H * 0.2, pole = H * 0.62;
    ctx.fillStyle = '#5A5F66'; ctx.fillRect(cx - 6 * u, top, 12 * u, pole);
    const down = clamp((lt - sw) / 1.0), up = clamp((lt - sw - 1.1) / 1.2);
    const fy = up > 0 ? lerp(top + pole - 160 * u, top + 6 * u, E.outCubic(up)) : lerp(top + 6 * u, top + pole - 160 * u, E.inCubic(down));
    flagRect(cx + 6 * u, fy, 260 * u, 160 * u, up > 0 ? s.to : s.from, t * 3);
    if (s.label) { const e = enter(t, api.span[0] + 0.3); ctx.save(); ctx.globalAlpha = e.a; txt(s.label, W / 2, H * 0.12 + e.dy, font(SERIF, 700, 64 * u), TOK.parchment); ctx.restore(); }
    sea(t, H * 0.82, 0.5);
  }
  function dotsScene(s, t, api) {          // a population shown as dots that fade (abstract, no imagery)
    const lt = t - api.span[0]; const n = s.n || 150, keep = s.keep || 10, cols = 25; const fadeT = s.fadeWord ? (api.wordAt(s.fadeWord) ?? api.span[0] + 3) - api.span[0] : 3;
    for (let i = 0; i < n; i++) { const r = Math.floor(i / cols), c = i % cols; const appear = clamp((lt - 0.2 - i * 0.008) / 0.3); const stay = M.hash01(i, 17) < keep / n;
      const fade = stay ? 1 : 1 - clamp((lt - fadeT - M.hash01(i, 5) * 2) / 0.8); const a = appear * (0.15 + 0.85 * fade); if (a <= 0) continue;
      ctx.globalAlpha = a; ctx.fillStyle = stay ? TOK.parchment : TOK.dim; ctx.beginPath(); ctx.arc(W / 2 + (c - (cols - 1) / 2) * 52 * u, H * 0.32 + r * 52 * u, 13 * u, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (s.label) { const e = enter(t, api.span[0] + 0.3); ctx.save(); ctx.globalAlpha = e.a; txt(s.label, W / 2, H * 0.17 + e.dy, font(SERIF, 600, 46 * u, true), TOK.parchment); ctx.restore(); }
  }
  // ---- Onrust additions: steamship, barracks, graves, prison bars, ruins
  function steamer(x, y, s, t, phase = 0) {
    ctx.save(); ctx.translate(x, y + Math.sin(t * 1.2 + phase) * 4 * s); ctx.rotate(Math.sin(t * 0.9 + phase) * 0.015); ctx.scale(s, s);
    ctx.fillStyle = '#20262C'; ctx.strokeStyle = TOK.gold; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-230, -20); ctx.lineTo(230, -20); ctx.lineTo(205, 40); ctx.lineTo(-200, 40); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#E8DDC4'; ctx.fillRect(-150, -70, 260, 50); ctx.strokeRect(-150, -70, 260, 50);
    ctx.fillStyle = '#20262C'; for (let i = 0; i < 9; i++) ctx.fillRect(-138 + i * 28, -58, 14, 14);
    ctx.fillStyle = '#2A1E16'; ctx.fillRect(-30, -150, 46, 80); ctx.fillStyle = TOK.mace; ctx.fillRect(-30, -150, 46, 14);
    for (let i = 0; i < 6; i++) { const k = ((t * 0.4 + i / 6) % 1); ctx.fillStyle = `rgba(200,200,200,${0.35 * (1 - k)})`; ctx.beginPath(); ctx.arc(-8 - k * 160, -165 - k * 90, 18 + k * 40, 0, 7); ctx.fill(); }
    ctx.strokeStyle = 'rgba(201,164,92,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-200, -20); ctx.lineTo(-200, -130); ctx.moveTo(180, -20); ctx.lineTo(180, -120); ctx.stroke();
    ctx.restore();
  }
  function steamScene(s, t, api) {
    const hz = H * 0.62, lt = t - api.span[0], len = Math.max(3, api.span[1] - api.span[0]);
    if (s.coast) { ctx.fillStyle = '#1A2420'; ctx.beginPath(); ctx.moveTo(W * 0.55, hz + 4); for (let x = W * 0.55; x <= W; x += 30) ctx.lineTo(x, hz - 30 * u - Math.sin(x * 0.01) * 14 * u); ctx.lineTo(W, hz + 4); ctx.fill(); }
    const k = E.inOutSine(clamp(lt / (len * 0.95))); const x = lerp(s.fromX ?? -0.2, s.toX ?? 0.45, k) * W;
    steamer(x, hz + 20 * u, (s.scale || 1) * u, t);
    sea(t, hz + 10 * u, 0.8);
    if (s.label) { const e = enter(t, api.span[0] + 0.5); ctx.save(); ctx.globalAlpha = e.a; txt(s.label, W / 2, H * 0.16 + e.dy, font(SERIF, 700, 72 * u), TOK.parchment); if (s.labelSub) txt(s.labelSub, W / 2, H * 0.16 + 66 * u + e.dy, font(SANS, 600, 24 * u), TOK.gold, 'center', 7 * u); ctx.restore(); }
  }
  function barakScene(s, t, api) {
    const lt = t - api.span[0], n = s.n || 35, cols = 7, bw = 150 * u, bh = 64 * u, gx = W / 2 - (cols * bw * 1.25) / 2, gy = H * 0.3;
    for (let i = 0; i < n; i++) { const r = Math.floor(i / cols), c = i % cols, k = E.outCubic(clamp((lt - 0.3 - i * 0.06) / 0.5)); if (k <= 0) continue;
      const x = gx + c * bw * 1.25, y = gy + r * bh * 1.6; ctx.save(); ctx.globalAlpha = k;
      ctx.fillStyle = '#2B343C'; ctx.fillRect(x, y + 18 * u, bw, bh - 18 * u); ctx.fillStyle = '#6B4A30'; ctx.beginPath(); ctx.moveTo(x - 8 * u, y + 20 * u); ctx.lineTo(x + bw / 2, y); ctx.lineTo(x + bw + 8 * u, y + 20 * u); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(236,226,204,0.5)'; for (let w = 0; w < 5; w++) ctx.fillRect(x + 14 * u + w * 27 * u, y + 32 * u, 12 * u, 14 * u); ctx.restore(); }
    if (s.counter) { const k = E.outCubic(clamp((lt - 0.4) / Math.max(1, n * 0.06))); txt(Math.round(n * k).toString(), W * 0.88, H * 0.5, font(SERIF, 700, 120 * u), TOK.parchment, 'right'); txt('BARAK', W * 0.88, H * 0.5 + 60 * u, font(SANS, 600, 24 * u), TOK.gold, 'right', 7 * u); }
    if (s.label) { const e = enter(t, api.span[0] + 0.3); ctx.save(); ctx.globalAlpha = e.a; txt(s.label, W / 2, H * 0.16 + e.dy, font(SERIF, 700, 64 * u), TOK.parchment); if (s.labelSub) txt(s.labelSub, W / 2, H * 0.16 + 60 * u + e.dy, font(SANS, 600, 24 * u), TOK.gold, 'center', 7 * u); ctx.restore(); }
  }
  function makamScene(s, t, api) {          // simple grave markers, some without names (respectful, no imagery of death)
    const lt = t - api.span[0], rows = 3, cols = 9; const gy = H * 0.5;
    ctx.fillStyle = '#18221E'; ctx.fillRect(0, gy + 150 * u, W, H); 
    for (let r = rows - 1; r >= 0; r--) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, k = E.outCubic(clamp((lt - 0.3 - i * 0.05) / 0.6)); if (k <= 0) continue;
      const sc = 1 - r * 0.18, x = W / 2 + (c - (cols - 1) / 2) * 150 * u * sc, y = gy + r * -70 * u + 120 * u, w = 54 * u * sc, h = 90 * u * sc;
      const named = s.dutch ? M.hash01(i, 4) < 0.5 : M.hash01(i, 7) < 0.25;
      ctx.save(); ctx.globalAlpha = k * (1 - r * 0.2);
      ctx.fillStyle = named ? '#8A8478' : '#4A4A44'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h, w, h, [w / 2, w / 2, 4 * u, 4 * u]); ctx.fill();
      if (named) { ctx.fillStyle = 'rgba(20,20,20,0.6)'; for (let l = 0; l < 3; l++) ctx.fillRect(x - w * 0.3, y - h * 0.7 + l * h * 0.15, w * 0.6, 3 * u * sc); }
      ctx.restore();
    }
    for (let i = 0; i < 4; i++) { const tx = W * (0.12 + i * 0.26), th = 300 * u; ctx.fillStyle = '#0F1714'; ctx.fillRect(tx - 10 * u, gy + 150 * u - th, 20 * u, th); ctx.beginPath(); ctx.arc(tx, gy + 150 * u - th, 120 * u, 0, 7); ctx.fill(); }
    if (s.label) { const e = enter(t, api.span[0] + 0.4); ctx.save(); ctx.globalAlpha = e.a; txt(s.label, W / 2, H * 0.16 + e.dy, font(SERIF, 600, 54 * u, true), TOK.parchment); if (s.labelSub) txt(s.labelSub, W / 2, H * 0.16 + 60 * u + e.dy, font(SANS, 600, 22 * u), TOK.gold, 'center', 7 * u); ctx.restore(); }
  }
  function barsScene(s, t, api) {          // prison: text behind vertical bars that slide shut
    const lt = t - api.span[0]; const e = enter(t, api.span[0] + 0.2);
    ctx.save(); ctx.globalAlpha = e.a; txt(s.big || '', W / 2, H * 0.45 + e.dy, font(SERIF, 700, (s.size || 120) * u), TOK.parchment);
    if (s.small) txt(s.small, W / 2, H * 0.45 + 110 * u + e.dy, font(SANS, 800, 46 * u), TOK.mace, 'center', 6 * u); ctx.restore();
    const k = E.outCubic(clamp((lt - (s.barsAt ?? 0.8)) / 0.9)); const n = 11;
    for (let i = 0; i < n; i++) { const x = W * (0.06 + 0.88 * i / (n - 1)); const yTop = lerp(-H, 0, k);
      const g = ctx.createLinearGradient(x - 14 * u, 0, x + 14 * u, 0); g.addColorStop(0, '#2A2F35'); g.addColorStop(0.5, '#6A7078'); g.addColorStop(1, '#22272C');
      ctx.fillStyle = g; ctx.fillRect(x - 12 * u, yTop, 24 * u, H); }
    ctx.fillStyle = '#3A4048'; [0.12, 0.88].forEach((f) => ctx.fillRect(0, lerp(-H, 0, k) + H * f, W, 22 * u));
    // keep the words readable in front of the bars
    if (k > 0) { ctx.save(); ctx.globalAlpha = e.a * k; ctx.font = font(SERIF, 700, (s.size || 120) * u); const tw = ctx.measureText(s.big || '').width;
      ctx.fillStyle = 'rgba(12,17,23,0.82)'; ctx.beginPath(); ctx.roundRect(W / 2 - tw / 2 - 50 * u, H * 0.45 - (s.size || 120) * 0.75 * u, tw + 100 * u, (s.size || 120) * u * 1.05 + (s.small ? 110 * u : 0), 16 * u); ctx.fill();
      txt(s.big || '', W / 2, H * 0.45, font(SERIF, 700, (s.size || 120) * u), TOK.parchment);
      if (s.small) txt(s.small, W / 2, H * 0.45 + 110 * u, font(SANS, 800, 46 * u), TOK.mace, 'center', 6 * u); ctx.restore(); }
  }
  function ruinsScene(s, t, api) {         // brick foundations overgrown with roots
    const lt = t - api.span[0]; ctx.fillStyle = '#16201B'; ctx.fillRect(0, H * 0.35, W, H);
    const rects = [[0.12, 0.45, 0.22, 0.2], [0.4, 0.42, 0.2, 0.26], [0.66, 0.5, 0.2, 0.18], [0.24, 0.72, 0.28, 0.12], [0.58, 0.74, 0.24, 0.1]];
    rects.forEach(([x, y, w, h], i) => { const k = clamp((lt - 0.3 - i * 0.3) / 1.2); if (k <= 0) return;
      ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = '#9A5A3C'; ctx.lineWidth = 10 * u; ctx.setLineDash([46 * u, 12 * u, 20 * u, 30 * u]); ctx.strokeRect(W * x, H * y, W * w, H * h); ctx.restore(); });
    ctx.strokeStyle = 'rgba(70,110,60,0.7)'; ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) { const k = clamp((lt - 1 - i * 0.2) / 2); if (k <= 0) continue; ctx.lineWidth = (6 + M.hash01(i, 3) * 8) * u; ctx.beginPath(); let x = W * M.hash01(i, 5), y = H * 0.35;
      ctx.moveTo(x, y); for (let j = 0; j < 12 * k; j++) { x += (M.hash01(i * 13 + j, 7) - 0.5) * 80 * u; y += 40 * u; ctx.lineTo(x, y); } ctx.stroke(); }
    if (s.label) { const e = enter(t, api.span[0] + 0.4); ctx.save(); ctx.globalAlpha = e.a; txt(s.label, W / 2, H * 0.16 + e.dy, font(SERIF, 700, 64 * u), TOK.parchment); if (s.labelSub) txt(s.labelSub, W / 2, H * 0.16 + 60 * u + e.dy, font(SANS, 600, 22 * u), TOK.gold, 'center', 7 * u); ctx.restore(); }
  }
  const KINDS = { map: mapScene, title: titleCard, number: bigNumber, compare, statement, icons: iconRow, nutmeg: nutmegScene, sign: streetSign, oldmap: oldMap, quiet, end: endScreen,
    ship: shipScene, steam: steamScene, barak: barakScene, makam: makamScene, bars: barsScene, ruins: ruinsScene, fort: fortScene, kebun: kebunScene, portrait: silhouette, calendar, scroll, chain, flag: flagSwap, dots: dotsScene };
  const AMBIENT = new Set(['title', 'number', 'compare', 'statement', 'icons', 'nutmeg', 'quiet', 'chain', 'calendar', 'portrait', 'scroll', 'dots']);

  return function docu(p, t, s, api, target) {
    ctx = target || mainCtx;
    background(t, s.dim || 0);
    if (AMBIENT.has(s.kind) && s.ambient !== 'none') ambient(s, t, api);
    const fn = KINDS[s.kind] || mapScene;
    if (s.kind === 'title') titleCard(s, t, api.span[0]); else fn(s, t, api);
    lowerThird(s, t, api);
    chapterTag(s, t, api.span[0] + 0.1);
    finish(t);
    ctx = mainCtx;
  };
}
