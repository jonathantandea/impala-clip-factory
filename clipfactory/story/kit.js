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
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.345, 24, 12, 0, M.TAU, 0, 1.1), spec.hair ? mat(spec.hair) : blk); hair.position.y = 0.3; hair.rotation.x = -0.35; head.add(hair);
  if (spec.hairLong) {
    const hm = mat(spec.hairLong === true ? '#2A1E18' : spec.hairLong);
    const back = cast(new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 14), hm)); back.scale.set(1.02, 1.25, 0.8); back.position.set(0, 0.16, -0.1); head.add(back);
    hair.material = hm;
  }
  const face = new THREE.Group(); face.position.set(0, 0.3, 0); head.add(face);
  const eyes = [-1, 1].map((d) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), blk); e.position.set(d * 0.11, 0.03, 0.315); face.add(e); return e; });
  const brows = [-1, 1].map((d) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.018, 0.02), blk); b.position.set(d * 0.11, 0.11, 0.31); face.add(b); return b; });
  const smileGeo = new THREE.TorusGeometry(0.075, 0.012, 6, 18, Math.PI);
  const mouth = new THREE.Mesh(smileGeo, blk); mouth.position.set(0, -0.1, 0.305); face.add(mouth);
  const oMouth = new THREE.Mesh(new THREE.CircleGeometry(0.05, 18), blk); oMouth.position.set(0, -0.12, 0.312); oMouth.scale.y = 1.3; oMouth.visible = false; face.add(oMouth);
  if (spec.blush) [-1, 1].forEach((d) => { const c = new THREE.Mesh(new THREE.CircleGeometry(0.045, 14), mat(PAL.blush)); c.position.set(d * 0.19, -0.05, 0.285); c.rotation.y = d * 0.55; face.add(c); });
  if (spec.mustache) [-1, 1].forEach((d) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.08, 4, 8), blk); m.rotation.z = Math.PI / 2 + d * 0.35; m.position.set(d * 0.06, -0.05, 0.322); face.add(m); });
  let hatObj = null;
  if (spec.hat === 'rimba') { hatObj = rangerHat(head); hatObj.position.y = 0.56; hatObj.rotation.x = -0.08; }
  else if (spec.hat === 'caping') {
    const c = cast(new THREE.Mesh(new THREE.ConeGeometry(0.66, 0.3, 28), mat(PAL.caping))); c.position.y = 0.66; head.add(c);
  } else if (spec.hat === 'peci') {
    const p = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.2, 24), blk)); p.position.y = 0.6; p.rotation.x = -0.12; head.add(p);
  } else if (spec.hat === 'cap') {
    const capM = mat(spec.capColor || '#F07A1A');
    const c = cast(new THREE.Mesh(new THREE.SphereGeometry(0.35, 20, 10, 0, M.TAU, 0, Math.PI / 2), capM)); c.position.y = 0.36; head.add(c);
    const brim = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 16, 1, false, 0, Math.PI), capM)); brim.position.set(0, 0.42, 0.3); brim.rotation.y = -Math.PI / 2; head.add(brim);
  } else if (spec.hat === 'toga') {
    const c = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.14, 20), blk)); c.position.y = 0.6; head.add(c);
    const board = cast(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.04, 0.62), blk)); board.position.y = 0.69; board.rotation.y = Math.PI / 4; head.add(board);
    const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.25, 6), mat('#F2C14E')); tassel.position.set(0.28, 0.58, 0); head.add(tassel);
  }
  if (spec.whistle) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 8), mat('#F2C14E')); w.rotation.x = Math.PI / 2; w.position.set(0.02, 0.2, 0.37); head.add(w);
  }
  let baby = null;
  if (spec.baby) {
    baby = new THREE.Group();
    const bb = cast(new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), mat('#F7E6F0'))); bb.scale.set(1.4, 1, 1); baby.add(bb);
    const bh = cast(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), skin)); bh.position.set(-0.15, 0.06, 0); baby.add(bh);
    baby.position.set(0, 0.42, 0.24); torso.add(baby);
  }
  scene.add(root);

  // pose: a pure function of t and a pose spec
  function pose(t, o = {}) {
    const { x = 0, y = 0.18, z = 0, rot = 0, walk = 0, armL = null, armR = null, mood = 'smile', look = [0, 0], bob = 1, hold = 0, sit = 0 } = o;
    root.position.set(x, y, z); root.rotation.y = rot;
    const ph = t * 7.5;
    const sw = walk * Math.sin(ph);
    legs[0].rotation.x = sw * 0.6; legs[1].rotation.x = -sw * 0.6;
    const idle = Math.sin(t * 2.2) * 0.02 * bob;
    hips.position.y = 0.52 + Math.abs(Math.cos(ph)) * 0.04 * walk + idle;
    arms[0].rotation.set(-sw * 0.5, 0, 0.12); arms[1].rotation.set(sw * 0.5, 0, -0.12);
    if (hold) { arms[0].rotation.set(-1.1 * hold, 0, 0.35); arms[1].rotation.set(-1.1 * hold, 0, -0.35); }
    if (sit) { legs[0].rotation.x = -1.45; legs[1].rotation.x = -1.45; hips.position.y = 0.52 + idle; }
    if (baby) { arms[0].rotation.set(-1.0, 0, 0.5); arms[1].rotation.set(-1.0, 0, -0.5); }
    if (armL) arms[0].rotation.set(armL[0], armL[1] || 0, armL[2] || 0);
    if (armR) arms[1].rotation.set(armR[0], armR[1] || 0, armR[2] || 0);
    head.rotation.set(look[1], look[0], Math.sin(t * 1.7) * 0.03 * bob);
    torso.rotation.y = 0;
    const happy = mood === 'smile' ? 1 : mood === 'frown' ? -1 : 0;
    mouth.rotation.z = happy >= 0 ? Math.PI : 0;
    mouth.position.y = happy >= 0 ? -0.08 : -0.14;
    mouth.scale.set(1, mood === 'grin' ? 1.4 : mood === 'neutral' ? 0.12 : 1, 1);
    brows[0].rotation.z = happy < 0 ? -0.35 : 0.08; brows[1].rotation.z = happy < 0 ? 0.35 : -0.08;
    const shock = mood === 'shock';
    oMouth.visible = shock; mouth.visible = !shock;
    brows.forEach((b) => { b.position.y = shock ? 0.15 : 0.11; }); if (shock) { brows[0].rotation.z = 0.3; brows[1].rotation.z = -0.3; }
    const blink = (Math.sin(t * 1.3 + x) > 0.985) ? 0.15 : 1;
    eyes.forEach((e) => { e.scale.y = blink; e.scale.x = shock ? 1.3 : 1; if (shock) e.scale.y = 1.3; });
  }
  const items = {};
  function hold(type) {
    Object.entries(items).forEach(([k, m]) => { m.visible = k === type; });
    if (type && !items[type]) { items[type] = handItem(type); arms[1].add(items[type]); }
  }
  return { obj: root, pose, arm: (i) => arms[i], root, hat: hatObj, head, hold };
}

// ======================================================================== sea + room sets, octopus
// Underwater set: sand floor, rocks, coral, swaying kelp, rising bubbles, light shafts.
export function seaSet() {
  const scene = new THREE.Scene();
  const shallow = new THREE.Color('#2C8CC4'), deep = new THREE.Color('#0A2340');
  scene.background = shallow.clone();
  scene.fog = new THREE.Fog(shallow.clone(), 7, 42);
  const hemi = new THREE.HemisphereLight('#CDEFFF', '#2E6670', 1.7); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#E6F8FF', 1.8);
  sun.position.set(-4, 16, 6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
  scene.add(sun);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(200, 200, 60, 60), mat('#D9C291'));
  const sp = sand.geometry.attributes.position;
  for (let i = 0; i < sp.count; i++) sp.setZ(i, M.noise1(sp.getX(i) * 0.15, 3) * 0.25 + M.noise1(sp.getY(i) * 0.2, 7) * 0.2);
  sand.geometry.computeVertexNormals(); sand.rotation.x = -Math.PI / 2; sand.receiveShadow = true; scene.add(sand);
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < 22; i++) {
    const r = cast(new THREE.Mesh(rockGeo, mat(i % 3 ? '#7C8A8C' : '#5F6E73')));
    const a = M.hash01(i, 31) * M.TAU, d = 3 + M.hash01(i, 32) * 16, s = 0.3 + M.hash01(i, 33) * 1.1;
    r.position.set(Math.cos(a) * d, s * 0.35, -Math.abs(Math.sin(a) * d) - 1); r.scale.set(s, s * 0.7, s); r.rotation.set(i, i * 2, 0);
    scene.add(r);
  }
  const coralCols = ['#F2735A', '#F5A3C7', '#F6C344', '#B47AE0'];
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    const col = mat(coralCols[i % 4]);
    for (let j = 0; j < 4; j++) {
      const br = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.5 + M.hash01(i * 9 + j, 4) * 0.5, 6), col));
      br.position.set((j - 1.5) * 0.09, 0.3, 0); br.rotation.z = (j - 1.5) * 0.35; g.add(br);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), col); tip.position.set((j - 1.5) * 0.2, 0.62, 0); g.add(tip);
    }
    const a = M.hash01(i, 41) * M.TAU, d = 2.5 + M.hash01(i, 42) * 10;
    g.position.set(Math.cos(a) * d, 0, -Math.abs(Math.sin(a) * d) - 1.5); scene.add(g);
  }
  const kelp = [[-6, -9, -3, -5], [3.5, -12, 7, -7], [-12, -16, -7, -11], [8, -18, 13, -14]]
    .map(([x0, z0, x1, z1], i) => {
      const f = riceField(scene, { x0, z0, x1, z1, spacing: 0.75, height: 2.2, seed: 50 + i, jitter: 0.4 });
      return f;
    });
  // bubbles
  const bubGeo = new THREE.SphereGeometry(0.05, 8, 6);
  const bubbles = new THREE.InstancedMesh(bubGeo, mat('#E8F8FF', { transparent: true, opacity: 0.55, emissive: '#BFE8FF', emissiveIntensity: 0.4 }), 60);
  scene.add(bubbles);
  // light shafts
  const shaftMat = new THREE.MeshBasicMaterial({ color: '#BFE8FF', transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const shafts = [-5, -1.5, 2.5, 6].map((x, i) => {
    const s = new THREE.Mesh(new THREE.ConeGeometry(1.4, 16, 12, 1, true), shaftMat); s.position.set(x, 8, -6 - i * 2); s.rotation.z = 0.15; scene.add(s); return s;
  });
  const m4 = new THREE.Matrix4();
  return {
    scene, sun,
    update(t, { deep = 0 } = {}) {
      scene.background.lerpColors(shallow, deep_c(deep), 1); scene.fog.color.copy(scene.background);
      hemi.intensity = 1.7 - deep * 0.9; sun.intensity = 1.8 - deep * 1.2; shaftMat.opacity = 0.07 * (1 - deep);
      kelp.forEach((k, i) => k.update(t * 0.6 + i, { wind: 0.35, ripe: 0 }));
      for (let i = 0; i < 60; i++) {
        const sx = (M.hash01(i, 61) - 0.5) * 12, sz = -1 - M.hash01(i, 62) * 10, sp2 = 0.4 + M.hash01(i, 63) * 0.6;
        const y = ((t * sp2 + M.hash01(i, 64) * 8) % 8);
        const sc = 0.5 + M.hash01(i, 65);
        m4.makeScale(sc, sc, sc).setPosition(sx + Math.sin(t * 2 + i) * 0.1, y, sz); bubbles.setMatrixAt(i, m4);
      }
      bubbles.instanceMatrix.needsUpdate = true;
      shafts.forEach((s, i) => { s.rotation.z = 0.15 + Math.sin(t * 0.3 + i) * 0.05; });
    },
  };
  function deep_c(d) { return shallow.clone().lerp(deep, M.clamp(d)); }
}

// A small living room: wall, window, sofa, lamp, plant.
export function roomSet() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#F3D9C0');
  scene.add(new THREE.HemisphereLight('#FFF3E2', '#8A6A50', 1.5));
  const win = new THREE.DirectionalLight('#FFF6E6', 1.6); win.position.set(-3, 5, 4); win.castShadow = true;
  win.shadow.mapSize.set(1024, 1024); Object.assign(win.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 }); scene.add(win);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), mat('#C79A6B')); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 0.2), mat('#F1D3B6')); wall.position.set(0, 3, -1.6); wall.receiveShadow = true; scene.add(wall);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 0.05), mat('#FFFFFF')); frame.position.set(-2.2, 2.3, -1.48); scene.add(frame);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.36, 1.06, 0.06), mat('#A9DDF5', { emissive: '#CFEFFF', emissiveIntensity: 0.5 })); glass.position.set(-2.2, 2.3, -1.46); scene.add(glass);
  const sofaM = mat('#5B7FB6'), cushM = mat('#6F93C8');
  const base = cast(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.42, 0.95), sofaM)); base.position.set(0, 0.21, -0.75); scene.add(base);
  const back = cast(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.75, 0.25), sofaM)); back.position.set(0, 0.6, -1.2); scene.add(back);
  [-1.4, 1.4].forEach((x) => { const a = cast(new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 0.95), sofaM)); a.position.set(x, 0.42, -0.75); scene.add(a); });
  const seat = cast(new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 0.85), cushM)); seat.position.set(0, 0.47, -0.72); scene.add(seat);
  const pillow = cast(new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), mat('#F2C14E'))); pillow.scale.set(1, 0.55, 0.8); pillow.position.set(-1.0, 0.65, -0.75); scene.add(pillow);
  const pot = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.4, 12), mat('#C0603C'))); pot.position.set(2.1, 0.2, -1.1); scene.add(pot);
  const leaves = cast(new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), mat('#4E9E36'))); leaves.position.set(2.1, 0.75, -1.1); scene.add(leaves);
  const lamp = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.35, 16, 1, true), mat('#F7E7C6', { emissive: '#FFE7B0', emissiveIntensity: 0.6, side: THREE.DoubleSide }));
  lamp.position.set(-2.1, 1.55, -1.0); scene.add(lamp);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), mat('#3A3A3A')); pole.position.set(-2.1, 0.7, -1.0); scene.add(pole);
  return { scene, update() {} };
}

