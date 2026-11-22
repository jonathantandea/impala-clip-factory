// kit.js: reusable low-poly cartoon kit for village stories (Cerita Factory).
// Every builder returns { obj, update?(t, opts) }; update is a pure function of time.
// Units: metres. Characters ~1.7 tall with big round heads.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as M from './motion.js';

export const PAL = {
  sky: '#7FC6EE', horizon: '#E4F4FF', water: '#9FB497', dike: '#8ACB45', grass: '#79BE3E',
  rice: '#63B437', gold: '#E2B33C', wall: '#F4E8D2', roof: '#D45A2A', wood: '#7A4E2D',
  skin: '#FFF9F0', black: '#1E1B19', caping: '#E8A93A', bamboo: '#C8B65C', sack: '#EFE4C6',
  bird: '#5C4632', beak: '#F2B634', palm: '#4E9E36', trunk: '#8B6A45', hill: '#6DB44A', blush: '#F1A7A0',
};
const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const MATS = new Map();
export const mat = (c, o) => { const k = c + JSON.stringify(o || {}); if (!MATS.has(k)) MATS.set(k, lam(c, o)); return MATS.get(k); };
const cast = (m, c = true, r = true) => { m.castShadow = c; m.receiveShadow = r; return m; };

// ---------------------------------------------------------------- textures
function canvasTex(w, h, paint) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  paint(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
export function batik(base, motif, accent) {
  return canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    c.fillStyle = motif;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const cx = x * 64 + (y % 2) * 32 + 16, cy = y * 64 + 32;
      c.beginPath(); c.moveTo(cx, cy - 18); c.lineTo(cx + 14, cy); c.lineTo(cx, cy + 18); c.lineTo(cx - 14, cy); c.closePath(); c.fill();
      c.fillStyle = accent; c.beginPath(); c.arc(cx, cy, 5, 0, M.TAU); c.fill(); c.fillStyle = motif;
    }
  });
}
export function plaid(a, b) {
  return canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = a; c.fillRect(0, 0, w, h);
    c.fillStyle = b; c.globalAlpha = 0.55;
    for (let i = 0; i < 4; i++) { c.fillRect(i * 32, 0, 10, h); c.fillRect(0, i * 32, w, 10); }
  });
}

// ---------------------------------------------------------------- environment
export function skyAndLights(scene) {
  scene.background = canvasTex(4, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, PAL.sky); g.addColorStop(0.75, PAL.horizon); g.addColorStop(1, PAL.horizon);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  scene.fog = new THREE.Fog(PAL.horizon, 38, 110);
  scene.add(new THREE.HemisphereLight('#D9F0FF', '#6E9A4C', 1.6));
  const sun = new THREE.DirectionalLight('#FFF2D8', 2.1);
  sun.position.set(-10, 18, 10); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 14, bottom: -14, near: 1, far: 60 });
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
  sun.target.position.set(6, 0, -5); scene.add(sun, sun.target);
  return sun;
}

export function clouds(scene, seed = 4) {
  const g = new THREE.Group(), m = mat('#FFFFFF', { emissive: '#FFFFFF', emissiveIntensity: 0.35 });
  const geo = new THREE.SphereGeometry(1, 14, 10);
  const items = [];
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group();
    const n = 3 + Math.floor(M.hash01(i, seed) * 3);
    for (let j = 0; j < n; j++) {
      const s = new THREE.Mesh(geo, m); const r = 1.6 + M.hash01(i * 7 + j, seed) * 1.4;
      s.scale.set(r * 1.3, r, r); s.position.set(j * 1.9 - n, M.hash01(j + i, 9) * 0.8, 0); c.add(s);
    }
    c.userData.x0 = -40 + i * 11 + M.hash01(i, 2) * 6;
    c.position.set(c.userData.x0, 16 + M.hash01(i, 3) * 9, -62 - M.hash01(i, 5) * 20);
    g.add(c); items.push(c);
  }
  scene.add(g);
  return { obj: g, update(t) { items.forEach((c) => { c.position.x = c.userData.x0 + t * 0.35; }); } };
}

