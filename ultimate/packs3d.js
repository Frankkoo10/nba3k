import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/environments/RoomEnvironment.js';
import { cardUrl } from './cardzip.js';
import { TEAMS } from '../teams.js';
import { createCourtWorld, HOOP_Z } from './court3d.js';

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
stageEl.innerHTML = '<canvas id="cv"></canvas><div id="flash"></div><div class="ov" id="dots"></div><div class="ov d" id="clue"></div><div class="ov" id="info"></div><div class="ov" id="hint"></div><button type="button" id="skip">Saltear</button>';
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
const frontTex=p=>texCache[p.id]||(texCache[p.id]=new Promise(res=>{const im=new Image();im.onload=()=>res(cnv(324,464,(x)=>{shield(x,324,464);x.clip();x.drawImage(im,0,0)}));im.src=cardUrl(p.id)}));
const backTex=col=>cnv(216,309,(x,w,h)=>{shield(x,w,h);x.clip();const g=x.createLinearGradient(0,0,w,h);g.addColorStop(0,'#1b2140');g.addColorStop(1,'#07080f');x.fillStyle=g;x.fillRect(0,0,w,h);x.strokeStyle='#'+col.toString(16).padStart(6,'0');x.lineWidth=3;x.beginPath();x.arc(w/2,h/2,52,0,7);x.moveTo(w/2-52,h/2);x.lineTo(w/2+52,h/2);x.moveTo(w/2,h/2-52);x.lineTo(w/2,h/2+52);x.stroke();x.lineWidth=8;shield(x,w,h);x.stroke()});
async function mkCard(p,col){const g=new THREE.Group(),geo=new THREE.PlaneGeometry(1.4,2),mat=m=>new THREE.MeshBasicMaterial({map:m,transparent:true,toneMapped:false});
 const f=new THREE.Mesh(geo,mat(await frontTex(p))),b=new THREE.Mesh(geo,mat(backTex(col)));b.rotation.y=Math.PI;const gl=spr(glowT,col,4.6,.7);gl.position.z=-.1;g.add(gl,f,b);g.userData.gl=gl;return g}
const tier=o=>o>=LEGEND?0xb86bff:o>=WALK?0xffd45a:o>=80?0x9ecbff:0xd9a066;
function mkPackFlat(pk){const tex=cnv(256,380,(x,w,h)=>{const g=x.createLinearGradient(0,0,w,h);g.addColorStop(0,pk.a);g.addColorStop(.8,pk.b);x.fillStyle=g;x.fillRect(0,0,w,h);x.fillStyle='#ffffff18';for(let i=-h;i<w;i+=26)x.fillRect(i,0,10,h*2),x.setTransform(1,0,-.4,1,0,0);x.setTransform(1,0,0,1,0,0);
  x.fillStyle='#0004';for(let i=0;i<w;i+=8){x.fillRect(i,0,4,h*.05);x.fillRect(i,h*.95,4,h*.05)}x.fillStyle='#ff6a1a';x.beginPath();x.arc(w/2,h*.4,48,0,7);x.fill();x.strokeStyle='#1a0c04';x.lineWidth=5;x.stroke();x.beginPath();x.moveTo(w/2-48,h*.4);x.lineTo(w/2+48,h*.4);x.moveTo(w/2,h*.4-48);x.lineTo(w/2,h*.4+48);x.stroke();
  x.fillStyle='#fff';x.textAlign='center';x.font='900 46px Impact,sans-serif';x.fillText(pk.name.toUpperCase(),w/2,h*.72);x.font='600 20px sans-serif';x.fillText('ULTIMATE TEAM · '+pk.n+' CARTAS',w/2,h*.8)});
 const mk=(h,y,ro,rr)=>{const t=tex.clone();t.needsUpdate=true;t.offset.y=ro;t.repeat.y=rr;const m=new THREE.Mesh(new THREE.BoxGeometry(1.5,h,.14),new THREE.MeshBasicMaterial({map:t,transparent:true,toneMapped:false}));m.position.y=y;return m};
 const g=new THREE.Group(),body=mk(1.936,-.132,0,.88),top=mk(.264,.968,.88,.12),gl=spr(glowT,pk.col,6,0);gl.position.z=-.2;g.add(gl,body,top);return{g,body,top,gl,idle:true,charge:()=>{},open:t=>{top.position.set(1.4*t,.968+2.6*t,0);top.rotation.z=-1.3*t;body.position.y=-.132-4*t*t}}}