// Octopus: mantle, big eyes, 8 jointed tentacles; hearts inside for the diagram.
export function octopus(scene, { color = '#E8704A' } = {}) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const skin = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 1 });
  const tipM = mat(new THREE.Color(color).lerp(new THREE.Color('#FFE2D0'), 0.35).getStyle());
  const mantle = cast(new THREE.Mesh(new THREE.SphereGeometry(0.42, 28, 20), skin)); mantle.scale.set(1, 1.25, 1); mantle.position.y = 0.95; body.add(mantle);
  const eyes = [-1, 1].map((d) => {
    const g = new THREE.Group(); g.position.set(d * 0.17, 0.62, 0.33); body.add(g);
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), mat('#FFFFFF')); g.add(w);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 10), mat('#1E1B19')); p.position.set(0, -0.01, 0.07); g.add(p);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), mat('#FFFFFF', { emissive: '#FFFFFF', emissiveIntensity: 0.6 })); h.position.set(0.025, 0.025, 0.115); g.add(h);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12, 0, M.TAU, 0, Math.PI / 2), skin); lid.rotation.x = -0.2; g.add(lid);
    return { g, p, lid };
  });
  const hearts = [[-0.2, 0.78, 0.05], [0.2, 0.78, 0.05], [0, 1.02, 0.1]].map((p) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), new THREE.MeshBasicMaterial({ color: '#FF4A5A' }));
    m.position.set(...p); m.visible = false; body.add(m); return m;
  });
  const tentacles = [];
  for (let i = 0; i < 8; i++) {
    const base = new THREE.Group(); base.position.set(Math.sin((i / 8) * M.TAU) * 0.26, 0.55, Math.cos((i / 8) * M.TAU) * 0.26);
    base.rotation.y = (i / 8) * M.TAU; body.add(base);
    const segs = []; let parent = base;
    for (let s = 0; s < 7; s++) {
      const j = new THREE.Group(); parent.add(j);
      const r0 = 0.075 * (1 - s / 8), r1 = 0.075 * (1 - (s + 1) / 8), len = 0.15;
      const g = new THREE.CylinderGeometry(r1, r0, len, 8); g.translate(0, -len / 2, 0);
      const seg = cast(new THREE.Mesh(g, s >= 5 ? tipM : skin)); j.add(seg);
      const nx = new THREE.Group(); nx.position.y = -len; j.add(nx);
      segs.push(j); parent = nx;
    }
    tentacles.push(segs);
  }
  scene.add(root);
  function pose(t, o = {}) {
    const { x = 0, y = 0, z = 0, rot = 0, mode = 'idle', xray = 0, blue = 0, stopped = 0, mood = 'smile', look = [0, 0] } = o;
    root.position.set(x, y, z); root.rotation.set(0, rot, 0);
    const swim = mode === 'swim', crawl = mode === 'crawl', tired = mode === 'tired';
    const jet = swim ? (t * 1.2) % 1 : 0;
    const contract = swim ? (jet < 0.3 ? E_out(jet / 0.3) : 1 - (jet - 0.3) / 0.7) : 0;
    body.position.y = (swim ? 0 : Math.sin(t * 1.8) * 0.03) + (tired ? -0.12 : 0);
    body.rotation.x = swim ? -0.5 : crawl ? 0.15 : tired ? 0.25 : 0;
    mantle.scale.set(1 - contract * 0.1, 1.25 + contract * 0.12 - (tired ? 0.15 : 0), 1 - contract * 0.1);
    tentacles.forEach((segs, i) => {
      segs.forEach((j, s) => {
        const ph = t * (swim ? 5 : crawl ? 3 : 1.8) + i * 0.8 + s * 0.6;
        let ax;
        if (swim) ax = (s === 0 ? -0.1 + contract * 0.9 : 0.08 * Math.sin(ph) - contract * 0.12);
        else if (crawl) ax = s === 0 ? 1.25 + 0.25 * Math.sin(t * 3 + i * 1.1) : -0.18 + 0.12 * Math.sin(ph);
        else if (tired) ax = s === 0 ? 1.35 : -0.05 + 0.04 * Math.sin(ph);
        else ax = s === 0 ? 0.55 : -0.08 + 0.18 * Math.sin(ph);
        j.rotation.set(ax, 0, 0.12 * Math.sin(ph * 0.7));
      });
    });
    skin.opacity = 1 - xray * 0.55; skin.depthWrite = xray < 0.5;
    const red = new THREE.Color('#FF4A5A'), bl = new THREE.Color('#4AA8FF'), gr = new THREE.Color('#8A8A8A');
    hearts.forEach((h, i) => {
      h.visible = xray > 0.05;
      const isBody = i === 2;
      const off = isBody ? stopped : 0;
      const beat = Math.pow(Math.max(0, Math.sin(t * M.TAU * 1.3 + i * 0.4)), 6) * (1 - off);
      h.scale.setScalar((0.8 + xray * 0.2) * (1 + beat * 0.35));
      h.material.color.copy(red).lerp(bl, blue).lerp(gr, off);
    });
    const happy = mood === 'smile' || mood === 'grin';
    eyes.forEach((e, k) => {
      e.lid.visible = tired || mood === 'neutral' || mood === 'frown';
      e.lid.rotation.x = tired ? 0.35 : mood === 'frown' ? -0.1 : 0.15;
      e.p.position.set(look[0] * 0.03, -0.01 - (tired ? 0.02 : 0) + look[1] * 0.03, 0.07);
      const blink = Math.sin(t * 1.1 + k * 0.01) > 0.992 ? 0.1 : 1; e.g.scale.y = blink;
    });
    void happy;
  }
  return { obj: root, pose, root, hearts };
}
function E_out(x) { return 1 - (1 - x) ** 3; }

// ======================================================================== outback set, wombat, cubes, trophy, clothes
// Australian scrub at dusk: red earth, dry grass, eucalyptus, flat rocks.
export function scrubSet() {
  const scene = new THREE.Scene();
  scene.background = canvasTex(4, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#3B4A8C'); g.addColorStop(0.45, '#C0748A'); g.addColorStop(0.75, '#F2B36B'); g.addColorStop(1, '#F7CF8E');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  scene.fog = new THREE.Fog('#E9A877', 18, 70);
  scene.add(new THREE.HemisphereLight('#FFD9B0', '#7A4A2E', 1.4));
  const sun = new THREE.DirectionalLight('#FFB873', 2.0); sun.position.set(12, 6, 6); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 50 }); scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220, 50, 50), mat('#B5643A'));
  const gp = ground.geometry.attributes.position;
  for (let i = 0; i < gp.count; i++) gp.setZ(i, M.noise1(gp.getX(i) * 0.12, 5) * 0.3 + M.noise1(gp.getY(i) * 0.17, 9) * 0.25);
  ground.geometry.computeVertexNormals(); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const grass = [[-9, -14, -2.5, -3], [2.5, -14, 10, -3.5], [-14, -26, 14, -15]].map(([x0, z0, x1, z1], i) =>
    riceField(scene, { x0, z0, x1, z1, spacing: 0.7, height: 0.6, seed: 80 + i, jitter: 0.5 }));
  const leafM = mat('#7F9A6A'), trunkM = mat('#E8DCCB');
  [[-6, -9, 6], [7, -11, 7], [-13, -18, 8], [13, -20, 7.5], [1, -24, 9], [-20, -30, 8], [20, -32, 9]].forEach(([x, z, h], i) => {
    const t = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, h, 8), trunkM)); t.position.set(x, h / 2, z); t.rotation.z = (M.hash01(i, 7) - 0.5) * 0.2; scene.add(t);
    for (let k = 0; k < 5; k++) {
      const b = cast(new THREE.Mesh(new THREE.SphereGeometry(1.1 + M.hash01(i * 5 + k, 8) * 0.8, 10, 8), leafM));
      b.scale.y = 0.6; b.position.set(x + (M.hash01(k + i, 3) - 0.5) * 2.4, h - 0.3 + M.hash01(k, i) * 1.2, z + (M.hash01(k * 2 + i, 4) - 0.5) * 2); scene.add(b);
    }
  });
  const shrubM = mat('#8FA06A');
  for (let i = 0; i < 26; i++) {
    const s = cast(new THREE.Mesh(new THREE.SphereGeometry(0.5 + M.hash01(i, 11) * 0.6, 10, 8), shrubM));
    const a = M.hash01(i, 12) * M.TAU, d = 3 + M.hash01(i, 13) * 14;
    s.scale.y = 0.65; s.position.set(Math.cos(a) * d, 0.25, -Math.abs(Math.sin(a) * d) - 1.5); scene.add(s);
  }
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < 14; i++) {
    const r = cast(new THREE.Mesh(rockGeo, mat(i % 2 ? '#8C7B6B' : '#A08C78')));
    const a = M.hash01(i, 21) * M.TAU, d = 4 + M.hash01(i, 22) * 14, s = 0.3 + M.hash01(i, 23) * 0.8;
    r.position.set(Math.cos(a) * d, s * 0.3, -Math.abs(Math.sin(a) * d) - 2); r.scale.set(s, s * 0.6, s); scene.add(r);
  }
  return { scene, update(t) { grass.forEach((g) => g.update(t, { wind: 0.12, ripe: 0.75 })); } };
}

// A flat display rock (for the cubes) — returned as a prop with a top height.
export function flatRock(scene, x, z) {
  const g = new THREE.Group();
  const r = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 0.45, 9), mat('#9A8674')));
  r.position.y = 0.22; r.rotation.y = 0.4; g.add(r);
  g.position.set(x, 0, z); scene.add(g); return { obj: g, top: 0.45 };
}

// Cube droppings: little brown rounded cubes stacked on a host top.
export function cubes(scene, n = 5, top = 0) {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(0.11, 0.11, 0.11, 2, 2, 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); const s = 1 - 0.12 * (Math.abs(v.x) + Math.abs(v.y) + Math.abs(v.z)) / 0.165; p.setXYZ(i, v.x * (0.92 + 0.08 * s), v.y * (0.92 + 0.08 * s), v.z * (0.92 + 0.08 * s)); }
  geo.computeVertexNormals();
  const items = [];
  for (let i = 0; i < n; i++) {
    const c = cast(new THREE.Mesh(geo, mat(i % 2 ? '#5A3B24' : '#6B472B')));
    c.position.set((i % 3 - 1) * 0.14 + M.hash01(i, 2) * 0.03, top + 0.055 + Math.floor(i / 3) * 0.11, (Math.floor(i / 3) % 2) * 0.05 + M.hash01(i, 3) * 0.04);
    c.rotation.y = M.hash01(i, 4) * 0.5; g.add(c); items.push(c);
  }
  scene.add(g); return { obj: g, items };
}

export function trophy(scene) {
  const g = new THREE.Group();
  const gold = mat('#E8B93A', { emissive: '#8A5A00', emissiveIntensity: 0.25 });
  const cup = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.1, 0.3, 20, 1, true), gold)); cup.position.y = 0.42; g.add(cup);
  const bowl = cast(new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 8, 0, M.TAU, Math.PI / 2, Math.PI / 2), gold)); bowl.position.y = 0.27; g.add(bowl);
  [-1, 1].forEach((d) => { const h = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 8, 16, Math.PI), gold); h.position.set(d * 0.24, 0.45, 0); h.rotation.z = -d * Math.PI / 2; g.add(h); });
  const stem = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.16, 10), gold)); stem.position.y = 0.17; g.add(stem);
  const base = cast(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.2), mat('#5A3B24'))); base.position.y = 0.045; g.add(base);
  scene.add(g); return { obj: g };
}

