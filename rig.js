import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { PROF, HEAD, HAIR, loft, cutNeckline, strip, decal, headMesh, faceColors, faceZ, hairMesh } from './rig-geo.js';

/* ============================================================================
   Cuerpo de jugador con proporciones humanas (estilo PS2: pocos polígonos, pero cuerpo de persona).
   Esqueleto: pelvis → torso → hombros/codos/manos/dedos y cadera → rodilla → tobillo/pie.
   Las medidas de los huesos (muslo .47, pierna .47, brazo .30, antebrazo .28) son las mismas de siempre,
   así que la pelota, las manos y las animaciones del juego siguen coincidiendo.
   ========================================================================== */
const mat = (color, roughness = 0.8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const SPH = new THREE.SphereGeometry(1, 16, 12);
const sphere = (parent, material, scale, position, rot) => {
  const m = new THREE.Mesh(SPH, material);
  m.scale.set(...scale); m.position.set(...position); if (rot) m.rotation.set(...rot);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
};

/* ---- geometrías compartidas por todos los jugadores ---- */
const mkGeo = d => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(d.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(d.nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(d.uv, 2));
  g.setIndex(Array.from(d.idx));
  return g;
};
const G = {};
const geo = () => {
  if (G.ready) return G; G.ready = true;
  G.thigh = mkGeo(loft(PROF.thigh, { radial: 14 })); G.shank = mkGeo(loft(PROF.shank, { radial: 14 }));
  G.sock = mkGeo(loft(PROF.sock, { radial: 12, capTop: false, capBot: false }));
  G.shortLeg = mkGeo(loft(PROF.shortLeg, { radial: 16, capBot: false }));
  G.belt = mkGeo(loft(PROF.belt, { radial: 22, capTop: false }));
  G.jersey = mkGeo(cutNeckline(loft(PROF.jersey, { radial: 24, capTop: false, capBot: false }), PROF.jersey, 0.60));
  G.skinTorso = mkGeo(loft(PROF.skinTorso, { radial: 20, capBot: false }));
  G.neck = mkGeo(loft(PROF.neck, { radial: 12, capTop: false, capBot: false }));
  G.upperArm = mkGeo(loft(PROF.upperArm, { radial: 12 })); G.foreArm = mkGeo(loft(PROF.foreArm, { radial: 12 }));
  G.sleeve = mkGeo(loft(PROF.sleeve, { radial: 14, capBot: false }));
  G.palm = mkGeo(loft(PROF.palm, { radial: 10 }));
  G.headBase = headMesh(56, 44);
  G.hair = {};
  return G;
};
const hairGeo = style => (geo().hair[style] ??= mkGeo(hairMesh(style)));
const capsCache = new Map();
const caps = (r, l) => { const k = `${r}|${l}`; if (!capsCache.has(k)) capsCache.set(k, new THREE.CapsuleGeometry(r, l, 3, 8)); return capsCache.get(k); };
const COMP_GEO = new THREE.CylinderGeometry(0.053, 0.041, 0.21, 16, 1, true);    // manga de compresión del antebrazo
const WRIST_GEO = new THREE.CylinderGeometry(0.038, 0.034, 0.05, 14, 1, true);   // muñequera
const KNEE_GEO = new THREE.CylinderGeometry(0.071, 0.066, 0.15, 16, 1, true);    // rodillera / manga de rodilla
const BAND_GEO = new THREE.TorusGeometry(1, 0.17, 8, 40);                        // vincha (se escala al tamaño de la cabeza)
/* Peinados largos o con volumen: se arman con la base de un peinado corto + piezas extra (rodete, cola, trenzas, rizos). */
const HAIR_CAP = { 5: 1, 6: 9, 7: 9, 8: 20, 9: 9, 10: 11 };
/* Rulos: muchas esferitas chicas pegadas al cuero cabelludo, fusionadas en una sola geometría (por peinado) para no cargar la escena. */
const curlCache = new Map();
function curlGeo(cap, n, rad) {
  const key = `${cap}|${n}|${rad}`; if (curlCache.has(key)) return curlCache.get(key);
  const H = HAIR[cap] || HAIR[1], tpl = new THREE.SphereGeometry(1, 6, 4), tp = tpl.attributes.position, tn = tpl.attributes.normal, ti = tpl.index.array;
  const pos = [], nrm = [], idx = []; let base = 0;
  for (let i = 0; i < n; i++) {
    const yy = 1 - 2 * (i + 0.5) / n, ph = i * 2.399963, rr = Math.sqrt(1 - yy * yy);
    const x = rr * Math.cos(ph) * HEAD.rx * H.s, y = yy * HEAD.ry * H.sy + (H.sy - 1) * 0.02, z = rr * Math.sin(ph) * HEAD.rz * H.s;
    if (yy < -0.05 || (z > 0.035 && y < 0.07) || (yy < 0.2 && z > 0)) continue;                 // sin rulos en la cara ni en la nuca baja
    const r = rad * (0.85 + ((i * 37) % 10) / 33);
    for (let v = 0; v < tp.count; v++) { pos.push(x + tp.getX(v) * r, y + tp.getY(v) * r, z + tp.getZ(v) * r); nrm.push(tn.getX(v), tn.getY(v), tn.getZ(v)); }
    for (const k of ti) idx.push(base + k); base += tp.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setIndex(idx);
  curlCache.set(key, g); return g;
}

const shell = (parent, geometry, material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
};

function makeHand(parent, inward, skin) {
  const hand = new THREE.Group(); hand.position.y = -0.28; parent.add(hand);
  shell(hand, geo().palm, skin);
  sphere(hand, skin, [0.03, 0.034, 0.028], [0, 0.012, 0]);                       // muñeca
  const digit = (x, y, l1, l2, r) => {
    const a = new THREE.Group(); a.position.set(x, y, 0); hand.add(a);
    const m1 = new THREE.Mesh(new THREE.CapsuleGeometry(r, l1, 3, 6), skin); m1.position.y = -l1 / 2 - r; m1.castShadow = true; a.add(m1);
    const b = new THREE.Group(); b.position.y = -l1 - r * 2; a.add(b);
    const m2 = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.9, l2, 3, 6), skin); m2.position.y = -l2 / 2 - r; b.add(m2);
    return { a, b, inward };
  };
  const fingers = [];
  for (let i = 0; i < 4; i++) fingers.push(digit((i - 1.5) * 0.022, -0.09, i === 1 || i === 2 ? 0.036 : 0.03, 0.026, 0.0095));
  fingers.push(digit(inward * 0.045, -0.025, 0.026, 0.022, 0.011));   // pulgar
  return { hand, fingers };
}
function setFingers(F, curl, spread) {
  F.forEach((f, i) => {
    if (i < 4) { f.a.rotation.set(-curl * 0.9, 0, (i - 1.5) * spread); f.b.rotation.x = -curl * 1.1; }
    else { f.a.rotation.set(-curl * 0.4, 0, f.inward * (0.6 + spread * 1.5)); f.b.rotation.x = -curl * 0.6; }
  });
}