/* ---- sobre 3D (GLB) ---- */
const PCUT=.9; /* altura (en el modelo) donde se rasga el sobre, debajo del sellado de arriba */
const PKS={};
export const warmPack=k=>PKS[k]||(PKS[k]=new GLTFLoader().loadAsync(packGlb(k)).then(g=>g.scene));
function partOf(src,plane){const root=src.clone(true),mats=[],an=R.capabilities.getMaxAnisotropy();root.traverse(o=>{if(o.isMesh){const m=o.material.clone();[m.map,m.normalMap,m.metalnessMap].forEach(t=>t&&(t.anisotropy=an));m.envMap=ENV;m.envMapIntensity=1.15;m.emissiveMap=m.map;m.emissive=new THREE.Color(0xffffff);m.emissiveIntensity=.35;m.clippingPlanes=[new THREE.Plane()];o.material=m;mats.push(m)}});
 return{root,sync(){root.updateWorldMatrix(true,true);mats.forEach(m=>m.clippingPlanes[0].copy(plane).applyMatrix4(root.matrixWorld))}}}
async function mkPack(pk){let src;try{src=await warmPack(pk.kind)}catch(e){console.warn('GLB del sobre no cargó, uso el sobre plano',e);delete PKS[pk.kind];return mkPackFlat(pk)}
 const g=new THREE.Group(),body=new THREE.Group(),top=new THREE.Group(),gl=spr(glowT,pk.col,6,0),seam=spr(glowT,pk.col,1,0);gl.position.z=-.3;seam.scale.set(3.2,.8,1);seam.position.set(0,PCUT,.25);
 const pb=partOf(src,new THREE.Plane(new THREE.Vector3(0,-1,0),PCUT)),pt=partOf(src,new THREE.Plane(new THREE.Vector3(0,1,0),-PCUT));
 body.add(pb.root);top.position.y=PCUT;pt.root.position.y=-PCUT;top.add(pt.root);g.add(gl,body,top,seam);
 const o={g,body,top,gl,idle:true,live:true,charge:t=>{seam.material.opacity=.75*t;g.scale.setScalar(1+.05*t)},
  open:t=>{top.position.set(1.5*t,PCUT+2.6*t,.4*t);top.rotation.set(-.5*t,.3*t,-1.2*t);body.position.y=-4*t*t;body.rotation.z=.12*t;seam.material.opacity=.75*(1-t)}};
 ticks.push(()=>{if(!o.live)return false;pb.sync();pt.sync();return true});return o}
function mkBall(r=.36){const t=cnv(256,128,(x,w,h)=>{x.fillStyle='#e8631a';x.fillRect(0,0,w,h);x.strokeStyle='#1a0c04';x.lineWidth=4;x.beginPath();x.moveTo(0,h/2);x.lineTo(w,h/2);for(const px of[0,w/2,w]){x.moveTo(px,0);x.lineTo(px,h)}x.moveTo(w/4,0);x.quadraticCurveTo(w/4+18,h/2,w/4,h);x.moveTo(w*.75,0);x.quadraticCurveTo(w*.75-18,h/2,w*.75,h);x.stroke()});
 return new THREE.Mesh(new THREE.SphereGeometry(r,28,20),new THREE.MeshStandardMaterial({map:t,roughness:.5}))}
/* ---------- secuencia ---------- */
const info=(p)=>{$('#info').innerHTML=p?`<b>${p.o}</b>${p.pos?p.pos+' · ':''}${p.n} · ${p.t}`:''};
const clue=(s)=>{const c=$('#clue');c.classList.remove('pop');void c.offsetWidth;c.textContent=s;if(s)c.classList.add('pop')};
function showCard(m,from,spins){const f=from.clone();return tw(1100,t=>{m.position.lerpVectors(f,new THREE.Vector3(0,.1,1.2),t);m.scale.setScalar(.15+.85*t);m.rotation.y=Math.PI*(1-t)+Math.PI*2*spins*(1-t)},E.out)}
function holo(m){ticks.push(()=>{if(!m.parent)return false;m.rotation.y+=(mx*.7-m.rotation.y)*.1;m.rotation.x+=(my*.5-m.rotation.x)*.1;return true})}
async function reveal(p){const col=tier(p.o),m=await mkCard(p,col);m.position.set(0,.2,-3);m.scale.setScalar(.15);m.rotation.y=Math.PI;G.add(m);
 flash('#'+col.toString(16).padStart(6,'0'),.5);burst(new THREE.Vector3(0,.2,.5),col,p.o>=80?220:90);
 await showCard(m,new THREE.Vector3(0,.2,-3),1);info(p);holo(m);await tap('Tocá para continuar');info(null);
 const q=m.position.clone();await tw(450,t=>{m.position.y=q.y-4*t;m.scale.setScalar(1-.5*t)},E.in);G.remove(m)}
