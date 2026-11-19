import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/environments/RoomEnvironment.js';
import { cardUrl } from './cardzip.js';
import { TEAMS } from '../teams.js';
import { createCourtWorld, HOOP_Z, warmCourt, freeCourtModels, freeCourtModel } from './court3d.js';
import { ALLSTAR, courtFor } from '../courts.js';
import { makeRig, mkJ, applyPose } from '../rig.js';
import { kitById, nickname } from '../kits.js';
import { lookOf, buildFor, scaleFor } from '../looks.js';
import { SKIN_TONES } from '../roster.js';
import { ICON_BY_ID } from './data/icons.js';

/* ============================================================================
   Apertura de sobres en 3D (la del proyecto nba3k-packs, metida en el juego).
   Uso:  await playPack(sobre, cartas)   →  sobre = { name, n, a, b, col }   ·   cartas = [{ id, t, o, pos, n }]
   Muestra una capa a pantalla completa (#utStage), anima el sobre y cada carta (walkout con la cancha real del equipo
   desde la media 86) y devuelve la promesa cuando se tocó la última carta. Mientras no se usa, no dibuja nada.
   ========================================================================== */
export const WALK = 86, LEGEND = 92;
/* Sobres 3D: cada tipo de sobre del juego ↔ su modelo y su foto (emparejados por color). */
const PACK_FILE = { rookie: 'pack_5k', oro: 'pack_25k', elite: 'pack_50k', especial: 'pack_100k' };
export const packImg = k => `assets/packs/${PACK_FILE[k] || PACK_FILE.rookie}.webp`;
const packGlb = k => `assets/packs/${PACK_FILE[k] || PACK_FILE.rookie}.glb`;
const lum=h=>{const n=parseInt(h.slice(1),16);return((n>>16&255)*.2126+(n>>8&255)*.7152+(n&255)*.0722)/255};
const tcol=ab=>{const t=TEAMS.find(x=>x.ab===ab);return!t?'#ffffff':lum(t.c1)>.28?t.c1:lum(t.c2)>.28?t.c2:'#ffffff'};

const stageEl = document.createElement('section');
stageEl.id = 'utStage'; stageEl.hidden = true;
stageEl.innerHTML = '<canvas id="cv"></canvas><div id="flash"></div><div class="ov" id="dots"></div><div class="ov d" id="clue"></div><div class="ov" id="stats"></div><div class="ov" id="info"></div><div class="ov" id="hint"></div><button type="button" id="skip">Saltear</button>';
document.body.appendChild(stageEl);
const $=s=>stageEl.querySelector(s);
/* ---------- motor 3D ---------- */
let raf=0,rsFn=null,ENV,R,S,C,G,W,CW,Wd,wmode=false,amb,sp,floor,on=false,skip=false,last=0,tws=[],ticks=[],mx=0,my=0,tapR=null,shake=0;
const E={lin:t=>t,io:t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,out:t=>1-Math.pow(1-t,3),in:t=>t*t,
 bnc:t=>{const n=7.5625,d=2.75;if(t<1/d)return n*t*t;if(t<2/d)return n*(t-=1.5/d)*t+.75;if(t<2.5/d)return n*(t-=2.25/d)*t+.9375;return n*(t-=2.625/d)*t+.984375}};
const tw=(ms,fn,e=E.io)=>new Promise(r=>tws.push({t0:performance.now(),ms:skip?ms/8:ms,fn,e,r}));
const wait=ms=>tw(ms,()=>{});
function tap(msg){const h=$('#hint');h.textContent=msg;h.classList.add('on');return new Promise(r=>{tapR=()=>{h.classList.remove('on');tapR=null;r()};if(skip)tapR()})}
stageEl.addEventListener('pointerdown',()=>tapR&&tapR());
addEventListener('keydown',e=>{if(on&&tapR&&(e.code==='Space'||e.code==='Enter')){e.preventDefault();e.stopPropagation();tapR()}},true);
addEventListener('pointermove',e=>{mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5});
$('#skip').onclick=()=>{skip=true;tapR&&tapR()};
function init3(){
 R=new THREE.WebGLRenderer({canvas:$('#cv'),antialias:true});R.toneMapping=THREE.ACESFilmicToneMapping;R.toneMappingExposure=1.1;R.autoClear=false;R.localClippingEnabled=true;R.setPixelRatio(Math.min(devicePixelRatio,2));
 ENV=new THREE.PMREMGenerator(R).fromScene(new RoomEnvironment(),.04).texture;
 S=new THREE.Scene();S.background=new THREE.Color(0x0a0c14);C=new THREE.PerspectiveCamera(50,1,.1,60);
 amb=new THREE.HemisphereLight(0xdfe8ff,0x3a4658,1.5);sp=new THREE.DirectionalLight(0xffffff,2.4);sp.position.set(0,10,4);S.add(amb,sp);
 floor=new THREE.Mesh(new THREE.CircleGeometry(10,64),new THREE.MeshStandardMaterial({map:woodTex(),roughness:.55}));floor.rotation.x=-Math.PI/2;floor.position.y=-2.3;S.add(floor);
 const rs=()=>{R.setSize(innerWidth,innerHeight,false);C.aspect=innerWidth/innerHeight;C.position.set(0,.4,C.aspect<.8?9.5:6.2);C.lookAt(0,.2,0);C.updateProjectionMatrix();if(CW){CW.aspect=C.aspect;CW.updateProjectionMatrix()}};
 addEventListener('resize',rs);rs();rsFn=rs}
function loop(now){raf=requestAnimationFrame(loop);const dt=Math.min(.05,(now-last)/1000);last=now;
 tws=tws.filter(w=>{const p=Math.min(1,Math.max(0,(now-w.t0)/w.ms));w.fn(w.e(p));if(p>=1){w.r();return false}return true});
 ticks=ticks.filter(f=>f(dt));if(Wd)Wd.arena.update(dt);
 if(!on)return;const bz=C.aspect<.8?9.5:6.2;R.clear();
 if(wmode&&CW){const o=new THREE.Vector3((Math.random()-.5)*shake*.5,(Math.random()-.5)*shake*.5,0);CW.position.add(o);R.render(W,CW);CW.position.sub(o);R.clearDepth()}
 C.position.set((Math.random()-.5)*shake,.4+(Math.random()-.5)*shake,bz);C.lookAt(0,.2,0);shake*=.9;R.render(S,C)}