function makeUniformDetails(torso, legs, jerseyMaterial, shortMaterial) {
  // Decals curvos (pegados a la camiseta) con fondo transparente: el texto sale del jugador de Supabase.
  const makeDecal = (w, h, y, back = false) => {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const mesh = new THREE.Mesh(mkGeo(decal(PROF.jersey, w, h, y)), material);
    mesh.position.set(0, y, 0); if (back) mesh.rotation.y = Math.PI;
    mesh.renderOrder = 3; torso.add(mesh);
    return { canvas, tex, mesh };
  };
  const front = makeDecal(0.32, 0.30, 0.34, false), back = makeDecal(0.32, 0.30, 0.34, true);
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x552583, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  // Vivos del short: franja lateral + blanco + dobladillo, siguiendo cada pierna.
  const shortGroups = [];
  for (const L of legs) {
    const g = new THREE.Group(); L.th.add(g); shortGroups.push(g);
    const ac = L.x > 0 ? 0 : Math.PI;
    for (const [hw, off, m] of [[0.30, 0.0016, stripeMat], [0.40, 0.0010, whiteMat]]) shell(g, mkGeo(strip(PROF.shortLeg, ac, hw, off, 0.03, -0.30, 8, 4)), m);
    shell(g, mkGeo(strip(PROF.shortLeg, 0, Math.PI, 0.0016, -0.272, -0.300, 1, 16)), stripeMat);
    g.visible = false;
  }
  const shortsAccent = { set visible(v) { shortGroups.forEach(g => { g.visible = v; }); }, get visible() { return shortGroups[0].visible; } };
  // Laterales de la camiseta.
  const jerseySides = new THREE.Group(); torso.add(jerseySides);
  for (const ac of [0, Math.PI]) {
    shell(jerseySides, mkGeo(strip(PROF.jersey, ac, 0.34, 0.0016, 0.50, 0.12, 10, 4)), stripeMat);
    for (const s of [-1, 1]) shell(jerseySides, mkGeo(strip(PROF.jersey, ac + s * 0.40, 0.045, 0.0010, 0.50, 0.12, 10, 1)), whiteMat);
  }
  jerseySides.visible = false;
  // Colores y texto del frente: los define cada camiseta (kits.js). Por defecto, Icon Edition de los Lakers.
  const S = { word: 'LAKERS', wordFill: '#552583', wordStroke: '#FFFFFF', numFill: '#FFFFFF', numStroke: '#552583', nameFill: '#FDB927', nameStroke: '#552583' };
  let lastInfo = null;
  const fitFont = (g, text, weight, family, size, maxW) => {            // achica la letra si el texto no entra (ej: TIMBERWOLVES)
    for (; size > 24; size -= 3) { g.font = `${weight} ${size}px ${family}`; if (g.measureText(text).width <= maxW) break; }
  };
  const draw = (decal, info, isBack) => {
    const g = decal.canvas.getContext('2d'); g.clearRect(0, 0, 512, 512);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    if (isBack) {
      const last = String(info.name || '').split(' ').slice(-1)[0].toUpperCase().slice(0, 12);
      fitFont(g, last, 'bold', 'Arial', 62, 440); g.lineWidth = 8; g.strokeStyle = S.nameStroke; g.fillStyle = S.nameFill;
      g.strokeText(last, 256, 102); g.fillText(last, 256, 102);
    } else {
      fitFont(g, S.word, 'italic bold', 'Georgia', 68, 440); g.lineWidth = 12; g.strokeStyle = S.wordStroke; g.fillStyle = S.wordFill;
      g.strokeText(S.word, 256, 120); g.fillText(S.word, 256, 120);
    }
    g.font = '900 230px Arial Black, Arial'; g.lineWidth = 18; g.strokeStyle = S.numStroke; g.fillStyle = S.numFill;
    g.strokeText(String(info.number ?? ''), 256, isBack ? 315 : 340);
    g.fillText(String(info.number ?? ''), 256, isBack ? 315 : 340);
    decal.tex.needsUpdate = true;
  };
  const redraw = () => { if (lastInfo) { draw(front, lastInfo, false); draw(back, lastInfo, true); } };
  return {
    shortsAccent, jerseySides,
    // ink: colores de los textos; word: texto del frente (apodo del equipo); decals: mostrar nombre y número
    setStyle({ jersey = '#FDB927', shorts = '#FDB927', accent = '#552583', trim = '#FFFFFF', details = false, word, ink, decals = true } = {}) {
      stripeMat.color.set(accent); whiteMat.color.set(trim);
      jerseyMaterial.color.set(jersey); shortMaterial.color.set(shorts);
      this.jerseySides.visible = details; this.shortsAccent.visible = details;
      if (word !== undefined) S.word = word;
      if (ink) Object.assign(S, ink);
      front.mesh.visible = back.mesh.visible = decals;
      redraw();
    },
    setInfo(info) { lastInfo = info; redraw(); },
    // La camiseta se ensancha con la contextura: el número, las franjas y los vivos del short tienen que ensancharse igual, o quedan adentro de la tela
    setBuild(k) {
      const sx = k, sz = 1 + (k - 1) * 0.8;
      front.mesh.scale.set(sx, 1, sz); back.mesh.scale.set(sx, 1, sz); jerseySides.scale.set(sx, 1, sz);
      shortGroups.forEach(g => g.scale.set(sx, 1, sz));
    },
  };
};

