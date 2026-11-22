// engine.js: turns a scene script (scene.json) + narration timings (words.json) into a 3-D village
// story. Everything is a pure function of time: seek(t) paints frame t. Vocabulary (README in
// docs/scene-format.md): characters, poses, camera shots, props and events.
import * as THREE from 'three';
import * as M from './motion.js';
import * as K from './kit.js';

export const W = 1080, H = 1920;
const { E, prog, lerp, clamp, hash01 } = M;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const SHIRTS = {
  hijau: ['#2F7D4F', '#1E5A37', '#E8C35A'], coklat: ['#8A4B22', '#5A2E12', '#E2B65A'],
  biru: ['#2E5E8C', '#1C3F63', '#E8C35A'], merah: ['#A63A2E', '#6E2018', '#F0C060'],
  ungu: ['#6A4C93', '#47306B', '#E8C35A'], kuning: ['#D9A62E', '#9C7414', '#5A3A12'],
};
const SARONGS = { coklat: ['#6B4A2E', '#3B271A'], abu: ['#4A5A6E', '#2A3442'], hijau: ['#3E6B4A', '#22402A'], merah: ['#7A2E2A', '#40160F'] };

function poseArms(pose, t) {
  switch (pose) {
    case 'hands_hips': return { armL: [0, 0, 0.55], armR: [0, 0, -0.55] };
    case 'wave': return { armR: [0, 0, -2.4 + Math.sin(t * 9) * 0.25] };
    case 'cheer': return { armL: [0, 0, 2.5 + Math.sin(t * 8) * 0.15], armR: [0, 0, -2.5 - Math.sin(t * 8) * 0.15] };
    case 'hands_head': return { armL: [0, 0, 2.7], armR: [0, 0, -2.7] };
    case 'point': return { armR: [-1.5, 0, -0.1] };
    case 'reach_up': return { armL: [-2.75, 0, 0.1], look: [0.2, -0.3] };
    case 'push': return { armL: [-1.4, 0, 0.25], armR: [-1.4, 0, -0.25] };
    case 'hold_up': return { armR: [-2.6, 0, -0.2] };
    case 'look_up': return { look: [0, -0.45] };
    case 'shrug': return { armL: [-0.4, 0, 1.0], armR: [-0.4, 0, -1.0] };
    case 'think': return { armR: [-2.2, 0, -0.6], look: [0.2, -0.15] };
    default: return {};
  }
}

