// engine.js: turns a scene script (scene.json) + narration timings (words.json) into a 3-D village
// story. Everything is a pure function of time: seek(t) paints frame t. Vocabulary (README in
// docs/scene-format.md): characters, poses, camera shots, props and events.
import * as THREE from 'three';
import * as M from './motion.js';
import * as K from './kit.js';

export let W = 1080, H = 1920;   // set per render: 9x16 (1080x1920) or 16x9 (1920x1080)
let LAND = false, BASE_FOV = 42, UI = 1;
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
    case 'watch': return { armL: [-1.35, 0, 0.75], look: [0.15, -0.35] };
    case 'hold_out': return { armR: [-1.45, 0, -0.25] };
    case 'ride': return { armL: [-1.2, 0, 0.25], armR: [-1.2, 0, -0.25] };
    case 'whistle': return { armR: [-2.0, 0, -0.9], armL: [-1.0, 0, 0.6] };
    case 'struggle': return { armL: [-2.2 + Math.sin(t * 11) * 0.5, 0, 0.7], armR: [-2.2 - Math.sin(t * 11) * 0.5, 0, -0.7], look: [Math.sin(t * 5) * 0.3, 0] };
    case 'panic': return { armL: [0, 0, 2.7], armR: [0, 0, -2.7], look: [Math.sin(t * 9) * 0.25, 0] };
    case 'hug': return { armL: [-1.35, 0, -0.55], armR: [-1.35, 0, 0.55], look: [0, 0.1] };
    case 'grope': return { armR: [-1.1 + Math.sin(t * 6) * 0.3, 0, 0.3], armL: [-0.7, 0, -0.2], look: [0.35, 0.3] };
    case 'press': return { armR: [-1.05, 0, 0.2], look: [0, 0.3] };
    case 'scroll': return { armR: [-1.95 + Math.sin(t * 9) * 0.1, 0, 0.35], look: [0, 0.12] };
    case 'phone': return { armR: [-2.5, 0, 0.55], look: [0.15, 0] };
    case 'hp': return { armR: [-1.25, 0, 0.3], look: [0, 0.28] };
    case 'point_fwd': return { armR: [-1.55, 0, -0.05] };
    case 'point_r': return { armR: [-0.1, 0, -1.55] };
    case 'point_l': return { armL: [-0.1, 0, 1.55] };
    case 'awkward': return { armL: [-0.15, 0, -0.05], armR: [-0.15, 0, 0.05], look: [0, 0.32] };
    case 'nervous': return { armL: [-0.5, 0, -0.35], armR: [-0.5, 0, 0.35], look: [Math.sin(t * 3) * 0.2, 0.15] };
    case 'thirsty': return { armL: [0.1, 0, 0.05], armR: [0.1, 0, -0.05], look: [0, 0.35] };
    default: return {};
  }
}