// Messy clothes pile: lumpy cloth shapes in mixed colours.
export function clothesPile(scene) {
  const g = new THREE.Group();
  const cols = ['#E2574C', '#4C7BE2', '#F2C14E', '#5DB37E', '#E8E2D6', '#8A63C9', '#2E3A4A'];
  for (let i = 0; i < 16; i++) {
    const geo = new THREE.SphereGeometry(0.22 + M.hash01(i, 5) * 0.12, 10, 8);
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) p.setY(k, p.getY(k) * (0.35 + M.hash01(k + i, 6) * 0.15));
    geo.computeVertexNormals();
    const m = cast(new THREE.Mesh(geo, mat(cols[i % cols.length])));
    const layer = Math.floor(i / 6);
    m.position.set((M.hash01(i, 7) - 0.5) * (0.9 - layer * 0.25), 0.07 + layer * 0.13, (M.hash01(i, 8) - 0.5) * (0.7 - layer * 0.2));
    m.rotation.set((M.hash01(i, 9) - 0.5) * 0.6, M.hash01(i, 10) * 3, (M.hash01(i, 11) - 0.5) * 0.6);
    m.scale.set(1.3, 1, 0.9); g.add(m);
  }
  const sleeve = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.4, 4, 8), mat('#4C7BE2'))); sleeve.rotation.z = 1.2; sleeve.position.set(0.5, 0.1, 0.25); g.add(sleeve);
  scene.add(g); return { obj: g };
}

// Wombat: barrel body, short legs, wide snout, little ears. Modes: idle, walk, proud.
export function wombat(scene, { color = '#8C6A50' } = {}) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const fur = mat(color), dark = mat(new THREE.Color(color).multiplyScalar(0.62).getStyle()), noseM = mat('#2B211C');
  const torso = cast(new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 18), fur)); torso.scale.set(0.95, 0.78, 1.25); torso.position.y = 0.42; body.add(torso);
  const head = new THREE.Group(); head.position.set(0, 0.5, 0.52); body.add(head);
  const skull = cast(new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 16), fur)); skull.scale.set(1.05, 0.9, 1); head.add(skull);
  const snout = cast(new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), dark)); snout.scale.set(1.2, 0.85, 0.9); snout.position.set(0, -0.06, 0.2); head.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), noseM); nose.scale.set(1.3, 0.8, 0.8); nose.position.set(0, -0.02, 0.33); head.add(nose);
  const eyes = [-1, 1].map((d) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), noseM); e.position.set(d * 0.12, 0.07, 0.22); head.add(e);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 4), mat('#FFFFFF', { emissive: '#FFFFFF', emissiveIntensity: 0.6 })); hl.position.set(d * 0.12 + 0.01, 0.085, 0.25); head.add(hl); return e; });
  [-1, 1].forEach((d) => { const ear = cast(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.12, 8), fur)); ear.position.set(d * 0.17, 0.24, -0.02); ear.rotation.z = -d * 0.35; head.add(ear); });
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => {
    const piv = new THREE.Group(); piv.position.set(sx * 0.24, 0.22, sz * 0.3); body.add(piv);
    const l = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.22, 10), dark)); l.position.y = -0.11; piv.add(l);
    return piv;
  });
  scene.add(root);
  function pose(t, o = {}) {
    const { x = 0, y = 0, z = 0, rot = 0, mode = 'idle', mood = 'smile' } = o;
    root.position.set(x, y, z); root.rotation.set(0, rot, 0);
    const walk = mode === 'walk', proud = mode === 'proud';
    const ph = t * 6;
    legs.forEach((l, i) => { l.rotation.x = walk ? Math.sin(ph + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.55 : 0; });
    body.position.y = walk ? Math.abs(Math.sin(ph)) * 0.035 : proud ? 0.06 + Math.abs(Math.sin(t * 3)) * 0.03 : Math.sin(t * 2) * 0.01;
    body.rotation.z = walk ? Math.sin(ph) * 0.05 : 0;
    head.rotation.set(proud ? -0.35 : Math.sin(t * 1.3) * 0.05, proud ? Math.sin(t * 1.6) * 0.15 : Math.sin(t * 0.9) * 0.12, 0);
    torso.scale.set(0.95, 0.78 + (proud ? 0.05 : 0), 1.25);
    const blink = Math.sin(t * 1.2 + x) > 0.99 ? 0.15 : (mood === 'neutral' ? 0.5 : 1);
    eyes.forEach((e) => { e.scale.y = proud ? 0.35 : blink; });
  }
  return { obj: root, pose, root };
}

// ======================================================================== town set (Kota Tertib | Kota Terserah) + vehicles
// x < 0: Kota Tertib (neat), x > 0: Kota Terserah (messy). Main road along x at z = 0.
export function townSet() {
  const scene = new THREE.Scene();
  const SKY = { day: new THREE.Color('#9BD7F5'), dusk: new THREE.Color('#F09A6A'), night: new THREE.Color('#1A2240'), dawn: new THREE.Color('#F4B98C') };
  scene.background = SKY.day.clone();
  scene.fog = new THREE.Fog('#CFEAF7', 90, 320);
  const hemi = new THREE.HemisphereLight('#EAF6FF', '#6E8F4E', 1.5); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#FFF1D8', 2.0); sun.position.set(-20, 30, 18); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 30, bottom: -30, near: 1, far: 120 });
  sun.shadow.bias = -0.0008; scene.add(sun, sun.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat('#93C65E')); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const box = (w, h, d, c, x, y, z, o = {}) => { const m = cast(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, o))); m.position.set(x, y, z); scene.add(m); return m; };
  // road + sidewalks
  box(80, 0.06, 6, '#4E5257', -40, 0.03, 0);                      // Tertib asphalt (dark, clean)
  box(80, 0.06, 6, '#7A776F', 40, 0.03, 0);                       // Terserah asphalt (worn)
  for (let x = -78; x < -2; x += 4) box(2, 0.065, 0.18, '#F4F4F0', x, 0.035, 0);   // dashes, Tertib only
  box(80, 0.18, 1.6, '#D9D6CE', -40, 0.09, 3.8); box(80, 0.18, 1.6, '#D9D6CE', -40, 0.09, -3.8);
  box(80, 0.18, 1.6, '#BDB3A3', 40, 0.09, 3.8); box(80, 0.18, 1.6, '#BDB3A3', 40, 0.09, -3.8);
  const holeM = mat('#3F3D39');
  [[8, 1.2], [13, -1.5], [21, 0.8], [35, -1], [41, 1.6], [47, -0.5]].forEach(([x, z], i) => {
    const h = new THREE.Mesh(new THREE.CircleGeometry(0.35 + (i % 3) * 0.15, 12), holeM); h.rotation.x = -Math.PI / 2; h.position.set(x, 0.065, z); scene.add(h);
  });
  // city gate at x = 0
  const gateM = mat('#E8E2D2');
  [-4.2, 4.2].forEach((z) => box(0.6, 4.2, 0.6, '#E8E2D2', 0, 2.1, z));
  box(0.5, 0.8, 9.2, '#E8E2D2', 0, 4.4, 0);
  const signL = canvasTex(512, 64, (c, w, h) => { c.fillStyle = '#2E6B4E'; c.fillRect(0, 0, w, h); c.fillStyle = '#FFF'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.fillText('KOTA TERTIB  |  KOTA TERSERAH', w / 2, 44); });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 1.1), new THREE.MeshBasicMaterial({ map: signL })); sign.position.set(0.3, 4.4, 0); sign.rotation.y = Math.PI / 2; scene.add(sign);
  const sign2 = sign.clone(); sign2.position.x = -0.3; sign2.rotation.y = -Math.PI / 2; scene.add(sign2);
  void gateM;
  // neat houses + trees (Tertib)
  for (let i = 0; i < 9; i++) { house(scene, -8 - i * 7.5, -14, 0, 1); house(scene, -8 - i * 7.5, 13, Math.PI, 1); }
  const treeM = mat('#4C9A3E'), trunkM = mat('#8B6A45');
  for (let x = -6; x > -78; x -= 6) [-5.2, 5.2].forEach((z) => {
    if (z > 0 && x > -20 && x < -8) return;   // keep the bus stop clear
    const t = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.6, 8), trunkM)); t.position.set(x, 0.8, z); scene.add(t);
    const c = cast(new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), treeM)); c.position.set(x, 2.1, z); scene.add(c);
  });
  // office + empty parking lot (Tertib)
  box(9, 7.5, 6, '#DDE6EC', -30, 3.75, -12);
  for (let fy = 0; fy < 4; fy++) for (let fx = 0; fx < 5; fx++) box(1.2, 1.1, 0.06, '#5F8FB3', -33.6 + fx * 1.8, 1.4 + fy * 1.7, -8.97, { emissive: '#2F5F83', emissiveIntensity: 0.2 });
  box(9, 0.05, 5, '#5A5E63', -30, 0.2, -6.9);
  for (let k = 0; k < 7; k++) box(0.08, 0.055, 2.2, '#F4F4F0', -33.9 + k * 1.3, 0.24, -6.2);
  // bus stop (Tertib)
  const stop = new THREE.Group(); stop.position.set(-14, 0.18, 4.6); scene.add(stop);
  const sm = mat('#2E6B4E');
  [[-1.6, 0.6], [1.6, 0.6]].forEach(([x, z]) => { const p = cast(new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 0.1), sm)); p.position.set(x, 1.2, z); stop.add(p); });
  const roof = cast(new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 1.5), sm)); roof.position.set(0, 2.45, 0.2); stop.add(roof);
  const back = cast(new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 0.05), mat('#BFE3EE', { transparent: true, opacity: 0.6 }))); back.position.set(0, 1.4, 0.65); stop.add(back);
  const bench = cast(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.4), mat('#8B6A45'))); bench.position.set(0, 0.45, 0.4); stop.add(bench);
  const busSign = cast(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.05), mat('#F2C14E'))); busSign.position.set(-1.9, 2.5, -0.2); stop.add(busSign);
  // messy Terserah: houses at odd angles, warung stalls, poles + sagging cables, river + bridge, traffic light
  for (let i = 0; i < 10; i++) {
    house(scene, 7 + i * 6.8 + hash(i, 1) * 2, -13.5 - hash(i, 2) * 3, (hash(i, 3) - 0.5) * 0.6, 0.9 + hash(i, 4) * 0.25, i % 2 ? '#C9502A' : '#D45A2A');
    house(scene, 7 + i * 6.8 + hash(i, 5) * 2, 12.5 + hash(i, 6) * 3, Math.PI + (hash(i, 7) - 0.5) * 0.6, 0.9 + hash(i, 8) * 0.25);
  }
  for (let i = 0; i < 8; i++) palm(scene, 9 + i * 7 + hash(i, 9) * 3, (i % 2 ? 1 : -1) * (7 + hash(i, 10) * 3), 5 + hash(i, 11) * 2, i + 20);
  const stallCols = ['#E2574C', '#F2C14E', '#4C7BE2', '#5DB37E'];
  [[6.5, 4.0], [15, 4.1], [23.5, -4.0], [37, 4.0], [44, -4.1], [11, -4.0]].forEach(([x, z], i) => {
    box(1.6, 1.0, 1.0, '#C8A06A', x, 0.68, z);
    const r = cast(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 1.4), mat(stallCols[i % 4]))); r.position.set(x, 1.9, z); r.rotation.z = 0.08; scene.add(r);
    [[-0.9, -0.6], [0.9, -0.6], [-0.9, 0.6], [0.9, 0.6]].forEach(([dx, dz]) => box(0.06, 1.7, 0.06, '#6B4A2E', x + dx, 1.0, z + dz));
  });
  const poleX = [5, 12, 19.5, 34, 41, 48];
  const poleM = mat('#8A8A8A');
  poleX.forEach((x) => { const p = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 6, 8), poleM)); p.position.set(x, 3, 4.9); scene.add(p); });
  const cableM = new THREE.LineBasicMaterial({ color: '#1E1B19' });
  for (let i = 0; i < poleX.length - 1; i++) for (let k = 0; k < 4; k++) {
    const pts = []; const x0 = poleX[i], x1 = poleX[i + 1];
    for (let s = 0; s <= 12; s++) { const f = s / 12; pts.push(new THREE.Vector3(x0 + (x1 - x0) * f, 5.7 - k * 0.18 - Math.sin(f * Math.PI) * (0.6 + k * 0.25), 4.9 + (k - 1.5) * 0.12)); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cableM));
  }
  // river along z at x = 29 + bridge
  const water = new THREE.Mesh(new THREE.PlaneGeometry(6, 400), mat('#4A9BC4', { transparent: true, opacity: 0.92 })); water.rotation.x = -Math.PI / 2; water.position.set(29, -0.35, 0); scene.add(water);
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 400), mat('#6A5A44')); bed.rotation.x = -Math.PI / 2; bed.position.set(29, -1.6, 0); scene.add(bed);
  [25.8, 32.2].forEach((x) => box(0.4, 1.8, 400, '#8C7B66', x, -0.7, 0));
  // carve the ground over the river: draw banks as boxes covering the plane gap
  box(6, 0.02, 400, '#4A9BC4', 29, 0.005, 0, { transparent: true, opacity: 0.0 });
  const deck = box(6.6, 0.3, 6.4, '#9C968A', 29, 0.1, 0);
  [-3.3, 3.3].forEach((z) => { box(6.6, 0.12, 0.12, '#D9D6CE', 29, 1.0, z); for (let x = 26; x <= 32; x += 1.5) box(0.1, 0.9, 0.1, '#D9D6CE', x, 0.55, z); });
  void deck;
  // traffic light
  const tl = new THREE.Group(); tl.position.set(18, 0.18, 3.7); scene.add(tl);
  const tp = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 3.4, 8), mat('#3A3A3A'))); tp.position.y = 1.7; tl.add(tp);
  const tbox = cast(new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.3, 0.4), mat('#222222'))); tbox.position.set(0, 3.5, -0.2); tl.add(tbox);
  const lamps = ['#FF3B30', '#FFCC00', '#34C759'].map((c, i) => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), new THREE.MeshBasicMaterial({ color: c })); l.position.set(0, 3.9 - i * 0.4, -0.42); tl.add(l); return l; });
  // sun + moon for the time-lapse
  const sunBall = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 12), new THREE.MeshBasicMaterial({ color: '#FFE08A', fog: false }));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 12), new THREE.MeshBasicMaterial({ color: '#F2F2E8', fog: false }));
  scene.add(sunBall, moon);
  const SPOTS = { halte: [-14, 4.1], kantor: [-26, -4.5], angkot: [10, 1.6], lampu: [17.2, 1.4], jembatan: [29, 1.4], sungai: [29, 4.6] };
  return {
    scene, SPOTS, trafficLight: tl,
    // tod: 0 = morning, cycles through dusk, night, dawn and back each 1.0
    update(t, { tod = 0, cycles = 0 } = {}) {
      const ph = ((tod % 1) + 1) % 1;
      const keys = [[0, SKY.day], [0.35, SKY.day], [0.45, SKY.dusk], [0.55, SKY.night], [0.8, SKY.night], [0.9, SKY.dawn], [1, SKY.day]];
      for (let i = 1; i < keys.length; i++) if (ph <= keys[i][0]) {
        const f = (ph - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]); scene.background.copy(keys[i - 1][1]).lerp(keys[i][1], f); break;
      }
      scene.fog.color.copy(scene.background).lerp(new THREE.Color('#FFFFFF'), 0.3);
      const dark = ph > 0.45 && ph < 0.9 ? Math.min(1, Math.min(ph - 0.45, 0.9 - ph) * 10) : 0;
      hemi.intensity = 1.5 - dark * 1.0; sun.intensity = 2.0 - dark * 1.8;
      const ang = ph * M.TAU;   // sun overhead at ph 0.15, sets ~0.45, moon opposite
      sunBall.position.set(Math.cos(ang + 0.6) * 60, Math.sin(ang + 0.6) * 40 + 5, -70);
      moon.position.set(Math.cos(ang + 0.6 + Math.PI) * 60, Math.sin(ang + 0.6 + Math.PI) * 40 + 5, -70);
      lamps[0].material.color.set('#FF3B30'); lamps[2].material.color.set('#1E3A24');
      void cycles; void t;
    },
  };
}
const hash = (i, s) => M.hash01(i, s);