const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const HAIR_STYLES = [1, 1, 2, 2, 2, 3, 4, 0, 1, 2];         // 0 pelado · 1 corto · 2 rapado · 3 afro · 4 high top
const BEARDS = [0, 0, 0, 0, 1, 1, 2, 0, 1, 2];

export function makeRig(scene, skinColor = 0xb97a50, hairColor = 0x15120f) {
  const g = geo();
  const root = new THREE.Group(); scene.add(root);
  const jm = mat(0xffffff, 0.65), sm = mat(0x111111, 0.7), shoeM = mat(0xffffff, 0.5), skin = mat(skinColor, 0.62);
  const soleM = mat(0xf2f2f2, 0.6), sockM = mat(0xffffff, 0.85), lacesM = mat(0xf4f4f4, 0.7);
  const faceM = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6, vertexColors: true });
  const hairM = mat(hairColor, 0.92), compM = mat(0x111111, 0.8); compM.side = THREE.DoubleSide;
  const wristM = mat(0xffffff, 0.8), kneeM = mat(0x111111, 0.8); wristM.side = kneeM.side = THREE.DoubleSide;
  const wristMeshes = [], kneeMeshes = [];                         // [izquierda, derecha]
  const bulkMeshes = [];                                           // piezas que engordan/adelgazan con la contextura

  const hips = new THREE.Group(); root.add(hips);                  // sube y baja (altura de la cadera)
  const pelvis = new THREE.Group(); hips.add(pelvis);              // gira (yaw) e inclina (roll) al correr
  bulkMeshes.push(shell(pelvis, g.belt, sm));
  const torso = new THREE.Group(); pelvis.add(torso);
  const jerseyMesh = shell(torso, g.jersey, jm), chestSkin = shell(torso, g.skinTorso, skin), neck = shell(torso, g.neck, skin);
  bulkMeshes.push(jerseyMesh, chestSkin);

  /* ---- cabeza: cráneo deformado + ojos + orejas + pelo ---- */
  const head = new THREE.Group(); head.position.y = 0.685; torso.add(head);
  const headGeo = mkGeo(g.headBase);
  const setBeard = k => headGeo.setAttribute('color', new THREE.Float32BufferAttribute(faceColors(g.headBase.pos, k), 3));
  setBeard(0);
  const skull = new THREE.Mesh(headGeo, faceM); skull.position.y = HEAD.cy; skull.castShadow = true; skull.receiveShadow = true; head.add(skull);
  sphere(head, skin, [0.011, 0.026, 0.017], [0.080, HEAD.cy + 0.002, -0.006], [0, 0, -0.12]);
  sphere(head, skin, [0.011, 0.026, 0.017], [-0.080, HEAD.cy + 0.002, -0.006], [0, 0, 0.12]);
  const eyeWhite = mat(0xf0e9df, 0.4), eyeDark = mat(0x1d1714, 0.35);
  for (const side of [-1, 1]) {
    const ez = faceZ(0.034, 0.023) - 0.001;
    sphere(head, eyeWhite, [0.0135, 0.0075, 0.007], [side * 0.034, HEAD.cy + 0.023, ez]);
    sphere(head, eyeDark, [0.0068, 0.0068, 0.004], [side * 0.034, HEAD.cy + 0.023, ez + 0.0042]);
  }
  const hair = new THREE.Mesh(hairGeo(1), hairM); hair.position.y = HEAD.cy; hair.castShadow = true; head.add(hair);
  const hairExtra = new THREE.Group(); hairExtra.position.y = HEAD.cy; head.add(hairExtra);     // rodete, cola, trenzas, rizos
  const bandM = mat(0xffffff, 0.8), band = new THREE.Mesh(BAND_GEO, bandM);                       // vincha
  band.rotation.x = Math.PI / 2; band.castShadow = true; band.visible = false; head.add(band);

  /* ---- brazos ---- */
  const arm = x => {
    const sh = new THREE.Group(); sh.position.set(x, 0.58, 0); torso.add(sh);
    const ua = shell(sh, g.upperArm, skin);
    sphere(sh, skin, [0.066, 0.074, 0.066], [0, -0.045, 0]);
    const el = new THREE.Group(); el.position.y = -0.30; sh.add(el);
    const fa = shell(el, g.foreArm, skin);
    sphere(el, skin, [0.044, 0.046, 0.044], [0, 0, 0]);
    const sleeve = shell(sh, g.sleeve, jm); sleeve.visible = false;
    const h = makeHand(el, x > 0 ? -1 : 1, skin);
    const comp = new THREE.Mesh(COMP_GEO, compM); comp.position.y = -0.13; comp.visible = false; comp.castShadow = true; el.add(comp);   // manga de compresión
    const wb = new THREE.Mesh(WRIST_GEO, wristM); wb.position.y = -0.235; wb.visible = false; wb.castShadow = true; el.add(wb); wristMeshes.push(wb);   // muñequera
    bulkMeshes.push(ua, fa, sleeve, comp, wb);        // (el deltoides es una esfera unitaria escalada: no se toca)
    return [sh, el, h.hand, h.fingers, sleeve, comp];
  };
  /* ---- piernas ---- */
  const legInfo = [];
  const leg = x => {
    const th = new THREE.Group(); th.position.set(x, -0.02, 0); pelvis.add(th);
    const t = shell(th, g.thigh, skin), sl = shell(th, g.shortLeg, sm);
    sphere(th, skin, [0.058, 0.058, 0.058], [0, -0.47, 0]);                              // rodilla
    const kn = new THREE.Group(); kn.position.y = -0.47; th.add(kn);
    const sk = shell(kn, g.shank, skin), so = shell(kn, g.sock, sockM);
    const ft = new THREE.Group(); ft.position.y = -0.47; kn.add(ft);                     // pie: pivota en el tobillo
    sphere(ft, skin, [0.040, 0.040, 0.042], [0, 0.0, 0]);
    sphere(ft, shoeM, [0.047, 0.040, 0.054], [0, -0.004, -0.003]);                       // caña
    sphere(ft, shoeM, [0.049, 0.034, 0.105], [0, -0.012, 0.050]);                        // empeine
    sphere(ft, shoeM, [0.046, 0.026, 0.070], [0, -0.019, 0.125]);                        // puntera
    sphere(ft, shoeM, [0.042, 0.030, 0.042], [0, -0.016, -0.040]);                       // talón
    sphere(ft, lacesM, [0.020, 0.005, 0.050], [0, 0.020, 0.050]);                        // cordones
    sphere(ft, soleM, [0.052, 0.012, 0.130], [0, -0.032, 0.062]);                        // suela
    const ks = new THREE.Mesh(KNEE_GEO, kneeM); ks.visible = false; ks.castShadow = true; kn.add(ks); kneeMeshes.push(ks);                   // rodillera
    bulkMeshes.push(t, sl, sk, so, ks);
    legInfo.push({ th, x });
    return [th, kn, ft];
  };
  const [legL, kneeL, ftL] = leg(0.1), [legR, kneeR, ftR] = leg(-0.1);   // la mano derecha está en -x (el modelo mira a +z)
  const [shL, elL, hL, fL, slvL, cmpL] = arm(0.23), [shR, elR, hR, fR, slvR, cmpR] = arm(-0.23);
  const uniform = makeUniformDetails(torso, legInfo, jm, sm);

  const base = { shx: 0.23, legx: 0.1 };
  const R = { root, hips, pelvis, torso, head, neck, chest: [jerseyMesh, chestSkin], legL, kneeL, ftL, legR, kneeR, ftR, shL, elL, hL, fL, shR, elR, hR, fR,
    jm, sm, shoeM, skin, faceM, hairM, seed: Math.random() * 6.28,
    setUniformStyle: uniform.setStyle.bind(uniform), setUniformInfo: uniform.setInfo.bind(uniform) };

  /* Piel: cuerpo y cara (la cara tiene colores por vértice que se multiplican por este tono). */
  R.setSkin = hex => { skin.color.setHex(hex); faceM.color.setHex(hex); };
  R.skin.color.setHex(skinColor);
  /* Aspecto: peinado, color de pelo, barba, vincha y manga. Lo que no se indica sale de una semilla (el nombre del jugador).
     o = { hair (0-8), hairColor ('#rrggbb'), beard (0-2), band ('#rrggbb'), sleeve ('L' | 'R' | 'B'), sleeveColor, wrist ('L' | 'R' | 'B'), wristColor, knee ('L' | 'R' | 'B'), kneeColor } */
  const BROWNS = [0x2b1d14, 0x4a3222, 0x7a5a36, 0x15120f];
  const clearExtra = () => { while (hairExtra.children.length) hairExtra.remove(hairExtra.children[0]); };
  const strands = (n, t0, t1, y, rr, len, r, tilt, hsh) => {                   // mechones colgando alrededor de la nuca y los costados
    for (let i = 0; i < n; i++) {
      const t = t0 + (t1 - t0) * (n === 1 ? 0.5 : i / (n - 1)), jit = (((hsh >> (i % 20)) & 3) - 1.5) * 0.02;
      const x = Math.sin(t) * rr[0], z = Math.cos(t) * rr[1], m = new THREE.Mesh(caps(r, len), hairM);
      m.position.set(x, y - len / 2 - r, z); m.rotation.set(Math.cos(t) * -tilt + jit, 0, Math.sin(t) * -tilt * 0.8 - jit);
      m.castShadow = true; hairExtra.add(m);
    }
  };
  R.setLook = (seed, o = {}) => {
    const h = hash(seed), style = o.hair ?? HAIR_STYLES[h % HAIR_STYLES.length], beard = o.beard ?? BEARDS[(h >> 5) % BEARDS.length];
    const cap = HAIR_CAP[style] ?? style;
    hair.visible = cap > 0; if (cap > 0) hair.geometry = hairGeo(cap);
    setBeard(beard);
    // color del pelo: el indicado; si no, negro (o marrones para los de piel clara)
    if (o.hairColor) hairM.color.set(o.hairColor); else hairM.color.setHex(skin.color.r > 0.6 ? BROWNS[(h >> 9) % BROWNS.length] : 0x15120f);
    // piezas extra
    clearExtra();
    if (style === 10) { const m = new THREE.Mesh(curlGeo(11, 90, 0.017), hairM); m.castShadow = true; hairExtra.add(m); }          // rizado medio
    else if (style === 6) sphere(hairExtra, hairM, [0.050, 0.050, 0.050], [0, 0.098, -0.086]);                                  // rodete
    else if (style === 7) { const m = new THREE.Mesh(caps(0.021, 0.13), hairM); m.position.set(0, -0.038, -0.122); m.rotation.x = 0.24; m.castShadow = true; hairExtra.add(m); }   // cola
    else if (style === 5) strands(15, 1.15, Math.PI * 2 - 1.15, 0.050, [0.088, 0.106], 0.15, 0.013, 0.10, h);               // trenzas
    else if (style === 8) { const m = new THREE.Mesh(curlGeo(20, 70, 0.019), hairM); m.castShadow = true; hairExtra.add(m); strands(17, 1.0, Math.PI * 2 - 1.0, 0.060, [0.092, 0.108], 0.10, 0.021, 0.16, h); strands(8, 1.7, Math.PI * 2 - 1.7, 0.100, [0.060, 0.074], 0.07, 0.022, 0.10, h >> 3); }   // rizos largos
    // vincha (se ajusta al tamaño del pelo; pelado = cráneo)
    band.visible = !!o.band;
    if (o.band) {
      bandM.color.set(o.band);
      const H = cap > 0 ? (HAIR[cap] || HAIR[1]) : { s: 1.0, sy: 1.0 }, y = 0.072, ry = HEAD.ry * H.sy, f = Math.sqrt(Math.max(0.05, 1 - (y / ry) ** 2));
      band.position.y = HEAD.cy + y; band.scale.set(HEAD.rx * H.s * f + 0.005, HEAD.rz * H.s * f + 0.005, 0.075);
    }
    // manga de compresión en el antebrazo
    const sl = String(o.sleeve || '').toUpperCase();
    compM.color.set(o.sleeveColor || '#111111');
    cmpL.visible = sl === 'L' || sl === 'B'; cmpR.visible = sl === 'R' || sl === 'B';
    // muñequeras y rodilleras (cada una: 'L' izquierda · 'R' derecha · 'B' ambas; con su color)
    const side = v => String(v || '').toUpperCase();
    const wr = side(o.wrist), kn = side(o.knee);
    wristM.color.set(o.wristColor || '#ffffff'); kneeM.color.set(o.kneeColor || '#111111');
    wristMeshes[0].visible = wr === 'L' || wr === 'B'; wristMeshes[1].visible = wr === 'R' || wr === 'B';
    kneeMeshes[0].visible = kn === 'L' || kn === 'B'; kneeMeshes[1].visible = kn === 'R' || kn === 'B';
  };
  /* Contextura: 0.86 (flaco) … 1.18 (corpulento). Engancha hombros y caderas al nuevo ancho. */
  R.setBuild = k => {
    k = Math.min(1.18, Math.max(0.86, k));
    bulkMeshes.forEach(m => { m.scale.set(k, 1, 1 + (k - 1) * 0.8); });
    shL.position.x = base.shx * (0.4 + 0.6 * k); shR.position.x = -base.shx * (0.4 + 0.6 * k);
    legL.position.x = base.legx * k; legR.position.x = -base.legx * k; R.build = k; uniform.setBuild(k);
  };
  /* Mangas cortas (árbitro). */
  R.setSleeves = on => { slvL.visible = on; slvR.visible = on; };
  R.setLook(Math.random().toString(), { hair: 1, beard: 0 });
  return R;
}

