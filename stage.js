import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { makeRig, mkJ, applyPose } from './rig.js';
import { SKIN_TONES } from './roster.js';
import { buildFor, scaleFor } from './looks.js';
import { nickname } from './kits.js';
import { fitCfg } from './stagecam.js';
import * as P3D from './players3d.js';
import { attachModel } from './rig-glb.js';

/* ============================================================================
   Escenario 3D del menú previo al partido (lo usan "Camisetas" y "Tu equipo").
   Muestra a los jugadores reales del juego (mismo cuerpo, cara y camiseta que en la cancha) parados y de frente.
   Solo dibuja a los jugadores y sus sombras: la cancha, los nombres y los anillos son HTML/SVG encima y debajo
   (prematch.js), y usan la MISMA cámara (stagecam.js) para que todo coincida con los pies de cada jugador.
   Si WebGL falla, prematch.js muestra una versión plana y el menú sigue funcionando igual.
   ========================================================================== */

/* ---- contextura y camiseta: igual que en main.js ---- */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const inkOf = k => ({ wordFill: k.wordFill, wordStroke: k.wordStroke, numFill: k.numFill, numStroke: k.numStroke, nameFill: k.nameFill, nameStroke: k.nameStroke });

function dress(R, it) {
  const p = it.player, k = it.kit;
  R.setSkin(SKIN_TONES[p.skin] ?? 0xb97a50); R.setLook(p.name || p.id, p.look); R.setBuild(buildFor(p)); R.setUniformInfo?.(p);
  R.setUniformStyle?.({ jersey: k.jersey, shorts: k.shorts, accent: k.accent, trim: k.trim, details: k.details, word: nickname(it.team), ink: inkOf(k), decals: true });
  R.shoeM.color.set(k.shoes);
  R.root.scale.setScalar(scaleFor(p));
}

/** Pose de "foto de equipo": parado, hombros relajados y brazos apenas separados del cuerpo. */
function standPose(J, i) {
  Object.assign(J, { shL: 0.04, shR: -0.04, szL: 0.2 + (i % 2) * 0.04, szR: -0.2 - (i % 2) * 0.04, elL: -0.3, elR: -0.3, tx: 0.03, hx: -0.04, hy: 0.985, cL: 0.35, cR: 0.35 });
}