// Bus: long body along x, windows, door; front faces -x.
export function bus(scene, { color = '#2FA4A0' } = {}) {
  const g = new THREE.Group();
  const body = cast(new THREE.Mesh(new THREE.BoxGeometry(9, 2.4, 2.5), mat(color))); body.position.y = 1.55; g.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(9.02, 0.25, 2.52), mat('#FFFFFF')); stripe.position.y = 1.0; g.add(stripe);
  for (let i = 0; i < 6; i++) [-1.26, 1.26].forEach((z) => { const w = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.04), mat('#24435C', { emissive: '#1A3247', emissiveIntensity: 0.3 })); w.position.set(-3.3 + i * 1.35, 2.05, z); g.add(w); });
  const ws = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.1, 2.2), mat('#24435C')); ws.position.set(-4.51, 2.0, 0); g.add(ws);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.9, 0.05), mat('#1E2A33')); door.position.set(-3.2, 1.3, 1.27); g.add(door);
  [-3, 3].forEach((x) => [-1.15, 1.15].forEach((z) => { const wh = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 16), mat('#222'))); wh.rotation.x = Math.PI / 2; wh.position.set(x, 0.45, z); g.add(wh); }));
  scene.add(g); return { obj: g };
}

// Angkot: minivan with open windows and two long side benches inside (camera can sit inside).
export function angkot(scene, { color = '#4FA3D9' } = {}) {
  const g = new THREE.Group();
  const cm = mat(color), dark = mat('#2A3440');
  const L = 4.4, Wd = 1.9;
  const floor = cast(new THREE.Mesh(new THREE.BoxGeometry(L, 0.12, Wd), dark)); floor.position.y = 0.55; g.add(floor);
  [-Wd / 2, Wd / 2].forEach((z) => { const s = cast(new THREE.Mesh(new THREE.BoxGeometry(L, 0.55, 0.06), cm)); s.position.set(0, 0.88, z); g.add(s); });
  const roof = cast(new THREE.Mesh(new THREE.BoxGeometry(L + 0.1, 0.1, Wd + 0.1), cm)); roof.position.y = 2.6; g.add(roof);
  [-L / 2, -0.75, L / 2 - 0.05].forEach((x) => [-Wd / 2, Wd / 2].forEach((z) => { const p = cast(new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.45, 0.08), cm)); p.position.set(x, 1.85, z); g.add(p); }));
  const back = cast(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, Wd), cm)); back.position.set(L / 2, 0.88, 0); g.add(back);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(L + 0.02, 0.12, Wd + 0.02), mat('#F2C14E')); stripe.position.y = 1.08; g.add(stripe);
  const hood = cast(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, Wd), cm)); hood.position.set(-L / 2 - 0.45, 0.85, 0); g.add(hood);
  const ws = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.2, Wd - 0.2), mat('#9ED3EA', { transparent: true, opacity: 0.3 })); ws.position.set(-L / 2 + 0.05, 1.85, 0); ws.rotation.z = -0.2; g.add(ws);
  [-0.6, 0.6].forEach((z) => { const b = cast(new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 0.42), mat('#7A4A2E'))); b.position.set(0.55, 0.95, z * 1.0); g.add(b); });
  const seat = cast(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.6), mat('#7A4A2E'))); seat.position.set(-L / 2 + 0.6, 0.95, -0.45); g.add(seat);
  [-1.5, 1.4].forEach((x) => [-Wd / 2, Wd / 2].forEach((z) => { const wh = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 14), mat('#222'))); wh.rotation.x = Math.PI / 2; wh.position.set(x, 0.33, z); g.add(wh); }));
  scene.add(g);
  // seats in local coords: driver + left/right benches
  return { obj: g, seats: { driver: [-L / 2 + 0.6, 0.98, -0.45], kiri1: [0.35, 0.98, -0.6], kiri2: [1.25, 0.98, -0.6], kanan1: [0.35, 0.98, 0.6], kanan2: [1.25, 0.98, 0.6] } };
}

export function motorbike(scene, { color = '#C8352E' } = {}) {
  const g = new THREE.Group();
  [-0.65, 0.65].forEach((x) => { const w = cast(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 8, 18), mat('#222'))); w.position.set(x, 0.32, 0); g.add(w); });
  const body = cast(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.28, 0.3), mat(color))); body.position.set(0, 0.62, 0); g.add(body);
  const seat = cast(new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.1, 0.3), mat('#1E1B19'))); seat.position.set(0.15, 0.8, 0); g.add(seat);
  const fork = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 6), mat('#888'))); fork.position.set(-0.6, 0.7, 0); fork.rotation.z = 0.35; g.add(fork);
  const bar = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6), mat('#333'))); bar.rotation.x = Math.PI / 2; bar.position.set(-0.72, 1.08, 0); g.add(bar);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mat('#FFF6C8', { emissive: '#FFE7A0', emissiveIntensity: 0.6 })); lamp.position.set(-0.82, 0.95, 0); g.add(lamp);
  scene.add(g);
  return { obj: g, seats: { depan: [0.05, 0.86, 0], belakang: [0.5, 0.86, 0] } };
}

// ======================================================================== forest set (Hutan) + animals + growable props
// Lowland rainforest (Ujung Kulon feel). Clearing at the origin; keepOut = [{x, z, r}] areas left free of trees.
export function forestSet(keepOut = []) {
  const scene = new THREE.Scene();
  scene.background = canvasTex(4, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#8FD3E8'); g.addColorStop(0.55, '#CDEBD6'); g.addColorStop(1, '#E6F4DA');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  scene.fog = new THREE.Fog('#BFE0C4', 30, 120);
  scene.add(new THREE.HemisphereLight('#F2FFF0', '#4F7A36', 1.45));
  const sun = new THREE.DirectionalLight('#FFF3D6', 1.9); sun.position.set(-14, 26, 16); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 90 });
  sun.shadow.bias = -0.0008; scene.add(sun, sun.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260, 60, 60), mat('#6FA845'));
  const gp = ground.geometry.attributes.position;
  for (let i = 0; i < gp.count; i++) gp.setZ(i, M.noise1(gp.getX(i) * 0.1, 3) * 0.25 + M.noise1(gp.getY(i) * 0.13, 7) * 0.2);
  ground.geometry.computeVertexNormals(); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const free = (x, z, pad = 0) => keepOut.every((k) => Math.hypot(x - k.x, z - k.z) > (k.r || 3.5) + pad);
  const leafCols = ['#2F7A3A', '#3E8E3F', '#2A6B35', '#4C9A45'].map((c) => mat(c));
  const trunkM = mat('#6B4A30');
  const tree = (x, z, h, i) => {
    const t = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.22 + h * 0.025, 0.4 + h * 0.035, h, 8), trunkM)); t.position.set(x, h / 2, z); scene.add(t);
    const n = 3 + (i % 3);
    for (let k = 0; k < n; k++) {
      const r = 1.4 + M.hash01(i * 7 + k, 3) * 1.3;
      const b = cast(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leafCols[(i + k) % 4]));
      b.scale.y = 0.7; b.position.set(x + (M.hash01(i + k, 5) - 0.5) * 3, h - 0.2 + M.hash01(k, i + 2) * 1.4, z + (M.hash01(k * 3 + i, 6) - 0.5) * 2.6); scene.add(b);
    }
  };
  let ti = 0;
  for (let i = 0; i < 260 && ti < 110; i++) {
    const a = M.hash01(i, 41) * M.TAU, d = 9 + M.hash01(i, 42) * 46;
    const x = Math.cos(a) * d, z = Math.sin(a) * d - 6;
    if (z > 9 && Math.abs(x) < 20) continue;                 // keep the camera side open
    if (!free(x, z, 1.5)) continue;
    tree(x, z, 6 + M.hash01(i, 43) * 6, ti++);
  }
  // ferns + undergrowth
  const fernGeo = (() => { const gs = []; for (let k = 0; k < 7; k++) { const g = new THREE.ConeGeometry(0.09, 0.9, 4); g.translate(0, 0.45, 0); g.rotateZ(0.7); g.rotateY(k / 7 * M.TAU); gs.push(g); } return mergeGeometries(gs); })();
  const fernM = mat('#5DA544');
  for (let i = 0; i < 140; i++) {
    const a = M.hash01(i, 51) * M.TAU, d = 4 + M.hash01(i, 52) * 34;
    const x = Math.cos(a) * d, z = Math.sin(a) * d - 4;
    if (!free(x, z, 0.4) || (Math.abs(x) < 6 && Math.abs(z) < 5)) continue;
    const f = cast(new THREE.Mesh(fernGeo, fernM)); const s = 0.6 + M.hash01(i, 53) * 0.8; f.scale.setScalar(s); f.position.set(x, 0, z); f.rotation.y = M.hash01(i, 54) * 3; scene.add(f);
  }
  // soft light shafts
  const shaftM = new THREE.MeshBasicMaterial({ color: '#FFF6C8', transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending });
  [[-6, -10], [5, -14], [14, -6], [-16, -4]].forEach(([x, z], i) => { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 2.4, 22, 12, 1, true), shaftM); s.position.set(x, 10, z); s.rotation.z = 0.35; s.rotation.x = 0.1 * i; scene.add(s); });
  return { scene, update() {} };
}

// puff of smoke (character pops in / out); set(k) with k 0..1 over ~0.9 s
export function puff(scene) {
  const g = new THREE.Group();
  const balls = Array.from({ length: 13 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 1), new THREE.MeshLambertMaterial({ color: i % 3 ? '#F4F1EA' : '#DCD6CC', transparent: true, emissive: '#FFFFFF', emissiveIntensity: 0.25 }));
    const a = M.hash01(i, 61) * M.TAU, e = (M.hash01(i, 62) - 0.3) * 1.4;
    m.dir = new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e) * 0.8 + 0.2, Math.sin(a) * Math.cos(e)); g.add(m); return m;
  });
  scene.add(g); g.visible = false;
  return {
    obj: g,
    set(k, x, y, z, s = 1) {
      g.visible = k > 0 && k < 1; if (!g.visible) return;
      g.position.set(x, y, z); g.scale.setScalar(s);
      const r = E_out(k);
      balls.forEach((b, i) => { b.position.copy(b.dir).multiplyScalar(0.25 + r * 1.1); b.scale.setScalar((0.6 + 0.9 * Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5)) * (1 - k * 0.5) * (0.8 + M.hash01(i, 63) * 0.5)); b.material.opacity = 1 - k ** 2; });
    },
  };
}