/* ============================================================================
   Pose
   ========================================================================== */
export const mkJ = () => ({ thL: 0, thR: 0, knL: 0, knR: 0, shL: 0, shR: 0, elL: 0, elR: 0, szL: 0.1, szR: -0.1, tx: 0.1, ty: 0, tz: 0, hx: 0, hy: 0.98, wL: 0, wR: 0, cL: 0.3, cR: 0.3, sL: 0.06, sR: 0.06,
  py: 0, pz: 0, hyaw: 0, gr: 1 });

/* Cinemática de las piernas: pie plano cuando está apoyado, puntas hacia abajo cuando empuja o está en el aire,
   y la cadera sube o baja justo lo necesario para que el punto más bajo de los pies toque el piso. */
const HIP_Y = -0.02, THIGH = 0.47, SHANK = 0.47, HEEL = [-0.055, -0.043], TOE = [0.185, -0.043];
const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
export function legKinematics(J) {
  const gr = clampN(J.gr ?? 1, 0, 1), pz = J.pz || 0, out = [];
  const legs = [{ t: J.thL, k: J.knL, x: 0.1 }, { t: J.thR, k: J.knR, x: -0.1 }];
  for (const L of legs) {
    L.ankle = (HIP_Y * Math.cos(pz) + L.x * Math.sin(pz)) - THIGH * Math.cos(L.t) - SHANK * Math.cos(L.t + L.k);
  }
  const low = Math.min(legs[0].ankle, legs[1].ankle);
  let bottom = Infinity;
  for (const L of legs) {
    const w = clampN(1 - (L.ankle - low) / 0.07, 0, 1) * gr, shank = L.t + L.k;
    const swing = clampN(0.25 + 0.5 * L.t, -0.35, 0.95) - shank;       // pie suelto: puntas apenas hacia abajo (más si la pierna queda atrás)
    L.f = swing + (-shank - swing) * w;                                 // apoyado: pie plano contra el piso
    const a = shank + L.f, c = Math.cos(a), s = Math.sin(a);
    bottom = Math.min(bottom, L.ankle + HEEL[1] * c - HEEL[0] * s, L.ankle + TOE[1] * c - TOE[0] * s);
    out.push(L.f);
  }
  return { f: out, hipsY: -bottom };
}

