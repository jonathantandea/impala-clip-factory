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
  besar: crescent([[129.872, -4.548], [129.90, -4.556], [129.93, -4.562], [129.96, -4.56], [129.985, -4.548], [130.0, -4.53]], 1.1, -4.55),
};
export const PLACES = { run: [129.683, -4.554], ai: [129.778, -4.526], neira: [129.899, -4.516], gunungapi: [129.882, -4.521], besar: [129.93, -4.556], banda: [129.86, -4.54], nailaka: [129.701, -4.537],
  maluku: [129.0, -3.3], manhattan: [-73.97, 40.78], newyork: [-74.0, 40.71], london: [-0.12, 51.5], amsterdam: [4.9, 52.37], malaka: [102.25, 2.2], venesia: [12.33, 45.44], breda: [4.78, 51.59], grenada: [-61.68, 12.12], ambon: [128.18, -3.69] };

// ---------------------------------------------------------------- renderer
export async function makeDocu(ctx, W, H, base = '/story/') {
  const fonts = [[SERIF, 'lora-600.woff2', '600', 'normal'], [SERIF, 'lora-700.woff2', '700', 'normal'], [SERIF, 'lora-600i.woff2', '600', 'italic'],
    [SANS, 'poppins-500.woff2', '500', 'normal'], [SANS, 'poppins-600.woff2', '600', 'normal'], [SANS, 'poppins-800.woff2', '800', 'normal']];
  await Promise.all(fonts.map(async ([fam, f, w, st]) => { const ff = new FontFace(fam, `url(${base}fonts/${f})`, { weight: w, style: st }); await ff.load(); document.fonts.add(ff); }));
  const [w50, w10] = await Promise.all(['land-50m.json', 'land-10m.json'].map((f) => fetch(base + 'geo/' + f).then((r) => r.json())));
  const LAND50 = topoPolys(w50), LAND10 = topoPolys(w10);
  let bandaPolys = BANDA;
  try { const osm = await fetch(base + 'geo/banda.json').then((r) => (r.ok ? r.json() : null)); if (osm) bandaPolys = { nailaka: BANDA.nailaka, syahrir: BANDA.syahrir, ...Object.fromEntries(Object.entries(osm).map(([k, v]) => [k, withBox(v)])) }; } catch { /* keep approximations */ }
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
    if (b !== a && lt < b.t - (b.dur ?? 1.6)) return { lon: a.lon, lat: a.lat, zoom: a.zoom };
    const lz = lerp(Math.log(a.zoom), Math.log(b.zoom), k);
    return { lon: lerp(a.lon, b.lon, k), lat: lerp(a.lat, b.lat, k), zoom: Math.exp(lz) };
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
    const polys = cam.zoom > 6 ? LAND10 : LAND50;
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
  const KINDS = { map: mapScene, title: titleCard, number: bigNumber, compare, statement, icons: iconRow, nutmeg: nutmegScene, sign: streetSign, oldmap: oldMap, quiet, end: endScreen };

  return function docu(p, t, s, api) {
    background(t, s.dim || 0);
    const fn = KINDS[s.kind] || mapScene;
    if (s.kind === 'title') titleCard(s, t, api.span[0]); else fn(s, t, api);
    lowerThird(s, t, api);
    chapterTag(s, t, api.span[0] + 0.1);
    finish(t);
  };
}