/** Brillo de selección: anillo en el piso + haz de luz dorado (aditivo, no tapa al jugador). */
function makeGlow() {
  const group = new THREE.Group(); group.visible = false;
  const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide };
  const ringM = new THREE.MeshBasicMaterial({ color: 0xffc53d, opacity: 0, ...add });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.52, 0.8, 48), ringM); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.025;
  const discM = new THREE.MeshBasicMaterial({ color: 0xffb81c, opacity: 0, ...add });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.52, 40), discM); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.02;
  const beamM = new THREE.MeshBasicMaterial({ color: 0xffd569, opacity: 0, ...add });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.8, 3.3, 32, 1, true), beamM); beam.position.y = 1.65;
  group.add(disc, ring, beam);
  return { group, ringM, discM, beamM };
}

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);

  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a4658, 1.35));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004;
  scene.add(key, key.target);
  const rimL = new THREE.DirectionalLight(0xffc53d, 1.2), rimR = new THREE.DirectionalLight(0x6f8cff, 1.2);
  rimL.position.set(-5, 3.5, -4); rimR.position.set(5, 3.5, -4); scene.add(rimL, rimR);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.55 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const figs = [];
  /* Modelo 3D del jugador (assets/jugadores/<equipo>/<nombre_apellido>/…_<camiseta>.glb, ver players3d.js): el mismo que usa el partido. Sin archivo queda el cuerpo de siempre. */
  const m3Pending = new Set(), m3Fail = new Set(); let m3Timer = 0;
  const syncModel = f => {
    const R = f.R, w = f.want, key = R.root.visible && w ? P3D.keyFor(w.info, w.ab, w.kit, () => syncModel(f)) : null;
    f.m3want = key;
    if (R.m3d && R.m3dKey !== key) { R.m3d.setVisible(false); R.root.remove(R.m3d.model); R.m3d = null; R.m3dKey = null; }
    const gltf = key ? P3D.loaded(key) : null;
    if (key && !gltf && !m3Fail.has(key) && !m3Pending.has(key)) {
      m3Pending.add(key);
      P3D.load(key).then(() => figs.forEach(syncModel)).catch(e => { m3Fail.add(key); console.warn(`No se pudo cargar ${key} en el menú; queda el cuerpo de siempre.`, e); }).finally(() => m3Pending.delete(key));
    }
    const clone = P3D.skelClone();
    if (gltf && clone && !R.m3d && attachModel(R, gltf, clone)) R.m3dKey = key;
    R.m3d?.setVisible(!!gltf);
    /* Si tiene modelo 3D (o todavía se está viendo si lo tiene / se está bajando), el cuerpo del juego queda oculto: nunca se ven los dos. */
    if (!R.m3d) R.hips.visible = !(w && R.root.visible && (key ? !gltf && !m3Fail.has(key) : P3D.checking(w.info, w.ab, w.kit)));
    clearTimeout(m3Timer); m3Timer = setTimeout(() => P3D.setUsers('stage', figs.map(x => x.m3want)), 400);     // el menú solo retiene los modelos que está mostrando
  };
  for (let i = 0; i < 5; i++) { const R = makeRig(scene), J = mkJ(); R.root.visible = false; figs.push({ R, J, ry: 0, i, g: 0, gt: 0, glow: makeGlow() }); scene.add(figs[i].glow.group); }
  const glowLight = new THREE.PointLight(0xffc53d, 0, 5, 1.6); glowLight.position.set(0, 1.4, 1.2); scene.add(glowLight);

  let name = 'kits', box = { w: 1, h: 1 }, raf = 0, running = false, failed = false, frames = 0, onFail = null;
  const api = {
    get failed() { return failed; },
        /** Muestra los jugadores `items` = [{ player, kit, team, x, z, ry, tint? }] en la escena `sceneName`. */
    show(sceneName, items) {
      name = sceneName;
      const b = sceneName === 'lineup' ? 9 : 4;
      key.shadow.camera.left = -b; key.shadow.camera.right = b; key.shadow.camera.top = b; key.shadow.camera.bottom = -b; key.shadow.camera.updateProjectionMatrix();
      key.position.set(sceneName === 'lineup' ? -3 : -2.5, 8, 6); key.target.position.set(0, 0, 0);
      figs.forEach((f, i) => {
        const it = items[i];
        f.R.root.visible = !!it; f.want = it ? { info: it.player, ab: it.team.ab, kit: it.kit.id } : null; if (!it) return;
        dress(f.R, it); standPose(f.J, i);
        f.R.root.position.set(it.x, 0, it.z); f.ry = it.ry || 0; f.R.root.rotation.y = f.ry; f.glow.group.position.set(it.x, 0, it.z);
        applyPose(f.R, f.J);
      });
      figs.forEach(syncModel);
      api.resize();
    },
    /** `cur` = jugador sobre el que estás parado (brilla fuerte y pulsa), `sel` = titular elegido para cambiar (brilla fijo y más suave). -1 = ninguno. */
    setGlow(cur, sel = -1) { figs.forEach((f, i) => { f.gt = i === cur ? 1 : i === sel ? 0.55 : 0; }); },
    resize() {
      const w = Math.max(1, canvas.clientWidth | 0), h = Math.max(1, canvas.clientHeight | 0);
      box = { w, h };
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(w, h, false);
      const c = fitCfg(name, w, h);
      camera.aspect = w / h; camera.fov = c.fov; camera.position.set(...c.pos); camera.lookAt(...c.target); camera.updateProjectionMatrix();
    },
    start(failCb) {
      onFail = failCb || onFail;
      if (running || failed) return;
      running = true;
      const tick = t => {
        if (!running) return;
        raf = requestAnimationFrame(tick);
        try {
          if (canvas.clientWidth !== box.w || canvas.clientHeight !== box.h) api.resize();
          const s = t * 0.001;
          let lead = null;
          for (const f of figs) {
            f.g += (f.gt - f.g) * 0.2;                                        // entra y sale suave
            const on = f.g > 0.01 && f.R.root.visible; f.glow.group.visible = on;
            if (on) {
              const pulse = f.gt === 1 ? 0.8 + 0.2 * Math.sin(s * 6) : 1;
              f.glow.ringM.opacity = 0.95 * f.g * pulse; f.glow.discM.opacity = 0.35 * f.g * pulse; f.glow.beamM.opacity = 0.16 * f.g * pulse;
              if (f.gt === 1) lead = f;
            }
            if (!f.R.root.visible) continue;
            f.R.root.rotation.y = f.ry + Math.sin(s * 0.7 + f.i * 1.3) * 0.05;
            applyPose(f.R, f.J);
          }
          glowLight.intensity += ((lead ? 6 : 0) - glowLight.intensity) * 0.2;
          if (lead) glowLight.position.set(lead.R.root.position.x, 1.5, lead.R.root.position.z + 1.3);
          renderer.render(scene, camera); frames++;
        } catch (e) { console.warn('El escenario 3D del menú falló; se usa la versión plana.', e); failed = true; running = false; onFail?.(e); }
      };
      raf = requestAnimationFrame(tick);
    },
    stop() { running = false; cancelAnimationFrame(raf); },
  };
  return api;
}
