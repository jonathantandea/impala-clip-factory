// kit2d.js: "flat" look — 2-D outlined puppets (billboards) in textured 3-D sets, plus props for them.
// Puppet faces/poses are painted on a canvas and cached per state; everything is a pure function of time.
import * as THREE from 'three';
import * as M from './motion.js';

const INK = '#3A2214';
let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
export function tex(w, h, paint, rep = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8; return t;
}
const grime = (c, w, h, n, col, rmin, rmax, a = 0.15) => { for (let i = 0; i < n; i++) { const r = rmin + rnd() * (rmax - rmin); const g = c.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0)); c.save(); c.translate(rnd() * w, rnd() * h); c.scale(1, 0.4 + rnd()); c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); c.restore(); } };
export const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
const sh = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

// ---------------------------------------------------------------- textures
export const T = {
  wood: () => tex(512, 512, (c, w, h) => {
    c.fillStyle = '#6B4128'; c.fillRect(0, 0, w, h);
    for (let p = 0; p < 4; p++) { const y0 = p * h / 4; c.fillStyle = ['#704430', '#633A24', '#76492E', '#5E3722'][p]; c.fillRect(0, y0, w, h / 4);
      for (let i = 0; i < 30; i++) { c.strokeStyle = `rgba(40,20,10,${0.15 + rnd() * 0.25})`; c.lineWidth = 1 + rnd() * 2; c.beginPath(); const yy = y0 + rnd() * h / 4; c.moveTo(0, yy); for (let x = 0; x <= w; x += 32) c.lineTo(x, yy + Math.sin(x * 0.02 + i) * 3 + (rnd() - 0.5) * 2); c.stroke(); }
      c.fillStyle = 'rgba(20,10,5,0.7)'; c.fillRect(0, y0, w, 4); }
    grime(c, w, h, 40, 'rgba(30,15,5,A)', 20, 80, 0.25);
  }),
  brick: () => tex(512, 512, (c, w, h) => {
    c.fillStyle = '#6E5A4E'; c.fillRect(0, 0, w, h); const bw = 128, bh = 48;
    for (let r = 0; r < h / bh; r++) for (let k = -1; k < w / bw + 1; k++) { const x = k * bw + (r % 2) * bw / 2, y = r * bh, v = rnd(); c.fillStyle = `rgb(${150 + v * 40},${92 + v * 30},${74 + v * 20})`; c.fillRect(x + 4, y + 4, bw - 8, bh - 8); }
    grime(c, w, h, 60, 'rgba(40,30,25,A)', 20, 90, 0.3);
  }, [4, 4]),
  tiles: () => tex(512, 512, (c, w, h) => {
    const n = 4, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = rnd() * 12; c.fillStyle = (i + j) % 2 ? `rgb(${200 + v},${190 + v},${170 + v})` : `rgb(${150 + v},${70 + v},${60 + v})`; c.fillRect(i * s + 2, j * s + 2, s - 4, s - 4); }
    grime(c, w, h, 50, 'rgba(60,40,20,A)', 20, 90, 0.18);
  }, [5, 5]),
  wall: (paint = '#5FA494', under = '#C9A982') => tex(1024, 1024, (c, w, h) => {
    c.fillStyle = paint; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 24; i++) { const x = rnd() * w, y = rnd() * h, r = 20 + rnd() * 70; c.fillStyle = under; c.beginPath(); for (let a = 0; a < 6.3; a += 0.5) { const rr = r * (0.6 + rnd() * 0.6); c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7); } c.fill(); c.strokeStyle = 'rgba(60,70,60,0.35)'; c.lineWidth = 2; c.stroke(); }
    grime(c, w, h, 90, 'rgba(60,50,30,A)', 30, 160, 0.18);
    for (let i = 0; i < 40; i++) { c.strokeStyle = 'rgba(70,55,35,0.22)'; c.lineWidth = 2; c.beginPath(); const x = rnd() * w; c.moveTo(x, 0); c.lineTo(x + (rnd() - 0.5) * 20, h * (0.2 + rnd() * 0.5)); c.stroke(); }
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(50,40,25,0.35)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  }),
  zinc: () => tex(512, 256, (c, w, h) => { for (let x = 0; x < w; x++) { const v = 0.5 + 0.5 * Math.sin(x / w * Math.PI * 16); c.fillStyle = `rgb(${120 + v * 70},${110 + v * 60},${100 + v * 50})`; c.fillRect(x, 0, 1, h); } grime(c, w, h, 50, 'rgba(140,60,20,A)', 10, 60, 0.45); }, [3, 1]),
  fabric: (col = '#4F7A5A') => tex(256, 256, (c, w, h) => { c.fillStyle = col; c.fillRect(0, 0, w, h); for (let i = 0; i < 2500; i++) { c.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},0.06)`; c.fillRect(rnd() * w, rnd() * h, 2, 2); } grime(c, w, h, 12, 'rgba(40,30,20,A)', 20, 60, 0.25); }, [2, 2]),
  dusty: (col = '#BFB59C') => tex(256, 256, (c, w, h) => { c.fillStyle = col; c.fillRect(0, 0, w, h); for (let i = 0; i < 1800; i++) { c.fillStyle = `rgba(${rnd() < 0.6 ? '120,110,90' : '230,225,210'},0.25)`; c.beginPath(); c.arc(rnd() * w, rnd() * h, rnd() * 1.6, 0, 7); c.fill(); } grime(c, w, h, 20, 'rgba(110,95,70,A)', 10, 50, 0.35); }),
};

// ---------------------------------------------------------------- 2-D puppet painter
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
function celFill(c, path, base, lightX) {
  c.save(); c.fillStyle = base; c.fill(path); c.clip(path); c.fillStyle = shade(base, 0.82); c.fillRect(lightX, -5000, 5000, 10000); c.restore();
  c.lineWidth = 11; c.lineJoin = 'round'; c.strokeStyle = INK; c.stroke(path);
}
// spec: { hijab | hair, peci, mustache, tunic, skirt, skin }  state: { mood, arm, look, sit, blink }
export function paintPuppet(spec, st) {
  const cw = 600, ch = 1200;
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const c = cv.getContext('2d');
  c.lineCap = 'round'; c.lineJoin = 'round';
  const skin = spec.skin || '#E2A06A', tunic = spec.tunic || '#5CBBD9', skirt = spec.skirt || '#E6DDC6';
  const { mood = 'smile', arm = 'down', look = 0, sit = false, blink = false } = st;
  const P = () => new Path2D();
  if (!sit) {
    const sk = P(); sk.moveTo(190, 900); sk.lineTo(410, 900); sk.lineTo(430, 1150); sk.quadraticCurveTo(300, 1170, 170, 1150); sk.closePath(); celFill(c, sk, skirt, 330);
    c.strokeStyle = shade(skirt, 0.75); c.lineWidth = 6; for (let x = 200; x < 420; x += 34) { c.beginPath(); c.moveTo(x, 910); c.lineTo(x + 6, 1140); c.stroke(); }
  } else {
    const lap = P(); lap.moveTo(170, 860); lap.quadraticCurveTo(300, 840, 430, 860); lap.lineTo(450, 960); lap.quadraticCurveTo(300, 985, 150, 960); lap.closePath(); celFill(c, lap, skirt, 330);
  }
  const tu = P(); tu.moveTo(200, 560); tu.quadraticCurveTo(300, 530, 400, 560); tu.lineTo(440, 920); tu.quadraticCurveTo(300, 945, 160, 920); tu.closePath(); celFill(c, tu, tunic, 345);
  if (spec.collar) { c.strokeStyle = shade(tunic, 0.6); c.lineWidth = 8; c.beginPath(); c.moveTo(250, 560); c.lineTo(300, 640); c.lineTo(350, 560); c.stroke(); }
  const armDraw = (side, kind) => {
    const sx = side < 0 ? 205 : 395, p = P();
    let hx, hy;
    if (kind === 'point') { p.moveTo(sx - 30 * side, 590); p.quadraticCurveTo(sx + 90 * side, 560, sx + 150 * side, 430); p.lineTo(sx + 190 * side, 450); p.quadraticCurveTo(sx + 120 * side, 640, sx + 10 * side, 690); hx = sx + 172 * side; hy = 420; }
    else if (kind === 'whisper') { p.moveTo(sx - 30 * side, 590); p.quadraticCurveTo(sx + 40 * side, 600, sx + 10 * side, 470); p.lineTo(sx - 40 * side, 470); p.quadraticCurveTo(sx - 20 * side, 600, sx - 40 * side, 660); hx = sx - 70 * side; hy = 440; }
    else if (kind === 'thumb') { p.moveTo(sx - 30 * side, 590); p.quadraticCurveTo(sx + 100 * side, 640, sx + 120 * side, 560); p.lineTo(sx + 150 * side, 590); p.quadraticCurveTo(sx + 110 * side, 720, sx, 700); hx = sx + 140 * side; hy = 560; }
    else { p.moveTo(sx - 20 * side, 585); p.quadraticCurveTo(sx + 50 * side, 620, sx + 60 * side, 840); p.lineTo(sx + 10 * side, 850); p.quadraticCurveTo(sx - 10 * side, 700, sx - 30 * side, 650); hx = sx + 36 * side; hy = 870; }
    p.closePath(); celFill(c, p, tunic, side < 0 ? 9999 : sx);
    const hp = P(); hp.ellipse(hx, hy, 34, 38, 0, 0, Math.PI * 2); celFill(c, hp, skin, hx + 10);
    if (kind === 'point') { const f = P(); f.roundRect(hx - 10, hy - 95, 22, 70, 11); celFill(c, f, skin, hx + 6); }
    if (kind === 'thumb') { const f = P(); f.roundRect(hx - 11, hy - 80, 22, 60, 11); celFill(c, f, skin, hx + 6); }
  };
  armDraw(-1, arm === 'whisper' ? 'whisper' : 'down'); armDraw(1, ['point', 'thumb'].includes(arm) ? arm : 'down');
  const fx = 300 + look * 18;
  if (spec.hijab) {
    const hj = P(); hj.moveTo(300, 90); hj.bezierCurveTo(470, 90, 520, 260, 500, 420); hj.quadraticCurveTo(520, 560, 470, 640); hj.quadraticCurveTo(300, 690, 130, 640); hj.quadraticCurveTo(80, 560, 100, 420); hj.bezierCurveTo(80, 260, 130, 90, 300, 90); hj.closePath();
    celFill(c, hj, spec.hijab, 380);
  } else {   // ears
    [-1, 1].forEach((d) => { const e = P(); e.ellipse(fx + d * 130, 360, 26, 38, 0, 0, Math.PI * 2); celFill(c, e, skin, fx + d * 130 + 8); });
  }
  const face = P(); face.ellipse(fx, 345, 132, 152, 0, 0, Math.PI * 2); celFill(c, face, skin, fx + 70);
  if (spec.hijab) { c.lineWidth = 16; c.strokeStyle = shade(spec.hijab, 0.6); c.stroke(face); c.lineWidth = 11; c.strokeStyle = INK; c.stroke(face); }
  if (spec.hair && !spec.peci) { const hr = P(); hr.moveTo(fx - 140, 330); hr.bezierCurveTo(fx - 150, 150, fx + 150, 150, fx + 140, 330); hr.quadraticCurveTo(fx + 90, 240, fx - 20, 255); hr.quadraticCurveTo(fx - 90, 240, fx - 140, 330); hr.closePath(); c.fillStyle = spec.hair; c.fill(hr); c.lineWidth = 11; c.strokeStyle = INK; c.stroke(hr); }
  if (spec.peci) { const pc = P(); pc.moveTo(fx - 120, 255); pc.lineTo(fx - 110, 160); pc.quadraticCurveTo(fx, 140, fx + 110, 160); pc.lineTo(fx + 120, 255); pc.quadraticCurveTo(fx, 230, fx - 120, 255); pc.closePath(); celFill(c, pc, spec.peci === true ? '#2A2422' : spec.peci, fx + 60);
    if (spec.hair) { c.fillStyle = spec.hair; [-1, 1].forEach((d) => { c.beginPath(); c.ellipse(fx + d * 118, 285, 18, 36, 0, 0, Math.PI * 2); c.fill(); }); } }
  // brows
  const brow = (x, d) => { c.lineWidth = 14; c.strokeStyle = INK; c.beginPath();
    let tilt = mood === 'angry' ? -18 * d : mood === 'worried' ? 16 * d : mood === 'shock' ? -6 * d : 0, lift = mood === 'shock' ? -22 : 0;
    if (mood === 'suspicious') { tilt = d > 0 ? 0 : -14 * d; lift = d > 0 ? -20 : 6; }
    if (mood === 'smug') { tilt = 6 * d; lift = -4; }
    c.moveTo(x - 34, 285 + lift - tilt); c.quadraticCurveTo(x, 270 + lift, x + 34, 285 + lift + tilt); c.stroke(); };
  brow(fx - 55, -1); brow(fx + 55, 1);
  // eyes
  [-55, 55].forEach((dx) => {
    const ex = fx + dx + look * 6;
    if (blink || mood === 'happy') { c.lineWidth = 9; c.strokeStyle = INK; c.beginPath(); c.arc(ex, 338, 16, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); return; }
    const half = mood === 'smug' || (mood === 'suspicious' && dx < 0);
    c.fillStyle = INK; c.beginPath(); c.ellipse(ex, 332, mood === 'shock' ? 18 : 15, mood === 'shock' ? 24 : 21, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(ex + 5, 324, 5, 0, Math.PI * 2); c.fill();
    if (half) { c.fillStyle = skin; c.fillRect(ex - 24, 300, 48, 30); c.lineWidth = 8; c.strokeStyle = INK; c.beginPath(); c.moveTo(ex - 22, 330); c.lineTo(ex + 22, 330); c.stroke(); }
  });
  c.strokeStyle = shade(skin, 0.7); c.lineWidth = 6; c.beginPath(); c.moveTo(fx + 4, 360); c.quadraticCurveTo(fx + 14, 382, fx + 2, 390); c.stroke();
  c.fillStyle = 'rgba(230,110,90,0.35)'; [-80, 80].forEach((dx) => { c.beginPath(); c.ellipse(fx + dx, 395, 26, 14, 0, 0, Math.PI * 2); c.fill(); });
  if (spec.mustache) { c.fillStyle = spec.mustache === true ? '#2A1E18' : spec.mustache; c.beginPath(); c.ellipse(fx - 26, 410, 30, 12, 0.15, 0, Math.PI * 2); c.ellipse(fx + 26, 410, 30, 12, -0.15, 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = INK; c.lineWidth = 9; c.beginPath();
  if (mood === 'smile' || mood === 'happy') { c.moveTo(fx - 34, 428); c.quadraticCurveTo(fx, 455, fx + 34, 428); c.stroke(); }
  else if (mood === 'smug') { c.moveTo(fx - 30, 438); c.quadraticCurveTo(fx + 10, 448, fx + 38, 422); c.stroke(); }
  else if (mood === 'shock') { c.fillStyle = '#7A2E2A'; c.beginPath(); c.ellipse(fx, 442, 20, 26, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
  else if (mood === 'whisper') { c.fillStyle = '#7A2E2A'; c.beginPath(); c.ellipse(fx, 440, 12, 9, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
  else if (mood === 'angry' || mood === 'worried') { c.moveTo(fx - 30, 446); c.quadraticCurveTo(fx, 430, fx + 30, 446); c.stroke(); }
  else if (mood === 'suspicious') { c.moveTo(fx - 28, 440); c.lineTo(fx + 24, 434); c.stroke(); }
  else { c.moveTo(fx - 26, 438); c.lineTo(fx + 26, 438); c.stroke(); }
  return cv;
}

// a puppet character: billboard plane whose texture swaps with the state
export function puppet(scene, spec) {
  const cache = new Map();
  const mat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.05 });
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaTest: 0.5 });
  const geo = new THREE.PlaneGeometry(0.85, 1.7); geo.translate(0, 0.85, 0);
  const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.customDepthMaterial = depth;
  const root = new THREE.Group(); root.add(m); scene.add(root);
  let cur = '';
  function pose(t, o = {}) {
    const blink = (t * 0.7 + (o.x || 0)) % 4 < 0.12;
    const st = { mood: o.mood || 'smile', arm: o.arm || 'down', look: o.look || 0, sit: !!o.sit, blink };
    const key = JSON.stringify(st);
    if (key !== cur) {
      if (!cache.has(key)) { const tx = new THREE.CanvasTexture(paintPuppet(spec, st)); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; cache.set(key, tx); }
      mat.map = cache.get(key); depth.map = mat.map; mat.needsUpdate = true; depth.needsUpdate = true; cur = key;
    }
    const s = o.scale || 1;
    const bob = o.walk ? Math.abs(Math.sin(t * 8)) * 0.04 : Math.sin(t * 2.2 + (o.x || 0)) * 0.006;
    root.position.set(o.x || 0, (o.y || 0) + bob + (st.sit ? -0.02 * s : 0), o.z || 0);
    root.scale.setScalar(s);
    root.rotation.set(0, o.rot || 0, o.walk ? Math.sin(t * 8) * 0.04 : (o.talk ? Math.sin(t * 9) * 0.015 : 0));
  }
  return { obj: root, pose, puppet: true, height: 1.7, mesh: m };
}

// ---------------------------------------------------------------- sets
function baseLights(scene, { key = '#FFDDAA', bulb = [0, 2.6, 0] } = {}) {
  const hemi = new THREE.HemisphereLight('#FFF1D6', '#5A4030', 1.15);
  const sun = new THREE.DirectionalLight(key, 2.1); sun.position.set(4, 8, 7); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7 }); sun.shadow.bias = -0.0006;
  const pl = new THREE.PointLight('#FFC77A', 5, 7, 1.6); pl.position.set(...bulb);
  [hemi, sun, pl].forEach((l) => { l.layers.enableAll(); scene.add(l); }); sun.shadow.camera.layers.enableAll();
  return { sun };
}
const meshIn = (scene) => (geo, m, x, y, z, cs = true) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = cs; o.receiveShadow = true; scene.add(o); return o; };

// Warung (stall) with counter, shelves, goods, zinc roof, bulb. Counter front at z ≈ 1; customers stand at z ≈ 1.8.
export function warungSet() {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#E8D9B8');
  baseLights(scene, { bulb: [-0.6, 2.6, 0.2] });
  const mesh = meshIn(scene), wood = std({ map: T.wood() });
  const floor = mesh(new THREE.PlaneGeometry(16, 16), std({ map: T.brick() }), 0, 0, 0, false); floor.rotation.x = -Math.PI / 2;
  mesh(new THREE.BoxGeometry(10, 4.4, 0.2), std({ map: T.wall() }), 0, 2.2, -2.2, false);
  [1.4, 2.1].forEach((y) => mesh(new THREE.BoxGeometry(3.6, 0.06, 0.4), wood, -0.2, y, -1.9));
  const goods = ['#2F6FB0', '#D9473B', '#E8B93A', '#3E8E5A', '#F2F0E8', '#8A5A3C', '#2F6FB0', '#E87A2E'];
  for (let i = 0; i < 14; i++) { const w = 0.18 + rnd() * 0.2, h = 0.2 + rnd() * 0.25; mesh(new THREE.BoxGeometry(w, h, 0.25), std({ color: goods[i % 8] }), -1.8 + (i % 7) * 0.5 + rnd() * 0.1, (i < 7 ? 1.43 : 2.13) + h / 2, -1.85); }
  for (let i = 0; i < 6; i++) mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.22, 14), std({ color: '#F4E6C8', transparent: true, opacity: 0.85 }), 1.0 + i * 0.18, 1.54, -1.85);
  const roof = mesh(new THREE.PlaneGeometry(10, 2.6), std({ map: T.zinc(), side: THREE.DoubleSide, metalness: 0.3, roughness: 0.6 }), 0, 3.25, 0.4); roof.rotation.x = Math.PI / 2 - 0.18;
  mesh(new THREE.BoxGeometry(10, 0.12, 0.12), wood, 0, 3.0, 1.6);
  [-1.7, 1.7].forEach((x) => mesh(new THREE.BoxGeometry(0.12, 3.0, 0.12), wood, x, 1.5, 1.55));
  const bm = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), new THREE.MeshBasicMaterial({ color: '#FFF4D0' })); bm.position.set(-0.6, 2.62, 0.2); scene.add(bm);
  mesh(new THREE.BoxGeometry(3.4, 0.08, 0.9), wood, 0, 0.82, 0.6); mesh(new THREE.BoxGeometry(3.4, 0.8, 0.06), wood, 0, 0.4, 1.03);
  const peel = std({ map: tex(256, 128, (c, w, h) => { c.fillStyle = '#E8A23A'; c.fillRect(0, 0, w, h); for (let i = 0; i < 700; i++) { c.fillStyle = 'rgba(160,90,20,0.3)'; c.beginPath(); c.arc(rnd() * w, rnd() * h, 1.4, 0, 7); c.fill(); } }) });
  mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.2, 28, 1, true), std({ color: '#B88A4E', side: THREE.DoubleSide }), 1.05, 0.96, 0.55);
  for (let i = 0; i < 9; i++) mesh(new THREE.SphereGeometry(0.1, 18, 14), peel, 1.05 + Math.cos(i * 1.3) * (i ? 0.17 : 0), 1.06 + (i > 5 ? 0.08 : 0), 0.55 + Math.sin(i * 1.3) * (i ? 0.14 : 0));
  mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.03, 28), std({ color: '#F2F4F6' }), -1.05, 0.875, 0.6);
  for (let i = 0; i < 18; i++) { const c = mesh(new THREE.CapsuleGeometry(0.012, 0.07, 4, 6), std({ color: rnd() < 0.7 ? '#C8281E' : '#3E8E2A' }), -1.05 + (rnd() - 0.5) * 0.26, 0.91, 0.6 + (rnd() - 0.5) * 0.22); c.rotation.set(Math.PI / 2, 0, rnd() * 3); }
  // street side: a house wall far left/right so wide shots have context
  mesh(new THREE.BoxGeometry(4, 3.4, 0.2), std({ map: T.wall('#D9C7A0', '#B89A72') }), -5.2, 1.7, -0.5, false);
  return { scene, update() {} };
}

// Ruang tamu Pak Darto: back wall z=-3, room x -4..4. Table at (0,-0.8), sofa left, chair right, door at back x 2.6.
export function rumahSet() {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#2A2420');
  baseLights(scene, { bulb: [0, 2.7, -0.6] });
  const mesh = meshIn(scene), wood = std({ map: T.wood() });
  const floor = mesh(new THREE.PlaneGeometry(9, 8), std({ map: T.tiles() }), 0, 0, 0, false); floor.rotation.x = -Math.PI / 2;
  const wallM = std({ map: T.wall('#9CC3C9', '#D8C7A4') });
  mesh(new THREE.BoxGeometry(9, 3.4, 0.2), wallM, 0, 1.7, -3.1, false);
  [-1, 1].forEach((d) => mesh(new THREE.BoxGeometry(0.2, 3.4, 8), wallM, d * 4.5, 1.7, 0.6, false));
  mesh(new THREE.BoxGeometry(9, 0.16, 0.05), std({ color: '#5E4630' }), 0, 0.08, -2.98);
  // window with curtains
  mesh(new THREE.BoxGeometry(1.5, 1.2, 0.06), std({ color: '#CDEBF5', emissive: '#FFF2D0', emissiveIntensity: 0.6 }), -2.0, 1.8, -2.98, false);
  [-1, 1].forEach((d) => mesh(new THREE.BoxGeometry(0.4, 1.6, 0.05), std({ map: T.fabric('#C96B4A') }), -2.0 + d * 0.9, 1.75, -2.92));
  // framed photo + calendar
  mesh(new THREE.BoxGeometry(0.6, 0.45, 0.04), std({ color: '#5E4630' }), 0.2, 2.2, -2.98);
  mesh(new THREE.PlaneGeometry(0.5, 0.36), std({ map: tex(128, 96, (c, w, h) => { c.fillStyle = '#C8B48C'; c.fillRect(0, 0, w, h); c.fillStyle = '#7A5A3C'; [[40, 50], [86, 52]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y - 12, 12, 0, 7); c.fill(); c.fillRect(x - 16, y, 32, 40); }); }) }), 0.2, 2.2, -2.955, false);
  // door frame (door panel is a prop)
  mesh(new THREE.BoxGeometry(1.2, 0.12, 0.2), wood, 2.6, 2.16, -3.0); [-1, 1].forEach((d) => mesh(new THREE.BoxGeometry(0.1, 2.2, 0.2), wood, 2.6 + d * 0.58, 1.1, -3.0));
  const outside = mesh(new THREE.PlaneGeometry(1.06, 2.1), new THREE.MeshBasicMaterial({ color: '#F6E7C4' }), 2.6, 1.05, -3.2, false); void outside;
  // table
  mesh(new THREE.BoxGeometry(1.5, 0.06, 0.85), wood, 0, 0.76, -0.8);
  [[-0.68, -0.4], [0.68, -0.4], [-0.68, 0.36], [0.68, 0.36]].forEach(([x, z]) => mesh(new THREE.BoxGeometry(0.07, 0.74, 0.07), wood, x, 0.37, -0.8 + z));
  const cloth = mesh(new THREE.PlaneGeometry(0.9, 0.5), std({ map: tex(128, 64, (c, w, h) => { c.fillStyle = '#F2EEE2'; c.fillRect(0, 0, w, h); c.strokeStyle = '#C96B4A'; c.lineWidth = 4; c.strokeRect(6, 6, w - 12, h - 12); }) }), 0, 0.795, -0.85, false); cloth.rotation.x = -Math.PI / 2;
  // glasses of tea on the table
  [[-0.35, -0.7], [0.35, -0.9]].forEach(([x, z]) => { mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.12, 14), std({ color: '#D9EEF5', transparent: true, opacity: 0.55 }), x, 0.85, z); mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.08, 14), std({ color: '#B5652A' }), x, 0.83, z); });
  // sofa (left, facing +x / the table) and chair (right)
  const sofaM = std({ map: T.fabric('#56806A') });
  mesh(new THREE.BoxGeometry(0.8, 0.42, 1.8), sofaM, -1.9, 0.33, -1.0); mesh(new THREE.BoxGeometry(0.22, 0.75, 1.8), sofaM, -2.25, 0.7, -1.0);
  [-1, 1].forEach((d) => mesh(new THREE.BoxGeometry(0.8, 0.55, 0.18), sofaM, -1.9, 0.5, -1.0 + d * 0.95));
  mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), wood, 0.55, 0.46, -1.55); mesh(new THREE.BoxGeometry(0.5, 0.6, 0.06), wood, 0.55, 0.78, -1.8);
  [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(([x, z]) => mesh(new THREE.BoxGeometry(0.05, 0.45, 0.05), wood, 0.55 + x, 0.22, -1.55 + z));
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), new THREE.MeshBasicMaterial({ color: '#FFF4D0' })); bulb.position.set(0, 2.75, -0.6); scene.add(bulb);
  mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.6, 4), std({ color: '#222' }), 0, 3.1, -0.6, false);
  return { scene, update() {} };
}

// ---------------------------------------------------------------- props
// standing fan; spin(t) is the blade angle (the engine integrates the speed curve)
export function standFan(scene) {
  const g = new THREE.Group();
  const body = std({ map: T.dusty('#C9C0A8') }), dark = std({ color: '#6E6658' });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.06, 24), body); base.position.y = 0.03; g.add(sh(base));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.1, 10), body); pole.position.y = 0.6; g.add(sh(pole));
  const head = new THREE.Group(); head.position.y = 1.2; g.add(head);
  const motor = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.12, 4, 12), body); motor.rotation.x = Math.PI / 2; motor.position.z = -0.1; head.add(sh(motor));
  const blades = new THREE.Group(); blades.position.z = 0.02; head.add(blades);
  const bladeM = std({ color: '#A9C8C2', transparent: true, opacity: 0.92, side: THREE.DoubleSide, map: T.dusty('#A9C8C2') });
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.CircleGeometry(0.14, 16), bladeM); b.scale.set(0.55, 1, 1); b.position.set(0, 0.13, 0); const p = new THREE.Group(); p.add(b); p.rotation.z = i * Math.PI * 2 / 3; blades.add(p); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 14), dark); hub.rotation.x = Math.PI / 2; hub.position.z = 0.04; head.add(hub);
  const blur = new THREE.Mesh(new THREE.CircleGeometry(0.29, 32), new THREE.MeshBasicMaterial({ color: '#C9DCD6', transparent: true, opacity: 0, depthWrite: false })); blur.position.z = 0.03; head.add(blur);
  const cageM = std({ color: '#9A9282', metalness: 0.4, roughness: 0.5 });
  [0.31, 0.2].forEach((r) => { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 6, 40), cageM); ring.position.z = 0.07; head.add(ring); });
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const s = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.31, 3), cageM); s.position.set(Math.cos(a) * 0.155, Math.sin(a) * 0.155, 0.075); s.rotation.z = a - Math.PI / 2; head.add(s); }
  const back = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.006, 6, 40), cageM); back.position.z = -0.03; head.add(back);
  // dust bunnies + cobweb
  const web = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([[0, 0.31, 0.07], [0.2, 0.55, 0.0], [0.1, 0.31, 0.07], [0.2, 0.55, 0], [0.25, 0.2, 0.07], [0.2, 0.55, 0]].map((p) => new THREE.Vector3(...p))), new THREE.LineBasicMaterial({ color: '#EEE', transparent: true, opacity: 0.6 }));
  head.add(web);
  scene.add(g);
  return { obj: g, update(t, k, angle = 0) {
    blades.rotation.z = -angle; blur.material.opacity = M.clamp((k - 0.35) * 1.2) * 0.55; bladeM.opacity = 0.92 - M.clamp((k - 0.35) * 1.2) * 0.5;
    head.rotation.y = Math.sin(t * 0.3) * 0.0; web.visible = k < 0.05;
  } };
}
export function doorPanel(scene) {
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.BoxGeometry(1.04, 2.08, 0.05), std({ map: T.wood() })); p.position.set(0.52, 1.04, 0); g.add(sh(p));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), std({ color: '#C9A13A', metalness: 0.6, roughness: 0.3 })); knob.position.set(0.92, 1.0, 0.05); g.add(knob);
  scene.add(g); return { obj: g, update(t, k) { g.rotation.y = k * 1.5; } };      // k = open amount
}
// floor switch box with a cable, and a 2-D outlined foot that presses it
export function footSwitch(scene) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.1), std({ color: '#E8E2D0', roughness: 0.4 })); box.position.y = 0.03; g.add(sh(box));
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 14), std({ color: '#D9302A' })); btn.position.set(0.03, 0.07, 0); g.add(btn);
  const pts = [[-0.08, 0.02, 0], [-0.4, 0.01, -0.2], [-0.9, 0.01, -0.6], [-1.3, 0.01, -1.4]].map((p) => new THREE.Vector3(...p));
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.008, 6), std({ color: '#2A2A2A' })); g.add(cable);
  const cv = document.createElement('canvas'); cv.width = 400; cv.height = 600; const c = cv.getContext('2d');
  c.lineJoin = 'round'; c.lineWidth = 11; c.strokeStyle = INK;
  const leg = new Path2D(); leg.moveTo(130, 0); leg.lineTo(270, 0); leg.lineTo(260, 380); leg.lineTo(150, 380); leg.closePath(); c.fillStyle = '#5A4632'; c.fill(leg); c.stroke(leg);
  const foot = new Path2D(); foot.moveTo(150, 360); foot.quadraticCurveTo(140, 470, 170, 520); foot.quadraticCurveTo(250, 580, 330, 540); foot.quadraticCurveTo(360, 500, 300, 470); foot.quadraticCurveTo(262, 440, 262, 360); foot.closePath();
  c.fillStyle = '#E2A06A'; c.fill(foot); c.save(); c.clip(foot); c.fillStyle = 'rgba(150,80,40,0.25)'; c.fillRect(230, 300, 200, 300); c.restore(); c.stroke(foot);
  c.fillStyle = '#2F6FB0'; c.beginPath(); c.roundRect(130, 520, 230, 40, 18); c.fill(); c.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const fm = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.3), new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide }));
  const footG = new THREE.Group(); footG.add(fm); fm.position.set(0.0, 0.15, 0); g.add(footG);
  scene.add(g);
  return { obj: g, foot: footG, update(t, k) { const press = k > 0.5 ? 1 : 0; footG.position.set(0.06, 0.07 + (1 - press) * 0.07 + (press ? Math.sin(t * 4) * 0.003 : 0), 0); btn.position.y = 0.07 - press * 0.012; } };
}
export function billPaper(scene, { amount = 'Rp 12.500' } = {}) {
  const t = tex(512, 700, (c, w, h) => {
    c.fillStyle = '#FBF7EC'; c.fillRect(0, 0, w, h); c.fillStyle = '#2F6FB0'; c.fillRect(0, 0, w, 90);
    c.fillStyle = '#FFFFFF'; c.font = '800 44px Display'; c.textAlign = 'center'; c.fillText('TAGIHAN LISTRIK', w / 2, 60);
    c.fillStyle = '#333'; c.font = '30px sans-serif'; c.textAlign = 'left';
    ['Nama : DARTO', 'Bulan : JULI', 'Pemakaian : 14 kWh'].forEach((l, i) => c.fillText(l, 40, 160 + i * 52));
    c.strokeStyle = '#BBB'; c.lineWidth = 2; c.beginPath(); c.moveTo(40, 330); c.lineTo(w - 40, 330); c.stroke();
    c.font = '800 36px Display'; c.fillText('TOTAL', 40, 400); c.textAlign = 'right'; c.font = '800 64px Display'; c.fillStyle = '#1E1B19'; c.fillText(amount, w - 40, 410);
    c.save(); c.translate(330, 560); c.rotate(-0.25); c.strokeStyle = '#C8352E'; c.lineWidth = 8; c.strokeRect(-130, -50, 260, 100); c.fillStyle = '#C8352E'; c.font = '800 64px Display'; c.textAlign = 'center'; c.fillText('HEMAT', 0, 22); c.restore();
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.41), std({ map: t, roughness: 0.9 })); m.rotation.x = -Math.PI / 2; m.receiveShadow = true;
  const g = new THREE.Group(); g.add(m); scene.add(g); return { obj: g };
}

// ---------------------------------------------------------------- film look helpers (2-D, on the output canvas)
const NOISE = [];
export function grade(ctx, W, H, frame, { warm = 0.35, vignette = 0.55, grain = 0.07 } = {}) {
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = `rgba(255,170,90,${warm})`; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  const vg = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.3, W / 2, H * 0.5, Math.max(W, H) * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(25,12,5,${vignette})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  if (!NOISE.length) for (let k = 0; k < 4; k++) { const n = document.createElement('canvas'); n.width = n.height = 256; const nc = n.getContext('2d'); const id = nc.createImageData(256, 256); for (let i = 0; i < id.data.length; i += 4) { const v = (M.hash01(i + k * 99991, 7) * 255) | 0; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } nc.putImageData(id, 0, 0); NOISE.push(n); }
  ctx.globalAlpha = grain; ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = ctx.createPattern(NOISE[Math.floor(frame / 2) % 4], 'repeat'); ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
// cheap lens blur of a canvas into ctx: shrink then enlarge
export function blurInto(ctx, src, W, H, px) {
  if (px <= 0.5) { ctx.drawImage(src, 0, 0); return; }
  let s = src; const f = 1 / Math.max(1, px * 0.9);
  for (const k of [f * 2, f]) { const c = document.createElement('canvas'); c.width = Math.max(8, W * k | 0); c.height = Math.max(8, H * k | 0); const cc = c.getContext('2d'); cc.imageSmoothingQuality = 'high'; cc.drawImage(s, 0, 0, c.width, c.height); s = c; }
  ctx.imageSmoothingQuality = 'high'; ctx.drawImage(s, 0, 0, W, H);
}