export function applyPose(R, J) {
  R.legL.rotation.x = J.thL; R.legR.rotation.x = J.thR; R.kneeL.rotation.x = J.knL; R.kneeR.rotation.x = J.knR;
  R.shL.rotation.set(J.shL, 0, J.szL); R.shR.rotation.set(J.shR, 0, J.szR); R.elL.rotation.x = J.elL; R.elR.rotation.x = J.elR;
  R.hL.rotation.y = J.wL; R.hR.rotation.y = J.wR; setFingers(R.fL, J.cL, J.sL); setFingers(R.fR, J.cR, J.sR);
  R.pelvis.rotation.set(0, J.py || 0, J.pz || 0);
  R.torso.rotation.set(J.tx, J.ty, J.tz);
  R.head.rotation.set(J.hx, (J.hyaw || 0) - ((J.py || 0) + J.ty) * 0.8, 0);        // la cabeza se mantiene estable aunque giren hombros y pelvis
  const kin = legKinematics(J), gr = clampN(J.gr ?? 1, 0, 1);
  R.ftL.rotation.x = kin.f[0]; R.ftR.rotation.x = kin.f[1];
  R.hips.position.y = J.hy + (kin.hipsY - J.hy) * gr;
  // Hombros: al subir los brazos se encogen un poco (clavícula y trapecio acompañan el movimiento).
  const lift = a => clampN((-a - 1.3) * 0.03, 0, 0.05);
  R.shL.position.y = 0.58 + lift(J.shL); R.shR.position.y = 0.58 + lift(J.shR);
  // Respiración sutil.
  const b = Math.sin(performance.now() * 0.0018 + R.seed) * 0.5 + 0.5;
  R.chest.forEach(m => { m.scale.y = 1 + 0.006 * b; });
  if (R.sync3D) R.sync3D();                                   // personaje 3D con esqueleto (rig-glb.js): copia esta pose
}