function eyeWithShine(parent, x, y, z, r) {
  const e = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat(PAL.black)); e.position.set(x, y, z); parent.add(e);
  const hl = new THREE.Mesh(new THREE.SphereGeometry(r * 0.32, 6, 4), mat('#FFFFFF', { emissive: '#FFFFFF', emissiveIntensity: 0.6 })); hl.position.set(x + r * 0.3, y + r * 0.35, z + r * 0.75); parent.add(hl);
  return e;
}
function bucketMesh() {
  const g = new THREE.Group();
  const b = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.22, 14, 1, true), mat('#4C86C9', { side: THREE.DoubleSide }))); b.position.y = -0.11; g.add(b);
  const bot = new THREE.Mesh(new THREE.CircleGeometry(0.11, 14), mat('#3A6CA8')); bot.rotation.x = -Math.PI / 2; bot.position.y = -0.22; g.add(bot);
  const h = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.012, 6, 16, Math.PI), mat('#888888')); g.add(h);
  return g;
}
function mapMesh() {
  const tex = canvasTex(256, 180, (c, w, h) => {
    c.fillStyle = '#F3E6C4'; c.fillRect(0, 0, w, h); c.strokeStyle = '#B79B62'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
    c.fillStyle = '#9CCB7A'; c.beginPath(); c.ellipse(90, 100, 60, 40, 0.3, 0, M.TAU); c.fill(); c.beginPath(); c.ellipse(190, 70, 40, 28, -0.4, 0, M.TAU); c.fill();
    c.strokeStyle = '#C0392B'; c.setLineDash([8, 6]); c.lineWidth = 4; c.beginPath(); c.moveTo(40, 150); c.bezierCurveTo(100, 40, 160, 160, 210, 50); c.stroke();
    c.setLineDash([]); c.font = 'bold 30px sans-serif'; c.fillStyle = '#5A3B24'; c.textAlign = 'center'; c.fillText('PETA', w / 2, 40);
    c.strokeStyle = '#C0392B'; c.lineWidth = 6; c.beginPath(); c.moveTo(200, 40); c.lineTo(220, 60); c.moveTo(220, 40); c.lineTo(200, 60); c.stroke();
  });
  tex.center.set(0.5, 0.5); tex.rotation = Math.PI;           // upside down
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.4), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
  return m;
}

// Four-legged animals: badak (Javan rhino, one horn), rusa (deer), babi (wild boar), kancil (mouse deer).
// Modes: idle, walk, cheer, snort, lost, sad. Moods: smile, flat (half-closed eyes), shock.
export function beast(scene, { kind = 'badak', color, bucket = false, map = false } = {}) {
  const C = {
    badak: { col: '#8F8C88', bodyR: 0.75, body: [0.85, 0.74, 1.45], bodyY: 0.98, legR: 0.16, legL: 0.56, legX: 0.4, legZ: 0.7, head: [0, 1.02, 1.18], headR: 0.36, eye: 0.05 },
    rusa: { col: '#A8703E', bodyR: 0.45, body: [0.7, 0.72, 1.4], bodyY: 1.02, legR: 0.05, legL: 0.78, legX: 0.18, legZ: 0.42, head: [0, 1.62, 0.72], headR: 0.2, eye: 0.05 },
    babi: { col: '#5A4A40', bodyR: 0.45, body: [0.82, 0.8, 1.3], bodyY: 0.56, legR: 0.07, legL: 0.3, legX: 0.2, legZ: 0.36, head: [0, 0.6, 0.62], headR: 0.24, eye: 0.04 },
    kancil: { col: '#B5793F', bodyR: 0.26, body: [0.7, 0.8, 1.4], bodyY: 0.5, legR: 0.03, legL: 0.42, legX: 0.1, legZ: 0.24, head: [0, 0.78, 0.4], headR: 0.14, eye: 0.04 },
  }[kind];
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const fur = mat(color || C.col), dark = mat(new THREE.Color(color || C.col).multiplyScalar(0.7).getStyle()), light = mat(new THREE.Color(color || C.col).lerp(new THREE.Color('#FFFFFF'), 0.45).getStyle());
  const torso = cast(new THREE.Mesh(new THREE.SphereGeometry(C.bodyR, 24, 18), fur)); torso.scale.set(...C.body); torso.position.y = C.bodyY; body.add(torso);
  if (kind === 'badak') {   // skin folds
    [0.42, -0.38].forEach((z) => { const q = Math.sqrt(1 - (z / (C.bodyR * C.body[2])) ** 2) * 0.99; const f = cast(new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 6, 28), dark)); f.scale.set(C.bodyR * C.body[0] * q, C.bodyR * C.body[1] * q, 1); f.position.set(0, C.bodyY, z); body.add(f); });
    const tail = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.4, 6), dark)); tail.position.set(0, C.bodyY + 0.1, -1.12); tail.rotation.x = 0.5; body.add(tail);
  }
  if (kind === 'rusa' || kind === 'kancil') {
    const rump = new THREE.Mesh(new THREE.SphereGeometry(C.bodyR * 0.35, 10, 8), mat('#F4EEE2')); rump.position.set(0, C.bodyY + C.bodyR * 0.2, -C.bodyR * C.body[2] * 0.95); body.add(rump);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(C.bodyR * 0.95, 16, 10), light); belly.scale.set(C.body[0] * 0.9, C.body[1] * 0.5, C.body[2] * 0.85); belly.position.y = C.bodyY - C.bodyR * 0.32; body.add(belly);
  }
  if (kind === 'babi') for (let i = 0; i < 7; i++) { const b = cast(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 5), dark)); b.position.set(0, C.bodyY + C.bodyR * C.body[1] - 0.02, 0.4 - i * 0.12); b.rotation.x = -0.4; body.add(b); }
  // neck (rusa / kancil)
  if (kind === 'rusa' || kind === 'kancil') {
    const [hx, hy, hz] = C.head; const nb = new THREE.Vector3(0, C.bodyY + C.bodyR * 0.3, C.bodyR * C.body[2] * 0.7), nt = new THREE.Vector3(hx, hy - C.headR * 0.6, hz - C.headR * 0.4);
    const len = nb.distanceTo(nt); const n = cast(new THREE.Mesh(new THREE.CylinderGeometry(C.headR * 0.5, C.headR * 0.75, len, 10), fur));
    n.position.copy(nb).lerp(nt, 0.5); n.lookAt(nt); n.rotateX(Math.PI / 2); body.add(n);
  }
  const head = new THREE.Group(); head.position.set(...C.head); body.add(head);
  const skull = cast(new THREE.Mesh(new THREE.SphereGeometry(C.headR, 20, 16), fur)); head.add(skull);
  let horn = null, nose = new THREE.Object3D();
  const eyesY = C.headR * 0.25, eyesX = C.headR * 0.62, eyesZ = C.headR * 0.62;
  if (kind === 'badak') {
    skull.scale.set(0.9, 0.82, 1.2);
    const snout = cast(new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), fur)); snout.scale.set(0.95, 0.78, 1.1); snout.position.set(0, -0.12, 0.36); head.add(snout);
    const lip = cast(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 8), dark)); lip.position.set(0, -0.2, 0.66); lip.rotation.x = 1.9; head.add(lip);
    horn = cast(new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.36, 10), mat('#5E554C'))); horn.position.set(0, 0.12, 0.52); horn.rotation.x = -0.35; head.add(horn);
    [-1, 1].forEach((d) => { const ear = cast(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 8), fur)); ear.position.set(d * 0.2, 0.32, -0.12); ear.rotation.z = -d * 0.4; head.add(ear);
      const ns = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mat(PAL.black)); ns.position.set(d * 0.08, -0.08, 0.68); head.add(ns); });
    nose.position.set(0, -0.08, 0.74); head.add(nose);
  } else if (kind === 'babi') {
    skull.scale.set(0.95, 0.95, 1.15);
    const snout = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.3, 14), fur)); snout.rotation.x = Math.PI / 2; snout.position.set(0, -0.05, 0.3); head.add(snout);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.13, 16), mat('#C98A7A')); disc.position.set(0, -0.05, 0.455); head.add(disc);
    [-1, 1].forEach((d) => { const tk = cast(new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.14, 6), mat('#F4EEE2'))); tk.position.set(d * 0.13, -0.08, 0.36); tk.rotation.set(-0.3, 0, -d * 0.5); head.add(tk);
      const ear = cast(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.15, 6), dark)); ear.position.set(d * 0.15, 0.22, -0.02); ear.rotation.z = -d * 0.3; head.add(ear); });
    nose.position.set(0, -0.05, 0.5); head.add(nose);
  } else {
    skull.scale.set(0.85, 0.9, 1.1);
    const muzzle = cast(new THREE.Mesh(new THREE.SphereGeometry(C.headR * 0.62, 14, 10), fur)); muzzle.scale.set(0.8, 0.75, 1.2); muzzle.position.set(0, -C.headR * 0.25, C.headR * 0.8); head.add(muzzle);
    const nz = new THREE.Mesh(new THREE.SphereGeometry(C.headR * 0.18, 8, 6), mat(PAL.black)); nz.position.set(0, -C.headR * 0.2, C.headR * 1.45); head.add(nz);
    [-1, 1].forEach((d) => { const ear = cast(new THREE.Mesh(new THREE.ConeGeometry(C.headR * 0.32, C.headR * 0.9, 8), fur)); ear.position.set(d * C.headR * 0.75, C.headR * 0.55, -C.headR * 0.2); ear.rotation.z = -d * 1.0; head.add(ear); });
    if (kind === 'rusa') [-1, 1].forEach((d) => {
      const am = mat('#D9C7A0');
      const a1 = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.5, 6), am)); a1.position.set(d * 0.1, 0.38, -0.04); a1.rotation.z = -d * 0.35; head.add(a1);
      const a2 = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.24, 6), am)); a2.position.set(d * 0.2, 0.52, 0.06); a2.rotation.set(0.6, 0, -d * 0.1); head.add(a2);
      const a3 = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.22, 6), am)); a3.position.set(d * 0.24, 0.66, -0.04); a3.rotation.z = -d * 0.8; head.add(a3);
    });
    nose.position.set(0, -C.headR * 0.2, C.headR * 1.5); head.add(nose);
  }
  const eyes = [-1, 1].map((d) => eyeWithShine(head, d * eyesX, eyesY, eyesZ, C.eye));
  const lids = [-1, 1].map((d) => { const l = new THREE.Mesh(new THREE.SphereGeometry(C.eye * 1.25, 12, 8, 0, M.TAU, 0, Math.PI / 2), fur); l.position.set(d * eyesX, eyesY, eyesZ); head.add(l); return l; });
  const legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => {
    const piv = new THREE.Group(); piv.position.set(sx * C.legX, C.legL, sz * C.legZ); body.add(piv);
    const l = cast(new THREE.Mesh(new THREE.CylinderGeometry(C.legR, C.legR * 1.1, C.legL, 10), kind === 'badak' ? fur : dark)); l.position.y = -C.legL / 2; piv.add(l);
    const hoof = cast(new THREE.Mesh(new THREE.CylinderGeometry(C.legR * 1.15, C.legR * 1.2, C.legL * 0.12, 10), mat('#2E2824'))); hoof.position.y = -C.legL + C.legL * 0.06; piv.add(hoof);
    return piv;
  });
  let bk = null, mp = null;
  if (bucket) { bk = bucketMesh(); bk.position.set(0, -C.headR * 0.75, C.headR * 1.3); head.add(bk); }
  if (map) { mp = mapMesh(); mp.scale.setScalar(0.62); mp.position.set(C.headR * 1.7, -C.headR * 0.9, C.headR * 1.4); mp.rotation.set(-0.1, -0.7, 0); head.add(mp); }
  scene.add(root);
  function pose(t, o = {}) {
    const { x = 0, y = 0, z = 0, rot = 0, mode = 'idle', mood = 'smile' } = o;
    root.position.set(x, y, z); root.rotation.set(0, rot, 0);
    const walk = mode === 'walk', ph = t * (kind === 'badak' ? 5 : 7);
    legs.forEach((l, i) => { l.rotation.x = walk ? Math.sin(ph + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.5 : 0; });
    let by = Math.sin(t * 2) * 0.01, hx = Math.sin(t * 1.3) * 0.05, hy = Math.sin(t * 0.8) * 0.12, bz = 0;
    if (walk) { by = Math.abs(Math.sin(ph)) * 0.03; bz = Math.sin(ph) * 0.03; }
    if (mode === 'cheer') { const j = Math.abs(Math.sin(t * 6 + x)); by = j * 0.35; hx = -0.3; legs.forEach((l, i) => { l.rotation.x = (i < 2 ? -1 : 1) * j * 0.5; }); }
    if (mode === 'snort') { hx = -0.15 + Math.max(0, Math.sin(t * 5)) * 0.2; }
    if (mode === 'lost') { hy = Math.sin(t * 2.4) * 0.6; hx = 0.1; }
    if (mode === 'sad' || mode === 'thirsty') { hx = 0.35; by = -0.02; }
    body.position.y = by; body.rotation.z = bz;
    head.rotation.set(hx, hy, 0);
    const blink = Math.sin(t * 1.2 + x * 3) > 0.985;
    const lid = mood === 'flat' ? 1 : blink ? 1 : 0;
    lids.forEach((l) => { l.visible = lid > 0; l.rotation.x = mood === 'flat' ? -0.25 : 0.4; });
    eyes.forEach((e) => { e.scale.setScalar(mood === 'shock' ? 1.35 : 1); });
    if (bk) bk.rotation.z = Math.sin(t * 3 + x) * 0.15;
    if (mp) mp.rotation.z = Math.sin(t * 2) * 0.05 + Math.PI * 0;
  }
  return { obj: root, pose, root, animal: true, nose, height: C.head[1] + C.headR };
}