export async function createStory(canvas, base, opts = {}) {
  LAND = opts.format === '16x9';
  [W, H] = LAND ? [1920, 1080] : [1080, 1920];
  BASE_FOV = LAND ? 30 : 42;          // landscape: narrower vertical FOV keeps subjects a similar size
  UI = LAND ? 0.82 : 1;               // text scale
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
  const startOf = (i) => {
    if (i === 0) return 0;
    const sc0 = scenes[i];
    if (sc0.at_word) {        // start on a spoken word of its line
      const w = vo.words.find((x) => x.phrase === sc0.line && x.w.toLowerCase().replace(/[^a-z0-9-]/g, '').startsWith(sc0.at_word.toLowerCase()));
      if (w) return Math.max(0, w.s - 0.1);
    }
    return Math.max(0, (phrases[sc0.line] || phrases[phrases.length - 1]).s - 0.12 + (sc0.offset || 0));
  };
  const sceneAt = (t) => { let k = 0; for (let i = 0; i < scenes.length; i++) if (t >= startOf(i)) k = i; return k; };
  const spanOf = (i) => [startOf(i), i + 1 < scenes.length ? startOf(i + 1) : END];
  const lineWords = (i) => vo.words.filter((w) => w.phrase === scenes[i].line);
  const eventsUpTo = (t, type) => scenes.flatMap((s, i) => (startOf(i) <= t ? (s.events || []).filter((e) => e.type === type).map((e) => ({ ...e, at: e.word ? wordTime(i, e.word) - 0.3 : startOf(i), i })).filter((e) => e.at <= t) : []));

  // ---------------------------------------------------------------- world
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(BASE_FOV, W / H, 0.1, 300);
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

  // other sets (built only when a scene uses them)
  const usedSets = new Set(spec.scenes.map((x) => x.set || spec.world?.set || 'sawah'));
  const SETS = { sawah: { scene } };
  if (usedSets.has('laut')) SETS.laut = K.seaSet();
  if (usedSets.has('kamar')) SETS.kamar = K.roomSet();
  if (usedSets.has('semak')) SETS.semak = K.scrubSet();
  if (usedSets.has('kota')) SETS.kota = K.townSet();
  if (usedSets.has('hutan')) {
    const keep = (spec.world?.props || []).filter((p) => p.set === 'hutan').flatMap((p) => p.type === 'path'
      ? Array.from({ length: Math.ceil((p.length || 24) / 3) + 1 }, (_, k) => ({ x: p.x + k * 3, z: p.z, r: 3 }))
      : [{ x: p.x, z: p.z, r: p.clear ?? ({ fruit_tree: 4.5, wallow: (p.r || 2.2) + 2.5, thicket: (p.r || 3) + 1.5 }[p.type] || 2.5) }]);
    SETS.hutan = K.forestSet([{ x: 0, z: 0, r: 7 }, ...keep, ...(spec.world?.clear || [])]);
  }
  if (usedSets.has('interior')) SETS.interior = K.interiorSet();
  if (usedSets.has('ilustrasi')) SETS.ilustrasi = { scene: new THREE.Scene(), flat: true };
  const setOf = (i) => scenes[i].set || spec.world?.set || 'sawah';

  // props
  const props = {};
  (spec.world?.props || []).forEach((p, i) => {
    const id = p.id || `${p.type}${i}`;
    const scene = (SETS[p.set || 'sawah'] || SETS.sawah).scene;   // eslint-disable-line no-shadow
    let o;
    if (p.type === 'bus') { o = K.bus(scene, { color: p.color }); o.obj.position.set(p.x, 0.06, p.z); o.obj.rotation.y = p.rot || 0; }
    else if (p.type === 'angkot') { o = K.angkot(scene, { color: p.color }); o.obj.position.set(p.x, 0.06, p.z); o.obj.rotation.y = p.rot || 0; }
    else if (p.type === 'motor') { o = K.motorbike(scene, { color: p.color }); o.obj.position.set(p.x, 0.06, p.z); o.obj.rotation.y = p.rot || 0; }
    else if (p.type === 'flat_rock') o = K.flatRock(scene, p.x, p.z);
    else if (['bed', 'radio', 'calendar', 'landline', 'tv', 'desk', 'fax', 'wall_clock', 'cafe_table', 'post_box', 'cafe_front'].includes(p.type)) {
      o = { bed: () => K.bed(scene), radio: () => K.radio(scene), calendar: () => K.wallCalendar(scene, p), landline: () => K.landline(scene),
        tv: () => K.crtTV(scene, p), desk: () => K.officeDesk(scene), fax: () => K.faxMachine(scene), wall_clock: () => K.wallClock(scene, p),
        cafe_table: () => K.cafeTable(scene, p), post_box: () => K.postBox(scene), cafe_front: () => K.cafeFront(scene, p) }[p.type]();
      o.obj.position.set(p.x, p.y || 0, p.z); o.obj.rotation.y = p.rot || 0; if (p.scale) o.obj.scale.setScalar(p.scale);
      o.grows = !!o.update;
    }
    else if (['fruit_tree', 'seedlings', 'dung', 'wallow', 'path', 'thicket', 'sandal', 'ranger_hat'].includes(p.type)) {
      o = p.type === 'fruit_tree' ? K.fruitTree(scene) : p.type === 'seedlings' ? K.seedlings(scene) : p.type === 'dung' ? K.dung(scene)
        : p.type === 'wallow' ? K.wallow(scene, { r: p.r || 2.2 }) : p.type === 'path' ? K.footpath(scene, { length: p.length || 24 })
        : p.type === 'thicket' ? K.thicket(scene, { r: p.r || 3, count: p.count || 16 }) : p.type === 'sandal' ? K.sandal(scene)
        : (() => { const g = new THREE.Group(); scene.add(g); K.rangerHat(g); return { obj: g }; })();
      o.obj.position.set(p.x, p.y || 0, p.z); o.obj.rotation.y = p.rot || 0; if (p.scale) o.obj.scale.setScalar(p.scale);
      o.grows = !!o.update;
    }
    else if (p.type === 'cubes') {
      const host = p.on && props[p.on];
      o = K.cubes(scene, p.count ?? 5, host ? host.top || 0 : 0);
      o.obj.position.set(host ? host.obj.position.x : p.x, 0, host ? host.obj.position.z : p.z);
    } else if (p.type === 'trophy') { o = K.trophy(scene); o.obj.position.set(p.x, p.y || 0, p.z); o.obj.scale.setScalar(p.scale || 1); }
    else if (p.type === 'clothes') { o = K.clothesPile(scene); o.obj.position.set(p.x, 0, p.z); }
    else if (p.type === 'bamboo_pole') o = K.bambooPole(scene, p.x, p.z, { height: 2.3, arm: 1.6, bottles: p.bottles ?? 5 });
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
    o.spec = p; o.id = id; o.home = o.obj.position.clone(); o.homeRot = o.obj.rotation.y; props[id] = o;
  });

  // characters
  const chars = {};
  Object.entries(spec.characters || {}).forEach(([id, c]) => {
    const shirt = Array.isArray(c.shirt) ? c.shirt : SHIRTS[c.shirt] || SHIRTS.hijau;
    const sarong = Array.isArray(c.sarong) ? c.sarong : SARONGS[c.sarong] || SARONGS.coklat;
    const ch = c.type === 'octopus' ? K.octopus(scene, { color: c.color || '#E8704A' })
      : c.type === 'wombat' ? K.wombat(scene, { color: c.color || '#8C6A50' })
      : ['badak', 'rusa', 'babi', 'kancil'].includes(c.type) ? K.beast(scene, { kind: c.type, color: c.color, bucket: !!c.bucket, map: !!c.map })
      : c.type === 'rangkong' ? K.hornbill(scene, { bucket: !!c.bucket })
      : K.character(scene, { shirt, sarong, hat: c.hat || null, mustache: !!c.mustache, blush: !!c.blush,
        hair: c.hair, hairLong: c.hairLong, whistle: !!c.whistle, baby: !!c.baby, capColor: c.capColor });
    ch.type = c.type || 'person';
    ch.sack = K.sack(scene); ch.sack.visible = false;
    chars[id] = ch;
  });

  // birds
  const flock = Array.from({ length: 14 }, (_, i) => { const b = K.bird(scene); b.h = [hash01(i, 21), hash01(i, 22), hash01(i, 23)]; return b; });
  const perchBirds = [0, 1, 2].map(() => K.bird(scene));

  // growable props: value 0..1 set by "grow" events {target, from, to, word, delay, dur}; it holds after the scene
  function growK(id, t) {
    let v = props[id]?.spec.k ?? 0;
    for (let i = 0; i < scenes.length; i++) {
      if (startOf(i) > t) break;
      (scenes[i].events || []).filter((e) => e.type === 'grow' && e.target === id).forEach((e) => {
        const [a, b] = spanOf(i);
        const t0 = a + (e.delay || 0), t1 = e.word ? wordTime(i, e.word) : a + (e.dur ?? (b - a));
        v = lerp(e.from ?? v, e.to ?? 1, (e.ease === 'linear' ? (x) => x : E.inOutSine)(prog(t, t0, Math.max(t0 + 0.05, t1))));
      });
    }
    return v;
  }
  const puffs = [];
  const getPuff = (n, sceneObj) => { while (puffs.length <= n) puffs.push(K.puff(sceneObj)); const pf = puffs[n]; if (pf.obj.parent !== sceneObj) sceneObj.add(pf.obj); return pf; };

  // ---------------------------------------------------------------- helpers
  const groundY = (z) => (z > -1.3 && z < 0.1 ? 0.18 : 0);
  const castY = (c, z, sc) => {
    if (c.y != null) return c.y;
    if (setOf(sc) !== 'sawah') return chars[c.who]?.type === 'octopus' && ['swim', 'idle', 'float'].includes(c.mode || 'idle') ? 0.5 : 0;
    return groundY(z);
  };
  // time inside a scene with a freeze: the world stops at the frozen moment, captions keep going
  function worldTime(t, sc) {
    const fz = (scenes[sc].events || []).find((e) => e.type === 'freeze');
    if (!fz) return t;
    const ft = wordTime(sc, fz.word, fz.at);
    return t > ft ? ft : t;
  }
  function wordTime(sc, word, at) {
    const [a, b] = spanOf(sc);
    if (word) { const w = lineWords(sc).find((x) => x.w.toLowerCase().replace(/[^a-z0-9-]/g, '').startsWith(word.toLowerCase())); if (w) return w.s; }
    return a + (at ?? (b - a) * 0.5);
  }
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
      if (ci >= 0) { const p = castPos(cast[ci], ci, t, sc); pts.push(V(p.x, castY(cast[ci], p.z, sc), p.z)); }
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
  const SHOTS_SMALL = {
    establishing: [[1.5, 3.5, 8], [0, 0.4, -4]],
    wide: [[1.6, 1.4, 4.8], [0, 0.45, 0]],
    medium: [[0.6, 0.8, 2.6], [0, 0.5, 0]],
    closeup: [[0.35, 0.75, 2.3], [0, 0.5, 0]],
    low: [[0.6, 0.3, 3.0], [0, 0.65, 0]],
    high: [[1, 3.5, 3.5], [0, 0.2, 0]],
    track: [[1.4, 0.8, 2.8], [-0.4, 0.45, 0]],
  };
  // an octopus is ~1.4 m tall with its eyes at ~0.6 m: frame its face, not a person's head height
  const SHOTS_OCTO = {
    establishing: [[1.5, 5, 10], [0, 0.6, -6]],
    wide: [[1.8, 2.0, 6.2], [0, 0.8, 0]],
    medium: [[0.7, 1.2, 3.6], [0, 0.85, 0]],
    closeup: [[0.3, 1.05, 2.5], [0, 0.9, 0]],
    low: [[0.6, 0.35, 2.8], [0, 1.0, 0]],
    high: [[1.2, 5, 5], [0, 0.4, 0]],
    track: [[1.6, 1.2, 3.6], [-0.4, 0.8, 0]],
  };
  function placeCamera(t, sc) {
    const s = scenes[sc];
    const [a, b] = spanOf(sc);
    const camSpec = (LAND ? s.cam_16x9 : s.cam_9x16) || s.cam;
    if (camSpec) {
      const z0 = s.zoom ? lerp(1, s.zoom, E.outCubic(prog(t, a, a + 0.8))) : 1;
      if (Math.abs(cam.fov - BASE_FOV / z0) > 1e-4) { cam.fov = BASE_FOV / z0; cam.updateProjectionMatrix(); }
      const e = E.inOutSine(clamp((t - a) / Math.max(0.5, b - a)));
      const to = camSpec.to || camSpec;
      const follow = camSpec.follow && props[camSpec.follow] ? props[camSpec.follow].obj.position : null;
      const pos = V(...camSpec.pos).lerp(V(...to.pos), e), tgt = V(...camSpec.look).lerp(V(...to.look), e);
      if (follow) { pos.add(follow); tgt.add(follow); }
      cam.position.copy(pos); cam.lookAt(tgt); return;
    }
    const z = s.zoom ? lerp(1, s.zoom, E.outCubic(prog(t, a, a + 0.8))) : 1;
    if (Math.abs(cam.fov - BASE_FOV / z) > 1e-4) { cam.fov = BASE_FOV / z; cam.updateProjectionMatrix(); }
    const p = clamp((t - a) / Math.max(0.5, b - a));
    const f = focusOf(s, t, sc);
    const shot = SHOTS[s.shot] ? s.shot : (sc === 0 ? 'establishing' : 'medium');
    const side = s.side ?? (sc % 2 ? -1 : 1);
    const scale = (1 + (f.spread || 0) * 0.45) * (s.dist || 1);
    const octoFocus = (s.cast || []).some((c) => chars[c.who]?.type === 'octopus') && (!s.focus || chars[s.focus]?.type === 'octopus');
    const smallFocus = (s.cast || []).some((c) => chars[c.who]?.type === 'wombat') && (!s.focus || chars[s.focus]?.type === 'wombat' || (Array.isArray(s.focus) === false && props[s.focus] && s.small));
    let [off, look] = (octoFocus ? SHOTS_OCTO : (smallFocus || s.small) ? SHOTS_SMALL : SHOTS)[shot];
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
  function updateWorld(tReal) {
    const sc = sceneAt(tReal);
    const t = worldTime(tReal, sc);
    const active = setOf(sc);
    if (active === 'laut') {
      let deep = 0;
      scenes.forEach((s2, i) => {
        if (!(s2.events || []).some((e) => e.type === 'deep')) return;
        const [a, b] = spanOf(i); deep = Math.max(deep, clamp(Math.min((t - a) / 0.8, (b + 0.6 - t) / 0.8)));
      });
      SETS.laut.update(t, { deep });
    }
    if (active === 'semak') SETS.semak.update(t);
    if (active === 'kota') {
      const tl = (scenes[sc].events || []).find((e) => e.type === 'timelapse');
      const [a, b] = spanOf(sc);
      const tod = tl ? (tl.from ?? 0.15) + (tl.cycles ?? 1) * clamp((t - a) / Math.max(0.5, b - a)) : (scenes[sc].tod ?? 0.12);
      SETS.kota.update(t, { tod });
    }
    // vehicles: each scene may move props (drive from -> to, arriving at a word)
    Object.values(props).forEach((o) => { if (o.home) { o.obj.position.copy(o.home); o.obj.rotation.y = o.homeRot; } });
    (scenes[sc].vehicles || []).forEach((v) => {
      const o = props[v.id]; if (!o) return;
      const [a, b] = spanOf(sc);
      const tEnd = v.word ? wordTime(sc, v.word) : a + (v.dur ?? (b - a));
      const k = (v.ease === 'linear' ? (x) => x : E.outCubic)(prog(t, a + (v.delay || 0), tEnd));
      const from = v.from || [o.home.x, o.home.z], to = v.to || from;
      o.obj.position.set(lerp(from[0], to[0], k), 0.06 + (v.bump ? Math.abs(Math.sin(t * 14)) * 0.03 : 0), lerp(from[1], to[1], k));
      if (v.rot != null) o.obj.rotation.y = v.rot;
    });
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
      if ((scenes[sc].hide || []).includes(o.id)) k = 0;
      o.obj.visible = k > 0.001; o.obj.scale.setScalar(Math.max(0.001, k) * (o.spec.scale || 1));
      if (o.grows) o.update(t, growK(o.id, t));
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
    const evs = scenes[sc].events || [];
    puffs.forEach((pf) => { pf.obj.visible = false; });
    let puffN = 0;
    Object.entries(chars).forEach(([id, ch]) => {
      const ci = cast.findIndex((c) => c.who === id);
      ch.obj.visible = ci >= 0; ch.sack.visible = false;
      if (ci < 0) return;
      if (ch.obj.parent !== SETS[active].scene) SETS[active].scene.add(ch.obj);
      if (ch.hat) ch.hat.visible = c0visible(cast[ci], t, sc);
      if (ch.sack.parent !== SETS[active].scene) SETS[active].scene.add(ch.sack);
      let c = cast[ci];
      let p = castPos(c, ci, t, sc);
      let y = castY(c, p.z, sc);
      let rideRot = null;
      if (c.ride && props[c.ride]) {             // seated in / on a vehicle
        const o = props[c.ride];
        const seat = (o.seats || {})[c.seat || Object.keys(o.seats || { a: 0 })[0]] || [0, 0.9, 0];
        const wp = new THREE.Vector3(...seat).applyEuler(o.obj.rotation).add(o.obj.position);
        p = { x: wp.x, z: wp.z, walking: 0 }; y = wp.y - 0.52;
        const local = c.seat === 'kanan1' || c.seat === 'kanan2' ? Math.PI : c.seat && c.seat.startsWith('kiri') ? 0 : -Math.PI / 2;
        rideRot = o.obj.rotation.y + local + (c.turn || 0);
      }
      if (c.enter) {                              // pops in from somewhere (behind a pole, out of the river)
        const te = c.enter.word ? wordTime(sc, c.enter.word) - 0.25 : spanOf(sc)[0] + (c.enter.at ?? 0.3);
        const k = M.spring(t - te, M.SPRING.bouncy);
        const fr = c.enter.from;
        p = { ...p, x: lerp(fr[0], p.x, k), z: lerp(fr[2], p.z, k) };
        y = lerp(fr[1], y, k);
        if (t < te && c.enter.hidden) { ch.obj.visible = false; return; }
      }
      if (c.puff) {                               // pops in / out in a puff of smoke
        const tp = c.puff.word ? wordTime(sc, c.puff.word) : spanOf(sc)[0] + (c.puff.at ?? 0.3);
        const kp = (t - tp + 0.12) / 0.9;
        const size = c.puff.size ?? (ch.animal ? (ch.height || 1) * 1.1 : 1.6);
        if (kp > 0 && kp < 1) getPuff(puffN++, SETS[active].scene).set(kp, p.x, y + size * 0.45, p.z, size);
        const shown = c.puff.mode === 'in' ? t >= tp : t < tp;
        if (!shown) { ch.obj.visible = false; return; }
      }
      let rot = 0;
      if (rideRot != null) rot = rideRot;
      else if (p.walking && ch.animal) rot = p.heading;
      else if (p.walking) rot = ch.type === 'octopus' || ch.type === 'wombat' ? p.heading * 0.35 + Math.atan2(cam.position.x - p.x, cam.position.z - p.z) * 0.65 : p.heading;
      else if (typeof c.face === 'number') rot = c.face;
      else if (c.face === 'left') rot = -Math.PI / 2;
      else if (c.face === 'right') rot = Math.PI / 2;
      else if (c.face === 'away') rot = Math.PI;
      else if (c.face && (chars[c.face] || props[c.face])) {
        const o = props[c.face]?.obj.position || (() => { const oc = cast.find((x) => x.who === c.face); const op = oc ? castPos(oc, cast.indexOf(oc), t, sc) : { x: 0, z: 0 }; return V(op.x, 0, op.z); })();
        rot = Math.atan2(o.x - p.x, o.z - p.z);
      } else rot = Math.atan2(cam.position.x - p.x, cam.position.z - p.z) * 0.85;   // 'camera' (default)
      if (c.pose_at) {                            // change pose on spoken words: [{word, pose}]
        const hit = c.pose_at.filter((q) => t >= wordTime(sc, q.word, q.at)).pop();
        if (hit) c = { ...c, pose: hit.pose, mood: hit.mood || c.mood };
      }
      if (ch.hold) ch.hold(c.item || null);
      const carry = c.pose === 'carry';
      if (ch.animal) {
        ch.pose(t, { x: p.x, y, z: p.z, rot, mode: p.walking ? 'walk' : (c.mode || 'idle'), mood: c.mood || 'smile' });
        return;
      }
      if (ch.type === 'wombat') {
        ch.pose(t, { x: p.x, y, z: p.z, rot, mode: p.walking ? 'walk' : (c.mode || 'idle'), mood: c.mood || 'smile' });
        return;
      }
      if (ch.type === 'octopus') {
        const [a] = spanOf(sc);
        const hs = evs.find((e) => e.type === 'hearts');
        const stop = evs.find((e) => e.type === 'heart_stop');
        const stopT = stop ? wordTime(sc, stop.word, stop.at) : Infinity;
        const blueOn = scenes.some((s2, i) => i <= sc && (s2.events || []).some((e) => e.type === 'blue') && startOf(i) <= tReal);
        const swimBob = (c.mode === 'swim') ? Math.sin(t * 1.2 * M.TAU) * 0.08 : 0;
        ch.pose(t, { x: p.x, y: y + swimBob, z: p.z, rot, mode: c.mode || (p.walking ? 'swim' : 'idle'), mood: c.mood || 'smile',
          xray: hs ? E.outCubic(prog(tReal, a + 0.2, a + 0.7)) : 0, blue: blueOn ? 1 : 0, stopped: tReal >= stopT ? 1 : 0 });
        return;
      }
      ch.pose(t, { x: p.x, y, z: p.z, rot, walk: p.walking, mood: c.mood || 'smile', hold: carry ? 1 : 0, sit: c.ride || c.sit ? 1 : 0, ...poseArms(c.pose || (c.ride && props[c.ride]?.spec.type === 'motor' && c.seat !== 'belakang' ? 'ride' : null), t) });
      if (c.pose === 'struggle') { ch.root.rotation.z = Math.sin(t * 10) * 0.07; ch.root.position.x += Math.sin(t * 13) * 0.03; } else ch.root.rotation.z = 0;
      if (c.pose === 'lying' || c.lying) { ch.root.rotation.set(0, 0, Math.PI / 2); ch.root.position.set(p.x + 0.95, y + 0.78, p.z); }
      if (carry) {
        ch.sack.visible = true;
        ch.sack.position.set(p.x + Math.sin(rot) * 0.38, y + 0.44, p.z + Math.cos(rot) * 0.38);
        ch.sack.rotation.set(0, rot, 0.1);
      }
    });
    evs.filter((e) => e.type === 'snort').forEach((e) => {   // small puffs from an animal's nose
      const ch = chars[e.who]; if (!ch || !ch.obj.visible || !ch.nose) return;
      const ts = e.word ? wordTime(sc, e.word) : spanOf(sc)[0] + (e.at ?? 0.5);
      const np = new THREE.Vector3(); ch.nose.getWorldPosition(np);
      [0, 0.35].forEach((dt) => { const k = (t - ts - dt) / 0.7; if (k > 0 && k < 1) getPuff(puffN++, SETS[active].scene).set(k, np.x, np.y, np.z, 0.28); });
    });
    return sc;
  }
  function c0visible(c, t, sc) { return c.hat !== false && !(c.hat_off && t >= wordTime(sc, c.hat_off)); }

  const ILLUS_EXTRA = {};   // illustrations registered by overlay helpers below
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
    ctx.translate(W / 2, H * (LAND ? 0.8 : 0.76)); ctx.scale(s * UI, s * UI);
    ctx.font = '800 84px Display'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(20,16,12,0.92)';
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.strokeText(cur.w, 0, 0);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = spec.caption_color || (KEY.has(clean) ? '#FFD23F' : '#FFFFFF');
    ctx.fillText(cur.w, 0, 0);
    ctx.restore();
  }

  // ---------------------------------------------------------------- on-screen text (titles, labels, freeze flash)
  function titleAt(t) {
    let cur = null, from = 0, sc = sceneAt(t);
    for (let i = 0; i <= sc; i++) if (scenes[i].title !== undefined) { cur = scenes[i].title; from = i; }
    if (!cur) return null;
    const s = scenes[from];
    const t0 = s.title_word ? wordTime(from, s.title_word) : startOf(from) + 0.15;
    return t >= t0 ? { text: cur, t0 } : null;
  }
  function drawTitle(t) {
    const ti = titleAt(t);
    if (!ti) return;
    const k = M.spring(t - ti.t0, M.SPRING.bouncy);
    const parts = ti.text.split(/(\{arrow\}|\{dot\}|\{trophy\})/).filter(Boolean);
    let size = 104;
    const measure = () => { ctx.font = `800 ${size}px Display`; return parts.reduce((w, p) => w + (p === '{arrow}' ? size * 0.9 : p === '{dot}' || p === '{trophy}' ? size * 0.8 : ctx.measureText(p).width), 0); };
    while (measure() > (LAND ? 1500 : 960) && size > 46) size -= 4;
    const total = measure();
    ctx.save();
    ctx.translate(W / 2, H * (LAND ? 0.14 : 0.2)); ctx.scale((0.7 + 0.3 * k) * UI, (0.7 + 0.3 * k) * UI); ctx.globalAlpha = clamp(k * 1.5);
    let x = -total / 2;
    ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    parts.forEach((p) => {
      if (p === '{arrow}') {
        const w = size * 0.9;
        ctx.lineWidth = size * 0.28; ctx.strokeStyle = 'rgba(20,16,12,0.92)'; ctx.lineCap = 'round';
        const arrow = (col, lw) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x + w * 0.12, 0); ctx.lineTo(x + w * 0.85, 0); ctx.moveTo(x + w * 0.6, -size * 0.22); ctx.lineTo(x + w * 0.86, 0); ctx.lineTo(x + w * 0.6, size * 0.22); ctx.stroke(); };
        arrow('rgba(20,16,12,0.92)', size * 0.26); arrow('#FFD23F', size * 0.11);
        x += w; return;
      }
      if (p === '{trophy}') {
        const cx = x + size * 0.38, u = size / 100;
        const cupPath = () => { ctx.beginPath(); ctx.moveTo(cx - 26 * u, -34 * u); ctx.lineTo(cx + 26 * u, -34 * u); ctx.quadraticCurveTo(cx + 24 * u, 4 * u, cx, 8 * u);
          ctx.quadraticCurveTo(cx - 24 * u, 4 * u, cx - 26 * u, -34 * u); ctx.closePath(); };
        ctx.lineJoin = 'round';
        ctx.fillStyle = 'rgba(20,16,12,0.92)'; ctx.strokeStyle = 'rgba(20,16,12,0.92)'; ctx.lineWidth = 14 * u;
        cupPath(); ctx.stroke(); ctx.fillRect(cx - 6 * u - 6 * u, 6 * u, 24 * u, 22 * u); ctx.fillRect(cx - 20 * u - 6 * u, 26 * u, 52 * u, 16 * u);
        ['#F2C14E'].forEach((g) => { ctx.fillStyle = g; cupPath(); ctx.fill(); ctx.fillRect(cx - 6 * u, 6 * u, 12 * u, 22 * u); ctx.fillRect(cx - 20 * u, 28 * u, 40 * u, 10 * u); });
        ctx.strokeStyle = '#F2C14E'; ctx.lineWidth = 6 * u;
        [-1, 1].forEach((d) => { ctx.beginPath(); ctx.arc(cx + d * 28 * u, -20 * u, 11 * u, d < 0 ? Math.PI * 0.5 : -Math.PI * 0.5, d < 0 ? Math.PI * 1.5 : Math.PI * 0.5, false); ctx.stroke(); });
        x += size * 0.8; return;
      }
      if (p === '{dot}') {
        const r = size * 0.27;
        ctx.fillStyle = 'rgba(20,16,12,0.92)'; ctx.beginPath(); ctx.arc(x + size * 0.36, 0, r + 7, 0, M.TAU); ctx.fill();
        ctx.fillStyle = '#2E86F0'; ctx.beginPath(); ctx.arc(x + size * 0.36, 0, r, 0, M.TAU); ctx.fill();
        x += size * 0.7; return;
      }
      ctx.font = `800 ${size}px Display`; ctx.textAlign = 'left';
      ctx.lineWidth = 16; ctx.strokeStyle = 'rgba(20,16,12,0.92)'; ctx.strokeText(p, x, 0);
      ctx.fillStyle = '#FFFFFF'; ctx.fillText(p, x, 0);
      x += ctx.measureText(p).width;
    });
    ctx.restore();
  }
  function drawHeartLabels(t, sc) {
    const evs = scenes[sc].events || [];
    const hs = evs.find((e) => e.type === 'hearts' && e.labels !== false);
    if (!hs) return;
    const oc = Object.values(chars).find((c) => c.type === 'octopus' && c.obj.visible);
    if (!oc) return;
    const k = E.outCubic(prog(t, startOf(sc) + 0.5, startOf(sc) + 1.1));
    const labels = hs.labels || ['insang', 'insang', 'badan'];
    oc.hearts.forEach((h, i) => {
      const p = new THREE.Vector3(); h.getWorldPosition(p); p.project(cam);
      const sx = (p.x * 0.5 + 0.5) * W, sy = (-p.y * 0.5 + 0.5) * H;
      const lx = sx + (i === 0 ? -170 : i === 1 ? 170 : 0), ly = sy + (i === 2 ? -170 : 60);
      ctx.save(); ctx.globalAlpha = k;
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(lerp(sx, lx, k), lerp(sy, ly, k)); ctx.stroke();
      ctx.font = '800 46px Display'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(20,16,12,0.92)'; ctx.strokeText(labels[i], lx, ly);
      ctx.fillStyle = i === 2 ? '#FFD23F' : '#FFFFFF'; ctx.fillText(labels[i], lx, ly);
      ctx.restore();
    });
  }
  function drawClock(t, sc) {
    const ev = (scenes[sc].events || []).find((e) => e.type === 'clock');
    if (!ev) return;
    const [a] = spanOf(sc);
    const toSec = (s2) => s2.split(':').reduce((acc, v) => acc * 60 + Number(v), 0);
    const s0 = toSec(ev.start), s1 = ev.stop ? toSec(ev.stop) : s0 + 99;
    const tStop = ev.word ? wordTime(sc, ev.word) : null;
    let cur;
    if (tStop != null) cur = Math.round(s1 - Math.max(0, Math.ceil(tStop - t)));
    else cur = Math.min(s1, s0 + Math.floor(t - a - (ev.delay || 0)));
    cur = Math.max(s0, Math.min(s1, cur));
    const txt = [Math.floor(cur / 3600), Math.floor(cur / 60) % 60, cur % 60].map((v) => String(v).padStart(2, '0')).join(':');
    const k = M.spring(t - a - 0.1, M.SPRING.bouncy);
    const hit = cur >= s1;
    ctx.save();
    ctx.translate(W / 2, H * (LAND ? 0.33 : 0.36)); ctx.scale(k * UI, k * UI);
    ctx.fillStyle = 'rgba(20,16,12,0.85)'; ctx.beginPath(); ctx.roundRect(-250, -70, 500, 140, 30); ctx.fill();
    ctx.strokeStyle = hit ? '#5CE08A' : '#FFD23F'; ctx.lineWidth = 6; ctx.stroke();
    ctx.font = '800 96px Display'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = hit ? '#5CE08A' : '#FFFFFF'; ctx.fillText(txt, 0, 6);
    ctx.restore();
  }
  // 5x7 pixel font for the 8-bit scoreboard
  const PIX = { A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110', E: '11111100001000011110100001000011111', H: '10001100011000111111100011000110001', I: '01110001000010000100001000010001110', K: '10001100101010011000101001001010001', M: '10001110111010110101100011000110001', N: '10001110011010110011100011000110001', O: '01110100011000110001100011000101110', P: '11110100011000111110100001000010000', R: '11110100011000111110101001001010001', S: '01111100001000001110000010000111110', T: '11111001000010000100001000010000100', U: '10001100011000110001100011000101110', Y: '10001100010101000100001000010000100', G: '01111100001000010111100011000101111', "0": '01110100011001110101110011000101110', "1": '00100011000010000100001000010001110', "2": '01110100010000100010001000100011111', "3": '11110000010000101110000010000111110', "4": '00010001100101010010111110001000010', "5": '11111100001111000001000011000101110', "-": '00000000000000011111000000000000000', "?": '01110100010000100010001000000000100', " ": '00000000000000000000000000000000000' };
  function pixText(txt, x, y, px, col) {
    let cx = x;
    for (const ch of txt.toUpperCase()) {
      const g = PIX[ch] || PIX[' '];
      ctx.fillStyle = col;
      for (let r = 0; r < 7; r++) for (let cc = 0; cc < 5; cc++) if (g[r * 5 + cc] === '1') ctx.fillRect(cx + cc * px, y + r * px, px - 1, px - 1);
      cx += 6 * px;
    }
    return cx - x;
  }
  ILLUS_EXTRA.papan_skor = (p, t, s2) => {
    ctx.fillStyle = '#0E1430'; ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 6) { ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(0, y, W, 2); }
    const sc2 = s2.score || { left: 'TERTIB', right: 'TERSERAH', a: 1, b: 1 };
    const px = LAND ? 14 : 12;
    const tw = (txt) => txt.length * 6 * px;
    const blink = Math.floor(t * 3) % 2 === 0;
    const k = E.outBack(prog(p, 0, 0.15), 1.6);
    ctx.save(); ctx.translate(W / 2, H * 0.42); ctx.scale(k, k);
    const l = sc2.left, r2 = sc2.right;
    if (LAND) {
      const line = `${l} ${sc2.a} - ${sc2.b} ${r2}`;
      pixText(line, -tw(line) / 2, -3.5 * px, px, '#FFFFFF');
    } else {
      pixText(l, -tw(l) / 2, -16 * px, px, '#7FD6FF');
      const mid = `${sc2.a} - ${sc2.b}`;
      pixText(mid, -tw(mid) * 1.5 / 2, -4 * px, px * 1.5, '#FFFFFF');
      pixText(r2, -tw(r2) / 2, 10 * px, px, '#FFB86B');
    }
    ctx.restore();
    if (blink) { const ins = 'PART 1'; pixText(ins, W / 2 - tw(ins) * 0.5 / 2, H * (LAND ? 0.62 : 0.6), px * 0.5, '#FFD23F'); }
  };

  // "HARI KE-30" badge
  function drawDay(t, sc) {
    const ev = (scenes[sc].events || []).find((e) => e.type === 'day');
    if (!ev) return;
    const t0 = ev.word ? wordTime(sc, ev.word) : spanOf(sc)[0] + (ev.at ?? 0.2);
    if (t < t0) return;
    const k = M.spring(t - t0, M.SPRING.bouncy);
    const txt = ev.text || `HARI KE-${ev.n ?? 1}`;
    ctx.save(); ctx.translate(W / 2, H * (LAND ? 0.3 : 0.32)); ctx.scale(k * UI, k * UI); ctx.rotate(-0.04);
    ctx.font = '800 84px Display'; const w = ctx.measureText(txt).width + 90;
    ctx.fillStyle = 'rgba(20,16,12,0.9)'; ctx.beginPath(); ctx.roundRect(-w / 2, -66, w, 132, 26); ctx.fill();
    ctx.strokeStyle = '#FF7A45'; ctx.lineWidth = 7; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#FFFFFF'; ctx.fillText(txt, 0, 6);
    ctx.restore();
  }
  // comic speech bubble over a character: {type: bubble, who, text, word|at, dur}
  function drawBubble(t, sc) {
    (scenes[sc].events || []).filter((e) => e.type === 'bubble').forEach((e) => {
      const ch = chars[e.who]; if (!ch || !ch.obj.visible) return;
      const t0 = e.word ? wordTime(sc, e.word) : spanOf(sc)[0] + (e.at ?? 0.3);
      if (t < t0 || (e.dur && t > t0 + e.dur)) return;
      const p = new THREE.Vector3(); ch.obj.getWorldPosition(p); p.y += e.y ?? (ch.height ? ch.height + 0.4 : 2.3); p.project(cam);
      const sx = (p.x * 0.5 + 0.5) * W + (e.dx || 0), sy = (-p.y * 0.5 + 0.5) * H;
      const k = M.spring(t - t0, M.SPRING.bouncy);
      ctx.save(); ctx.translate(sx, sy); ctx.scale(k * UI, k * UI);
      ctx.font = '800 64px Display'; const w = ctx.measureText(e.text).width + 70, h = 110;
      ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = 'rgba(20,16,12,0.95)'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.roundRect(-w / 2, -h - 40, w, h, 40); ctx.moveTo(-18, -42); ctx.lineTo(0, 0); ctx.lineTo(22, -42); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(-14, -48, 34, 12);
      ctx.fillStyle = '#1E1B19'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(e.text, 0, -h / 2 - 36);
      ctx.restore();
    });
  }
  // hourglass flip + "HARI KE-n"
  ILLUS_EXTRA.jam_pasir = (p, t, s2) => {
    const u = Math.min(W, H) / 1080;
    const g = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, Math.max(W, H) * 0.7); g.addColorStop(0, '#3B2F5C'); g.addColorStop(1, '#17122A');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const flip = E.inOutCubic(prog(p, 0.02, 0.18));
    const sand = prog(p, 0.18, 1);
    const v = LAND ? u * 0.72 : u;
    const cx = LAND ? W * 0.36 : W / 2, cy = H * (LAND ? 0.5 : 0.44), hw = 150 * v, hh = 230 * v;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI * (1 - flip) + (flip < 1 ? 0 : Math.sin(t * 2) * 0.02));
    const glass = () => { ctx.beginPath(); ctx.moveTo(-hw, -hh); ctx.lineTo(hw, -hh); ctx.bezierCurveTo(hw, -hh * 0.35, 18 * u, -24 * u, 18 * u, 0); ctx.bezierCurveTo(18 * u, 24 * u, hw, hh * 0.35, hw, hh); ctx.lineTo(-hw, hh);
      ctx.bezierCurveTo(-hw, hh * 0.35, -18 * u, 24 * u, -18 * u, 0); ctx.bezierCurveTo(-18 * u, -24 * u, -hw, -hh * 0.35, -hw, -hh); ctx.closePath(); };
    ctx.fillStyle = 'rgba(200,230,255,0.16)'; glass(); ctx.fill();
    ctx.save(); glass(); ctx.clip();
    const top = flip < 1 ? 0 : 1 - sand;            // sand fraction in the top bulb (after the flip)
    ctx.fillStyle = '#F2C14E';
    if (flip < 1) ctx.fillRect(-hw, hh * 0.25, hw * 2, hh * 0.75);      // before flip: sand sits at the (visually upper) end
    else {
      ctx.fillRect(-hw, -hh * 0.05 - top * hh * 0.7 + hh * 0.05, hw * 2, top * hh * 0.7);
      ctx.beginPath(); ctx.moveTo(-hw, hh); ctx.lineTo(hw, hh); ctx.lineTo(hw * 0.6, hh - sand * hh * 0.75); ctx.lineTo(0, hh - sand * hh * 0.9 - 10 * u); ctx.lineTo(-hw * 0.6, hh - sand * hh * 0.75); ctx.closePath(); ctx.fill();
      if (sand < 1) ctx.fillRect(-3 * u, 0, 6 * u, hh);
    }
    ctx.restore();
    ctx.strokeStyle = '#E8F4FF'; ctx.lineWidth = 8 * u; glass(); ctx.stroke();
    ctx.fillStyle = '#8A5A34'; [-1, 1].forEach((d) => { ctx.beginPath(); ctx.roundRect(-hw - 40 * u, d * hh - (d < 0 ? 34 : 0) * u, hw * 2 + 80 * u, 34 * u, 12 * u); ctx.fill(); });
    ctx.restore();
    const k = M.spring((p - 0.16) * 6, M.SPRING.bouncy);
    if (p > 0.16) {
      ctx.save(); if (LAND) ctx.translate(W * 0.64, cy); else ctx.translate(W / 2, cy + hh + 190 * u); ctx.scale(k * UI, k * UI);
      ctx.font = '800 120px Display'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.lineWidth = 18; ctx.strokeStyle = 'rgba(20,16,12,0.95)'; const txt = s2.day_text || `HARI KE-${s2.day ?? 1}`;
      ctx.strokeText(txt, 0, 0); ctx.fillStyle = '#FFD23F'; ctx.fillText(txt, 0, 0); ctx.restore();
    }
  };
  // map of Indonesia, a blinking dot on Ujung Kulon (zooms in on Java in the second half)
  const ISLANDS = [
    [[95.3,5.6],[97.5,5.2],[98.7,3.8],[100.4,2.3],[101.4,1.9],[103.8,1.1],[104.5,-1.0],[106.0,-3.2],[105.8,-5.9],[104.5,-5.9],[102.3,-4.0],[101.0,-2.5],[99.0,0.0],[98.7,1.7],[97.1,3.5]],
    [[105.2,-6.8],[106.0,-6.0],[108.3,-6.3],[110.4,-6.9],[112.6,-6.9],[114.4,-7.7],[114.6,-8.7],[112.0,-8.3],[110.0,-8.1],[108.0,-7.8],[106.4,-7.4],[105.4,-6.9]],
    [[105.2,-1.6],[106.4,-2.0],[106.7,-3.0],[105.8,-2.4]],
    [[114.4,-8.1],[115.7,-8.4],[115.2,-8.8],[114.5,-8.5]],
    [[115.9,-8.3],[116.7,-8.3],[119.0,-8.2],[119.2,-8.7],[116.5,-8.9],[115.9,-8.8]],
    [[119.8,-8.4],[123.0,-8.2],[122.8,-8.7],[120.0,-8.8]],
    [[119.0,-9.4],[120.8,-9.9],[120.5,-10.3],[119.0,-9.8]],
    [[123.5,-10.2],[125.2,-9.0],[127.3,-8.4],[127.0,-8.8],[124.4,-10.0],[123.6,-10.4]],
    [[109.0,1.5],[109.6,2.0],[111.0,1.6],[113.0,3.2],[115.4,5.0],[116.8,6.9],[117.7,6.4],[119.2,5.3],[118.0,4.3],[117.7,2.0],[118.9,1.0],[117.5,0.0],[116.6,-1.4],[116.5,-3.3],[114.6,-4.0],[113.0,-3.2],[111.6,-3.4],[110.2,-2.9],[109.6,-1.0],[108.9,0.4]],
    [[119.4,-5.5],[119.6,-3.5],[118.8,-2.7],[119.3,-1.0],[119.8,0.1],[120.3,0.8],[121.0,1.3],[123.0,0.9],[124.3,1.4],[125.2,1.6],[124.5,0.4],[123.2,0.5],[121.1,0.4],[120.3,-0.8],[121.6,-1.0],[123.4,-0.9],[121.8,-1.9],[122.3,-3.2],[123.2,-4.6],[122.0,-4.6],[121.3,-3.0],[120.6,-2.7],[120.9,-4.0],[120.4,-5.6]],
    [[127.8,1.8],[128.6,1.2],[128.0,0.5],[128.8,-0.5],[127.9,-0.8],[127.4,0.6]],
    [[128.0,-3.2],[130.8,-3.4],[130.6,-3.9],[128.2,-3.6]],
    [[126.0,-3.1],[127.2,-3.3],[126.9,-3.8],[126.1,-3.6]],
    [[131.0,-1.4],[132.3,-0.4],[134.0,-0.9],[134.3,-2.4],[135.5,-3.4],[137.6,-1.5],[139.0,-2.0],[141.0,-2.6],[141.0,-9.1],[139.9,-8.1],[138.0,-8.4],[137.6,-7.5],[138.7,-6.6],[136.0,-4.8],[134.1,-3.9],[133.4,-4.0],[132.0,-2.8],[133.0,-2.3],[131.9,-1.6]],
  ];
  ILLUS_EXTRA.peta_indonesia = (p, t, s2) => {
    ctx.fillStyle = '#1F6F8B'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 2;
    for (let x = 0; x < W; x += 90) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 90) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    const mapW = W * 0.92, sc0 = mapW / 47.5, UK = [105.35, -6.78];
    const proj = (lon, lat) => [(lon - 117.75) * sc0, -(lat + 2.5) * sc0];
    const zk = E.inOutCubic(prog(p, 0.38, 0.62)), z = 1 + 1.5 * zk;
    const [ux, uy] = proj(...UK);
    const fx = lerp(0, ux * 0.85, zk), fy = lerp(0, uy * 0.85, zk);
    ctx.save(); ctx.translate(W / 2, H * (LAND ? 0.5 : 0.46)); ctx.scale(z, z); ctx.translate(-fx, -fy);
    const intro = E.outCubic(prog(p, 0, 0.12));
    ctx.globalAlpha = intro;
    ISLANDS.forEach((isl, i) => {
      ctx.beginPath(); isl.forEach(([lo, la], k) => { const [x, y] = proj(lo, la); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath();
      ctx.fillStyle = i === 1 ? '#9ED36A' : '#7DBF57'; ctx.fill(); ctx.lineJoin = 'round'; ctx.strokeStyle = '#2E5A2A'; ctx.lineWidth = 3 / z; ctx.stroke();
    });
    ctx.globalAlpha = 1;
    const dk = prog(p, 0.12, 0.2);
    if (dk > 0) {
      const pulse = (t * 1.2) % 1;
      ctx.strokeStyle = `rgba(255,80,60,${1 - pulse})`; ctx.lineWidth = 5 / z; ctx.beginPath(); ctx.arc(ux, uy, (14 + pulse * 46) / z, 0, M.TAU); ctx.stroke();
      ctx.fillStyle = Math.floor(t * 3) % 2 ? '#FF5A3C' : '#FFD23F'; ctx.beginPath(); ctx.arc(ux, uy, (12 * E.outBack(dk, 2)) / z, 0, M.TAU); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(ux, uy, 4 / z, 0, M.TAU); ctx.fill();
    }
    ctx.restore();
    const lk = M.spring((p - 0.62) * 8, M.SPRING.bouncy);
    if (p > 0.62) {
      ctx.save(); ctx.translate(W / 2, H * (LAND ? 0.72 : 0.62)); ctx.scale(lk * UI, lk * UI);
      ctx.font = '800 76px Display'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      const txt = s2.label || 'UJUNG KULON'; const w = ctx.measureText(txt).width + 70;
      ctx.fillStyle = 'rgba(20,16,12,0.9)'; ctx.beginPath(); ctx.roundRect(-w / 2, -60, w, 120, 28); ctx.fill();
      ctx.strokeStyle = '#FF5A3C'; ctx.lineWidth = 6; ctx.stroke(); ctx.fillStyle = '#FFFFFF'; ctx.fillText(txt, 0, 4);
      ctx.restore();
    }
  };

  // desk calendar flipping days (n0 -> n1)
  ILLUS_EXTRA.kalender = (p, t, s2) => {
    const u = Math.min(W, H) / 1080;
    ctx.fillStyle = '#F3E3C3'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(160,110,60,0.08)'; for (let i = 0; i < 50; i++) ctx.fillRect((hash01(i, 5) * W) | 0, (hash01(i, 6) * H) | 0, 8, 8);
    const n0 = s2.from ?? 1, n1 = s2.to ?? 14;
    const q = E.inOutSine(prog(p, 0.08, 0.8)), f = n0 + (n1 - n0) * q, day = Math.floor(f), frac = f - day;
    const cx = W / 2, cy = H * (LAND ? 0.5 : 0.46), w = 520 * u, h = 600 * u;
    const page = (n, lift) => {
      ctx.save(); ctx.translate(cx, cy - h / 2);
      ctx.scale(1, Math.cos(lift * Math.PI * 0.5)); ctx.translate(0, 0);
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.roundRect(-w / 2, 0, w, h, 24 * u); ctx.fill();
      ctx.fillStyle = '#C0392B'; ctx.beginPath(); ctx.roundRect(-w / 2, 0, w, 150 * u, [24 * u, 24 * u, 0, 0]); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.font = `800 ${74 * u}px Display`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s2.month || 'MARET 1995', 0, 78 * u);
      ctx.fillStyle = n % 7 === 0 ? '#C0392B' : '#2E2E2E'; ctx.font = `800 ${300 * u}px Display`; ctx.fillText(String(Math.min(n, n1)), 0, 380 * u);
      ctx.restore();
    };
    page(Math.min(n1, day + 1), 0);
    if (day < n1) page(day, frac);
    ctx.fillStyle = '#5A3B24'; [-1, 1].forEach((d) => { ctx.beginPath(); ctx.roundRect(cx + d * 150 * u - 14 * u, cy - h / 2 - 30 * u, 28 * u, 60 * u, 10 * u); ctx.fill(); });
  };
  // a generic social post on a phone; likes count up and stop at s2.likes
  ILLUS_EXTRA.post_sosmed = (p, t, s2) => {
    const u = Math.min(W, H) / 1080;
    ctx.fillStyle = '#20232B'; ctx.fillRect(0, 0, W, H);
    const pw = 640 * u, ph = 1160 * u, cx = W / 2, cy = H * 0.5, big = LAND ? 0.8 : 1.3;
    const k = E.outBack(prog(p, 0, 0.12), 1.4);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k * big, k * big);
    ctx.fillStyle = '#0E0F12'; ctx.beginPath(); ctx.roundRect(-pw / 2 - 24 * u, -ph / 2 - 24 * u, pw + 48 * u, ph + 48 * u, 70 * u); ctx.fill();
    ctx.fillStyle = '#FAFAFA'; ctx.beginPath(); ctx.roundRect(-pw / 2, -ph / 2, pw, ph, 50 * u); ctx.fill();
    const x0 = -pw / 2 + 40 * u, y0 = -ph / 2 + 110 * u;
    ctx.fillStyle = '#E85D75'; ctx.beginPath(); ctx.arc(x0 + 40 * u, y0 + 40 * u, 40 * u, 0, M.TAU); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.font = `800 ${40 * u}px Display`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('R', x0 + 40 * u, y0 + 42 * u);
    ctx.textAlign = 'left'; ctx.fillStyle = '#1E1B19'; ctx.font = `800 ${38 * u}px Display`; ctx.fillText(s2.user || 'raka', x0 + 100 * u, y0 + 28 * u);
    ctx.fillStyle = '#8A8A8A'; ctx.font = `${28 * u}px sans-serif`; ctx.fillText(s2.ago || 'baru saja', x0 + 100 * u, y0 + 66 * u);
    // post text, wrapped
    ctx.fillStyle = '#1E1B19'; ctx.font = `800 ${46 * u}px Display`;
    const words = (s2.text || 'gue habis hidup di tahun 90-an').split(' '); let line = '', ly = y0 + 160 * u;
    words.forEach((w2) => { const tl = line ? line + ' ' + w2 : w2; if (ctx.measureText(tl).width > pw - 80 * u) { ctx.fillText(line, x0, ly); line = w2; ly += 58 * u; } else line = tl; }); ctx.fillText(line, x0, ly);
    // picture: a cassette
    const iy = ly + 50 * u, iw = pw - 80 * u, ih = 380 * u;
    ctx.fillStyle = '#F2C14E'; ctx.beginPath(); ctx.roundRect(x0, iy, iw, ih, 24 * u); ctx.fill();
    ctx.fillStyle = '#2E2E2E'; ctx.beginPath(); ctx.roundRect(x0 + 60 * u, iy + 70 * u, iw - 120 * u, ih - 140 * u, 20 * u); ctx.fill();
    ctx.fillStyle = '#F4F1EA'; [-1, 1].forEach((d) => { ctx.beginPath(); ctx.arc(x0 + iw / 2 + d * 110 * u, iy + ih / 2, 46 * u, 0, M.TAU); ctx.fill(); });
    ctx.fillStyle = '#2E2E2E'; [-1, 1].forEach((d) => { ctx.save(); ctx.translate(x0 + iw / 2 + d * 110 * u, iy + ih / 2); ctx.rotate(t * 3); for (let i = 0; i < 6; i++) { ctx.rotate(M.TAU / 6); ctx.fillRect(-4 * u, 20 * u, 8 * u, 22 * u); } ctx.restore(); });
    // likes
    const likes = Math.min(s2.likes ?? 3, Math.floor(prog(p, 0.2, 0.45) * ((s2.likes ?? 3) + 0.99)));
    const hy = iy + ih + 80 * u;
    ctx.fillStyle = likes > 0 ? '#E8364F' : '#BBBBBB';
    ctx.save(); ctx.translate(x0 + 34 * u, hy); const hb = likes > 0 ? 1 + 0.25 * Math.max(0, 1 - ((p - 0.2) * 20 % 1)) * (p < 0.46 ? 1 : 0) : 1; ctx.scale(hb * u, hb * u);
    ctx.beginPath(); ctx.moveTo(0, 14); ctx.bezierCurveTo(-34, -10, -18, -38, 0, -18); ctx.bezierCurveTo(18, -38, 34, -10, 0, 14); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#1E1B19'; ctx.font = `800 ${44 * u}px Display`; ctx.textBaseline = 'middle'; ctx.fillText(`${likes} suka`, x0 + 80 * u, hy + 2 * u);
    ctx.restore();
  };

  function drawFreeze(t, sc) {
    const fz = (scenes[sc].events || []).find((e) => e.type === 'freeze');
    if (!fz) return;
    const ft = wordTime(sc, fz.word, fz.at);
    if (t < ft) return;
    ctx.save();
    ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = `rgba(128,128,128,${0.75 * clamp((t - ft) / 0.2)})`; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    const fl = 1 - clamp((t - ft) / 0.25); if (fl > 0) { ctx.fillStyle = `rgba(255,255,255,${fl * 0.8})`; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  // ---------------------------------------------------------------- 2-D illustrations (set "ilustrasi")
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); }
  const ILLUS = {
    usus_kubus(p, t) {
      ctx.fillStyle = '#FFF3E0'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(180,120,80,0.08)';
      for (let i = 0; i < 40; i++) ctx.fillRect((hash01(i, 3) * W) | 0, (hash01(i, 4) * H) | 0, 6, 6);
      // the intestine: a thick tube snaking down the frame, soft and stiff bands alternating
      const pts = [[120, 560], [960, 640], [940, 900], [140, 980], [150, 1240], [960, 1300]];
      const path = new Path2D(); path.moveTo(...pts[0]);
      for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; path.bezierCurveTo((x0 + x1) / 2, y0, (x0 + x1) / 2, y1, x1, y1); }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = '#B2584F'; ctx.lineWidth = 150; ctx.stroke(path);
      ctx.strokeStyle = '#F2A08F'; ctx.lineWidth = 128; ctx.stroke(path);
      ctx.save(); ctx.setLineDash([70, 70]); ctx.strokeStyle = '#D9776A'; ctx.lineWidth = 128; ctx.stroke(path); ctx.restore();
      // labels
      const lab = (txt, x, y, col) => { ctx.font = '800 50px Display'; ctx.textAlign = 'center'; ctx.lineWidth = 12; ctx.strokeStyle = '#FFF3E0'; ctx.strokeText(txt, x, y); ctx.fillStyle = col; ctx.fillText(txt, x, y); };
      const lk = E.outCubic(prog(p, 0.08, 0.2));
      if (lk > 0) { ctx.globalAlpha = lk; lab('lentur', 330, 500, '#B2584F'); lab('kaku', 760, 520, '#7A3530'); ctx.globalAlpha = 1; }
      // the dropping travels along the tube and squares up as it goes
      const q = E.inOutSine(prog(p, 0.12, 0.86));
      const seg = Math.min(pts.length - 2, Math.floor(q * (pts.length - 1)));
      const f = q * (pts.length - 1) - seg;
      const [x0, y0] = pts[seg], [x1, y1] = pts[seg + 1];
      const bx = ((1 - f) ** 3) * x0 + 3 * ((1 - f) ** 2) * f * ((x0 + x1) / 2) + 3 * (1 - f) * f * f * ((x0 + x1) / 2) + f ** 3 * x1;
      const by = ((1 - f) ** 3) * y0 + 3 * ((1 - f) ** 2) * f * y0 + 3 * (1 - f) * f * f * y1 + f ** 3 * y1;
      const sq = q, size = 92, rad = lerp(size / 2, 8, sq);
      const squeeze = 1 + Math.sin(t * 9) * 0.06 * (1 - sq);
      ctx.save(); ctx.translate(bx, by); ctx.rotate(Math.sin(q * 12) * 0.25 * (1 - sq));
      ctx.fillStyle = '#6B472B'; rr(-size / 2 * squeeze, -size / 2 / squeeze, size * squeeze, size / squeeze, rad); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; rr(-size / 2 + 12, -size / 2 + 10, size * 0.4, size * 0.22, rad / 2); ctx.fill();
      ctx.restore();
      // the finished cube pops out at the end (isometric)
      const ck = E.outBack(prog(p, 0.86, 0.95), 1.8);
      if (ck > 0) {
        const cx = 820, cy = 1500, a = 110 * ck;
        const face = (pts2, col) => { ctx.beginPath(); ctx.moveTo(...pts2[0]); pts2.slice(1).forEach((pp) => ctx.lineTo(...pp)); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
        face([[cx, cy - a], [cx + a * 0.87, cy - a * 0.5], [cx, cy], [cx - a * 0.87, cy - a * 0.5]], '#8A5E3B');
        face([[cx - a * 0.87, cy - a * 0.5], [cx, cy], [cx, cy + a], [cx - a * 0.87, cy + a * 0.5]], '#6B472B');
        face([[cx + a * 0.87, cy - a * 0.5], [cx, cy], [cx, cy + a], [cx + a * 0.87, cy + a * 0.5]], '#563821');
        if (ck > 0.9) lab('kubus!', cx, cy + a + 80, '#563821');
      }
    },
  };

  function seek(t) {
    const sc = updateWorld(t);
    const setNow = SETS[setOf(sc)];
    if (setNow.flat) {
      // one illustration runs across consecutive scenes that share it
      let i0 = sc, i1 = sc;
      while (i0 > 0 && setOf(i0 - 1) === 'ilustrasi' && scenes[i0 - 1].illustration === scenes[sc].illustration) i0--;
      while (i1 + 1 < scenes.length && setOf(i1 + 1) === 'ilustrasi' && scenes[i1 + 1].illustration === scenes[sc].illustration) i1++;
      const a = spanOf(i0)[0], b = spanOf(i1)[1];
      ({ ...ILLUS, ...ILLUS_EXTRA }[scenes[sc].illustration] || ILLUS.usus_kubus)(clamp((t - a) / Math.max(0.5, b - a)), t, scenes[sc]);
    } else {
      R.render(setNow.scene, cam);
      ctx.drawImage(glc, 0, 0);
    }
    drawFreeze(t, sc);
    drawClock(t, sc);
    drawDay(t, sc);
    drawBubble(t, sc);
    drawHeartLabels(t, sc);
    drawTitle(t);
    caption(t);
  }
  return { spec, duration: END, seek, scenes: scenes.length, spans: scenes.map((_, i) => spanOf(i)) };
}