/* ---- walkout con la cancha real del equipo de fondo ---- */
function mkBeams(c){const g=new THREE.Group();for(let i=0;i<5;i++){const ge=new THREE.CylinderGeometry(.12,2.6,28,20,1,true);ge.translate(0,-14,0);const m=new THREE.Mesh(ge,new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:.12,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));m.position.set(-8+i*4,28,-6);g.add(m)}
 let tt=0;ticks.push(dt=>{if(!g.parent)return false;tt+=dt;g.children.forEach((m,i)=>{m.rotation.z=Math.sin(tt*1.3+i*1.2)*.4;m.rotation.x=Math.cos(tt+i)*.2});return true});return g}
function mkCrowd(){const g=new THREE.Group(),s=[];for(let i=0;i<90;i++){const a=Math.random()*6.28,q=spr(glowT,0xffffff,1.1,0);q.position.set(Math.cos(a)*(16+Math.random()*8),4+Math.random()*9,Math.sin(a)*(24+Math.random()*7));g.add(q);s.push(q)}
 ticks.push(dt=>{if(!g.parent)return false;s.forEach(q=>{q.material.opacity=Math.random()>.975?1:Math.max(0,q.material.opacity-dt*5)});return true});return g}
function toFore(v){const q=v.clone();CW.updateMatrixWorld();q.project(CW);const z=C.aspect<.8?9.5:6.2,hh=Math.tan(C.fov*Math.PI/360)*(z-1.2);return new THREE.Vector3(q.x*hh*C.aspect,q.y*hh,1.2)}
async function walkout(p){const col=tier(p.o),leg=p.o>=LEGEND,tc=tcol(p.t),tcn=new THREE.Color(tc).getHex(),cl=$('#clue');
 Wd=createCourtWorld(p.t);W=Wd.scene;const hoop=Wd.hoop,rimV=hoop.rim,V=(x,y,z)=>new THREE.Vector3(x,y,z);
 CW=new THREE.PerspectiveCamera(50,C.aspect,.1,300);CW.position.set(0,1.8,-3);CW.lookAt(0,2.6,-HOOP_Z);
 const ball=mkBall(.12);ball.position.set(.25,.12,-4.6);W.add(ball);const beams=mkBeams(tcn),crowd=mkCrowd();W.add(beams,crowd);
 Wd.setDim(1);S.background=null;floor.visible=false;wmode=true;flash('#000',1);
 await tw(900,t=>Wd.setDim(1-.25*t));
 tw(3000,t=>{CW.position.z=-3-.6*t;CW.lookAt(0,2.6,-HOOP_Z)},E.lin);
 for(const[s,c]of[[p.t,tc],[p.pos,'#fff'],[Math.floor(p.o/10)+'?','#ffd45a']]){if(!s)continue;cl.style.color=c;clue(s);shake=.05;await wait(950)}clue('');
 /* pique, pique, pique */
 const dr=tw(1500,t=>{ball.position.set(.25,.12+Math.abs(Math.sin(t*Math.PI*3))*(1.1-.2*t),-4.6);ball.rotation.x=-t*8},E.lin);
 [500,1000,1480].forEach(m=>setTimeout(()=>{shake=.1},m/(skip?8:1)));await dr;
 await tw(260,t=>{ball.position.y=.12+1.6*t},E.out);
 /* tiro en cámara lenta: la cámara sigue la pelota y se acerca al aro */
 const A=ball.position.clone(),B=rimV.clone().add(V(0,.5,0)),c0=CW.position.clone(),c1=V(0,3.1,-9),slow=t=>t<.7?t/.7*.85:.85+.15*((t-.7)/.3);
 await tw(2300,t=>{ball.position.lerpVectors(A,B,t);ball.position.y+=3.2*Math.sin(Math.PI*t);ball.rotation.x=-t*10;CW.position.lerpVectors(c0,c1,t);CW.fov=50-22*t;CW.updateProjectionMatrix();CW.lookAt(ball.position.clone().lerp(rimV,t*t))},slow);
 await tw(260,t=>{ball.position.y=B.y-1.05*t},E.in);
 /* swish: se prende el estadio, salta el público, parpadea el marco LED del tablero */
 shake=.4;flash('#ffffff',.9);Wd.ledFlash(true);setTimeout(()=>Wd.ledFlash(false),500/(skip?8:1));Wd.arena.cheer(7);
 tw(600,t=>hoop.net.scale.set(1+.25*(1-t),1-.35*(1-t),1+.25*(1-t)),E.out);tw(700,t=>Wd.setDim(.75*(1-t)),E.out);
 const f0=CW.fov,p0=CW.position.clone();tw(1800,t=>{CW.position.lerpVectors(p0,V(0,3.2,-4.8),t);CW.fov=f0+(46-f0)*t;CW.updateProjectionMatrix();CW.lookAt(0,3.2,-HOOP_Z+3)});
 const fp=toFore(rimV);ring(fp,tcn);burst(fp,0xffffff,120,6);
 if(leg){hoop.glass.visible=false;burst(hoop.board,0xcfe8ff,320,5,W,.35)}
 (async()=>{await tw(350,t=>{ball.position.y=2.5-2.38*t},E.in);await tw(1100,t=>ball.position.set(.1+t*2,.12+Math.abs(Math.sin(t*Math.PI*3))*1.2*(1-t),-12.6+t*5),E.lin)})();
 await wait(600);
 /* sube la media */
 cl.style.color=leg?'#ff7ad9':'#ffd45a';await tw(1200,t=>{cl.classList.remove('pop');cl.textContent=Math.round(55+(p.o-55)*t)},E.out);clue(p.o);shake=.3;flash(leg?'#ff5ac8':'#ffd45a',.8);
 for(const c of leg?[0xff5ac8,0x5ae0ff,0xffd45a]:[col,0xffffff])burst(V(0,.4,.5),c,220,8);await wait(700);clue('');
 /* la carta sale del aro */
 const m=await mkCard(p,col),from=toFore(rimV);m.position.copy(from);m.scale.setScalar(.05);G.add(m);
 const rays=spr(raysT,col,16,.9);rays.position.set(0,.2,-1.5);G.add(rays);ticks.push(dt=>{if(!rays.parent)return false;rays.material.rotation+=dt*.5;return true});
 ring(V(0,.2,.5),col);await showCard(m,from,2);
 let pu=0;ticks.push(dt=>{if(!m.parent)return false;pu+=dt;m.userData.gl.material.opacity=.6+.3*Math.sin(pu*4);return true});
 cl.style.color='#fff';clue(leg?'LEYENDA':'WALKOUT');tw(1500,t=>cl.style.opacity=1-t,E.in).then(()=>{clue('');cl.style.opacity=1});
 info(p);holo(m);await tap('Tocá para continuar');info(null);G.remove(rays);
 const q=m.position.clone();await tw(450,t=>{m.position.y=q.y-4*t;m.scale.setScalar(1-.5*t)},E.in);G.remove(m);
 flash('#000',1);wmode=false;Wd.dispose();Wd=null;W=null;CW=null;S.background=new THREE.Color(0x0a0f1d);floor.visible=true;dark(0)}
