import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';

/* ============================================================================
   Personaje 3D con esqueleto (GLB; LeBron y Haliburton) que copia las animaciones del juego (v39).

   El juego anima con poses por código (applyPose → ángulos de cadera, rodilla, hombro, codo, torso…) sobre el cuerpo procedural de rig.js.
   Ese cuerpo SIGUE existiendo (invisible): es el "motor de animación". Todas las animaciones, la pelota en las manos, los mates, los pases,
   la IA y el online siguen funcionando igual, porque nada de eso se tocó. Este módulo solo hace de "traductor":
     1) Cada cuadro lee la orientación de cada segmento del cuerpo procedural (torso, brazos, piernas, cabeza…).
     2) Se la copia al hueso equivalente del GLB (retargeting en espacio del jugador; no importa cómo estén orientados los ejes del GLB).
     3) Como las proporciones del GLB son distintas (brazos más cortos, piernas más largas), hace IK de 2 huesos en brazos y piernas
        para que las manos sigan tocando la pelota y los pies queden en el piso, sin flotar ni hundirse.
   ========================================================================== */

const DOWN = new THREE.Vector3(0, -1, 0);
const PROXY_ANKLE_H = 0.043;     // altura del tobillo del cuerpo procedural con el pie apoyado (rig.js: HEEL/TOE y = -0.043)
const PROXY_STAND_H = 0.960;     // distancia pelvis → tobillo del cuerpo procedural parado (cadera 1,003 − tobillo 0,043)
const ARM_STRETCH = 1.15;        // los brazos del GLB son cortos (0,51 m contra 0,58 del cuerpo procedural): se alargan un 15 % para que la mano llegue a la pelota al driblear
const PROXY_ARM_LEN = 0.58;       // brazo + antebrazo del cuerpo procedural (0,30 + 0,28)
const SHOULDER_BLEND = 0.5;      // cuánto del ancho de hombros / caderas propio del GLB se respeta (0 = manos exactas en las del cuerpo procedural)

/* Esqueleto Mixamo (Meshy, Mixamo, etc.): se traducen sus huesos a los nombres que usa el resto del archivo (pelvis, spine_01…, upperarm_l…).
   GLTFLoader le saca los ":" a los nombres, así que llegan como "mixamorigHips"; se acepta con o sin prefijo. */
const MIXAMO = { Hips: 'pelvis', Spine: 'spine_01', Spine1: 'spine_03', Spine2: 'spine_05', Neck: 'neck_01', Head: 'head' };
for (const [m, u] of [['Arm', 'upperarm'], ['ForeArm', 'lowerarm'], ['Hand', 'hand'], ['Shoulder', 'clavicle'], ['UpLeg', 'thigh'], ['Leg', 'calf'], ['Foot', 'foot']]) {
  MIXAMO[`Left${m}`] = `${u}_l`; MIXAMO[`Right${m}`] = `${u}_r`;
}
const baseName = n => {
  const s = String(n).replace(/_\d+$/, '');
  return MIXAMO[s.replace(/^mixamorig:?/, '')] || s;
};
const SPINE = [['spine_01', 0.2], ['spine_02', 0.4], ['spine_03', 0.6], ['spine_04', 0.8], ['spine_05', 1.0]];
const NECK = [['neck_01', 0.3], ['neck_02', 0.6]];

/** Crea el personaje 3D para un cuerpo (R = resultado de makeRig). Devuelve { model, setVisible(on) }.
 *  gltf.fitScale (opcional, v45): escala UNIFORME para que el modelo mida lo mismo que el resto (1,98 m). Los 4 Haliburton nuevos miden 1,70 m;
 *  con fitScale = 1,98 / 1,70 quedan del tamaño de siempre sin tocar el archivo ni deformar nada (los demás modelos ya miden 1,98 y no lo usan). */