export async function createStory(canvas, base) {
  const spec = await fetch(base + 'scene.json', { cache: 'no-store' }).then((r) => r.json());
  const vo = await fetch(base + 'words.json', { cache: 'no-store' }).then((r) => r.json());
  await document.fonts.load('800 84px Display');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const glc = document.createElement('canvas'); glc.width = W; glc.height = H;
  const R = new THREE.WebGLRenderer({ canvas: glc, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  R.setPixelRatio(1); R.setSize(W, H, false);
  R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.NoToneMapping;
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFShadowMap;

  // ---------------------------------------------------------------- timeline
  const phrases = vo.phrases;                    // one per script line
  const END = vo.duration;
  const scenes = spec.scenes.map((s, i) => ({ ...s, line: s.line ?? i }));
  const startOf = (i) => (i === 0 ? 0 : Math.max(0, (phrases[scenes[i].line] || phrases[phrases.length - 1]).s - 0.12));
  const sceneAt = (t) => { let k = 0; for (let i = 0; i < scenes.length; i++) if (t >= startOf(i)) k = i; return k; };
  const spanOf = (i) => [startOf(i), i + 1 < scenes.length ? startOf(i + 1) : END];
  const lineWords = (i) => vo.words.filter((w) => w.phrase === scenes[i].line);
  const eventsUpTo = (t, type) => scenes.flatMap((s, i) => (startOf(i) <= t ? (s.events || []).filter((e) => e.type === type).map((e) => ({ ...e, at: startOf(i), i })) : []));

  // ---------------------------------------------------------------- world
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(42, W / H, 0.1, 300);
  K.skyAndLights(scene);
  const clouds = K.clouds(scene);
  K.ground(scene);
  K.dike(scene, -30, -1.3, 40, 0.1); K.dike(scene, 6.6, -11.6, 7.4, -1.3); K.dike(scene, -30, -12.4, 40, -11.6);
  K.dike(scene, -7.8, -11.6, -7.0, -1.3); K.dike(scene, 21, -11.6, 21.8, -1.3);
  const fields = {
    A: K.riceField(scene, { x0: -7, z0: -11.4, x1: 6.6, z1: -1.4, seed: 1 }),
    B: K.riceField(scene, { x0: 7.4, z0: -11.4, x1: 21, z1: -1.4, seed: 2 }),
    back: K.riceField(scene, { x0: -26, z0: -21, x1: 36, z1: -12.6, spacing: 0.62, height: 0.8, seed: 3, jitter: 0.2 }),
    left: K.riceField(scene, { x0: -26, z0: -11.4, x1: -7.8, z1: -1.4, spacing: 0.6, seed: 4, jitter: 0.2 }),
  };
  [[-16, -27, 0.2], [-9, -29, -0.1], [-2, -27.5, 0.15], [5, -29.5, 0], [12, -27, -0.2], [19, -28.5, 0.1], [26, -27, 0.3], [33, -29, -0.2]]
    .forEach(([x, z, r], i) => K.house(scene, x, z, r, 1, i % 3 === 1 ? '#C9502A' : K.PAL.roof));
  [[-12, -25], [-5, -24.5], [1.5, -25.5], [8.5, -24.8], [15.5, -25.2], [23, -24.6], [30, -25.5], [-20, -24]]
    .forEach(([x, z], i) => K.palm(scene, x, z, 5 + hash01(i, 6) * 2, i));

  // props
  const props = {};
  (spec.world?.props || []).forEach((p, i) => {
    const id = p.id || `${p.type}${i}`;
    let o;
    if (p.type === 'bamboo_pole') o = K.bambooPole(scene, p.x, p.z, { height: 2.3, arm: 1.6, bottles: p.bottles ?? 5 });
    else if (p.type === 'scarecrow') o = K.scarecrow(scene, p.x, p.z);
    else if (p.type === 'sacks') {
      const g = new THREE.Group(); scene.add(g);
      const n = p.count ?? 5;
      const spots = [[-0.62, 0, 0], [0, 0, 0], [0.62, 0, 0], [-0.31, 0.62, 0], [0.31, 0.62, 0], [0, 1.22, 0]];
      for (let k = 0; k < n; k++) {
        const sk = K.sack(g);
        const [sx, sy, sz] = spots[k] || [((k - 6) % 3 - 1) * 0.62, 0, -0.6 - Math.floor((k - 6) / 3) * 0.6];
        sk.position.set(sx, sy, sz);
      }
      g.position.set(p.x, 0.18, p.z); o = { obj: g };
    } else if (p.type === 'house') { o = { obj: K.house(scene, p.x, p.z, p.rot || 0, p.scale || 1) }; }
    else if (p.type === 'palm') { o = { obj: K.palm(scene, p.x, p.z, p.height || 5, i) }; }
    if (!o) return;
    o.spec = p; o.id = id; props[id] = o;
  });

  // characters
  const chars = {};
  Object.entries(spec.characters || {}).forEach(([id, c]) => {
    const shirt = Array.isArray(c.shirt) ? c.shirt : SHIRTS[c.shirt] || SHIRTS.hijau;
    const sarong = Array.isArray(c.sarong) ? c.sarong : SARONGS[c.sarong] || SARONGS.coklat;
    const ch = K.character(scene, { shirt, sarong, hat: c.hat || null, mustache: !!c.mustache, blush: !!c.blush });
    ch.sack = K.sack(scene); ch.sack.visible = false;
    chars[id] = ch;
  });

  // birds
  const flock = Array.from({ length: 14 }, (_, i) => { const b = K.bird(scene); b.h = [hash01(i, 21), hash01(i, 22), hash01(i, 23)]; return b; });
  const perchBirds = [0, 1, 2].map(() => K.bird(scene));

  // ---------------------------------------------------------------- helpers
  const groundY = (z) => (z > -1.3 && z < 0.1 ? 0.18 : 0);
  function castPos(c, i, t, sc) {
    const [a, b] = spanOf(sc);
    const at = c.at || [i * 1.5, -0.6];
    if (!c.walk_to) return { x: at[0], z: at[1], walking: 0 };
    const k = E.inOutSine(prog(t, a + 0.1, a + Math.max(1, (b - a) * 0.75)));
    return { x: lerp(at[0], c.walk_to[0], k), z: lerp(at[1], c.walk_to[1], k), walking: k > 0 && k < 1 ? 1 : 0,
      heading: Math.atan2(c.walk_to[0] - at[0], c.walk_to[1] - at[1]) };
  }
  function focusOf(s, t, sc) {
    if (Array.isArray(s.focus)) return V(...s.focus);
    const cast = s.cast || [];
    const pts = [];
    const ids = s.focus ? [s.focus, ...(props[s.focus] && !['closeup'].includes(s.shot) ? cast.map((c) => c.who) : [])] : cast.map((c) => c.who);
    ids.forEach((id) => {
      const ci = cast.findIndex((c) => c.who === id);
      if (ci >= 0) { const p = castPos(cast[ci], ci, t, sc); pts.push(V(p.x, groundY(p.z), p.z)); }
      else if (props[id]) pts.push(props[id].obj.position.clone());
    });
    if (!pts.length) return V(3, 0, -3);
    const f = pts.reduce((a, p) => a.add(p), V(0, 0, 0)).multiplyScalar(1 / pts.length);
    f.spread = pts.length > 1 ? Math.max(...pts.map((p) => p.distanceTo(f))) : 0;
    return f;
  }
  const SHOTS = {   // [offset from focus, look offset]
    establishing: [[2, 9, 16], [2, 0.5, -12]],
    wide: [[2.5, 2.8, 7.5], [0, 0.9, 0]],
    medium: [[1.1, 1.7, 3.8], [0, 1.25, 0]],
    closeup: [[0.6, 1.9, 2.5], [0, 1.65, 0]],
    low: [[0.8, 0.6, 1.9], [0, 1.7, 0]],
    high: [[1.5, 7, 7], [0, 0, 0]],
    track: [[2.2, 1.65, 3.4], [-0.6, 1.05, 0]],
  };
  function placeCamera(t, sc) {
    const s = scenes[sc];
    const [a, b] = spanOf(sc);
    const p = clamp((t - a) / Math.max(0.5, b - a));
    const f = focusOf(s, t, sc);
    const shot = SHOTS[s.shot] ? s.shot : (sc === 0 ? 'establishing' : 'medium');
    const side = s.side ?? (sc % 2 ? -1 : 1);
    const scale = 1 + (f.spread || 0) * 0.45;
    let [off, look] = SHOTS[shot];
    if (shot === 'establishing') {
      const e = E.inOutCubic(p);
      const [mo, ml] = SHOTS.medium;
      const pos = V(off[0], off[1], off[2]).lerp(V(mo[0] * side, mo[1], mo[2] * scale), e).add(f.clone().setY(0));
      const tgt = V(look[0], look[1], look[2]).lerp(V(...ml), e).add(f.clone().setY(0));
      cam.position.copy(pos); cam.lookAt(tgt); return;
    }
    const pos = V(off[0] * side * scale, off[1], off[2] * scale).add(f);
    const tgt = V(look[0] * side, look[1], look[2]).add(f);
    pos.lerp(tgt, 0.1 * E.inOutSine(p));          // slow push-in
    cam.position.copy(pos); cam.lookAt(tgt);
  }

  // ---------------------------------------------------------------- frame
  function updateWorld(t) {
    const sc = sceneAt(t);
    clouds.update(t);
    // wind: per-scene strength, eased at scene edges
    let wind = 0.05;
    scenes.forEach((s, i) => {
      const ev = (s.events || []).find((e) => e.type === 'wind');
      if (!ev) return;
      const [a, b] = spanOf(i);
      const k = clamp(Math.min((t - a) / 0.7, (b + 0.8 - t) / 1.2));
      wind = Math.max(wind, 0.05 + (ev.strength ?? 0.3) * Math.max(0, k));
    });
    const harv = eventsUpTo(t, 'harvest')[0];
    const ripe = harv ? E.inOutCubic(prog(t, harv.at, harv.at + 0.9)) : 0;
    fields.A.update(t, { wind, ripe }); fields.B.update(t, { wind: wind * 0.8, ripe });
    fields.back.update(t, { wind: wind * 0.7, ripe: ripe * 0.6 }); fields.left.update(t, { wind: wind * 0.7, ripe: ripe * 0.6 });

    // props: visibility (hidden until 'appear', gone after 'disappear'), scarecrow raise, bottle knocks
    Object.values(props).forEach((o) => {
      const ap = eventsUpTo(t, 'appear').filter((e) => e.target === o.id).pop();
      const dis = eventsUpTo(t, 'disappear').filter((e) => e.target === o.id).pop();
      let k = o.spec.hidden ? 0 : 1;
      if (ap) k = E.outBack(prog(t, ap.at + 0.3, ap.at + 0.8), 1.8);
      if (dis && (!ap || dis.at >= ap.at)) k = 0;
      o.obj.visible = k > 0.001; o.obj.scale.setScalar(Math.max(0.001, k));
      if (o.spec.type === 'scarecrow') {
        const r = eventsUpTo(t, 'raise').filter((e) => e.target === o.id).pop();
        const tilt = o.spec.fallen ? (r ? lerp(1.15, 0, M.spring(t - r.at - 0.8, M.SPRING.bouncy)) : 1.15) : 0;
        o.update(t, { tilt });
      }
      if (o.spec.type === 'bamboo_pole') {
        const kn = scenes[sc].events?.find((e) => e.type === 'knock' && (!e.target || e.target === o.id));
        let knock = 0;
        if (kn) {
          const words = (kn.words || ['tuk']).map((w) => w.toLowerCase());
          let times = lineWords(sc).filter((w) => words.some((x) => w.w.toLowerCase().startsWith(x))).map((w) => w.s);
          if (!times.length) { const [a, b] = spanOf(sc); for (let x = a + 0.3; x < b; x += 0.5) times.push(x); }
          knock = times.reduce((acc, s) => acc + Math.max(0, 1 - Math.abs(t - s - 0.05) / 0.12), 0);
        }
        o.update(t, { wind: wind * 1.4, knock: clamp(knock) });
      }
    });

    // flock: arrive / flee
    const arr = eventsUpTo(t, 'birds_arrive').pop();
    const flee = eventsUpTo(t, 'birds_flee').pop();
    flock.forEach((b, i) => {
      if (!arr || (flee && flee.at < arr.at)) { b.obj.visible = false; return; }
      const region = arr.target === 'B' ? [8, 20] : [-4, 5];
      const perch = V(region[0] + b.h[0] * (region[1] - region[0]), 1.0, -9 + b.h[1] * 6);
      const from = V(perch.x + (b.h[2] - 0.5) * 14, 9 + b.h[2] * 4, perch.z - 28);
      const away = V(perch.x + (b.h[0] - 0.5) * 24, 15 + b.h[1] * 4, perch.z - 40);
      const a0 = arr.at + 0.2 + i * 0.1, land = a0 + 1.7;
      if (t < a0) { b.obj.visible = false; return; }
      b.obj.visible = true;
      if (flee && flee.at > arr.at && t >= flee.at + 0.1 + b.h[2] * 0.7) {
        const f0 = flee.at + 0.1 + b.h[2] * 0.7, k = E.inQuad(prog(t, f0, f0 + 2.4));
        if (k >= 1) { b.obj.visible = false; return; }
        b.set(perch.clone().lerp(away, k), away, true, t); return;
      }
      if (t < land) {
        const k = E.outCubic(prog(t, a0, land)); const pos = from.clone().lerp(perch, k); pos.y += Math.sin(k * Math.PI) * 1.5;
        b.set(pos, perch, true, t);
      } else {
        const pos = perch.clone(); pos.y += Math.abs(Math.sin((t - land) * 5 + i)) * 0.04;
        b.set(pos, V(pos.x + Math.sin(i), pos.y, pos.z + Math.cos(i)), false, t);
      }
    });
    // perched birds on a prop (scarecrow)
    const bl = eventsUpTo(t, 'birds_land').pop();
    const bLeave = eventsUpTo(t, 'birds_leave').pop();
    perchBirds.forEach((b, i) => {
      const host = bl && props[bl.target];
      if (!host || (bLeave && bLeave.at > bl.at)) { b.obj.visible = false; return; }
      const perch = host.perch ? host.perch[i] : host.obj.position.clone().add(V((i - 1) * 0.4, 1.2, 0));
      const land = bl.at + 0.55 + i * 0.4;
      if (t < land - 1.1) { b.obj.visible = false; return; }
      b.obj.visible = true;
      if (t < land) {
        const k = E.outCubic(prog(t, land - 1.1, land)); const from = V(perch.x + (i - 1) * 4, 7, perch.z - 7);
        const pos = from.lerp(perch, k); pos.y += Math.sin(k * Math.PI) * 0.8; b.set(pos, perch, true, t);
      } else b.set(perch, V(perch.x + 0.5, perch.y, perch.z + 1), false, t);
    });

    // camera first (characters may face it), then the cast
    placeCamera(t, sc);
    const cast = scenes[sc].cast || [];
    Object.entries(chars).forEach(([id, ch]) => {
      const ci = cast.findIndex((c) => c.who === id);
      ch.obj.visible = ci >= 0; ch.sack.visible = false;
      if (ci < 0) return;
      const c = cast[ci];
      const p = castPos(c, ci, t, sc);
      const y = groundY(p.z);
      let rot = 0;
      if (p.walking) rot = p.heading;
      else if (typeof c.face === 'number') rot = c.face;
      else if (c.face === 'left') rot = -Math.PI / 2;
      else if (c.face === 'right') rot = Math.PI / 2;
      else if (c.face === 'away') rot = Math.PI;
      else if (c.face && (chars[c.face] || props[c.face])) {
        const o = props[c.face]?.obj.position || (() => { const oc = cast.find((x) => x.who === c.face); const op = oc ? castPos(oc, cast.indexOf(oc), t, sc) : { x: 0, z: 0 }; return V(op.x, 0, op.z); })();
        rot = Math.atan2(o.x - p.x, o.z - p.z);
      } else rot = Math.atan2(cam.position.x - p.x, cam.position.z - p.z) * 0.85;   // 'camera' (default)
      const carry = c.pose === 'carry';
      ch.pose(t, { x: p.x, y, z: p.z, rot, walk: p.walking, mood: c.mood || 'smile', hold: carry ? 1 : 0, ...poseArms(c.pose, t) });
      if (carry) {
        ch.sack.visible = true;
        ch.sack.position.set(p.x + Math.sin(rot) * 0.38, y + 0.44, p.z + Math.cos(rot) * 0.38);
        ch.sack.rotation.set(0, rot, 0.1);
      }
    });
    return sc;
  }

  const KEY = new Set((spec.keywords || []).map((k) => k.toLowerCase()));
  function caption(t) {
    if (spec.captions === false) return;
    let cur = null;
    for (const w of vo.words) { if (w.s - 0.04 <= t) cur = w; else break; }
    if (!cur || t > cur.e + 0.6) return;
    const k = M.spring(t - cur.s + 0.04, M.SPRING.snappy);
    const s = 1.18 - 0.18 * k;
    const clean = cur.w.toLowerCase().replace(/[^a-z0-9-]/g, '');
    ctx.save();
    ctx.translate(W / 2, H * 0.7); ctx.scale(s, s);
    ctx.font = '800 84px Display'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(20,16,12,0.92)';
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.strokeText(cur.w, 0, 0);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = KEY.has(clean) ? '#FFD23F' : '#FFFFFF';
    ctx.fillText(cur.w, 0, 0);
    ctx.restore();
  }

  function seek(t) {
    updateWorld(t);
    R.render(scene, cam);
    ctx.drawImage(glc, 0, 0);
    caption(t);
  }
  return { spec, duration: END, seek, scenes: scenes.length };
}