const cnv=(w,h,f)=>{const c=document.createElement('canvas');c.width=w;c.height=h;f(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t};
function woodTex(){return cnv(1024,1024,(x,w,h)=>{x.fillStyle='#a8692f';x.fillRect(0,0,w,h);for(let i=0;i<40;i++){x.fillStyle=i%2?'#00000014':'#ffffff0c';x.fillRect(0,i*h/40,w,h/40)}x.strokeStyle='#ffffffaa';x.lineWidth=6;x.beginPath();x.arc(w/2,h/2,230,0,7);x.stroke();x.beginPath();x.arc(w/2,h/2,480,0,7);x.stroke()})}
const glowT=cnv(128,128,(x)=>{const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'#fff');g.addColorStop(.35,'#ffffff55');g.addColorStop(1,'#fff0');x.fillStyle=g;x.fillRect(0,0,128,128)});
const raysT=cnv(512,512,(x)=>{x.translate(256,256);for(let i=0;i<22;i++){x.rotate(Math.PI*2/22);const g=x.createLinearGradient(0,0,256,0);g.addColorStop(0,'#fff');g.addColorStop(1,'#fff0');x.fillStyle=g;x.beginPath();x.moveTo(0,0);x.lineTo(256,-10);x.lineTo(256,10);x.fill()}});
const spr=(t,col,s,o=1)=>{const m=new THREE.Sprite(new THREE.SpriteMaterial({map:t,color:col,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,opacity:o}));m.scale.set(s,s,1);return m};
function dark(k){amb.intensity=1.5*(1-k)+.2*k;sp.intensity=2.4*(1-k)+.3*k;if(S.background){const v=1-k;S.background.setRGB(.04*v,.05*v,.08*v)}}
function flash(col,a=.85){const f=$('#flash');f.style.background=col;tw(650,t=>f.style.opacity=a*(1-t),E.out)}
function burst(pos,col,n=160,sp0=5,grp=G,size=.22){const g=new THREE.BufferGeometry(),v=[],pa=new Float32Array(n*3);for(let i=0;i<n;i++){const a=Math.random()*6.28,b=(Math.random()-.5)*3,s=(.3+Math.random())*sp0;v.push([Math.cos(a)*s,Math.sin(a)*s+b,(Math.random()-.2)*s*.6]);pa.set([pos.x,pos.y,pos.z],i*3)}
 g.setAttribute('position',new THREE.BufferAttribute(pa,3));const m=new THREE.PointsMaterial({color:col,size,map:glowT,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false}),pts=new THREE.Points(g,m);grp.add(pts);let life=1.6;
 ticks.push(dt=>{life-=dt;for(let i=0;i<n;i++){pa[i*3]+=v[i][0]*dt;pa[i*3+1]+=v[i][1]*dt;pa[i*3+2]+=v[i][2]*dt;v[i][1]-=3*dt}g.attributes.position.needsUpdate=true;m.opacity=Math.max(0,life/1.6);if(life<=0){grp.remove(pts);return false}return true})}