// Rangkong (hornbill): black body, white tail, big yellow beak with orange casque. Optional bucket.
export function hornbill(scene, { bucket = false } = {}) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const blk = mat('#1F1D1C'), wht = mat('#F2EEE6');
  const torso = cast(new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 14), blk)); torso.scale.set(0.9, 1, 1.3); torso.position.y = 0.62; torso.rotation.x = -0.35; body.add(torso);
  const tail = cast(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.5), wht)); tail.position.set(0, 0.48, -0.42); tail.rotation.x = 0.5; body.add(tail);
  const wings = [-1, 1].map((d) => { const piv = new THREE.Group(); piv.position.set(d * 0.22, 0.72, 0); const w = cast(new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), blk)); w.scale.set(0.3, 0.8, 1.3); w.position.set(d * 0.04, -0.08, -0.05); piv.add(w); body.add(piv); return piv; });
  const head = new THREE.Group(); head.position.set(0, 0.98, 0.18); body.add(head);
  head.add(cast(new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), blk)));
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.25, 10), wht); neck.position.set(0, -0.15, -0.02); head.add(neck);
  const beak = cast(new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.42, 10), mat('#F2C14E'))); beak.rotation.x = Math.PI / 2 + 0.25; beak.position.set(0, -0.04, 0.3); head.add(beak);
  const casque = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.2, 4, 8), mat('#E8642A'))); casque.rotation.x = Math.PI / 2 + 0.15; casque.position.set(0, 0.08, 0.2); head.add(casque);
  const eyes = [-1, 1].map((d) => eyeWithShine(head, d * 0.1, 0.04, 0.09, 0.03));
  const legs = [-1, 1].map((d) => { const l = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 6), mat('#4A4038'))); l.position.set(d * 0.1, 0.2, 0); body.add(l); return l; });
  let bk = null;
  if (bucket) { bk = bucketMesh(); bk.scale.setScalar(0.85); bk.position.set(0, -0.12, 0.45); head.add(bk); }
  scene.add(root); void eyes; void legs;
  function pose(t, o = {}) {
    const { x = 0, y = 0, z = 0, rot = 0, mode = 'idle' } = o;
    root.position.set(x, y, z); root.rotation.set(0, rot, 0);
    const cheer = mode === 'cheer';
    body.position.y = cheer ? Math.abs(Math.sin(t * 7 + x)) * 0.3 : mode === 'walk' ? Math.abs(Math.sin(t * 8)) * 0.05 : 0;
    wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (cheer ? 0.6 + Math.sin(t * 20) * 0.6 : 0.05); });
    head.rotation.set(mode === 'sad' || mode === 'thirsty' ? 0.3 : Math.sin(t * 1.6) * 0.08, mode === 'lost' ? Math.sin(t * 2.4) * 0.6 : Math.sin(t * 0.9 + 1) * 0.25, 0);
    if (bk) bk.rotation.z = Math.sin(t * 3 + x) * 0.15;
  }
  return { obj: root, pose, root, animal: true, nose: head, height: 1.2 };
}

// ---- growable forest props: update(t, k) with k 0..1 driven by "grow" events
export function fruitTree(scene) {
  const g = new THREE.Group();
  const trunk = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.62, 5, 10), mat('#6B4A30'))); trunk.position.y = 2.5; g.add(trunk);
  [0, 1, 2, 3].forEach((i) => { const b = cast(new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.2, 4), mat('#5E412A'))); const a = i * M.TAU / 4 + 0.4; b.position.set(Math.cos(a) * 0.5, 0.5, Math.sin(a) * 0.5); b.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); g.add(b); });
  const leaf = [mat('#2F7A3A'), mat('#3E8E3F'), mat('#357F3C')];
  [[0, 5.6, 0, 2.4], [-1.8, 5.0, 0.4, 1.7], [1.8, 5.1, -0.2, 1.8], [0.3, 6.6, -0.4, 1.7], [0.2, 5.0, 1.4, 1.5]].forEach(([x, y, z, r], i) => {
    const c = cast(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leaf[i % 3])); c.scale.y = 0.75; c.position.set(x, y, z); g.add(c);
  });
  const cols = ['#F2A93B', '#E8C33A', '#E07A2E', '#9BC53D'];
  const N = 18;
  const fruits = Array.from({ length: N }, (_, i) => {
    const f = cast(new THREE.Mesh(new THREE.SphereGeometry(0.2 + M.hash01(i, 71) * 0.08, 12, 10), mat(cols[i % 4]))); f.scale.y = 1.1; g.add(f);
    const a = M.hash01(i, 72) * Math.PI - Math.PI * 0.1, rr = 1.2 + M.hash01(i, 73) * 1.2;
    f.hang = new THREE.Vector3(Math.cos(a) * rr * 1.1, 3.9 + M.hash01(i, 74) * 0.5, Math.sin(a) * rr * 0.7 + 0.6);
    const layer = i < 9 ? 0 : i < 15 ? 1 : 2, k = layer === 0 ? i : layer === 1 ? i - 9 : i - 15;
    const n = [9, 6, 3][layer];
    f.pile = new THREE.Vector3((k - (n - 1) / 2) * 0.36 + (layer % 2) * 0.05, 0.22 + layer * 0.32, 1.3 + (k % 2) * 0.32 - layer * 0.12);
    return f;
  });
  scene.add(g);
  return { obj: g, update(t, k) {
    fruits.forEach((f, i) => {
      const s = (i / N) * 0.72, q = M.clamp((k - s) / 0.28);
      if (q <= 0) { f.position.copy(f.hang); f.position.y += Math.sin(t * 2 + i) * 0.02; return; }
      const fall = Math.min(1, q * 1.4);
      f.position.lerpVectors(f.hang, f.pile, fall);
      f.position.y = f.hang.y + (f.pile.y - f.hang.y) * fall * fall;
      if (fall >= 1) f.position.y = f.pile.y + Math.abs(Math.sin((q - 0.714) * 11)) * 0.25 * Math.max(0, 1 - (q - 0.714) * 3.5);
    });
  } };
}

export function seedlings(scene) {
  const g = new THREE.Group();
  const stemM = mat('#5E9E3A'), leafM = mat('#7CC64A');
  const N = 15;
  const items = Array.from({ length: N }, (_, i) => {
    const s = new THREE.Group();
    const hero = i === 0;
    const h = hero ? 0.62 : 0.32 + M.hash01(i, 81) * 0.25;
    const st = cast(new THREE.Mesh(new THREE.CylinderGeometry(hero ? 0.035 : 0.02, hero ? 0.045 : 0.028, h, 6), stemM)); st.position.y = h / 2; s.add(st);
    [-1, 1].forEach((d) => { const l = cast(new THREE.Mesh(new THREE.SphereGeometry(hero ? 0.14 : 0.08, 10, 8), leafM)); l.scale.set(1.5, 0.35, 0.8); l.position.set(d * (hero ? 0.14 : 0.08), h, 0); l.rotation.z = d * 0.4; s.add(l); });
    if (hero) {
      const face = new THREE.Group(); face.position.set(0, h - 0.12, 0.04);
      [-1, 1].forEach((d) => eyeWithShine(face, d * 0.035, 0, 0.0, 0.022));
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 6, 12), mat(PAL.black)); m.position.set(0, -0.05, 0.0); face.add(m);
      st.material = stemM; s.add(face);
      const c = cast(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), stemM)); c.position.y = h - 0.1; c.scale.set(1, 1.3, 0.8); s.add(c);
    }
    const a = M.hash01(i, 82) * M.TAU, r = hero ? 0 : 0.18 + M.hash01(i, 83) * 0.7;
    s.position.set(Math.cos(a) * r, 0, Math.sin(a) * r * 0.6 - (hero ? -0.25 : 0)); s.base = s.position.clone();
    g.add(s); return s;
  });
  scene.add(g);
  return { obj: g, update(t, k) {
    items.forEach((s, i) => {
      const gk = M.clamp((k - (i / N) * 0.4) / 0.6);
      s.scale.setScalar(Math.max(0.001, E_out(gk)));
      const j = gk * (i === 0 ? 1.2 : 1);
      s.rotation.z = Math.sin(t * 7 + i * 1.7) * 0.28 * j;
      s.position.x = s.base.x + Math.sin(t * 7 + i * 1.7) * 0.04 * j;
    });
  } };
}

function glowTex() {
  return canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,240,170,1)'); g.addColorStop(0.4, 'rgba(255,220,120,0.45)'); g.addColorStop(1, 'rgba(255,220,120,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
}
export function dung(scene) {
  const g = new THREE.Group();
  [[0, 0.13, 0, 0.17], [-0.2, 0.1, 0.05, 0.13], [0.2, 0.1, -0.03, 0.14], [0.02, 0.1, 0.2, 0.12], [-0.05, 0.3, 0.02, 0.12]].forEach(([x, y, z, r], i) => {
    const b = cast(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat(i % 2 ? '#5A3B24' : '#6B472B'))); b.position.set(x, y, z); b.scale.y = 0.8; g.add(b);
  });
  const sprout = new THREE.Group(); sprout.position.set(-0.02, 0.38, 0.02); g.add(sprout);
  const st = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.4, 6), mat('#5E9E3A'))); st.position.y = 0.2; sprout.add(st);
  [-1, 1].forEach((d) => { const l = cast(new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat('#86D24E'))); l.scale.set(1.5, 0.35, 0.8); l.position.set(d * 0.1, 0.4, 0); l.rotation.z = d * 0.45; sprout.add(l); });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.y = 0.5; g.add(halo);
  const sparks = Array.from({ length: 8 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(0.12); g.add(s); return s; });
  const light = new THREE.PointLight('#FFE7A0', 0, 4); light.position.y = 0.9; g.add(light);
  scene.add(g);
  return { obj: g, update(t, k) {
    const sk = E_out(M.clamp(k / 0.7));
    sprout.scale.setScalar(Math.max(0.001, sk)); sprout.rotation.z = Math.sin(t * 2) * 0.06;
    const gl = M.clamp((k - 0.3) / 0.5);
    halo.material.opacity = gl * (0.8 + Math.sin(t * 4) * 0.1); halo.scale.setScalar(1.6 + gl * 0.4);
    light.intensity = gl * 4;
    sparks.forEach((s, i) => { const a = t * 1.5 + i * M.TAU / 8; s.position.set(Math.cos(a) * 0.5, 0.35 + ((t * 0.5 + i / 8) % 1) * 0.8, Math.sin(a) * 0.5); s.material.opacity = gl * Math.sin(((t * 0.5 + i / 8) % 1) * Math.PI); });
  } };
}

function crackTex() {
  return canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#C9A26A'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#7A5A36'; c.lineWidth = 3; c.lineCap = 'round';
    const pts = Array.from({ length: 22 }, (_, i) => [M.hash01(i, 91) * w, M.hash01(i, 92) * h]);
    pts.forEach(([x, y], i) => { const near = pts.map((p, j) => [Math.hypot(p[0] - x, p[1] - y), j]).sort((a, b) => a[0] - b[0]).slice(1, 4);
      near.forEach(([, j]) => { if (j < i) return; c.beginPath(); c.moveTo(x, y); const [x2, y2] = pts[j]; c.quadraticCurveTo((x + x2) / 2 + (M.hash01(i + j, 93) - 0.5) * 20, (y + y2) / 2 + (M.hash01(i * j, 94) - 0.5) * 20, x2, y2); c.stroke(); }); });
  });
}
export function wallow(scene, { r = 2.2 } = {}) {
  const g = new THREE.Group();
  const rim = cast(new THREE.Mesh(new THREE.TorusGeometry(r, 0.18, 6, 40), mat('#6E5034'))); rim.rotation.x = Math.PI / 2; rim.scale.z = 0.5; rim.position.y = 0.04; g.add(rim);
  const dry = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshLambertMaterial({ map: crackTex() })); dry.rotation.x = -Math.PI / 2; dry.position.y = 0.03; dry.receiveShadow = true; g.add(dry);
  const mudM = new THREE.MeshLambertMaterial({ color: '#6B4E33', emissive: '#2A1C10', emissiveIntensity: 0.3 });
  const mud = new THREE.Mesh(new THREE.CircleGeometry(r * 0.96, 40), mudM); mud.rotation.x = -Math.PI / 2; mud.position.y = 0.05; g.add(mud);
  const shineM = new THREE.MeshBasicMaterial({ color: '#B89A78', transparent: true, opacity: 0.5 });
  const shines = [0, 1, 2].map((i) => { const s = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 24), shineM); s.rotation.x = -Math.PI / 2; s.position.set((i - 1) * r * 0.4, 0.06, (i % 2 ? 0.3 : -0.4) * r); g.add(s); return s; });
  scene.add(g);
  const wet = new THREE.Color('#6B4E33'), dried = new THREE.Color('#A8824F');
  return { obj: g, update(t, k) {
    const s = Math.max(0.001, 1 - E_out(k) * 0.999);
    mud.scale.setScalar(s); mudM.color.lerpColors(wet, dried, k);
    shines.forEach((sh, i) => { const q = (t * 0.4 + i / 3) % 1; sh.scale.setScalar((0.5 + q * 2) * s); shineM.opacity = 0.5 * (1 - q) * (1 - k); });
  } };
}