export function attachModel(R, gltf, cloneFn) {
  const model = cloneFn(gltf.scene);
  const FIT = gltf.fitScale > 0 ? gltf.fitScale : 1, iF = 1 / FIT;          // iF: de espacio del jugador a espacio del modelo
  if (FIT !== 1) model.scale.setScalar(FIT);
  model.visible = false;
  model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });

  /* ---- huesos en orden jerárquico (el padre siempre antes que el hijo) ---- */
  const bones = []; model.traverse(o => { if (o.isBone) bones.push(o); });
  const idxOf = new Map(bones.map((b, i) => [b, i]));
  const B = bones.map(b => ({ bone: b, parent: idxOf.has(b.parent) ? idxOf.get(b.parent) : -1, t: b.position.clone(), rq: b.quaternion.clone(), key: null, pre: null }));
  const by = {}; B.forEach((b, i) => { by[baseName(b.bone.name)] = i; });
  /* los brazos del modelo se alargan hasta medir ~0,58 m (como el cuerpo procedural): con Curry (0,503 m) da 1,15, con LeBron (0,51 m) ~1,14 */
  const armLen = (by.lowerarm_l !== undefined && by.hand_l !== undefined) ? B[by.lowerarm_l].t.length() + B[by.hand_l].t.length() : 0;
  const armStretch = armLen > 0.05 ? Math.min(1.25, Math.max(1, PROXY_ARM_LEN / (armLen * FIT))) : ARM_STRETCH;
  for (const nm of ['lowerarm_l', 'lowerarm_r', 'hand_l', 'hand_r']) if (by[nm] !== undefined) { const b = B[by[nm]]; b.t.multiplyScalar(armStretch); b.bone.position.copy(b.t); }
  const need = ['pelvis', 'spine_05', 'neck_01', 'head', 'upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r', 'thigh_l', 'calf_l', 'foot_l', 'thigh_r', 'calf_r', 'foot_r'];
  const miss = need.filter(n => by[n] === undefined);
  if (miss.length) { console.warn('El GLB no tiene los huesos esperados:', miss.join(', ')); return null; }

  /* ---- pose de reposo en espacio del jugador (el modelo viene horneado: sin escalas en la jerarquía) ---- */
  const n = B.length, wq = B.map(() => new THREE.Quaternion()), p = B.map(() => new THREE.Vector3());
  const fk = (useRest) => {
    for (let i = 0; i < n; i++) {
      const b = B[i], pi = b.parent;
      if (useRest || !b.key) wq[i].copy(pi < 0 ? new THREE.Quaternion() : wq[pi]).multiply(b.rq);
      p[i].copy(b.t); if (pi >= 0) p[i].applyQuaternion(wq[pi]).add(p[pi]);
    }
  };
  fk(true);
  const wr = wq.map(q => q.clone()), pr = p.map(v => v.clone());       // reposo
  const dir = (a, b) => pr[by[b]].clone().sub(pr[by[a]]).normalize();
  const align = (a, b) => new THREE.Quaternion().setFromUnitVectors(dir(a, b), DOWN);

  /* ---- qué segmento del cuerpo procedural mueve a cada hueso, y cómo se alinea el reposo ---- */
  const ctrl = (name, key, alignQ) => { const i = by[name]; B[i].key = key; B[i].pre = (alignQ || new THREE.Quaternion()).clone().multiply(wr[i]); };
  ctrl('pelvis', 'pelvis');
  SPINE.forEach(([nm]) => by[nm] !== undefined && ctrl(nm, nm));
  NECK.forEach(([nm]) => by[nm] !== undefined && ctrl(nm, nm));
  ctrl('head', 'head');
  for (const s of ['l', 'r']) {
    const aUp = align(`upperarm_${s}`, `lowerarm_${s}`), aLo = align(`lowerarm_${s}`, `hand_${s}`);
    ctrl(`upperarm_${s}`, `sh_${s}`, aUp); ctrl(`lowerarm_${s}`, `el_${s}`, aLo); ctrl(`hand_${s}`, `el_${s}`, aLo);
    ctrl(`thigh_${s}`, `th_${s}`, align(`thigh_${s}`, `calf_${s}`)); ctrl(`calf_${s}`, `kn_${s}`, align(`calf_${s}`, `foot_${s}`));
    ctrl(`foot_${s}`, `ft_${s}`);                                  // el pie del GLB ya está plano en reposo, igual que el procedural
  }

  /* ---- diferencias de proporciones (se calculan una vez) ---- */
  const offAnkle = pr[by.foot_l].y - PROXY_ANKLE_H * iF;                        // el tobillo del GLB está más alto (suela más gruesa)
  const offPelvis = offAnkle + (pr[by.pelvis].y - pr[by.foot_l].y) - PROXY_STAND_H * iF;
  const limbs = ['l', 'r'].flatMap(s => {
    const mk = (up, mid, end, pole, src, tgt) => {
      const a = by[up], b = by[mid], c = by[end];
      if (B[b].parent !== a || B[c].parent !== b) { console.warn('IK desactivada en', up); return []; }
      return [{ a, b, c, l1: B[b].t.length(), l2: B[c].t.length(), pole: new THREE.Vector3(...pole), src, tgt }];
    };
    return [...mk(`upperarm_${s}`, `lowerarm_${s}`, `hand_${s}`, [0, 0, -1], R[s === 'l' ? 'shL' : 'shR'], R[s === 'l' ? 'hL' : 'hR']),
            ...mk(`thigh_${s}`, `calf_${s}`, `foot_${s}`, [0, 0, 1], R[s === 'l' ? 'legL' : 'legR'], R[s === 'l' ? 'ftL' : 'ftR'])];
  });
  limbs.forEach(L => { L.leg = L.src === R.legL || L.src === R.legR; });

  /* ---- por cuadro ---- */
  const Qp = new THREE.Quaternion(), Qt = new THREE.Quaternion(), Qh = new THREE.Quaternion(), T = {};
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qi = new THREE.Quaternion(), one = new THREE.Quaternion();
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), AT = new THREE.Vector3(), PL = new THREE.Vector3(), B2 = new THREE.Vector3(), T2 = new THREE.Vector3();
  const inv = new THREE.Matrix4(), tp = new THREE.Vector3();
  const Q = k => T[k] || (T[k] = new THREE.Quaternion());

  const rot = (qOut, from, to) => qOut.setFromUnitVectors(from, to);

  function sync() {
    if (!R.root.visible) return;
    R.hips.updateMatrixWorld(true);
    inv.copy(R.root.matrixWorld).invert();
    /* orientación de cada segmento del cuerpo procedural, en espacio del jugador */
    Qp.copy(R.pelvis.quaternion); Qt.copy(Qp).multiply(R.torso.quaternion); Qh.copy(Qt).multiply(R.head.quaternion);
    Q('pelvis').copy(Qp); Q('head').copy(Qh);
    for (const [nm, c] of SPINE) Q(nm).copy(Qp).slerp(Qt, c);
    for (const [nm, c] of NECK) Q(nm).copy(Qt).slerp(Qh, c);
    for (const s of ['l', 'r']) {
      const SH = s === 'l' ? R.shL : R.shR, EL = s === 'l' ? R.elL : R.elR, TH = s === 'l' ? R.legL : R.legR, KN = s === 'l' ? R.kneeL : R.kneeR, FT = s === 'l' ? R.ftL : R.ftR;
      Q(`sh_${s}`).copy(Qt).multiply(SH.quaternion); Q(`el_${s}`).copy(Q(`sh_${s}`)).multiply(EL.quaternion);
      Q(`th_${s}`).copy(Qp).multiply(TH.quaternion); Q(`kn_${s}`).copy(Q(`th_${s}`)).multiply(KN.quaternion); Q(`ft_${s}`).copy(Q(`kn_${s}`)).multiply(FT.quaternion);
    }
    /* esqueleto: orientaciones objetivo y posiciones (la pelvis sigue a la cadera del cuerpo procedural) */
    const ip = by.pelvis;
    for (let i = 0; i < n; i++) {
      const b = B[i], pi = b.parent;
      if (b.key) wq[i].copy(T[b.key]).multiply(b.pre); else wq[i].copy(pi < 0 ? one : wq[pi]).multiply(b.rq);
      if (i === ip) {
        p[i].set(pr[ip].x, R.hips.position.y * iF + offPelvis, pr[ip].z);
        if (pi >= 0) { qi.copy(wq[pi]).invert(); b.bone.position.copy(p[i]).sub(p[pi]).applyQuaternion(qi); } else b.bone.position.copy(p[i]);
      } else { p[i].copy(b.t); if (pi >= 0) p[i].applyQuaternion(wq[pi]).add(p[pi]); }
    }
    /* IK de 2 huesos: manos a las manos del cuerpo procedural (pelota), pies a sus pies (piso) */
    for (const L of limbs) {
      const { a, b, c, l1, l2 } = L;
      tp.setFromMatrixPosition(L.tgt.matrixWorld).applyMatrix4(inv).multiplyScalar(iF);   // destino en espacio del modelo
      v1.setFromMatrixPosition(L.src.matrixWorld).applyMatrix4(inv).multiplyScalar(iF);    // hombro / cadera del cuerpo procedural
      v2.copy(p[a]).sub(v1);                                                               // diferencia de ancho con el GLB
      tp.x += v2.x * SHOULDER_BLEND; tp.z += v2.z * SHOULDER_BLEND;
      if (L.leg) tp.y += offAnkle;
      AT.copy(tp).sub(p[a]); let d = AT.length(); if (d < 1e-4) continue; AT.divideScalar(d);
      d = Math.min(Math.max(d, Math.abs(l1 - l2) * 1.001 + 1e-3), (l1 + l2) * 0.9995);
      v3.copy(p[b]).sub(p[a]); v3.addScaledVector(AT, -v3.dot(AT));                        // dirección actual del codo / rodilla respecto del eje mano-hombro
      v2.copy(L.pole); v2.addScaledVector(AT, -v2.dot(AT));                                // eje de referencia del codo / rodilla, perpendicular al eje del miembro
      PL.copy(v3).addScaledVector(v2, 0.01).normalize();
      const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
      B2.copy(AT).multiplyScalar(x).addScaledVector(PL, h).add(p[a]);                     // nuevo codo / rodilla
      T2.copy(AT).multiplyScalar(d).add(p[a]);                                             // mano / pie alcanzable
      // 1) hueso de arriba apunta al nuevo codo
      v1.copy(p[b]).sub(p[a]).normalize(); v2.copy(B2).sub(p[a]).normalize();
      rot(qa, v1, v2); wq[a].premultiply(qa); wq[b].premultiply(qa); wq[c].premultiply(qa);
      p[b].copy(B2); p[c].copy(B2).add(v3.copy(B[c].t).applyQuaternion(wq[b]));
      // 2) hueso de abajo apunta al destino
      v1.copy(p[c]).sub(p[b]).normalize(); v2.copy(T2).sub(p[b]).normalize();
      rot(qb, v1, v2); wq[b].premultiply(qb); wq[c].premultiply(qb); p[c].copy(T2);
      if (L.leg) wq[c].copy(T[B[c].key]).multiply(B[c].pre);                               // el pie conserva su orientación (plano en el piso)
    }
    /* orientaciones locales de los huesos controlados (el resto queda en su reposo y acompaña) */
    for (let i = 0; i < n; i++) {
      const b = B[i]; if (!b.key) continue;
      if (b.parent < 0) b.bone.quaternion.copy(wq[i]); else { qi.copy(wq[b.parent]).invert(); b.bone.quaternion.copy(qi).multiply(wq[i]); }
    }
  }

  R.root.add(model);
  const api = {
    model,
    setVisible(on) { model.visible = on; R.hips.visible = !on; R.sync3D = on ? sync : null; },
  };
  R.m3d = api;
  return api;
}