function ring(pos,col){const m=new THREE.Mesh(new THREE.RingGeometry(.9,1,64),new THREE.MeshBasicMaterial({color:col,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));m.position.copy(pos);G.add(m);tw(900,t=>{m.scale.setScalar(.2+t*9);m.material.opacity=1-t},E.out).then(()=>G.remove(m))}
/* ---------- objetos ---------- */
const shield=(x,w,h)=>{x.beginPath();[[.07,.02],[.93,.02],[.99,.075],[.99,.87],[.5,.985],[.01,.87],[.01,.075]].forEach(([a,b],i)=>x[i?'lineTo':'moveTo'](a*w,b*h));x.closePath()};
const texCache={};
const frontTex=p=>texCache[p.id]||(texCache[p.id]=new Promise(res=>{const im=new Image();im.onload=()=>res(cnv(324,464,(x)=>{shield(x,324,464);x.clip();x.drawImage(im,0,0,324,464)}));im.src=cardUrl(p.id)}));
const backTex=col=>cnv(216,309,(x,w,h)=>{shield(x,w,h);x.clip();const g=x.createLinearGradient(0,0,w,h);g.addColorStop(0,'#1b2140');g.addColorStop(1,'#07080f');x.fillStyle=g;x.fillRect(0,0,w,h);x.strokeStyle='#'+col.toString(16).padStart(6,'0');x.lineWidth=3;x.beginPath();x.arc(w/2,h/2,52,0,7);x.moveTo(w/2-52,h/2);x.lineTo(w/2+52,h/2);x.moveTo(w/2,h/2-52);x.lineTo(w/2,h/2+52);x.stroke();x.lineWidth=8;shield(x,w,h);x.stroke()});
async function mkCard(p,col){const g=new THREE.Group(),geo=new THREE.PlaneGeometry(1.4,2),mat=m=>new THREE.MeshBasicMaterial({map:m,transparent:true,toneMapped:false});
 const f=new THREE.Mesh(geo,mat(await frontTex(p))),b=new THREE.Mesh(geo,mat(backTex(col)));b.rotation.y=Math.PI;const ic=isIc(p),gl=spr(glowT,col,ic?6.4:4.6,ic?.95:.7);gl.position.z=-.1;g.add(gl,f,b);if(ic)g.add(mkSweep());g.userData.gl=gl;return g}
const tier=o=>o>=LEGEND?0xb86bff:o>=WALK?0xffd45a:o>=80?0x9ecbff:0xd9a066;
/* ---- v65 · ÍCONOS: iluminación propia (dorada, a media luz, con foco cenital, polvo de oro y un brillo que recorre la carta) ---- */
const isIc=p=>String(p&&p.id||'').startsWith('ICON_'),ICON_GOLD=0xffd27a;
const maskT=cnv(324,464,(x)=>{x.fillStyle='#000';x.fillRect(0,0,324,464);shield(x,324,464);x.fillStyle='#fff';x.fill()});
const bandT=(()=>{const t=cnv(256,64,(x,w,h)=>{const g=x.createLinearGradient(0,0,w,0);[[0,'#000'],[.40,'#000'],[.5,'#fff3c4'],[.6,'#000'],[1,'#000']].forEach(([o,c])=>g.addColorStop(o,c));x.fillStyle=g;x.fillRect(0,0,w,h)});t.wrapS=THREE.RepeatWrapping;t.repeat.set(.55,1);t.center.set(.5,.5);t.rotation=.55;return t})();
function mkSweep(){const m=new THREE.Mesh(new THREE.PlaneGeometry(1.4,2),new THREE.MeshBasicMaterial({map:bandT,alphaMap:maskT,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));m.position.z=.012;let t=0;ticks.push(dt=>{if(!m.parent)return false;t+=dt;bandT.offset.x=-((t*.38)%1.6);return true});return m}
function mkDust(grp){const n=170,pa=new Float32Array(n*3),ph=[];for(let i=0;i<n;i++){pa.set([(Math.random()-.5)*7,(Math.random()-.5)*6,-.8+Math.random()*2.2],i*3);ph.push(Math.random()*6.28)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pa,3));const m=new THREE.PointsMaterial({color:0xffe6a0,size:.1,map:glowT,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,opacity:.9}),pts=new THREE.Points(g,m);grp.add(pts);let tt=0;
 ticks.push(dt=>{if(!pts.parent)return false;tt+=dt;for(let i=0;i<n;i++){pa[i*3+1]-=dt*(.22+(i%5)*.05);pa[i*3]+=Math.sin(tt*.8+ph[i])*dt*.18;if(pa[i*3+1]<-3.2)pa[i*3+1]=3.2}g.attributes.position.needsUpdate=true;return true});return pts}
function mkCone(grp){const ge=new THREE.CylinderGeometry(.4,2.3,10,32,1,true);ge.translate(0,-5,0);const m=new THREE.Mesh(ge,new THREE.MeshBasicMaterial({color:0xffe2a0,transparent:true,opacity:.0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));m.position.set(0,5.6,-.5);grp.add(m);let tt=0;
 ticks.push(dt=>{if(!m.parent)return false;tt+=dt;m.material.opacity=Math.min(.2,tt*.12)*(.85+.15*Math.sin(tt*3));return true});return m}
function mkPackFlat(pk){const tex=cnv(256,380,(x,w,h)=>{const g=x.createLinearGradient(0,0,w,h);g.addColorStop(0,pk.a);g.addColorStop(.8,pk.b);x.fillStyle=g;x.fillRect(0,0,w,h);x.fillStyle='#ffffff18';for(let i=-h;i<w;i+=26)x.fillRect(i,0,10,h*2),x.setTransform(1,0,-.4,1,0,0);x.setTransform(1,0,0,1,0,0);
  x.fillStyle='#0004';for(let i=0;i<w;i+=8){x.fillRect(i,0,4,h*.05);x.fillRect(i,h*.95,4,h*.05)}x.fillStyle='#ff6a1a';x.beginPath();x.arc(w/2,h*.4,48,0,7);x.fill();x.strokeStyle='#1a0c04';x.lineWidth=5;x.stroke();x.beginPath();x.moveTo(w/2-48,h*.4);x.lineTo(w/2+48,h*.4);x.moveTo(w/2,h*.4-48);x.lineTo(w/2,h*.4+48);x.stroke();
  x.fillStyle='#fff';x.textAlign='center';x.font='900 46px Impact,sans-serif';x.fillText(pk.name.toUpperCase(),w/2,h*.72);x.font='600 20px sans-serif';x.fillText('ULTIMATE TEAM · '+pk.n+' CARTAS',w/2,h*.8)});
 const mk=(h,y,ro,rr)=>{const t=tex.clone();t.needsUpdate=true;t.offset.y=ro;t.repeat.y=rr;const m=new THREE.Mesh(new THREE.BoxGeometry(1.5,h,.14),new THREE.MeshBasicMaterial({map:t,transparent:true,toneMapped:false}));m.position.y=y;return m};
 const g=new THREE.Group(),body=mk(1.936,-.132,0,.88),top=mk(.264,.968,.88,.12),gl=spr(glowT,pk.col,6,0);gl.position.z=-.2;g.add(gl,body,top);return{g,body,top,gl,idle:true,charge:()=>{},open:t=>{top.position.set(1.4*t,.968+2.6*t,0);top.rotation.z=-1.3*t;body.position.y=-.132-4*t*t}}}
/* ---- sobre 3D (GLB) ---- */
const PCUT=.9; /* altura (en el modelo) donde se rasga el sobre, debajo del sellado de arriba */
const PKS={};
export const warmPack=k=>{warmCourt(ALLSTAR.model).catch(()=>{});warmBall().catch(()=>{});return PKS[k]||(PKS[k]=new GLTFLoader().loadAsync(packGlb(k)).then(g=>g.scene))};
function partOf(src,plane){const root=src.clone(true),mats=[],an=R.capabilities.getMaxAnisotropy();root.traverse(o=>{if(o.isMesh){const m=o.material.clone();[m.map,m.normalMap,m.metalnessMap].forEach(t=>t&&(t.anisotropy=an));m.envMap=ENV;m.envMapIntensity=1.15;m.emissiveMap=m.map;m.emissive=new THREE.Color(0xffffff);m.emissiveIntensity=.35;m.clippingPlanes=[new THREE.Plane()];o.material=m;mats.push(m)}});
 return{root,sync(){root.updateWorldMatrix(true,true);mats.forEach(m=>m.clippingPlanes[0].copy(plane).applyMatrix4(root.matrixWorld))}}}
async function mkPack(pk){let src;try{src=await warmPack(pk.kind)}catch(e){console.warn('GLB del sobre no cargó, uso el sobre plano',e);delete PKS[pk.kind];return mkPackFlat(pk)}
 const g=new THREE.Group(),body=new THREE.Group(),top=new THREE.Group(),gl=spr(glowT,pk.col,6,0),seam=spr(glowT,pk.col,1,0);gl.position.z=-.3;seam.scale.set(3.2,.8,1);seam.position.set(0,PCUT,.25);
 const pb=partOf(src,new THREE.Plane(new THREE.Vector3(0,-1,0),PCUT)),pt=partOf(src,new THREE.Plane(new THREE.Vector3(0,1,0),-PCUT));
 body.add(pb.root);top.position.y=PCUT;pt.root.position.y=-PCUT;top.add(pt.root);g.add(gl,body,top,seam);
 const o={g,body,top,gl,idle:true,live:true,charge:t=>{seam.material.opacity=.75*t;g.scale.setScalar(1+.05*t)},
  open:t=>{top.position.set(1.5*t,PCUT+2.6*t,.4*t);top.rotation.set(-.5*t,.3*t,-1.2*t);body.position.y=-4*t*t;body.rotation.z=.12*t;seam.material.opacity=.75*(1-t)}};
 ticks.push(()=>{if(!o.live)return false;pb.sync();pt.sync();return true});return o}
/* v68 · pelota 3D (assets/ball.glb = la nba_basketball.glb de canchas_3d.zip, ya calibrada). mkBall(r) devuelve un grupo de radio r; si el GLB todavía no llegó usa la esfera de siempre. */
let ballP=null,ballSrc=null;
const warmBall=()=>ballP||(ballP=new GLTFLoader().loadAsync('assets/ball.glb').then(g=>{let m=null;g.scene.traverse(o=>{if(o.isMesh&&!m)m=o});if(!m)throw new Error('ball.glb sin malla');m.geometry.computeBoundingSphere();m.material.metalness=0;ballSrc={geo:m.geometry,mat:m.material,r:m.geometry.boundingSphere.radius||.116};return ballSrc}).catch(e=>{ballP=null;throw e}));
function mkBall(r=.36){const g=new THREE.Group();
 if(ballSrc){const m=new THREE.Mesh(ballSrc.geo,ballSrc.mat);m.scale.setScalar(1/ballSrc.r);g.add(m)}
 else{const t=cnv(256,128,(x,w,h)=>{x.fillStyle='#e8631a';x.fillRect(0,0,w,h);x.strokeStyle='#1a0c04';x.lineWidth=4;x.beginPath();x.moveTo(0,h/2);x.lineTo(w,h/2);for(const px of[0,w/2,w]){x.moveTo(px,0);x.lineTo(px,h)}x.moveTo(w/4,0);x.quadraticCurveTo(w/4+18,h/2,w/4,h);x.moveTo(w*.75,0);x.quadraticCurveTo(w*.75-18,h/2,w*.75,h);x.stroke()});
  g.add(new THREE.Mesh(new THREE.SphereGeometry(1,28,20),new THREE.MeshStandardMaterial({map:t,roughness:.5})))}
 g.scale.setScalar(r);return g}
/* ---------- secuencia ---------- */
const info=(p)=>{$('#info').innerHTML=p?`<b>${p.o}</b>${p.pos?p.pos+' · ':''}${p.n} · ${p.t}`:''};
const clue=(s)=>{const c=$('#clue');c.classList.remove('pop');void c.offsetWidth;c.textContent=s;if(s)c.classList.add('pop')};
function showCard(m,from,spins){const f=from.clone();return tw(1100,t=>{m.position.lerpVectors(f,new THREE.Vector3(0,.1,1.2),t);m.scale.setScalar(.15+.85*t);m.rotation.y=Math.PI*(1-t)+Math.PI*2*spins*(1-t)},E.out)}
function holo(m){ticks.push(()=>{if(!m.parent)return false;m.rotation.y+=(mx*.7-m.rotation.y)*.1;m.rotation.x+=(my*.5-m.rotation.x)*.1;return true})}
async function reveal(p){const col=tier(p.o),m=await mkCard(p,col);m.position.set(0,.2,-3);m.scale.setScalar(.15);m.rotation.y=Math.PI;G.add(m);
 flash('#'+col.toString(16).padStart(6,'0'),.5);burst(new THREE.Vector3(0,.2,.5),col,p.o>=80?220:90);
 await showCard(m,new THREE.Vector3(0,.2,-3),1);info(p);holo(m);await tap('Tocá para continuar');info(null);
 const q=m.position.clone();await tw(450,t=>{m.position.y=q.y-4*t;m.scale.setScalar(1-.5*t)},E.in);G.remove(m)}
/* ---- fondo de la apertura: la cancha del All-Star con la tribuna genérica (assets/asg_court.glb + ALLSTAR de courts.js).
   Se ve detrás del sobre y de las cartas comunes; en un walkout (media 86+) se cambia por la cancha del equipo del jugador y después vuelve. ---- */
const BG_DIM=.35; /* 0 = estadio a pleno · 1 = casi a oscuras: un poco apagado para que el sobre y las cartas resalten */
let bgTok=0;
function bgCam(t){const a=Math.sin(t*.18);CW.position.set(a*.9,1.65+Math.sin(t*.11)*.05,-1.6);CW.lookAt(a*.25,1.25,-HOOP_Z)}
function bgFree(){bgTok++;if(Wd){try{Wd.dispose()}catch(e){}Wd=null}W=null;CW=null;wmode=false}
function bgOff(){bgFree();if(S)S.background=new THREE.Color(0x0a0f1d);if(floor)floor.visible=true;dark(0)}
async function bgOn(){
 bgFree();const tok=bgTok,w=createCourtWorld(ALLSTAR,{model:true});
 try{await Promise.race([w.ready,new Promise(r=>setTimeout(r,2500))])}catch(e){} /* si el GLB tarda, arranca con la cancha armada por código y se cambia sola cuando llega */
 if(tok!==bgTok||!on){try{w.dispose()}catch(e){}return}
 Wd=w;W=w.scene;CW=new THREE.PerspectiveCamera(50,C.aspect,.1,300);Wd.setDim(BG_DIM);S.background=null;floor.visible=false;wmode=true;let t=0;bgCam(0);
 ticks.push(dt=>{if(tok!==bgTok||!wmode||Wd!==w)return false;t+=dt;bgCam(t);return true})}
/* ---- walkout con la cancha real del equipo de fondo ---- */
function mkBeams(c,n=5,op=.12){const g=new THREE.Group();for(let i=0;i<n;i++){const ge=new THREE.CylinderGeometry(.12,2.6,28,20,1,true);ge.translate(0,-14,0);const m=new THREE.Mesh(ge,new THREE.MeshBasicMaterial({color:Array.isArray(c)?c[i%c.length]:c,transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));m.position.set((i-(n-1)/2)*4,28,-6);g.add(m)}
 let tt=0;ticks.push(dt=>{if(!g.parent)return false;tt+=dt;g.children.forEach((m,i)=>{m.rotation.z=Math.sin(tt*1.3+i*1.2)*.4;m.rotation.x=Math.cos(tt+i)*.2});return true});return g}
function mkCrowd(){const g=new THREE.Group(),s=[];for(let i=0;i<90;i++){const a=Math.random()*6.28,q=spr(glowT,0xffffff,1.1,0);q.position.set(Math.cos(a)*(16+Math.random()*8),4+Math.random()*9,Math.sin(a)*(24+Math.random()*7));g.add(q);s.push(q)}
 ticks.push(dt=>{if(!g.parent)return false;s.forEach(q=>{q.material.opacity=Math.random()>.975?1:Math.max(0,q.material.opacity-dt*5)});return true});return g}
function toFore(v){const q=v.clone();CW.updateMatrixWorld();q.project(CW);const z=C.aspect<.8?9.5:6.2,hh=Math.tan(C.fov*Math.PI/360)*(z-1.2);return new THREE.Vector3(q.x*hh*C.aspect,q.y*hh,1.2)}
async function walkout(p,more){const ic=isIc(p),col=ic?ICON_GOLD:tier(p.o),leg=ic||p.o>=LEGEND,tc=tcol(p.t),tcn=new THREE.Color(tc).getHex(),cl=$('#clue');
 bgFree();Wd=createCourtWorld(p.t,{model:true});W=Wd.scene;const hoop=Wd.hoop,rimV=hoop.rim,V=(x,y,z)=>new THREE.Vector3(x,y,z);
 await warmBall().catch(()=>{});
 CW=new THREE.PerspectiveCamera(50,C.aspect,.1,300);CW.position.set(0,1.8,-3);CW.lookAt(0,2.6,-HOOP_Z);
 const ball=mkBall(.12);ball.position.set(.25,.12,-4.6);W.add(ball);const beams=ic?mkBeams(ICON_GOLD,9,.2):mkBeams(tcn),crowd=mkCrowd();W.add(beams,crowd);
 try{await Promise.race([Wd.ready,new Promise(r=>setTimeout(r,2500))])}catch(e){} /* cancha 3D del equipo (assets/<ab>_court.glb); si tarda, arranca con la armada por código */
 Wd.setDim(1);S.background=null;floor.visible=false;wmode=true;flash('#000',1);
 await tw(900,t=>Wd.setDim(1-(ic?.12:.25)*t));
 tw(3000,t=>{CW.position.z=-3-.6*t;CW.lookAt(0,2.6,-HOOP_Z)},E.lin);
 for(const[s,c]of[[p.t,tc],[p.pos,'#fff'],[ic?'??':Math.floor(p.o/10)+'?',ic?'#ffd27a':'#ffd45a']]){if(!s)continue;cl.style.color=c;clue(s);shake=.05;await wait(950)}clue('');
 /* pique, pique, pique */
 const dr=tw(1500,t=>{ball.position.set(.25,.12+Math.abs(Math.sin(t*Math.PI*3))*(1.1-.2*t),-4.6);ball.rotation.x=-t*8},E.lin);
 [500,1000,1480].forEach(m=>setTimeout(()=>{shake=.1},m/(skip?8:1)));await dr;
 await tw(260,t=>{ball.position.y=.12+1.6*t},E.out);
 /* tiro en cámara lenta: la cámara sigue la pelota y se acerca al aro */
 const A=ball.position.clone(),B=rimV.clone().add(V(0,.5,0)),c0=CW.position.clone(),c1=V(0,3.1,-9),slow=t=>t<.7?t/.7*.85:.85+.15*((t-.7)/.3);
 await tw(2300,t=>{ball.position.lerpVectors(A,B,t);ball.position.y+=3.2*Math.sin(Math.PI*t);ball.rotation.x=-t*10;CW.position.lerpVectors(c0,c1,t);CW.fov=50-22*t;CW.updateProjectionMatrix();CW.lookAt(ball.position.clone().lerp(rimV,t*t))},slow);
 await tw(260,t=>{ball.position.y=B.y-1.05*t},E.in);
 /* swish: se prende el estadio, salta el público, parpadea el marco LED del tablero */
 shake=.4;flash(ic?'#ffe39a':'#ffffff',.9);Wd.ledFlash(true);setTimeout(()=>Wd.ledFlash(false),500/(skip?8:1));Wd.arena.cheer(7);
 tw(600,t=>hoop.net.scale.set(1+.25*(1-t),1-.35*(1-t),1+.25*(1-t)),E.out);tw(700,t=>Wd.setDim(ic?.88-.46*t:.75*(1-t)),E.out);   /* ícono: el estadio queda a media luz, con haces dorados */
 const f0=CW.fov,p0=CW.position.clone();tw(1800,t=>{CW.position.lerpVectors(p0,V(0,3.2,-4.8),t);CW.fov=f0+(46-f0)*t;CW.updateProjectionMatrix();CW.lookAt(0,3.2,-HOOP_Z+3)});
 const fp=toFore(rimV);ring(fp,tcn);burst(fp,0xffffff,120,6);
 if(leg){hoop.glass.visible=false;burst(hoop.board,ic?0xffe39a:0xcfe8ff,320,5,W,.35)}
 (async()=>{await tw(350,t=>{ball.position.y=2.5-2.38*t},E.in);await tw(1100,t=>ball.position.set(.1+t*2,.12+Math.abs(Math.sin(t*Math.PI*3))*1.2*(1-t),-12.6+t*5),E.lin)})();
 await wait(600);
 /* sube la media */
 cl.style.color=ic?'#ffe39a':leg?'#ff7ad9':'#ffd45a';await tw(1200,t=>{cl.classList.remove('pop');cl.textContent=Math.round(55+(p.o-55)*t)},E.out);clue(p.o);shake=.3;flash(ic?'#ffd27a':leg?'#ff5ac8':'#ffd45a',.8);
 for(const c of ic?[0xffd27a,0xffffff,0xffb52e]:leg?[0xff5ac8,0x5ae0ff,0xffd45a]:[col,0xffffff])burst(V(0,.4,.5),c,ic?300:220,8);await wait(700);clue('');
 /* la carta sale del aro */
 const m=await mkCard(p,col),from=toFore(rimV);m.position.copy(from);m.scale.setScalar(.05);G.add(m);
 const rays=spr(raysT,col,ic?22:16,.9);rays.position.set(0,.2,-1.5);G.add(rays);ticks.push(dt=>{if(!rays.parent)return false;rays.material.rotation+=dt*.5;return true});
 let rays2=null,dust=null,cone=null;if(ic){rays2=spr(raysT,0xfff1c4,15,.55);rays2.position.set(0,.2,-1.4);G.add(rays2);ticks.push(dt=>{if(!rays2.parent)return false;rays2.material.rotation-=dt*.32;return true});dust=mkDust(G);cone=mkCone(G)}
 ring(V(0,.2,.5),col);await showCard(m,from,2);
 let pu=0;ticks.push(dt=>{if(!m.parent)return false;pu+=dt;m.userData.gl.material.opacity=.6+.3*Math.sin(pu*4);return true});
 cl.style.color=ic?'#ffd27a':'#fff';clue(ic?'ÍCONO':leg?'LEYENDA':'WALKOUT');tw(1500,t=>cl.style.opacity=1-t,E.in).then(()=>{clue('');cl.style.opacity=1});
 info(p);holo(m);await tap('Tocá para continuar');info(null);G.remove(rays);if(ic){G.remove(rays2,dust,cone)}
 const q=m.position.clone();await tw(450,t=>{m.position.y=q.y-4*t;m.scale.setScalar(1-.5*t)},E.in);G.remove(m);
 flash('#000',1);{const mp=Wd&&Wd.def.model;bgFree();if(mp&&mp!==ALLSTAR.model)freeCourtModel(mp)}dark(0);if(more)await bgOn();else bgOff()}
/* ============================================================================
   v68 · ÍCONO — secuencia propia (sale siempre primero):
   se abre el sobre → la pelota 3D aparece EN GRANDE, se achica y pica en el piso mientras se muestran las estadísticas, con luces blancas (es ícono) y de colores
   → entra el jugador (su cara, su cuerpo y la camiseta de su equipo) y clava un mate → ahí aparece la carta → después siguen las demás cartas del sobre, de menor a mayor.
   ============================================================================ */
const ISTAT=['TIR','PAS','REG','DEF','REB','VEL'],ILIGHT=[0xffffff,0xffffff,0xffffff,0xff3df0,0x39d6ff,0xffd45a,0x8a5bff];
const clampN=(v,a,b)=>Math.min(b,Math.max(a,v)),lrp=(a,b,t)=>a+(b-a)*t,sm=t=>{t=clampN(t,0,1);return t*t*(3-2*t)};
const hexS=n=>'#'+n.toString(16).padStart(6,'0');
function addStat(l,v){const s=$('#stats');s.classList.add('on');const d=document.createElement('div');d.className='st';d.style.setProperty('--w',clampN(v/110*100,4,100)+'%');
 d.innerHTML=`<b>${l}</b><span><i></i></span><em>${Math.round(v)}</em>`;s.appendChild(d);requestAnimationFrame(()=>requestAnimationFrame(()=>d.classList.add('on')))}
/* el jugador del ícono: aspecto, contextura, altura y camiseta (Icon) de su equipo, como en el partido */
function mkIconRig(p,scene){
 const ic=ICON_BY_ID.get(p.id),row=ic?.row||{},team=TEAMS.find(x=>x.ab===(ic?.team||p.t))||TEAMS.find(x=>x.ab===p.t);
 const R=makeRig(scene),info={name:p.n||ic?.name||'',number:ic?.num??row.number,skin:row.skin_tone,height:(row.height_in||78)*2.54,weightLb:row.weight_lb};
 R.setSkin(SKIN_TONES[row.skin_tone]??0xb97a50);R.setLook(info.name||String(p.id),lookOf(row,null));R.setBuild(buildFor(info));
 if(team){const k=kitById(team,'icon');R.setUniformStyle?.({jersey:k.jersey,shorts:k.shorts,accent:k.accent,trim:k.trim,details:k.details,word:nickname(team),ink:{wordFill:k.wordFill,wordStroke:k.wordStroke,numFill:k.numFill,numStroke:k.numStroke,nameFill:k.nameFill,nameStroke:k.nameStroke},decals:true});R.shoeM.color.set(k.shoes)}
 R.setUniformInfo?.(info);R.root.scale.setScalar(scaleFor(info));return R}
/* carrera → agachada → mate (las mismas poses del mate de dos manos del juego, en cámara lenta en el aire) → aterrizaje. Resuelve un rato después de aterrizar; `fx` se llama en el clavado. */
function dunkSeq(pl,ball,Wd,fx){return new Promise(res=>{
 const hoop=Wd.hoop,hz=-HOOP_Z,Z0=-2.4,ZJ=-10.2,RUN=1.55,TWD=.16,TF=.98,JH=1.3,S0=.4,REL=S0+.12,BALL_Z=-5.8;
 const J=mkJ(),hp=new THREE.Vector3(),hp2=new THREE.Vector3(),corr=new THREE.Vector3(),look=new THREE.Vector3();
 let ph='run',t=0,tf=0,gait=0,held=false,slam=false,released=false,bvy=0,landT=0,done=false,pwX=0,pwZ=ZJ;
 pl.root.rotation.y=Math.PI;pl.root.position.set(-.8,0,Z0);
 const pose=(T,dt,k=28)=>{const a=1-Math.exp(-k*dt);for(const q in T)J[q]+=(T[q]-J[q])*a;applyPose(pl,J);pl.root.updateMatrixWorld(true)};
 const base=()=>({thL:0,thR:0,knL:.08,knR:.08,shL:0,shR:0,elL:-.4,elR:-.4,szL:.12,szR:-.12,wL:0,wR:0,cL:.3,cR:.3,sL:.06,sR:.06});
 const fin=(T,cr,run,air)=>{const k0=cr*.95;T.thL-=k0;T.thR-=k0;T.knL+=2*k0;T.knR+=2*k0;T.tx=.1+run*.22+cr*.35-(air?.2:0);T.tz=0;T.ty=0;T.py=0;T.pz=0;T.hx=-T.tx*.8;T.hyaw=0;T.hy=.06+.94*Math.cos(k0);T.gr=air?0:1;return T};
 const runT=(g,k)=>{const s=Math.sin(g),c=Math.cos(g),A=.12+.45*k,Aa=.15+.5*k,cr=lrp(.22,.08,k),k0=cr*.95,tx=.1+k*.22+cr*.35;
  return{thL:-s*A-k0,thR:s*A-k0,knL:.08+(.15+.9*k)*Math.max(0,c)+2*k0,knR:.08+(.15+.9*k)*Math.max(0,-c)+2*k0,shL:s*Aa,shR:-s*Aa,elL:-.4-.7*k,elR:-.4-.7*k,szL:.12,szR:-.12,wL:0,wR:0,cL:.3,cR:.3,sL:.06,sR:.06,tx,ty:s*.2*k,tz:0,py:-s*.06*k,pz:-c*.04*k,hx:-tx*.8,hyaw:0,hy:.06+.94*Math.cos(k0),gr:1}};
 const armsUp=(ar,sl,ft)=>{const T=base();T.shR=lrp(-.8,-2.75,ar)+.6*sl;T.elR=lrp(-1.3,-.1,ar)-.4*sl-.3*ft;T.szR=.15;T.szL=-.15;T.wL=T.wR=Math.PI;T.cR=lrp(.35,.15,ar)+.5*ft;T.cL=lrp(.35,.15,ar);T.sR=.28;T.sL=.2;T.shL=T.shR;T.elL=T.elR;return T};
 ticks.push(dt0=>{
  if(!pl.root.parent||!CW)return false;
  const dt=Math.min(dt0,.05)*(skip?6:1);const rp=pl.root.position;
  if(ph==='run'){t+=dt;const u=clampN(t/RUN,0,1),e=sm(u)*.35+u*.65;rp.z=lrp(Z0,ZJ,e);rp.x=lrp(-.8,0,sm(u));gait+=dt*(7+6*u);pose(runT(gait,.55+.45*u),dt);
   if(!held&&rp.z<BALL_Z+.3)held=true;
   if(u>=1){ph='wind';t=0;pwX=rp.x;pwZ=rp.z}}
  else if(ph==='wind'){t+=dt;pose(fin(armsUp(0,0,0),lrp(.2,.75,sm(t/TWD)),0,false),dt,45);if(t>=TWD){ph='air';tf=0;pwX=rp.x;pwZ=rp.z}}
  else if(ph==='air'){
   tf+=dt*((tf>.1&&tf<TF*.95)?.55:1);                                    // cámara lenta mientras sube y clava
   const u=Math.min(tf/(TF/2),1),p2=lrp(u,sm(u),.5),u2=tf/TF;
   hp.set(pwX,0,pwZ-hz).normalize();
   rp.x=lrp(pwX,hp.x*.35+corr.x,p2);rp.z=lrp(pwZ,hz+hp.z*.35+corr.z,p2);rp.y=JH*4*Math.min(u2,1)*(1-Math.min(u2,1));
   if(tf>S0-.2&&tf<S0+.05){pl.hR.getWorldPosition(hp);corr.x+=(0-hp.x)*.25;corr.z+=(hz-hp.z)*.25}   // la mano que clava queda justo sobre el aro
   const ar=sm(tf/.36),sl=sm((tf-.4)/.12),ft=clampN((tf-REL)/.2,0,1),ext=sm((tf-TF*.65)/.2),T=armsUp(ar,sl,ft);
   T.thL=lrp(-.9,-.2,ext);T.knL=lrp(1,.3,ext);T.thR=lrp(-.55,-.2,ext);T.knR=lrp(.7,.3,ext);pose(fin(T,0,0,true),dt,45);
   if(tf>=S0+.1&&!slam){slam=true;fx&&fx()}
   if(tf>=REL&&!released){released=true;bvy=-2.2;tw(600,q=>hoop.net.scale.set(1+.25*(1-q),1-.35*(1-q),1+.25*(1-q)),E.out)}   // la pelota cae por el aro
   if(tf>=TF){ph='land';landT=0;rp.y=0;rp.x=0}}
  else{landT+=dt;const T=Object.assign(base(),{shL:-.5,shR:-.5,szL:.5,szR:-.5,elL:-.9,elR:-.9});pose(fin(T,ph==='land'?.6*Math.exp(-landT*4):0,0,false),dt,18);
   if(ph==='land'&&landT>1.1){ph='idle';if(!done){done=true;res()}}}
  /* la pelota: en la mano al correr y en las dos manos en el aire; suelta, cae por el aro y pica */
  if(!released){if(held){pl.hR.getWorldPosition(hp);if(ph==='air'||ph==='wind'){pl.hL.getWorldPosition(hp2);hp.add(hp2).multiplyScalar(.5);hp.y+=.14}else hp.y-=.07;ball.position.copy(hp)}}
  else{const b=ball.position;bvy-=9.8*dt;b.y+=bvy*dt;if(b.y>2.7){b.x+=(0-b.x)*Math.min(1,dt*10);b.z+=(hz-b.z)*Math.min(1,dt*8)}
   if(b.y<.12){b.y=.12;bvy=Math.abs(bvy)>.9?-bvy*.55:0}ball.rotation.x+=dt*4}
  /* cámara: arranca detrás de la pelota, se abre al costado y sigue el mate */
  const cu=ph==='run'?sm(t/RUN):1,ax=ph==='air'?sm(tf/TF):ph==='run'?0:1;
  CW.position.set(lrp(.8,4.6,cu)-.9*ax,lrp(1.7,1.95,cu)+.5*ax,lrp(-3.2,-8.6,cu)-.8*ax);
  CW.fov=lrp(50,38,ph==='air'||ph==='land'||ph==='idle'?ax:cu*.3);CW.updateProjectionMatrix();
  look.set(0,ph==='air'?2.1+rp.y*.55:ph==='run'?lrp(1.5,2.2,cu):2.3,ph==='run'?lrp(rp.z-1.5,-11.4,cu):-11.6);CW.lookAt(look);
  return true})})}
async function iconWalkout(p,more){
 const ic=ICON_BY_ID.get(p.id),stt=ic?.stats||[],cl=$('#clue'),V=(x,y,z)=>new THREE.Vector3(x,y,z),col=ICON_GOLD;
 bgFree();Wd=createCourtWorld(p.t,{model:true});W=Wd.scene;const hoop=Wd.hoop,rimV=hoop.rim;
 CW=new THREE.PerspectiveCamera(50,C.aspect,.1,300);CW.position.set(.8,1.7,-3.2);CW.lookAt(0,1.55,-4.6);
 await warmBall().catch(()=>{});
 const ball=mkBall(.5);ball.position.set(0,1.62,-4.2);W.add(ball);
 const beams=mkBeams(ILIGHT,9,.2),crowd=mkCrowd();W.add(beams,crowd);
 const lamp=new THREE.PointLight(0xffffff,0,0,2);lamp.position.set(0,2.4,-3.6);W.add(lamp);   /* luces que titilan: blancas casi siempre (es ícono) y de colores */
 let lt=0;ticks.push(dt=>{if(!lamp.parent)return false;lt-=dt;if(lt<=0){lt=.07+Math.random()*.09;lamp.color.setHex(Math.random()<.6?0xffffff:ILIGHT[3+Math.floor(Math.random()*4)]);lamp.intensity=40+Math.random()*120}return true});
 try{await Promise.race([Wd.ready,new Promise(r=>setTimeout(r,2500))])}catch(e){}
 Wd.setDim(1);S.background=null;floor.visible=false;wmode=true;flash('#000',1);
 await tw(700,t=>Wd.setDim(1-.1*t));
 /* 1) la pelota en grande, girando */
 cl.style.color='#ffffff';clue('ÍCONO');shake=.06;tw(1300,t=>cl.style.opacity=1-t,E.in).then(()=>{clue('');cl.style.opacity=1});
 tw(1000,t=>{ball.rotation.y=t*7;ball.rotation.x=t*2.5},E.lin);await wait(1000);
 /* 2) se achica y pica en el piso; mientras tanto van saliendo las estadísticas */
 const sb=$('#stats');sb.innerHTML='<h4></h4>';sb.firstChild.textContent=p.n||'';
 ISTAT.forEach((l,i)=>setTimeout(()=>addStat(l,stt[i]??Math.round(p.o*.9)),(250+i*560)/(skip?8:1)));
 await new Promise(res=>{let y=2.4,vy=0,n=0,tt=0;ticks.push(dt0=>{const dt=Math.min(dt0,.05)*(skip?6:1);tt+=dt;vy-=9.8*dt;y+=vy*dt;const r=lrp(.5,.12,E.out(clampN(tt/1.25,0,1)));
  ball.scale.setScalar(r);ball.position.set(0,Math.max(y,r),lrp(-4.2,-5.8,clampN(tt/1.6,0,1)));ball.rotation.x+=dt*5;ball.rotation.y+=dt*3;
  if(y<=r&&vy<0){y=r;vy=-vy*.74;n++;shake=.08+.02*n;const w=n%2?0xffffff:ILIGHT[3+n%4];burst(V(0,.05,ball.position.z),w,40,3.2,W,.14);flash(hexS(w),.25);if(n>=5){res();return false}}return true})});
 /* 3) entra el jugador y clava un mate */
 flash('#ffffff',.6);Wd.setDim(.9);
 const pl=mkIconRig(p,W),sp2=new THREE.SpotLight(0xffffff,600,0,.45,.6,2);sp2.target=pl.root;W.add(sp2);
 ticks.push(()=>{if(!sp2.parent||!pl.root.parent)return false;sp2.position.set(0,13,pl.root.position.z+2);return true});
 const fx=()=>{shake=.45;flash('#ffffff',.95);Wd.ledFlash(true);setTimeout(()=>Wd.ledFlash(false),500/(skip?8:1));Wd.arena.cheer(7);for(const c of[0xffffff,0xff3df0,0x39d6ff,0xffd45a])burst(rimV.clone(),c,160,6,W,.3);ring(toFore(rimV),0xffffff)};
 await dunkSeq(pl,ball,Wd,fx);
 /* 4) la carta del ícono aparece (sale del aro) */
 sb.classList.remove('on');setTimeout(()=>{sb.innerHTML=''},400);
 const m=await mkCard(p,col),from=toFore(rimV);m.position.copy(from);m.scale.setScalar(.05);G.add(m);
 const rays=spr(raysT,col,22,.9);rays.position.set(0,.2,-1.5);G.add(rays);ticks.push(dt=>{if(!rays.parent)return false;rays.material.rotation+=dt*.5;return true});
 const rays2=spr(raysT,0xfff1c4,15,.55);rays2.position.set(0,.2,-1.4);G.add(rays2);ticks.push(dt=>{if(!rays2.parent)return false;rays2.material.rotation-=dt*.32;return true});
 const dust=mkDust(G),cone=mkCone(G);
 ring(V(0,.2,.5),col);await showCard(m,from,2);
 let pu=0;ticks.push(dt=>{if(!m.parent)return false;pu+=dt;m.userData.gl.material.opacity=.6+.3*Math.sin(pu*4);return true});
 cl.style.color='#ffd27a';clue('ÍCONO');tw(1500,t=>cl.style.opacity=1-t,E.in).then(()=>{clue('');cl.style.opacity=1});
 info(p);holo(m);await tap('Tocá para continuar');info(null);G.remove(rays,rays2,dust,cone);
 const q=m.position.clone();await tw(450,t=>{m.position.y=q.y-4*t;m.scale.setScalar(1-.5*t)},E.in);G.remove(m);
 flash('#000',1);{const mp=Wd&&Wd.def.model;bgFree();if(mp&&mp!==ALLSTAR.model)freeCourtModel(mp)}dark(0);if(more)await bgOn();else bgOff()}

async function run(pk,cards){
 skip=false;G=new THREE.Group();S.add(G);dark(0);clue('');info(null);
 $('#dots').innerHTML=cards.map(()=>'<i></i>').join('');
 cards.forEach(c=>{if(c.o>=WALK||isIc(c)){const m=courtFor(c.t).model;m&&warmCourt(m).catch(()=>{})}});warmBall().catch(()=>{});   /* las canchas 3D de los walkouts se bajan mientras se abre el sobre */
 const[pack]=await Promise.all([mkPack(pk),bgOn()]);G.add(pack.g);pack.g.position.y=5;
 await tw(1000,t=>{pack.g.position.y=5*(1-E.bnc(t));pack.g.rotation.y=(1-E.out(t))*Math.PI*2});
 let t0=0;ticks.push(dt=>{if(!pack.idle)return false;t0+=dt;pack.g.rotation.y=Math.sin(t0*1.4)*.35+mx*.4;pack.g.rotation.x=my*.15;pack.g.position.y=Math.sin(t0*2)*.08;return true});
 await tap('Tocá el sobre para abrirlo');pack.idle=false;
 const hasIc=cards.some(isIc),pc=hasIc?ICON_GOLD:pk.col;if(hasIc){pack.gl.material.color.setHex(pc);tw(1000,t=>dark(.6*t),E.lin)}   /* el sobre "avisa": luz dorada y a oscuras */
 await tw(1000,t=>{pack.g.position.x=(Math.random()-.5)*.2*t;pack.g.rotation.z=(Math.random()-.5)*.25*t;pack.g.rotation.y*=.9;pack.gl.material.opacity=t;pack.charge(t)},E.lin);
 pack.g.position.x=0;pack.g.rotation.set(0,0,0);pack.g.scale.setScalar(1);flash(hasIc?'#ffe39a':'#ffffff',.95);shake=.2;burst(new THREE.Vector3(0,.5,.5),pc,hasIc?320:200);
 const rays=spr(raysT,pc,hasIc?16:12,.8);rays.position.z=-.3;G.add(rays);
 await tw(700,t=>{pack.open(t);pack.gl.material.opacity=1-t;rays.material.opacity=.8*(1-t);rays.material.rotation=t},E.out);
 pack.live=false;G.remove(pack.g,rays);if(hasIc)dark(0);
 for(let i=0;i<cards.length;i++){$('#dots').children[i].classList.add('d1');await(isIc(cards[i])?iconWalkout:cards[i].o>=WALK?walkout:reveal)(cards[i],i<cards.length-1)}
 S.remove(G)}

let ready=false;
/** Muestra la apertura completa. Resuelve cuando termina (o se saltea). */
export async function playPack(pk, cards){
  if(!ready){init3();ready=true}
  stageEl.hidden=false;on=true;last=performance.now();rsFn&&rsFn();raf=requestAnimationFrame(loop);
  try{await run(pk,cards)}
  finally{on=false;cancelAnimationFrame(raf);stageEl.hidden=true;bgOff();freeCourtModels();tws=[];ticks=[];R&&R.clear()}
}