// a forest footpath along +x (length L), overgrown as k goes 0 -> 1
export function footpath(scene, { length = 24 } = {}) {
  const g = new THREE.Group();
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(length, 1.6, 24, 2), mat('#B58E5C')); strip.rotation.x = -Math.PI / 2; strip.position.set(length / 2, 0.03, 0); strip.receiveShadow = true; g.add(strip);
  const geo = (() => { const gs = []; for (let k = 0; k < 6; k++) { const q = new THREE.ConeGeometry(0.1, 0.8, 4); q.translate(0, 0.4, 0); q.rotateZ(0.6); q.rotateY(k / 6 * M.TAU); gs.push(q); } return mergeGeometries(gs); })();
  const bushG = new THREE.IcosahedronGeometry(0.45, 1);
  const ms = [mat('#4E9A3E'), mat('#3E8A38'), mat('#62A848')];
  const plants = Array.from({ length: 46 }, (_, i) => {
    const p = cast(new THREE.Mesh(i % 3 ? geo : bushG, ms[i % 3]));
    p.position.set(M.hash01(i, 101) * length, i % 3 ? 0 : 0.2, (M.hash01(i, 102) - 0.5) * 1.5); p.rotation.y = M.hash01(i, 103) * 3;
    p.s0 = 0.8 + M.hash01(i, 104) * 0.7; p.delay = (p.position.x / length) * 0.5 + M.hash01(i, 105) * 0.2; g.add(p); return p;
  });
  scene.add(g);
  return { obj: g, update(t, k) { plants.forEach((p) => { const q = E_out(M.clamp((k - p.delay) / 0.35)); p.scale.setScalar(Math.max(0.001, q * p.s0)); p.visible = q > 0.01; }); } };
}

// thorny thicket: spiky bushes that grow with k (they fill the frame when grown)
export function thicket(scene, { r = 3, count = 16 } = {}) {
  const g = new THREE.Group();
  const leafM = mat('#2E6B30'), spikeM = mat('#8A3A2A');
  const bushes = Array.from({ length: count }, (_, i) => {
    const b = new THREE.Group();
    const R = 0.55 + M.hash01(i, 111) * 0.6;
    b.add(cast(new THREE.Mesh(new THREE.IcosahedronGeometry(R, 1), leafM)));
    const gs = [];
    for (let k = 0; k < 22; k++) {
      const u = M.hash01(i * 31 + k, 112) * 2 - 1, a = M.hash01(i * 31 + k, 113) * M.TAU, s = Math.sqrt(1 - u * u);
      const dir = new THREE.Vector3(s * Math.cos(a), u, s * Math.sin(a));
      const cg = new THREE.ConeGeometry(0.05, 0.28, 4); cg.translate(0, 0.14, 0);
      cg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
      cg.translate(dir.x * R * 0.92, dir.y * R * 0.92, dir.z * R * 0.92); gs.push(cg);
    }
    b.add(cast(new THREE.Mesh(mergeGeometries(gs), spikeM)));
    const a = M.hash01(i, 114) * M.TAU, d = Math.sqrt(M.hash01(i, 115)) * r;
    b.position.set(Math.cos(a) * d, R * 0.6, Math.sin(a) * d); b.scale.y = 0.9 + M.hash01(i, 116) * 0.6;
    b.delay = (d / r) * 0.45 + M.hash01(i, 117) * 0.15; b.s0 = b.scale.y;
    g.add(b); return b;
  });
  scene.add(g);
  return { obj: g, update(t, k) { bushes.forEach((b, i) => { const q = E_out(M.clamp((k - b.delay) / 0.4)); b.scale.set(Math.max(0.001, q), Math.max(0.001, q * b.s0), Math.max(0.001, q)); b.visible = q > 0.01; b.rotation.y = Math.sin(t * 1.5 + i) * 0.04; }); } };
}

export function sandal(scene) {
  const g = new THREE.Group();
  const sole = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.14, 4, 8), mat('#3A7BD5'))); sole.rotation.x = Math.PI / 2; sole.scale.y = 0.25; sole.position.y = 0.02; g.add(sole);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 12, Math.PI), mat('#F2F2F2')); strap.position.set(0, 0.03, 0.03); g.add(strap);
  g.scale.setScalar(1.6); scene.add(g); return { obj: g };
}
export function rangerHat(parent) {
  const g = new THREE.Group();
  const crown = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.2, 20), mat('#B59A5E'))); crown.position.y = 0.1; g.add(crown);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.05, 20), mat('#5A4A2E')); band.position.y = 0.03; g.add(band);
  const brim = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.025, 24), mat('#A88C52'))); g.add(brim);
  parent.add(g); return g;
}

// ======================================================================== interior set (90s rooms) + retro props
// Four open-front rooms side by side: kamar (x 0), ruang tamu (x 14), kantor (x 28), kafe (x 42). Front open toward +z.
export function interiorSet() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2A2622');
  scene.add(new THREE.HemisphereLight('#FFF6E6', '#7A6450', 1.35));
  const key = new THREE.DirectionalLight('#FFF0D8', 1.6); key.position.set(6, 12, 14); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -30, right: 30, top: 12, bottom: -12, near: 1, far: 60 });
  key.target.position.set(21, 0, -1); key.shadow.bias = -0.0006; scene.add(key, key.target);
  const box = (w, h, d, c, x, y, z, o) => { const m = cast(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, o))); m.position.set(x, y, z); scene.add(m); return m; };
  const ROOMS = [
    { cx: 0, wall: '#E9D3A8', floor: '#B98B5E', trim: '#8A5E3A' },
    { cx: 14, wall: '#CFE0C8', floor: '#D8CDB8', trim: '#6F8A66' },
    { cx: 28, wall: '#DCDAD0', floor: '#BFC3C4', trim: '#7C8288' },
    { cx: 42, wall: '#E3B98A', floor: '#9C6B45', trim: '#6B3F22' },
  ];
  ROOMS.forEach(({ cx, wall, floor, trim }) => {
    box(10, 0.1, 7, floor, cx, -0.05, 0.5);
    box(10, 4, 0.2, wall, cx, 2, -3.1);
    [-1, 1].forEach((d) => box(0.2, 4, 7, wall, cx + d * 5.1, 2, 0.4));
    box(10, 0.18, 0.06, trim, cx, 0.09, -2.98);
  });
  // window helper (back wall)
  const windowAt = (x, y = 2.1, w = 1.5, h = 1.2) => {
    box(w + 0.16, h + 0.16, 0.08, '#F4F1EA', x, y, -2.98);
    box(w, h, 0.06, '#A9DDF5', x, y, -2.95, { emissive: '#CFEFFF', emissiveIntensity: 0.55 });
    box(0.06, h, 0.08, '#F4F1EA', x, y, -2.93); box(w, 0.06, 0.08, '#F4F1EA', x, y, -2.93);
    [-1, 1].forEach((d) => box(0.35, h + 0.5, 0.05, '#C0504D', x + d * (w / 2 + 0.2), y - 0.1, -2.9));
  };
  // kamar: window, poster, rug
  windowAt(2.6);
  const poster = canvasTex(256, 360, (c, w, h) => { c.fillStyle = '#1E2A44'; c.fillRect(0, 0, w, h); c.fillStyle = '#F2C14E'; c.beginPath(); c.arc(w / 2, 140, 70, 0, M.TAU); c.fill();
    c.fillStyle = '#E85D75'; c.fillRect(30, 240, w - 60, 18); c.fillStyle = '#FFFFFF'; c.font = '800 44px Display'; c.textAlign = 'center'; c.fillText('ROCK 95', w / 2, 320); });
  const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.26), new THREE.MeshLambertMaterial({ map: poster })); pm.position.set(-1.2, 2.3, -2.99); scene.add(pm);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.4, 28), mat('#7A9CC6')); rug.rotation.x = -Math.PI / 2; rug.position.set(0.6, 0.01, 0.6); rug.scale.y = 0.6; scene.add(rug);
  // ruang tamu: window, sofa, plant
  windowAt(11.6);
  box(2.6, 0.45, 0.9, '#8A5A3C', 18.2, 0.4, 0.6); box(2.6, 0.7, 0.25, '#8A5A3C', 18.2, 0.75, 1.05);
  box(1.6, 0.06, 0.6, '#7A4E2D', 13.3, 0.74, -0.9); [-0.7, 0.7].forEach((d) => box(0.06, 0.72, 0.5, '#5E3B22', 13.3 + d, 0.36, -0.9));
  // kantor: filing cabinet, partition, plant
  box(0.7, 1.4, 0.6, '#9AA3A8', 23.8, 0.7, -2.6); box(0.7, 1.4, 0.6, '#9AA3A8', 24.6, 0.7, -2.6);
  windowAt(25.6, 2.3, 1.2, 1.0);
  // kafe: counter, hanging lamps, menu board
  box(3.2, 1.1, 0.8, '#6B3F22', 45.4, 0.55, -2.2); box(3.4, 0.08, 0.9, '#3A2418', 45.4, 1.12, -2.2);
  const menu = canvasTex(256, 180, (c, w, h) => { c.fillStyle = '#2B2B2B'; c.fillRect(0, 0, w, h); c.fillStyle = '#F4F1EA'; c.font = '800 40px Display'; c.textAlign = 'center'; c.fillText('MENU', w / 2, 48);
    c.font = '24px sans-serif'; ['KOPI ......... 2.000', 'TEH ........... 1.500', 'ES JERUK .... 2.500'].forEach((l, i) => c.fillText(l, w / 2, 92 + i * 30)); });
  const mm = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.12), new THREE.MeshLambertMaterial({ map: menu })); mm.position.set(45.4, 2.5, -2.99); scene.add(mm);
  [40.4, 42, 43.6].forEach((x) => { box(0.02, 1.2, 0.02, '#222', x, 3.4, -0.4); const l = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.3, 14, 1, true), mat('#F2C14E', { emissive: '#FFD27A', emissiveIntensity: 0.6, side: THREE.DoubleSide })); l.position.set(x, 2.7, -0.4); scene.add(l); });
  // plants
  [[21.6, -2.4], [32.4, -2.4], [38.6, -2.4]].forEach(([x, z]) => { box(0.4, 0.5, 0.4, '#B5643A', x, 0.25, z); const b = cast(new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), mat('#4E9A3E'))); b.position.set(x, 0.85, z); scene.add(b); });
  return { scene, update() {} };
}