export function ground(scene) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat(PAL.water));
  p.rotation.x = -Math.PI / 2; p.receiveShadow = true; scene.add(p);
  // far hills
  const hm = mat(PAL.hill);
  [[-50, -95, 34], [5, -110, 46], [60, -100, 38], [110, -120, 50]].forEach(([x, z, r]) => {
    const h = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12), hm); h.scale.y = 0.35; h.position.set(x, -2, z); scene.add(h);
  });
  return p;
}

export function dike(scene, x0, z0, x1, z1, h = 0.18) {
  const d = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1 - x0), h, Math.abs(z1 - z0)), mat(PAL.dike));
  d.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2); cast(d, false, true); scene.add(d); return d;
}

// rice clump: three tapered blades merged; wind bends the tops in the vertex shader
function clumpGeometry(height) {
  const blades = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.PlaneGeometry(0.07, height, 1, 4);
    const pos = g.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const y = pos.getY(v) + height / 2, k = 1 - (y / height) * 0.85;
      pos.setX(v, pos.getX(v) * k + y * y * 0.12 * (i % 2 ? 1 : -1));
      pos.setY(v, y);
    }
    g.rotateY((i / 4) * Math.PI + 0.3);
    g.computeVertexNormals();
    blades.push(g);
  }
  return mergeGeometries(blades);
}
export function riceField(scene, { x0, z0, x1, z1, spacing = 0.42, height = 0.95, seed = 1, jitter = 0.12 }) {
  const geo = clumpGeometry(height);
  const material = new THREE.MeshLambertMaterial({ color: PAL.rice, side: THREE.DoubleSide });
  const uniforms = { uTime: { value: 0 }, uWind: { value: 0.05 }, uH: { value: height } };
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = 'uniform float uTime; uniform float uWind; uniform float uH;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec3 ip = vec3(instanceMatrix[3]);
      float hh = clamp(position.y / uH, 0.0, 1.0);
      float sw = sin(uTime * 2.4 + ip.x * 0.45 + ip.z * 0.3) + 0.5 * sin(uTime * 4.1 + ip.x * 1.3);
      transformed.x += sw * uWind * hh * hh;
      transformed.z += sw * uWind * 0.35 * hh * hh;
    `);
  };
  const nx = Math.floor((x1 - x0) / spacing), nz = Math.floor((z1 - z0) / spacing);
  const mesh = new THREE.InstancedMesh(geo, material, nx * nz);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  let i = 0;
  for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
    const h1 = M.hash01(i, seed), h2 = M.hash01(i, seed + 7), h3 = M.hash01(i, seed + 13);
    p.set(x0 + (a + 0.5) * spacing + (h1 - 0.5) * jitter, 0, z0 + (b + 0.5) * spacing + (h2 - 0.5) * jitter);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), h3 * M.TAU);
    const sc = 0.85 + h1 * 0.3; s.set(sc, sc * (0.9 + h2 * 0.2), sc);
    m4.compose(p, q, s); mesh.setMatrixAt(i, m4);
    col.setScalar(0.85 + h3 * 0.25); mesh.setColorAt(i, col);
    i++;
  }
  mesh.receiveShadow = true;
  scene.add(mesh);
  const green = new THREE.Color(PAL.rice), gold = new THREE.Color(PAL.gold);
  return { obj: mesh, update(t, { wind = 0.05, ripe = 0 } = {}) { uniforms.uTime.value = t; uniforms.uWind.value = wind; material.color.lerpColors(green, gold, M.clamp(ripe)); } };
}

export function house(scene, x, z, rot = 0, s = 1, roof = PAL.roof) {
  const g = new THREE.Group();
  const w = cast(new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 2), mat(PAL.wall)));
  w.position.y = 0.75; g.add(w);
  const r = cast(new THREE.Mesh(new THREE.ConeGeometry(2.05, 1.15, 4), mat(roof)));
  r.position.y = 2.07; r.rotation.y = Math.PI / 4; r.scale.set(1, 1, 0.85); g.add(r);
  const d = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.95, 0.05), mat(PAL.wood)); d.position.set(0, 0.48, 1.01); g.add(d);
  [-0.75, 0.75].forEach((wx) => { const wn = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.05), mat('#4D6B7A')); wn.position.set(wx, 0.9, 1.01); g.add(wn); });
  g.position.set(x, 0, z); g.rotation.y = rot; g.scale.setScalar(s);
  scene.add(g); return g;
}

export function palm(scene, x, z, h = 5, seed = 1) {
  const g = new THREE.Group();
  const lean = (M.hash01(seed, 3) - 0.5) * 0.3;
  const trunk = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, h, 8), mat(PAL.trunk)));
  trunk.position.y = h / 2; g.add(trunk);
  const leafGeo = new THREE.SphereGeometry(1, 10, 6); leafGeo.scale(1.6, 0.12, 0.38); leafGeo.translate(1.4, 0, 0);
  for (let i = 0; i < 7; i++) {
    const l = cast(new THREE.Mesh(leafGeo, mat(PAL.palm)));
    l.position.y = h; l.rotation.set(0, (i / 7) * M.TAU, -0.35 - M.hash01(i, seed) * 0.25); g.add(l);
  }
  g.position.set(x, 0, z); g.rotation.z = lean; scene.add(g); return g;
}

// ---------------------------------------------------------------- props
export function bambooPole(scene, x, z, { height = 2.6, arm = 1.6, bottles = 5 } = {}) {
  const g = new THREE.Group();
  const bm = mat(PAL.bamboo), nm = mat('#A08F3E');
  const pole = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, height, 10), bm)); pole.position.y = height / 2; g.add(pole);
  for (let i = 1; i < 5; i++) { const n = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.012, 6, 12), nm); n.rotation.x = Math.PI / 2; n.position.y = (i * height) / 5; g.add(n); }
  const armM = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, arm, 8), bm)); armM.rotation.z = Math.PI / 2; armM.position.set(arm / 2, height - 0.12, 0); g.add(armM);
  const prof = [[0, 0], [0.07, 0], [0.08, 0.02], [0.08, 0.2], [0.05, 0.26], [0.025, 0.3], [0.025, 0.36], [0, 0.36]].map(([a, b]) => new THREE.Vector2(a, b));
  const bottleGeo = new THREE.LatheGeometry(prof, 14);
  const bottleMats = ['#8FD3BC', '#B8E3F0', '#9CC97A'].map((c) => mat(c, { transparent: true, opacity: 0.82, emissive: c, emissiveIntensity: 0.15 }));
  const strM = mat('#3D3328');
  const items = [];
  for (let i = 0; i < bottles; i++) {
    const piv = new THREE.Group(); piv.position.set(0.25 + (i * (arm - 0.35)) / Math.max(1, bottles - 1), height - 0.12, 0);
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.32, 4), strM); str.position.y = -0.16; piv.add(str);
    const b = cast(new THREE.Mesh(bottleGeo, bottleMats[i % 3])); b.rotation.x = Math.PI; b.position.y = -0.32; piv.add(b);
    g.add(piv); items.push(piv);
  }
  g.position.set(x, 0, z); scene.add(g);
  return {
    obj: g, bottles: items,
    // swing: wind amplitude; knock: 0..1 pulse that makes the bottles hit each other; shown: how many bottles hang
    update(t, { wind = 0.05, knock = 0, shown = bottles, drop = 1 } = {}) {
      items.forEach((p, i) => {
        p.visible = i < shown;
        const ph = i * 1.7;
        p.rotation.z = Math.sin(t * 3.1 + ph) * wind * 1.6 + (i % 2 ? 1 : -1) * knock * 0.35;
        p.rotation.x = Math.sin(t * 2.3 + ph) * wind * 0.8;
        if (i === shown - 1) p.position.y = height - 0.12 + (1 - drop) * 0.6;
      });
    },
  };
}

export function scarecrow(scene, x, z) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const wood = mat(PAL.wood), straw = mat('#D9B862'), shirt = mat('#B7553A'), burlap = mat('#CDB487');
  const pole = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.2, 8), wood)); pole.position.y = 1.1; body.add(pole);
  const bar = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 8), wood)); bar.rotation.z = Math.PI / 2; bar.position.y = 1.55; body.add(bar);
  const torso = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.27, 0.65, 10), shirt)); torso.position.y = 1.3; body.add(torso);
  [-1, 1].forEach((d) => { const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6), straw); tuft.rotation.z = (d * Math.PI) / 2; tuft.position.set(d * 0.82, 1.55, 0); body.add(tuft); });
  const head = cast(new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), burlap)); head.position.y = 1.86; body.add(head);
  const hat = cast(new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.2, 20), mat(PAL.caping))); hat.position.y = 2.1; body.add(hat);
  const eyeM = mat(PAL.black);
  [-0.08, 0.08].forEach((ex) => { const e = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.01), eyeM); e.position.set(ex, 1.9, 0.235); e.rotation.z = 0.7 * Math.sign(ex); body.add(e); const e2 = e.clone(); e2.rotation.z = -e.rotation.z; body.add(e2); });
  root.position.set(x, 0, z); scene.add(root);
  return { obj: root, perch: [[0, 2.22, 0], [-0.62, 1.6, 0], [0.6, 1.6, 0]].map((p) => new THREE.Vector3(x + p[0], p[1], z + p[2])),
    update(t, { tilt = 0 } = {}) { body.rotation.z = tilt; } };
}

export function sack(scene) {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.34, 14, 10); geo.scale(1, 1.18, 0.82);
  const s = cast(new THREE.Mesh(geo, mat(PAL.sack))); s.position.y = 0.38; g.add(s);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 14), mat('#3F7A3A')); band.rotation.x = Math.PI / 2; band.position.y = 0.72; g.add(band);
  const tie = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 8), mat(PAL.sack)); tie.position.y = 0.82; g.add(tie);
  scene.add(g); return g;
}

// ---------------------------------------------------------------- birds
export function bird(scene) {
  const g = new THREE.Group();
  const bm = mat(PAL.bird);
  const b = cast(new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), bm)); b.scale.set(1, 0.8, 1.5); g.add(b);
  const h = cast(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), bm)); h.position.set(0, 0.07, 0.14); g.add(h);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.07, 6), mat(PAL.beak)); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.06, 0.22); g.add(beak);
  [-0.02, 0.02].forEach((ex) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), mat(PAL.black)); e.position.set(ex * 2.2, 0.09, 0.19); g.add(e); });
  const wings = [-1, 1].map((d) => {
    const piv = new THREE.Group(); piv.position.set(d * 0.08, 0.03, 0);
    const w = cast(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.015, 0.14), bm)); w.position.x = d * 0.12; piv.add(w);
    g.add(piv); return piv;
  });
  scene.add(g);
  return {
    obj: g,
    set(pos, look, flap, t) {
      g.position.copy(pos);
      if (look) g.lookAt(look);
      wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (flap ? Math.sin(t * 34 + i * 0.2) * 0.9 : -0.25); });
    },
  };
}

// ---------------------------------------------------------------- characters
// spec: { shirt: [base, motif, accent], hat: 'caping'|'peci'|null, mustache, blush, sarong: [a, b] }
export function character(scene, spec) {
  const root = new THREE.Group(), hips = new THREE.Group(); root.add(hips); hips.position.y = 0.52;
  const blk = mat(PAL.black), skin = mat(PAL.skin, { emissive: '#FFF4E6', emissiveIntensity: 0.22 });
  const limb = (len, r = 0.028) => { const g = new THREE.CylinderGeometry(r, r, len, 6); g.translate(0, -len / 2, 0); return g; };
  const legs = [-1, 1].map((d) => {
    const piv = new THREE.Group(); piv.position.set(d * 0.09, 0, 0);
    piv.add(cast(new THREE.Mesh(limb(0.48), blk)));
    const foot = cast(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), blk)); foot.scale.set(1, 0.6, 1.6); foot.position.set(0, -0.5, 0.03); piv.add(foot);
    hips.add(piv); return piv;
  });
  const torso = new THREE.Group(); hips.add(torso);
  const sarong = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.29, 0.26, 16), new THREE.MeshLambertMaterial({ map: plaid(...(spec.sarong || ['#7A4A2E', '#3A2418'])) })));
  sarong.position.y = 0.06; torso.add(sarong);
  const shirtTex = batik(...spec.shirt); shirtTex.repeat.set(2, 1);
  const shirt = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.48, 16), new THREE.MeshLambertMaterial({ map: shirtTex })));
  shirt.position.y = 0.42; torso.add(shirt);
  const arms = [-1, 1].map((d) => {
    const piv = new THREE.Group(); piv.position.set(d * 0.23, 0.6, 0);
    piv.add(cast(new THREE.Mesh(limb(0.46), blk)));
    const hand = cast(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), blk)); hand.position.y = -0.47; piv.add(hand);
    torso.add(piv); return piv;
  });
  const head = new THREE.Group(); head.position.y = 0.72; torso.add(head);
  const skull = cast(new THREE.Mesh(new THREE.SphereGeometry(0.34, 28, 20), skin)); skull.position.y = 0.3; head.add(skull);
  // hair cap
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.345, 24, 12, 0, M.TAU, 0, 1.1), blk); hair.position.y = 0.3; hair.rotation.x = -0.35; head.add(hair);
  const face = new THREE.Group(); face.position.set(0, 0.3, 0); head.add(face);
  const eyes = [-1, 1].map((d) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), blk); e.position.set(d * 0.11, 0.03, 0.315); face.add(e); return e; });
  const brows = [-1, 1].map((d) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.018, 0.02), blk); b.position.set(d * 0.11, 0.11, 0.31); face.add(b); return b; });
  const smileGeo = new THREE.TorusGeometry(0.075, 0.012, 6, 18, Math.PI);
  const mouth = new THREE.Mesh(smileGeo, blk); mouth.position.set(0, -0.1, 0.305); face.add(mouth);
  if (spec.blush) [-1, 1].forEach((d) => { const c = new THREE.Mesh(new THREE.CircleGeometry(0.045, 14), mat(PAL.blush)); c.position.set(d * 0.19, -0.05, 0.285); c.rotation.y = d * 0.55; face.add(c); });
  if (spec.mustache) [-1, 1].forEach((d) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.08, 4, 8), blk); m.rotation.z = Math.PI / 2 + d * 0.35; m.position.set(d * 0.06, -0.05, 0.322); face.add(m); });
  if (spec.hat === 'caping') {
    const c = cast(new THREE.Mesh(new THREE.ConeGeometry(0.66, 0.3, 28), mat(PAL.caping))); c.position.y = 0.66; head.add(c);
  } else if (spec.hat === 'peci') {
    const p = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.2, 24), blk)); p.position.y = 0.6; p.rotation.x = -0.12; head.add(p);
  }
  scene.add(root);

  // pose: a pure function of t and a pose spec
  function pose(t, o = {}) {
    const { x = 0, y = 0.18, z = 0, rot = 0, walk = 0, armL = null, armR = null, mood = 'smile', look = [0, 0], bob = 1, hold = 0 } = o;
    root.position.set(x, y, z); root.rotation.y = rot;
    const ph = t * 7.5;
    const sw = walk * Math.sin(ph);
    legs[0].rotation.x = sw * 0.6; legs[1].rotation.x = -sw * 0.6;
    const idle = Math.sin(t * 2.2) * 0.02 * bob;
    hips.position.y = 0.52 + Math.abs(Math.cos(ph)) * 0.04 * walk + idle;
    arms[0].rotation.set(-sw * 0.5, 0, 0.12); arms[1].rotation.set(sw * 0.5, 0, -0.12);
    if (hold) { arms[0].rotation.set(-1.1 * hold, 0, 0.35); arms[1].rotation.set(-1.1 * hold, 0, -0.35); }
    if (armL) arms[0].rotation.set(armL[0], armL[1] || 0, armL[2] || 0);
    if (armR) arms[1].rotation.set(armR[0], armR[1] || 0, armR[2] || 0);
    head.rotation.set(look[1], look[0], Math.sin(t * 1.7) * 0.03 * bob);
    torso.rotation.y = 0;
    const happy = mood === 'smile' ? 1 : mood === 'frown' ? -1 : 0;
    mouth.rotation.z = happy >= 0 ? Math.PI : 0;
    mouth.position.y = happy >= 0 ? -0.08 : -0.14;
    mouth.scale.set(1, mood === 'grin' ? 1.4 : 1, 1);
    brows[0].rotation.z = happy < 0 ? -0.35 : 0.08; brows[1].rotation.z = happy < 0 ? 0.35 : -0.08;
    const blink = (Math.sin(t * 1.3 + x) > 0.985) ? 0.15 : 1;
    eyes.forEach((e) => { e.scale.y = blink; });
  }
  return { obj: root, pose, arm: (i) => arms[i], root };
}