async function run(pk,cards){
 skip=false;G=new THREE.Group();S.add(G);dark(0);clue('');info(null);
 $('#dots').innerHTML=cards.map(()=>'<i></i>').join('');
 const pack=await mkPack(pk);G.add(pack.g);pack.g.position.y=5;
 await tw(1000,t=>{pack.g.position.y=5*(1-E.bnc(t));pack.g.rotation.y=(1-E.out(t))*Math.PI*2});
 let t0=0;ticks.push(dt=>{if(!pack.idle)return false;t0+=dt;pack.g.rotation.y=Math.sin(t0*1.4)*.35+mx*.4;pack.g.rotation.x=my*.15;pack.g.position.y=Math.sin(t0*2)*.08;return true});
 await tap('Tocá el sobre para abrirlo');pack.idle=false;
 await tw(1000,t=>{pack.g.position.x=(Math.random()-.5)*.2*t;pack.g.rotation.z=(Math.random()-.5)*.25*t;pack.g.rotation.y*=.9;pack.gl.material.opacity=t;pack.charge(t)},E.lin);
 pack.g.position.x=0;pack.g.rotation.set(0,0,0);pack.g.scale.setScalar(1);flash('#ffffff',.95);shake=.2;burst(new THREE.Vector3(0,.5,.5),pk.col,200);
 const rays=spr(raysT,pk.col,12,.8);rays.position.z=-.3;G.add(rays);
 await tw(700,t=>{pack.open(t);pack.gl.material.opacity=1-t;rays.material.opacity=.8*(1-t);rays.material.rotation=t},E.out);
 pack.live=false;G.remove(pack.g,rays);
 for(let i=0;i<cards.length;i++){$('#dots').children[i].classList.add('d1');await(cards[i].o>=WALK?walkout:reveal)(cards[i])}
 S.remove(G)}

let ready=false;
/** Muestra la apertura completa. Resuelve cuando termina (o se saltea). */
export async function playPack(pk, cards){
  if(!ready){init3();ready=true}
  stageEl.hidden=false;on=true;last=performance.now();rsFn&&rsFn();raf=requestAnimationFrame(loop);
  try{await run(pk,cards)}
  finally{on=false;cancelAnimationFrame(raf);stageEl.hidden=true;wmode=false;if(Wd){try{Wd.dispose()}catch(e){}Wd=null}W=null;CW=null;if(S){S.background=new THREE.Color(0x0a0f1d);}if(floor)floor.visible=true;tws=[];ticks=[];R&&R.clear()}
}