const textTex = (w, h, paint) => canvasTex(w, h, paint);
export function bed(scene) {
  const g = new THREE.Group();
  const b = (w, h, d, c, x, y, z) => { const m = cast(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c))); m.position.set(x, y, z); g.add(m); return m; };
  b(2.2, 0.35, 1.3, '#7A4E2D', 0, 0.2, 0); b(2.1, 0.18, 1.22, '#F4F1EA', 0, 0.45, 0);
  b(0.1, 1.0, 1.3, '#7A4E2D', -1.1, 0.5, 0);
  const pillow = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.6, 4, 10), mat('#FFFFFF'))); pillow.rotation.x = Math.PI / 2; pillow.position.set(-0.78, 0.62, 0); g.add(pillow);
  b(1.3, 0.1, 1.24, '#5B8DC9', 0.35, 0.56, 0);
  // nightstand
  b(0.55, 0.55, 0.5, '#8A5E3A', -1.5, 0.28, -0.35);
  scene.add(g); return { obj: g };
}
export function radio(scene) {
  const g = new THREE.Group();
  const body = cast(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.32, 0.16), mat('#3A3A3E'))); body.position.y = 0.16; g.add(body);
  [-1, 1].forEach((d) => { const s = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20), mat('#1A1A1C')); s.position.set(d * 0.2, 0.15, 0.081); g.add(s);
    const r = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.115, 20), mat('#9A9AA0')); r.position.set(d * 0.2, 0.15, 0.082); g.add(r); });
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), mat('#C9C2B0')); deck.position.set(0, 0.16, 0.082); g.add(deck);
  const tape = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.06), mat('#E8642A')); tape.position.set(0, 0.16, 0.083); g.add(tape);
  ['#C0392B', '#888', '#888', '#888'].forEach((c, i) => { const k = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.03), mat(c)); k.position.set(-0.045 + i * 0.03, 0.33, 0.04); g.add(k); });
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.5, 4), mat('#BBBBBB')); ant.position.set(0.26, 0.5, -0.04); ant.rotation.z = -0.4; g.add(ant);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 6, 16, Math.PI), mat('#BBBBBB')); handle.position.set(0, 0.32, 0); g.add(handle);
  scene.add(g); return { obj: g };
}
export function wallCalendar(scene, { text = '1995', month = 'JANUARI' } = {}) {
  const tex = textTex(256, 340, (c, w, h) => {
    c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, w, h); c.fillStyle = '#C0392B'; c.fillRect(0, 0, w, 120);
    c.fillStyle = '#FFFFFF'; c.font = '800 92px Display'; c.textAlign = 'center'; c.fillText(text, w / 2, 96);
    c.fillStyle = '#333'; c.font = '800 30px Display'; c.fillText(month, w / 2, 160);
    c.font = '20px sans-serif'; for (let i = 0; i < 31; i++) { c.fillStyle = i % 7 === 0 ? '#C0392B' : '#333'; c.fillText(String(i + 1), 30 + (i % 7) * 32, 200 + Math.floor(i / 7) * 30); }
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.93), new THREE.MeshLambertMaterial({ map: tex })); scene.add(m); return { obj: m };
}
function coilGeo(len = 0.6, r = 0.035, turns = 16) {
  const pts = []; for (let i = 0; i <= turns * 12; i++) { const a = i / 12 * M.TAU; pts.push(new THREE.Vector3(Math.cos(a) * r, -i / (turns * 12) * len, Math.sin(a) * r)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 12, 0.008, 5, false);
}
function handsetMesh() {
  const g = new THREE.Group();
  const bar = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.2, 4, 8), mat('#E8E0CC'))); bar.rotation.z = Math.PI / 2; g.add(bar);
  [-1, 1].forEach((d) => { const e = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.05, 12), mat('#E8E0CC'))); e.position.set(d * 0.13, -0.03, 0); g.add(e); });
  return g;
}
export function landline(scene) {
  const g = new THREE.Group();
  const base = cast(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.24), mat('#E8E0CC'))); base.position.y = 0.05; g.add(base);
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.07, 18), mat('#C9BFA8')); dial.rotation.x = -Math.PI / 2 + 0.3; dial.position.set(0, 0.105, 0.04); g.add(dial);
  const hs = handsetMesh(); hs.position.set(0, 0.15, -0.03); g.add(hs);
  const coil = new THREE.Mesh(coilGeo(0.25, 0.025, 10), mat('#E8E0CC')); coil.rotation.z = Math.PI / 2; coil.position.set(-0.15, 0.08, 0.05); g.add(coil);
  scene.add(g); return { obj: g, handset: hs };
}
export function crtTV(scene, { text = 'BERITA PAGI', sub = '06:00' } = {}) {
  const g = new THREE.Group();
  const b = cast(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.72, 0.7), mat('#4A443E'))); b.position.y = 0.36 + 0.6; g.add(b);
  const stand = cast(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.6), mat('#7A4E2D'))); stand.position.y = 0.3; g.add(stand);
  const tex = textTex(320, 240, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2E6FB0'); gr.addColorStop(1, '#173E6B'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = '#F2C14E'; c.beginPath(); c.arc(90, 105, 38, 0, M.TAU); c.fill(); c.fillStyle = '#FFFFFF'; c.beginPath(); c.ellipse(130, 125, 50, 26, 0, 0, M.TAU); c.fill();
    c.fillStyle = '#C0392B'; c.fillRect(0, 180, w, 60); c.fillStyle = '#FFFFFF'; c.font = '800 34px Display'; c.textAlign = 'center'; c.fillText(text, w / 2, 222);
    c.font = '800 40px Display'; c.fillText(sub, 245, 120);
    c.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 2);
  });
  const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.52), new THREE.MeshBasicMaterial({ map: tex })); sc.position.set(-0.03, 0.97, 0.352); g.add(sc);
  [0.34, 0.34].forEach((x, i) => { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 10), mat('#222')); k.rotation.x = Math.PI / 2; k.position.set(x, 1.1 - i * 0.14, 0.36); g.add(k); });
  [-1, 1].forEach((d) => { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 4), mat('#BBB')); a.position.set(d * 0.15, 1.55, -0.05); a.rotation.z = d * 0.5; g.add(a); });
  scene.add(g); return { obj: g };
}
export function officeDesk(scene) {
  const g = new THREE.Group();
  const b = (w, h, d, c, x, y, z) => { const m = cast(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c))); m.position.set(x, y, z); g.add(m); return m; };
  b(1.8, 0.06, 0.85, '#A0794F', 0, 0.76, 0); b(0.06, 0.74, 0.8, '#7A5A3A', -0.85, 0.37, 0); b(0.06, 0.74, 0.8, '#7A5A3A', 0.85, 0.37, 0);
  b(0.5, 0.42, 0.45, '#D9D2BE', -0.2, 1.0, -0.15);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.28), mat('#2F5E3A', { emissive: '#3FA35A', emissiveIntensity: 0.6 })); scr.position.set(-0.2, 1.02, 0.08); g.add(scr);
  b(0.5, 0.03, 0.18, '#D9D2BE', -0.2, 0.8, 0.22);
  [[0.45, 0.82, 0.1], [0.5, 0.86, 0.05]].forEach(([x, y, z]) => b(0.32, 0.04, 0.42, '#FFFFFF', x, y, z));
  // chair
  b(0.5, 0.06, 0.5, '#2E3A4A', 0, 0.48, 0.75); b(0.5, 0.6, 0.06, '#2E3A4A', 0, 0.8, 1.0); b(0.06, 0.45, 0.06, '#555', 0, 0.23, 0.75);
  scene.add(g); return { obj: g };
}
export function faxMachine(scene) {
  const g = new THREE.Group();
  const b = (w, h, d, c, x, y, z) => { const m = cast(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c))); m.position.set(x, y, z); g.add(m); return m; };
  b(0.8, 0.72, 0.6, '#8A7B66', 0, 0.36, 0);                    // side table
  b(0.55, 0.18, 0.42, '#E2DAC6', 0, 0.81, 0);
  b(0.2, 0.06, 0.12, '#3A3A3A', 0.15, 0.91, 0.12);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), mat('#5CE08A', { emissive: '#5CE08A', emissiveIntensity: 1 })); led.position.set(-0.2, 0.91, 0.18); g.add(led);
  const tex = textTex(128, 256, (c, w, h) => { c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, w, h); c.fillStyle = '#333'; for (let y = 20; y < h; y += 16) c.fillRect(12, y, w - 24 - (y % 48 ? 0 : 40), 5); });
  const paper = new THREE.Group(); paper.position.set(-0.05, 0.86, 0.21); g.add(paper);
  const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.42), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })); pm.position.y = -0.21; paper.add(pm);
  paper.rotation.x = -1.2;
  scene.add(g);
  return { obj: g, update(t, k) { paper.scale.set(1, Math.max(0.001, k), 1); paper.rotation.x = -1.2 + k * 0.5; led.material.emissiveIntensity = 0.4 + Math.abs(Math.sin(t * 8)) * 0.8; } };
}
export function wallClock(scene, { time = '15:00' } = {}) {
  const [hh, mm] = time.split(':').map(Number);
  const tex = textTex(256, 256, (c, w, h) => {
    c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(128, 128, 120, 0, M.TAU); c.fill(); c.lineWidth = 12; c.strokeStyle = '#2E2E2E'; c.stroke();
    c.fillStyle = '#2E2E2E'; for (let i = 0; i < 12; i++) { const a = i / 12 * M.TAU; c.fillRect(128 + Math.sin(a) * 96 - 4, 128 - Math.cos(a) * 96 - 10, 8, 20); }
    const hand = (a, l, wd, col) => { c.strokeStyle = col; c.lineWidth = wd; c.lineCap = 'round'; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + Math.sin(a) * l, 128 - Math.cos(a) * l); c.stroke(); };
    hand(((hh % 12) + mm / 60) / 12 * M.TAU, 60, 12, '#2E2E2E'); hand(mm / 60 * M.TAU, 92, 8, '#2E2E2E');
  });
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.4, 32), new THREE.MeshLambertMaterial({ map: tex })); scene.add(m); return { obj: m };
}
export function cafeTable(scene, { glasses = 4 } = {}) {
  const g = new THREE.Group();
  const top = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 28), mat('#5A3B24'))); top.position.y = 0.74; g.add(top);
  const leg = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.25, 0.72, 10), mat('#2E2E2E'))); leg.position.y = 0.36; g.add(leg);
  const gm = mat('#D9EEF5', { transparent: true, opacity: 0.6 }), drink = ['#C9762E', '#F2A93B', '#7A4A2E', '#E85D75'];
  for (let i = 0; i < glasses; i++) {
    const a = i / glasses * M.TAU + 0.4;
    const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.16, 12), gm); gl.position.set(Math.cos(a) * 0.42, 0.85, Math.sin(a) * 0.42); g.add(gl);
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.045, 0.1, 12), mat(drink[i % 4])); d.position.set(Math.cos(a) * 0.42, 0.82, Math.sin(a) * 0.42); g.add(d);
  }
  scene.add(g); return { obj: g };
}
export function postBox(scene) {
  const g = new THREE.Group();
  const red = mat('#C8352E');
  const b = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 1.1, 18), red)); b.position.y = 0.55; g.add(b);
  const top = cast(new THREE.Mesh(new THREE.SphereGeometry(0.29, 18, 10, 0, M.TAU, 0, Math.PI / 2), red)); top.position.y = 1.1; g.add(top);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.04), mat('#1E1B19')); slot.position.set(0, 0.95, 0.28); g.add(slot);
  const tex = textTex(128, 64, (c, w, h) => { c.fillStyle = '#F2C14E'; c.fillRect(0, 0, w, h); c.fillStyle = '#C8352E'; c.font = '800 44px Display'; c.textAlign = 'center'; c.fillText('POS', w / 2, 48); });
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshLambertMaterial({ map: tex })); lab.position.set(0, 0.72, 0.3); g.add(lab);
  scene.add(g); return { obj: g };
}
export function cafeFront(scene, { name = 'KAFE' } = {}) {
  const g = new THREE.Group();
  const b = (w, h, d, c, x, y, z, o) => { const m = cast(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, o))); m.position.set(x, y, z); g.add(m); return m; };
  b(6, 3.6, 3, '#F0E2C8', 0, 1.8, -1.5);
  b(2.2, 1.6, 0.06, '#A9DDF5', -1.5, 1.4, 0.02, { emissive: '#FFE7B0', emissiveIntensity: 0.35 });
  b(1.0, 2.1, 0.06, '#6B3F22', 1.3, 1.05, 0.02);
  for (let i = 0; i < 8; i++) { const s = cast(new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.06, 1.0), mat(i % 2 ? '#FFFFFF' : '#2F8F6A'))); s.position.set(-2.64 + i * 0.76, 2.5, 0.45); s.rotation.x = 0.35; g.add(s); }
  const tex = textTex(256, 80, (c, w, h) => { c.fillStyle = '#2B2B2B'; c.fillRect(0, 0, w, h); c.fillStyle = '#F2C14E'; c.font = '800 56px Display'; c.textAlign = 'center'; c.fillText(name, w / 2, 60); });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.75), new THREE.MeshLambertMaterial({ map: tex })); sign.position.set(0, 3.15, 0.03); g.add(sign);
  scene.add(g); return { obj: g };
}
// small items a person can hold in the right hand
export function handItem(type) {
  const g = new THREE.Group();
  if (type === 'hp') {
    const b = cast(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.012), mat('#1E1E22'))); g.add(b);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.135), mat('#7FC6EE', { emissive: '#9FD8FF', emissiveIntensity: 0.9 })); s.position.z = 0.0065; g.add(s);
    g.position.set(0, -0.5, 0.05); g.rotation.x = -0.9;
  } else if (type === 'radio') {
    const r = radio(g); r.obj.scale.setScalar(0.7); r.obj.position.set(0, -0.6, 0.1); r.obj.rotation.x = 1.2;
  } else if (type === 'kabel') {
    const c = new THREE.Mesh(coilGeo(0.5, 0.03, 14), mat('#E8E0CC')); c.position.set(0, -0.48, 0.02); g.add(c);
    const plug = cast(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.03), mat('#F4F1EA'))); plug.position.set(0, -0.47, 0.04); g.add(plug);
  } else if (type === 'gagang') {
    const h = handsetMesh(); h.rotation.set(0, Math.PI / 2, Math.PI / 2); h.position.set(0, -0.5, 0.04); g.add(h);
    const c = new THREE.Mesh(coilGeo(0.5, 0.025, 14), mat('#E8E0CC')); c.position.set(0, -0.6, 0.04); g.add(c);
  } else if (type === 'surat') {
    const tex = canvasTex(128, 90, (c, w, h) => { c.fillStyle = '#FFF6E6'; c.fillRect(0, 0, w, h); c.strokeStyle = '#C8A06A'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(w / 2, h * 0.55); c.lineTo(w, 0); c.stroke();
      c.fillStyle = '#E2574C'; c.beginPath(); c.arc(w / 2, h * 0.62, 10, 0, M.TAU); c.fill(); });
    const e = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.15), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })); e.position.set(0, -0.52, 0.05); g.add(e);
  }
  return g;
}
