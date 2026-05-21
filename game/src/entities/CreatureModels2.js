/**
 * CreatureModels2.js — ★★2등급 26종 상세 Three.js 모델
 * cm2_ 접두사 빌더 + DETAILED_SHAPE_MAP2
 */
import * as THREE from 'three';

const lm  = (c, o={}) => new THREE.MeshLambertMaterial({ color:c, flatShading:true,  ...o });
const lms = (c, o={}) => new THREE.MeshLambertMaterial({ color:c, flatShading:false, ...o });
const bm  = (c, o={}) => new THREE.MeshBasicMaterial({ color:c, ...o });

function canvasTex(w, h, fn) {
  const cv = document.createElement('canvas');
  cv.width=w; cv.height=h;
  fn(cv.getContext('2d'), w, h);
  return new THREE.CanvasTexture(cv);
}
const hx = c => '#'+(c>>>0).toString(16).padStart(6,'0');

export const DETAILED_BUILDERS2 = {

  // ══════════════════════════════════════════════════════
  // ── 물고기 그룹 ────────────────────────────────────────
  // ══════════════════════════════════════════════════════

  // 붕어 (crucian) — 납작한 타원 + 선명한 비늘
  cm2_crucian(color) {
    const g=new THREE.Group(), p={};
    const dark=new THREE.Color(color).multiplyScalar(0.55).getHex();
    const scaleTex=canvasTex(64,64,(ctx,w,h)=>{
      ctx.fillStyle=hx(color); ctx.fillRect(0,0,w,h);
      ctx.strokeStyle='rgba(0,0,0,0.20)'; ctx.lineWidth=1;
      for(let r=6;r<h;r+=7){ctx.beginPath();ctx.moveTo(0,r);ctx.lineTo(w,r);ctx.stroke();}
      for(let c2=8;c2<w;c2+=10){ctx.beginPath();ctx.moveTo(c2,0);ctx.lineTo(c2,h);ctx.stroke();}
      const g2=ctx.createRadialGradient(w*0.35,h*0.4,2,w*0.5,h*0.5,w*0.5);
      g2.addColorStop(0,'rgba(255,255,255,0.22)'); g2.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g2; ctx.fillRect(0,0,w,h);
    });
    const body=new THREE.Mesh(new THREE.SphereGeometry(0.20,10,8),
      lms(0xffffff,{map:scaleTex}));
    body.scale.set(0.62,0.72,1.55); g.add(body); p.body=body;
    // 흰 배
    const belly=new THREE.Mesh(new THREE.SphereGeometry(0.16,8,6),lm(0xf5eecc));
    belly.scale.set(0.50,0.38,1.45); belly.position.y=-0.06; g.add(belly);
    // 꼬리
    for(const[y,rx] of [[0.10,-0.4],[-0.07,0.4]]){
      const t=new THREE.Mesh(new THREE.ConeGeometry(0.09,0.22,4),lm(dark));
      t.rotation.x=Math.PI/2+rx; t.position.set(0,y,0.38); g.add(t);
    }
    // 등지느러미
    const dor=new THREE.Mesh(new THREE.PlaneGeometry(0.26,0.12),
      lms(color,{transparent:true,opacity:0.7,side:THREE.DoubleSide}));
    dor.position.set(0,0.19,0.05); g.add(dor);
    // 가슴지느러미
    for(const s of[-1,1]){
      const pec=new THREE.Mesh(new THREE.PlaneGeometry(0.10,0.07),
        lms(dark,{transparent:true,opacity:0.65,side:THREE.DoubleSide}));
      pec.position.set(s*0.145,-0.02,-0.05); pec.rotation.y=s*0.5; g.add(pec);
    }
    // 눈
    const eye=new THREE.Mesh(new THREE.SphereGeometry(0.032,6,6),lm(0x111111));
    eye.position.set(0.155,0.02,-0.26); g.add(eye);
    const sh=new THREE.Mesh(new THREE.SphereGeometry(0.010,4,4),bm(0xffffff));
    sh.position.set(0.165,0.028,-0.275); g.add(sh);
    g.userData.parts=p; return g;
  },

  // 미꾸라지 (loach) — 길고 가느다란 + 수염 6개
  cm2_loach(color) {
    const g=new THREE.Group(), p={}, dark=new THREE.Color(color).multiplyScalar(0.48).getHex();
    const segs=[];
    for(let i=0;i<9;i++){
      const t=i/8, r=0.055-t*0.022;
      const s=new THREE.Mesh(new THREE.SphereGeometry(r,6,5),lm(i%2===0?color:dark));
      s.scale.set(0.72,0.88,1.0);
      s.position.set(Math.sin(t*Math.PI*1.8)*0.038,0.03,i*0.105-0.42);
      g.add(s); segs.push(s);
    }
    p.segments=segs;
    // 꼬리지느러미
    const tail=new THREE.Mesh(new THREE.PlaneGeometry(0.12,0.09),
      lms(dark,{transparent:true,opacity:0.7,side:THREE.DoubleSide}));
    tail.position.set(0,0.03,0.56); tail.rotation.x=0.2; g.add(tail);
    // 수염 (barbels) 6개
    const BPOS=[[-0.02,0.02,-0.48],[0.02,0.02,-0.48],[-0.03,0,-0.46],[0.03,0,-0.46],
                [-0.018,-0.015,-0.44],[0.018,-0.015,-0.44]];
    for(const[bx,by,bz] of BPOS){
      const b=new THREE.Mesh(new THREE.CylinderGeometry(0.004,0.003,0.07,4),lm(dark));
      b.position.set(bx,by,bz); b.rotation.x=0.4; b.rotation.z=bx<0?-0.3:0.3;
      g.add(b);
    }
    for(const s of[-1,1]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.018,5,5),lm(0x111111));
      eye.position.set(s*0.044,0.04,-0.455); g.add(eye);
    }
    g.userData.parts=p; return g;
  },

  // 메기 (catfish) — 납작 넓은 머리 + 긴 수염
  cm2_catfish(color) {
    const g=new THREE.Group(), p={}, dark=new THREE.Color(color).multiplyScalar(0.45).getHex();
    // 넓적한 몸통
    const body=new THREE.Mesh(new THREE.SphereGeometry(0.18,9,7),lm(color));
    body.scale.set(0.78,0.52,1.65); g.add(body); p.body=body;
    // 납작한 넓은 머리
    const head=new THREE.Mesh(new THREE.BoxGeometry(0.38,0.14,0.28),lm(dark));
    head.position.set(0,0.04,-0.34); g.add(head); p.head=head;
    // ★ 긴 수염 4개
    for(const[s,z,rx] of [[-0.12,0,0.12],[0.12,0,0.12],[-0.06,0,-0.05],[0.06,0,-0.05]]){
      const len=Math.abs(s)>0.08?0.32:0.20;
      const b=new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.003,len,4),lm(dark));
      b.position.set(s,0.04+z,-0.44); b.rotation.x=rx; b.rotation.z=s<0?-0.25:0.25;
      g.add(b);
    }
    // 눈 (납작한 머리 위쪽)
    for(const s of[-1,1]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.024,5,5),lm(0x111111));
      eye.position.set(s*0.105,0.095,-0.36); g.add(eye);
    }
    // 꼬리 (포크형)
    for(const[y,rx] of [[0.08,-0.5],[-0.06,0.5]]){
      const t=new THREE.Mesh(new THREE.ConeGeometry(0.07,0.20,4),lm(dark));
      t.rotation.x=Math.PI/2+rx; t.position.set(0,y,0.42); g.add(t);
    }
    // 등지느러미
    const dor=new THREE.Mesh(new THREE.ConeGeometry(0.04,0.14,3),lm(dark));
    dor.position.set(0,0.17,0.0); g.add(dor);
    g.userData.parts=p; return g;
  },

  // 복어 (puffer) — 팽창한 구형 몸통 + 가시
  cm2_puffer(color) {
    const g=new THREE.Group(), p={}, dark=new THREE.Color(color).multiplyScalar(0.48).getHex();
    const SPOT=0x223300;
    // 둥근 몸통
    const body=new THREE.Mesh(new THREE.SphereGeometry(0.22,10,9),lm(color));
    body.scale.set(1.05,0.92,1.10); g.add(body); p.body=body;
    // 흰 배
    const belly=new THREE.Mesh(new THREE.SphereGeometry(0.19,9,7),lm(0xf8f8ee));
    belly.scale.set(0.82,0.55,0.95); belly.position.set(0,-0.06,0); g.add(belly);
    // ★ 가시 (등 + 옆)
    const SPIKES=[
      [0,0.24,0],[0,0.20,0.12],[0,0.20,-0.12],
      [0.19,0.12,0.06],[-0.19,0.12,0.06],
      [0.18,0.12,-0.06],[-0.18,0.12,-0.06],
      [0.16,0.05,0.14],[-0.16,0.05,0.14],
    ];
    for(const[sx,sy,sz] of SPIKES){
      const sp=new THREE.Mesh(new THREE.ConeGeometry(0.012,0.065,4),lm(dark));
      sp.position.set(sx,sy,sz);
      const dir=new THREE.Vector3(sx,sy,sz).normalize();
      sp.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);
      g.add(sp);
    }
    // 점박이 무늬
    for(const[sx,sy,sz] of [[0.14,0.10,0.10],[-0.14,0.10,0.10],[0,0.14,-0.08],
                             [0.18,0.03,-0.05],[-0.18,0.03,-0.05]]){
      const spot=new THREE.Mesh(new THREE.SphereGeometry(0.030,5,4),lm(SPOT));
      spot.scale.set(1,0.28,1); spot.position.set(sx,sy,sz); g.add(spot);
    }
    // 눈
    for(const s of[-1,1]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.036,6,6),lm(0x111111));
      eye.position.set(s*0.165,0.06,-0.16); g.add(eye);
      const sh=new THREE.Mesh(new THREE.SphereGeometry(0.012,4,4),bm(0xffffff));
      sh.position.set(s*0.172,0.068,-0.192); g.add(sh);
    }
    // 입 (삐죽)
    const mouth=new THREE.Mesh(new THREE.SphereGeometry(0.04,6,5),lm(0xddbb88));
    mouth.scale.set(0.7,0.55,0.8); mouth.position.set(0,0.0,-0.225); g.add(mouth);
    // 작은 지느러미
    for(const s of[-1,1]){
      const fin=new THREE.Mesh(new THREE.PlaneGeometry(0.10,0.065),
        lms(color,{transparent:true,opacity:0.6,side:THREE.DoubleSide}));
      fin.position.set(s*0.225,0.0,0.04); fin.rotation.y=s*0.4; g.add(fin);
    }
    g.userData.parts=p; return g;
  },

  // 가오리 (ray) — 납작 마름모 + 긴 채찍 꼬리
  cm2_ray(color) {
    const g=new THREE.Group(), p={}, dark=new THREE.Color(color).multiplyScalar(0.45).getHex();
    // 납작한 마름모형 몸통
    const body=new THREE.Mesh(new THREE.SphereGeometry(0.24,10,6),lm(color));
    body.scale.set(1.75,0.12,1.25); g.add(body); p.body=body;
    // 날개 끝 (점점 가늘어짐)
    for(const s of[-1,1]){
      const tip=new THREE.Mesh(new THREE.ConeGeometry(0.06,0.18,4),lm(dark));
      tip.position.set(s*0.43,0,0); tip.rotation.z=s*Math.PI/2; g.add(tip);
    }
    // 앞 끝
    const front=new THREE.Mesh(new THREE.ConeGeometry(0.05,0.16,4),lm(dark));
    front.rotation.x=-Math.PI/2; front.position.set(0,0,-0.32); g.add(front);
    // ★ 채찍 꼬리
    for(let i=0;i<7;i++){
      const t=i/6, r=0.025-t*0.016;
      const ts=new THREE.Mesh(new THREE.SphereGeometry(Math.max(r,0.006),5,4),lm(dark));
      ts.scale.set(0.75,0.55,1.0);
      ts.position.set(0,0,0.30+i*0.13);
      g.add(ts);
    }
    // 눈 + 아가미 (등면)
    for(const s of[-1,1]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.018,5,5),lm(0x111111));
      eye.position.set(s*0.06,0.015,-0.10); g.add(eye);
    }
    // 배면 입
    const mouth=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.020,0.055),lm(0x664433));
    mouth.position.set(0,-0.015,-0.18); g.add(mouth);
    g.userData.parts=p; return g;
  },

  // 고래 (whale) — 거대 유선형 + 등지느러미 + 꼬리 수평 플루크
  cm2_whale(color) {
    const g=new THREE.Group(), p={}, dark=new THREE.Color(color).multiplyScalar(0.45).getHex();
    // 거대한 몸통
    const body=new THREE.Mesh(new THREE.SphereGeometry(0.28,10,8),lm(color));
    body.scale.set(0.72,0.68,2.80); g.add(body); p.body=body;
    // 흰 배
    const belly=new THREE.Mesh(new THREE.SphereGeometry(0.24,9,7),lm(0xeeeedd));
    belly.scale.set(0.52,0.35,2.40); belly.position.set(0,-0.075,0); g.add(belly);
    // ★ 삼각 등지느러미
    const dor=new THREE.Mesh(new THREE.ConeGeometry(0.08,0.30,3),lm(dark));
    dor.position.set(0,0.248,0.15); g.add(dor);
    // 가슴지느러미 (길고 납작)
    for(const s of[-1,1]){
      const pec=new THREE.Mesh(new THREE.SphereGeometry(0.10,7,5),lm(dark));
      pec.scale.set(0.35,0.22,1.55);
      pec.position.set(s*0.295,-0.045,-0.15);
      pec.rotation.z=s*0.28; g.add(pec);
    }
    // ★ 꼬리 플루크 (수평 — 고래 핵심)
    for(const s of[-1,1]){
      const fluke=new THREE.Mesh(new THREE.SphereGeometry(0.12,7,5),lm(dark));
      fluke.scale.set(1.0,0.18,0.65);
      fluke.position.set(s*0.135,-0.02,0.82);
      fluke.rotation.z=s*0.22; g.add(fluke);
    }
    // 눈
    const eye=new THREE.Mesh(new THREE.SphereGeometry(0.028,6,6),lm(0x111111));
    eye.position.set(0.245,0.04,-0.58); g.add(eye);
    // 입선 (수염고래)
    const jaw=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.015,0.45),lm(0x446655));
    jaw.position.set(0.18,-0.058,-0.38); g.add(jaw);
    // 분수공
    const blowhole=new THREE.Mesh(new THREE.SphereGeometry(0.022,5,5),lm(0x334455));
    blowhole.position.set(0.05,0.195,-0.55); g.add(blowhole);
    g.userData.parts=p; return g;
  },

  // ══════════════════════════════════════════════════════
  // ── 바다/연못 생물 ─────────────────────────────────────
  // ══════════════════════════════════════════════════════

  // 자라 (soft_turtle) — 납작 타원 등딱지 + 긴 목
  cm2_soft_turtle(color) {
    const g=new THREE.Group(), p={}, dark=new THREE.Color(color).multiplyScalar(0.45).getHex();
    const SHELL=0x557744;
    // 납작한 타원 등딱지 (자라는 뾰족함)
    const shell=new THREE.Mesh(new THREE.SphereGeometry(0.20,10,8),lm(SHELL));
    shell.scale.set(1.15,0.35,1.40); shell.position.y=0.08; g.add(shell); p.shell=shell;
    // 부드러운 테두리 (피부성 가장자리)
    const rim=new THREE.Mesh(new THREE.TorusGeometry(0.215,0.025,4,14),lm(dark));
    rim.scale.set(1.12,0.22,1.38); rim.position.y=0.065; g.add(rim);
    // ★ 긴 목 (자라 특징)
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.040,0.058,0.22,6),lm(dark));
    neck.position.set(0,0.10,-0.24); neck.rotation.x=0.55; g.add(neck); p.neck=neck;
    // 뾰족한 머리
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.068,8,7),lm(dark));
    head.scale.set(0.85,0.72,1.15); head.position.set(0,0.14,-0.42); g.add(head);
    // 뾰족 주둥이
    const snout=new THREE.Mesh(new THREE.ConeGeometry(0.018,0.065,5),lm(dark));
    snout.rotation.x=-Math.PI/2; snout.position.set(0,0.12,-0.505); g.add(snout);
    for(const s of[-1,1]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.015,5,5),lm(0x111111));
      eye.position.set(s*0.038,0.158,-0.462); g.add(eye);
    }
    // 납작 지느러미발 4개
    for(const[sx,sy,sz,rz] of [[-0.22,0.02,-0.06,-1.1],[0.22,0.02,-0.06,1.1],
                                 [-0.20,0.02,0.12,-1.0],[0.20,0.02,0.12,1.0]]){
      const flipper=new THREE.Mesh(new THREE.SphereGeometry(0.065,6,5),lm(dark));
      flipper.scale.set(1.60,0.28,0.80); flipper.position.set(sx,sy,sz);
      g.add(flipper);
    }
    g.userData.parts=p; return g;
  },

  // 왜가리 (heron) — 긴 목 S자 + 장다리 + 긴 부리
  cm2_heron(color) {
    const g=new THREE.Group(), p={};
    const WHITE=0xf0f0ee, DARK=0x223344, ACC=0xddbb66;
    // 몸통 (달걀형)
    const body=new THREE.Mesh(new THREE.SphereGeometry(0.18,9,7),lm(WHITE));
    body.scale.set(0.82,1.08,1.12); body.position.y=0.40; g.add(body); p.body=body;
    // 날개 (접힌 상태)
    for(const s of[-1,1]){
      const wing=new THREE.Mesh(new THREE.SphereGeometry(0.14,7,6),lm(color));
      wing.scale.set(0.35,0.90,1.10); wing.position.set(s*0.205,0.40,0.02); g.add(wing);
    }
    // ★ S자 긴 목
    const NECK=[
      [0,0.62,-0.04, 0.025,0.048, 0.22, Math.PI/2, 0.12],
      [0,0.75,-0.06, 0.022,0.040, 0.18, Math.PI/2, 0.08],
      [0,0.86,-0.04, 0.020,0.035, 0.15, Math.PI/2,-0.06],
    ];
    for(const[x,y,z,r0,r1,h,rx,rx2] of NECK){
      const ns=new THREE.Mesh(new THREE.CylinderGeometry(r0,r1,h,6),lm(WHITE));
      ns.position.set(x,y,z); ns.rotation.x=rx+rx2; g.add(ns);
    }
    // 머리
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.072,7,6),lm(WHITE));
    head.position.set(0,1.00,-0.10); g.add(head); p.head=head;
    // 머리 검은 줄무늬
    const stripe=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.025,0.09),lm(DARK));
    stripe.position.set(0,1.025,-0.12); g.add(stripe);
    // ★ 긴 부리
    const beak=new THREE.Mesh(new THREE.CylinderGeometry(0.010,0.016,0.28,5),lm(ACC));
    beak.rotation.x=Math.PI/2; beak.position.set(0,0.985,-0.30); g.add(beak);
    // 눈
    for(const s of[-1,1]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.018,5,5),lm(0xffaa00));
      eye.position.set(s*0.046,1.010,-0.155); g.add(eye);
      const pupil=new THREE.Mesh(new THREE.SphereGeometry(0.009,4,4),lm(0x111111));
      pupil.position.set(s*0.048,1.010,-0.172); g.add(pupil);
    }
    // ★ 긴 다리 (왜가리 핵심)
    const legGrp=new THREE.Group(); p.legs=legGrp;
    for(const s of[-1,1]){
      const thigh=new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.018,0.28,5),lm(DARK));
      thigh.position.set(s*0.072,0.16,0.06); legGrp.add(thigh);
      const shin=new THREE.Mesh(new THREE.CylinderGeometry(0.016,0.013,0.28,5),lm(ACC));
      shin.position.set(s*0.072,-0.12,0.10); shin.rotation.x=0.18; legGrp.add(shin);
      const foot=new THREE.Mesh(new THREE.CylinderGeometry(0.010,0.008,0.08,5),lm(ACC));
      foot.position.set(s*0.072,-0.27,0.16); foot.rotation.x=0.8; legGrp.add(foot);
      for(let fi=0;fi<3;fi++){
        const toe=new THREE.Mesh(new THREE.CylinderGeometry(0.007,0.004,0.12,4),lm(ACC));
        const fa=(fi-1)*0.35;
        toe.position.set(s*(0.072+Math.sin(fa)*0.02),-0.32,0.20+fi*0.01);
        toe.rotation.x=-0.3; toe.rotation.z=fa*0.4; legGrp.add(toe);
      }
    }
    g.add(legGrp);
    g.userData.parts=p; return g;
  },

  // 소라 (conch) — 나선 원뿔 껍데기 + 발
  cm2_conch(color) {
    const g=new THREE.Group(), p={};
    const SHELL=new THREE.Color(color).lerp(new THREE.Color(0xddaa77),0.5).getHex();
    const INNER=0xffddcc;
    // 원뿔형 나선 껍데기
    const shellGrp=new THREE.Group(); p.shell=shellGrp;
    // 주 몸체
    const body=new THREE.Mesh(new THREE.ConeGeometry(0.15,0.36,10),lm(SHELL));
    body.rotation.x=Math.PI/2; body.position.set(0,0.08,0.02); shellGrp.add(body);
    // 입구 (벌어진 나팔)
    const opening=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.08,0.06,10),
      lms(INNER));
    opening.position.set(0,0.05,-0.16); shellGrp.add(opening);
    // 나선 층
    for(let i=0;i<4;i++){
      const r=0.04+i*0.025, z=0.10+i*0.07;
      const layer=new THREE.Mesh(new THREE.TorusGeometry(r,0.018,5,10),
        lm(new THREE.Color(SHELL).multiplyScalar(0.82+i*0.04).getHex()));
      layer.rotation.x=Math.PI/2; layer.position.set(0,0.10,z); shellGrp.add(layer);
    }
    // 뾰족한 꼭대기 (시포날 캐널)
    const tip=new THREE.Mesh(new THREE.ConeGeometry(0.018,0.10,5),lm(SHELL));
    tip.rotation.x=Math.PI/2; tip.position.set(0,0.08,0.30); shellGrp.add(tip);
    g.add(shellGrp);
    // 발 (땅 접촉)
    const foot=new THREE.Mesh(new THREE.SphereGeometry(0.06,7,5),lm(0x887755));
    foot.scale.set(1.2,0.28,0.9); foot.position.set(0,-0.01,-0.10); g.add(foot);
    // 더듬이 2개
    for(const s of[-1,1]){
      const a=new THREE.Mesh(new THREE.CylinderGeometry(0.007,0.005,0.10,4),lm(0x887755));
      a.position.set(s*0.035,0.07,-0.18); a.rotation.z=s*0.3; a.rotation.x=-0.5;
      g.add(a);
      const t=new THREE.Mesh(new THREE.SphereGeometry(0.016,4,4),lm(0x111111));
      t.position.set(s*0.055,0.14,-0.245); g.add(t);
    }
    g.userData.parts=p; return g;
  },

  // 전복 (abalone) — 납작 타원 + 구멍 열
  cm2_abalone(color) {
    const g=new THREE.Group(), p={};
    const SHELL=new THREE.Color(color).lerp(new THREE.Color(0x448866),0.5).getHex();
    const IRIS=0x88ffdd;
    // 납작 타원 껍데기
    const shell=new THREE.Mesh(new THREE.SphereGeometry(0.22,10,7),lm(SHELL));
    shell.scale.set(1.20,0.25,1.55); shell.position.y=0.07; g.add(shell); p.shell=shell;
    // 내부 진주층 (약간 보임)
    const inner=new THREE.Mesh(new THREE.SphereGeometry(0.20,9,6),lms(IRIS,{transparent:true,opacity:0.35}));
    inner.scale.set(1.15,0.18,1.48); inner.position.y=0.05; g.add(inner);
    // ★ 구멍 열 (전복 특징)
    for(let i=0;i<6;i++){
      const hole=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.05,7),lm(IRIS));
      hole.position.set(0.05+i*0.025,0.090,-0.02-i*0.045); g.add(hole);
    }
    // 발 (흑갈색)
    const foot=new THREE.Mesh(new THREE.SphereGeometry(0.19,9,6),lm(0x2a2218));
    foot.scale.set(1.10,0.20,1.45); foot.position.set(0,0.02,0); g.add(foot);
    // 더듬이
    for(const s of[-1,1]){
      const a=new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.004,0.09,4),lm(0x2a2218));
      a.position.set(s*0.06,0.06,-0.24); a.rotation.z=s*0.28; a.rotation.x=-0.42;
      g.add(a);
    }
    g.userData.parts=p; return g;
  },

  // 문어 (octopus) — 둥근 머리 + 8개 팔
  cm2_octopus(color) {
    const g=new THREE.Group(), p={}, dark=new THREE.Color(color).multiplyScalar(0.48).getHex();
    // 구형 머리
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.20,10,9),lm(color));
    head.scale.set(1.0,1.15,1.0); head.position.y=0.26; g.add(head); p.head=head;
    // 눈
    for(const s of[-1,1]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.038,6,6),lm(0xfff8aa));
      eye.position.set(s*0.115,0.30,-0.155); g.add(eye);
      const pupil=new THREE.Mesh(new THREE.SphereGeometry(0.022,5,5),lm(0x111111));
      pupil.scale.set(1,0.5,0.5); pupil.position.set(s*0.122,0.30,-0.185); g.add(pupil);
    }
    // ★ 8개 팔 (꾸불꾸불)
    const armGrp=new THREE.Group(); p.arms=armGrp;
    for(let i=0;i<8;i++){
      const angle=(i/8)*Math.PI*2;
      const armSub=new THREE.Group();
      for(let j=0;j<5;j++){
        const t=j/4, r=0.038-t*0.016;
        const seg=new THREE.Mesh(new THREE.SphereGeometry(Math.max(r,0.010),5,4),lm(color));
        seg.scale.set(0.85,0.85,1.0);
        seg.position.set(
          Math.cos(angle)*(0.12+j*0.095)+Math.sin(j*1.2)*0.03,
          -j*0.065+0.05,
          Math.sin(angle)*(0.12+j*0.095)+Math.cos(j*1.2)*0.03
        );
        armSub.add(seg);
        // 빨판 (흰 점)
        if(j>0){
          const sucker=new THREE.Mesh(new THREE.SphereGeometry(0.012,4,4),lm(0xffeedd));
          sucker.position.copy(seg.position);
          sucker.position.y-=0.03;
          armSub.add(sucker);
        }
      }
      armGrp.add(armSub);
    }
    g.add(armGrp);
    g.userData.parts=p; return g;
  },

  // 불가사리 (starfish) — 5방사 팔 + 결절 질감
  cm2_starfish(color) {
    const g=new THREE.Group(), p={}, dark=new THREE.Color(color).multiplyScalar(0.52).getHex();
    // 중앙 원반
    const disc=new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.075,0.045,10),lm(color));
    disc.position.y=0.025; g.add(disc); p.disc=disc;
    // ★ 5개 팔
    const armGrp=new THREE.Group(); p.arms=armGrp;
    for(let i=0;i<5;i++){
      const angle=(i/5)*Math.PI*2-Math.PI/2;
      const armSub=new THREE.Group();
      for(let j=0;j<5;j++){
        const t=j/4, r=0.045-t*0.022;
        const seg=new THREE.Mesh(new THREE.CylinderGeometry(r,r,0.040,7),lm(j%2===0?color:dark));
        seg.position.set(Math.cos(angle)*(0.09+j*0.08),0.022,Math.sin(angle)*(0.09+j*0.08));
        armSub.add(seg);
        // 돌기 (결절)
        for(let k=0;k<3;k++){
          const nub=new THREE.Mesh(new THREE.SphereGeometry(0.012,4,4),lm(dark));
          const na=(k/3)*Math.PI;
          nub.position.set(
            Math.cos(angle)*(0.09+j*0.08)+Math.cos(angle+Math.PI/2)*Math.cos(na)*r*0.7,
            0.050,
            Math.sin(angle)*(0.09+j*0.08)+Math.sin(angle+Math.PI/2)*Math.cos(na)*r*0.7
          );
          armSub.add(nub);
        }
      }
      armGrp.add(armSub);
    }
    g.add(armGrp);
    // 중앙 눈점
    const eyespot=new THREE.Mesh(new THREE.SphereGeometry(0.018,5,5),lm(0xff4400));
    eyespot.position.set(0,0.060,0); g.add(eyespot);
    g.userData.parts=p; return g;
  },

  // ══════════════════════════════════════════════════════
  // ── 열대 생물 ──────────────────────────────────────────
  // ══════════════════════════════════════════════════════

  // 앵무새 (parrot) — 화려한 색상 + 갈고리 부리
  cm2_parrot(color) {
    const g=new THREE.Group(), p={};
    const ACC=0xffdd00, BEAK=0xcc8800, RED=0xdd2200;
    // 몸통
    const body=new THREE.Mesh(new THREE.SphereGeometry(0.16,9,8),lm(color));
    body.scale.set(0.82,1.05,1.10); body.position.y=0.28; g.add(body); p.body=body;
    // 꼬리깃 (길고 뾰족)
    for(const[oz,ry] of [[0.22,0],[0.20,0.18],[0.20,-0.18]]){
      const tail=new THREE.Mesh(new THREE.ConeGeometry(0.025,0.24,4),lm(RED));
      tail.rotation.x=-Math.PI/2; tail.rotation.y=ry;
      tail.position.set(0,0.18,oz); g.add(tail);
    }
    // 날개 (색상 대비)
    for(const s of[-1,1]){
      const wing=new THREE.Mesh(new THREE.SphereGeometry(0.13,7,6),lm(ACC));
      wing.scale.set(0.30,0.88,1.18); wing.position.set(s*0.195,0.28,0.02);
      wing.rotation.z=s*0.12; g.add(wing);
      const feather=new THREE.Mesh(new THREE.SphereGeometry(0.065,6,5),lm(RED));
      feather.scale.set(0.35,0.50,1.30); feather.position.set(s*0.218,0.14,0.14); g.add(feather);
    }
    // 머리 (큰 둥근)
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.125,9,8),lm(color));
    head.position.set(0,0.50,-0.065); g.add(head); p.head=head;
    // 색 반지 (눈 주위)
    for(const s of[-1,1]){
      const ring=new THREE.Mesh(new THREE.TorusGeometry(0.032,0.008,4,8),lm(0xffffff));
      ring.position.set(s*0.072,0.52,-0.148); ring.rotation.y=Math.PI/2;
      g.add(ring);
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.020,5,5),lm(0x111111));
      eye.position.set(s*0.088,0.52,-0.162); g.add(eye);
    }
    // ★ 갈고리 부리
    const upper=new THREE.Mesh(new THREE.SphereGeometry(0.055,7,6),lm(BEAK));
    upper.scale.set(0.65,0.60,1.0); upper.position.set(0,0.488,-0.192); g.add(upper);
    const lower=new THREE.Mesh(new THREE.SphereGeometry(0.038,6,5),lm(BEAK));
    lower.scale.set(0.55,0.42,0.85); lower.position.set(0,0.462,-0.195); g.add(lower);
    // 발 (z자형 발가락)
    for(const s of[-1,1]){
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.012,0.10,5),lm(BEAK));
      leg.position.set(s*0.058,0.12,0.08); g.add(leg);
      for(let fi=0;fi<3;fi++){
        const toe=new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.005,0.08,4),lm(BEAK));
        const fa=(fi-1)*0.42;
        toe.position.set(s*(0.058+Math.sin(fa)*0.03),0.050,0.10+fi*0.008);
        toe.rotation.x=0.5; toe.rotation.z=fa*0.5; g.add(toe);
      }
    }
    g.userData.parts=p; return g;
  },

  // 카멜레온 (chameleon) — 납작 몸통 + 코일 꼬리 + 포탑 눈
  cm2_chameleon(color) {
    const g=new THREE.Group(), p={}, dark=new THREE.Color(color).multiplyScalar(0.45).getHex();
    // 납작한 옆면 몸통
    const body=new THREE.Mesh(new THREE.SphereGeometry(0.17,9,8),lm(color));
    body.scale.set(0.42,0.82,1.25); body.position.y=0.18; g.add(body); p.body=body;
    // 등 능선 (볏)
    for(let i=0;i<6;i++){
      const r=0.022-i*0.002;
      const s=new THREE.Mesh(new THREE.ConeGeometry(r,0.05,3),lm(dark));
      s.position.set(0,0.32-i*0.005,-0.14+i*0.06); g.add(s);
    }
    // 머리 (헬멧형 볏)
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.10,8,7),lm(color));
    head.scale.set(0.55,0.85,1.0); head.position.set(0,0.24,-0.22); g.add(head);
    const crest=new THREE.Mesh(new THREE.ConeGeometry(0.035,0.11,4),lm(dark));
    crest.position.set(0,0.38,-0.20); g.add(crest);
    // ★ 포탑 눈 (카멜레온 핵심)
    for(const s of[-1,1]){
      const turret=new THREE.Mesh(new THREE.SphereGeometry(0.040,7,6),lm(dark));
      turret.scale.set(0.6,0.8,0.6); turret.position.set(s*0.052,0.285,-0.258); g.add(turret);
      const iris=new THREE.Mesh(new THREE.SphereGeometry(0.028,6,6),lm(0xaacc00));
      iris.position.set(s*0.065,0.295,-0.285); g.add(iris);
      const pupil=new THREE.Mesh(new THREE.SphereGeometry(0.016,5,5),lm(0x111111));
      pupil.position.set(s*0.072,0.295,-0.298); g.add(pupil);
    }
    // 긴 혀 (바깥으로 살짝)
    const tongue=new THREE.Mesh(new THREE.CylinderGeometry(0.007,0.012,0.12,4),lm(0xff4444));
    tongue.rotation.x=Math.PI/2; tongue.position.set(0,0.22,-0.32); g.add(tongue);
    // ★ 코일 꼬리
    for(let i=0;i<8;i++){
      const t=i/7, r=0.032-t*0.016;
      const ts=new THREE.Mesh(new THREE.SphereGeometry(Math.max(r,0.010),5,4),lm(color));
      const a=t*Math.PI*1.8;
      ts.position.set(Math.sin(a)*0.08*(1-t*0.5),0.08-t*0.06,0.12+t*0.22); g.add(ts);
    }
    // 집게발 (발가락 2+3 묶음)
    for(const[sx,sy,sz] of [[-0.14,0.06,-0.10],[0.14,0.06,-0.10],[-0.12,0.06,0.12],[0.12,0.06,0.12]]){
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.014,0.011,0.12,4),lm(color));
      leg.position.set(sx,sy,sz); leg.rotation.z=sx<0?-1.0:1.0; g.add(leg);
    }
    g.userData.parts=p; return g;
  },

  // 나무늘보 (sloth) — 긴 팔 + 발톱 + 느린 표정
  cm2_sloth(color) {
    const g=new THREE.Group(), p={}, dark=new THREE.Color(color).multiplyScalar(0.52).getHex();
    const FACE=0xddccaa, CLW=0x1a1a0a;
    // 둥근 몸통 (털복숭이)
    const body=new THREE.Mesh(new THREE.SphereGeometry(0.18,9,8),lm(color));
    body.scale.set(0.88,1.05,0.92); body.position.y=0.22; g.add(body); p.body=body;
    // 얼굴
    const face=new THREE.Mesh(new THREE.SphereGeometry(0.115,8,7),lm(FACE));
    face.scale.set(0.90,0.88,0.92); face.position.set(0,0.44,-0.125); g.add(face);
    // 눈 (동그랗고 졸린)
    for(const s of[-1,1]){
      const eyeBase=new THREE.Mesh(new THREE.SphereGeometry(0.030,6,6),lm(0x2a1800));
      eyeBase.position.set(s*0.045,0.458,-0.225); g.add(eyeBase);
      const shine=new THREE.Mesh(new THREE.SphereGeometry(0.010,4,4),bm(0xffffff));
      shine.position.set(s*0.048,0.464,-0.240); g.add(shine);
      // 눈 주위 검은 마스크
      const mask=new THREE.Mesh(new THREE.SphereGeometry(0.040,6,5),lm(dark));
      mask.scale.set(1.0,0.75,0.4); mask.position.set(s*0.044,0.458,-0.215); g.add(mask);
    }
    // 코 (뭉툭)
    const nose=new THREE.Mesh(new THREE.SphereGeometry(0.025,5,5),lm(0x886655));
    nose.scale.set(1.1,0.7,0.8); nose.position.set(0,0.430,-0.238); g.add(nose);
    // 느긋한 미소
    const smile=new THREE.Mesh(new THREE.TorusGeometry(0.028,0.008,4,8,Math.PI),lm(0x553322));
    smile.position.set(0,0.410,-0.238); smile.rotation.x=Math.PI/2; smile.rotation.z=Math.PI;
    g.add(smile);
    // ★ 긴 팔 (3절 + 긴 발톱)
    const armGrp=new THREE.Group(); p.arms=armGrp;
    for(const s of[-1,1]){
      const shoulder=new THREE.Mesh(new THREE.SphereGeometry(0.055,6,6),lm(color));
      shoulder.position.set(s*0.195,0.32,-0.04); armGrp.add(shoulder);
      const upper=new THREE.Mesh(new THREE.CylinderGeometry(0.030,0.024,0.24,5),lm(color));
      upper.position.set(s*0.265,0.22,-0.04); upper.rotation.z=s*0.55; armGrp.add(upper);
      const lower=new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.016,0.24,5),lm(dark));
      lower.position.set(s*0.360,0.04,-0.04); lower.rotation.z=s*0.30; armGrp.add(lower);
      // 발톱 3개
      for(let ci=0;ci<3;ci++){
        const ca=(ci-1)*0.28;
        const claw=new THREE.Mesh(new THREE.CylinderGeometry(0.010,0.006,0.10,4),lm(CLW));
        claw.position.set(s*(0.420+Math.sin(ca)*0.02),0.00+ca*0.02,-0.02);
        claw.rotation.z=s*(Math.PI/2+0.2+ca*0.3); armGrp.add(claw);
      }
    }
    g.add(armGrp);
    // 짧은 다리
    for(const s of[-1,1]){
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.020,0.14,5),lm(color));
      leg.position.set(s*0.105,0.04,0.06); leg.rotation.z=s*0.5; g.add(leg);
    }
    g.userData.parts=p; return g;
  },

  // 이구아나 (iguana) — 등 가시 + 목 주름 + 긴 꼬리
  cm2_iguana(color) {
    const g=new THREE.Group(), p={}, dark=new THREE.Color(color).multiplyScalar(0.45).getHex();
    // 몸통
    const body=new THREE.Mesh(new THREE.BoxGeometry(0.38,0.24,0.65),lm(color));
    body.position.y=0.18; g.add(body); p.body=body;
    // ★ 등 가시열
    for(let i=0;i<9;i++){
      const h=0.055-i*0.004;
      const s2=new THREE.Mesh(new THREE.ConeGeometry(0.012,h,3),lm(dark));
      s2.position.set(0,0.32+h/2,-0.28+i*0.08); g.add(s2);
    }
    // 머리 (삼각형)
    const head=new THREE.Mesh(new THREE.BoxGeometry(0.24,0.16,0.28),lm(color));
    head.position.set(0,0.16,-0.48); g.add(head); p.head=head;
    for(const s of[-1,1]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.022,5,5),lm(0x996600));
      eye.position.set(s*0.088,0.200,-0.535); g.add(eye);
      const pupil=new THREE.Mesh(new THREE.SphereGeometry(0.013,4,4),lm(0x111111));
      pupil.position.set(s*0.092,0.200,-0.556); g.add(pupil);
    }
    // ★ 목 주름 (dewlap)
    const dewlap=new THREE.Mesh(new THREE.SphereGeometry(0.08,7,6),
      lm(new THREE.Color(color).lerp(new THREE.Color(0xff8800),0.4).getHex()));
    dewlap.scale.set(0.5,1.35,0.35); dewlap.position.set(0,-0.02,-0.40); g.add(dewlap);
    // 이빨
    for(let i=0;i<5;i++){
      const tooth=new THREE.Mesh(new THREE.ConeGeometry(0.008,0.025,3),lm(0xf5f5dc));
      tooth.position.set(-0.06+i*0.030,0.142,-0.608); tooth.rotation.x=0.2; g.add(tooth);
    }
    // 긴 꼬리
    for(let i=0;i<9;i++){
      const t=i/8, r=0.048-t*0.030;
      const ts=new THREE.Mesh(new THREE.SphereGeometry(Math.max(r,0.010),5,4),lm(i%2===0?color:dark));
      ts.position.set(Math.sin(t*0.8)*0.04,0.14,0.36+i*0.10); g.add(ts);
    }
    // 4다리
    for(const[sx,sz] of [[-0.24,-0.18],[0.24,-0.18],[-0.22,0.18],[0.22,0.18]]){
      const thigh=new THREE.Mesh(new THREE.CylinderGeometry(0.032,0.025,0.14,5),lm(color));
      thigh.position.set(sx,0.06,sz); thigh.rotation.z=sx<0?-1.0:1.0; g.add(thigh);
      const shin=new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.016,0.12,5),lm(dark));
      shin.position.set(sx<0?sx-0.06:sx+0.06,-0.02,sz); shin.rotation.z=sx<0?-0.4:0.4; g.add(shin);
    }
    g.userData.parts=p; return g;
  },

  // 거미 (spider) — 8다리 + 복부/두흉부 + 독니
  cm2_spider(color) {
    const g=new THREE.Group(), p={}, dark=new THREE.Color(color).multiplyScalar(0.40).getHex();
    const VENOM=0x44ff88;
    // 두흉부
    const ceph=new THREE.Mesh(new THREE.SphereGeometry(0.12,9,8),lm(color));
    ceph.scale.set(1.0,0.72,1.05); ceph.position.set(0,0.08,-0.10); g.add(ceph);
    // 복부 (더 큰)
    const abd=new THREE.Mesh(new THREE.SphereGeometry(0.16,9,8),lm(dark));
    abd.scale.set(0.95,0.85,1.20); abd.position.set(0,0.10,0.20); g.add(abd); p.abdomen=abd;
    // 복부 무늬
    for(let i=0;i<3;i++){
      const mark=new THREE.Mesh(new THREE.SphereGeometry(0.040,5,4),lm(new THREE.Color(color).lerp(new THREE.Color(0xffaa00),0.4).getHex()));
      mark.scale.set(0.9,0.22,0.8); mark.position.set(0,0.22,0.10+i*0.09); g.add(mark);
    }
    // 눈 8개 (앞면)
    const EYE_POS=[[-0.045,0.116,-0.162],[0.045,0.116,-0.162],[-0.075,0.100,-0.155],[0.075,0.100,-0.155],
                   [-0.030,0.095,-0.168],[0.030,0.095,-0.168],[-0.058,0.082,-0.158],[0.058,0.082,-0.158]];
    for(const[ex,ey,ez] of EYE_POS){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.012,4,4),lm(0x111111));
      eye.position.set(ex,ey,ez); g.add(eye);
    }
    // ★ 독니 (chelicerae)
    for(const s of[-1,1]){
      const ch=new THREE.Mesh(new THREE.CylinderGeometry(0.014,0.010,0.07,4),lm(dark));
      ch.position.set(s*0.032,0.058,-0.178); ch.rotation.z=s*0.3; ch.rotation.x=-0.5;
      g.add(ch);
      const fang=new THREE.Mesh(new THREE.ConeGeometry(0.007,0.045,3),lm(VENOM));
      fang.position.set(s*0.040,0.032,-0.212); fang.rotation.z=s*0.8; g.add(fang);
    }
    // ★ 8다리 (3절)
    const legGrp=new THREE.Group(); p.legs=legGrp;
    const LEG_ANGLES=[-0.6,-0.3,0.3,0.6]; // 앞2+뒤2쌍
    const LEG_Z=[-0.12,-0.04,0.04,0.12];
    for(let i=0;i<4;i++){
      for(const s of[-1,1]){
        const z=LEG_Z[i];
        const u=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.010,0.16,4),lm(color));
        u.position.set(s*0.12,0.06,z-0.06); u.rotation.z=s*(0.9+i*0.08);
        legGrp.add(u);
        const l=new THREE.Mesh(new THREE.CylinderGeometry(0.010,0.008,0.18,4),lm(dark));
        l.position.set(s*0.26,-0.01,z-0.04); l.rotation.z=s*0.55; l.rotation.x=0.35;
        legGrp.add(l);
        const f=new THREE.Mesh(new THREE.CylinderGeometry(0.007,0.005,0.12,4),lm(dark));
        f.position.set(s*0.38,-0.06,z-0.02); f.rotation.x=0.7; legGrp.add(f);
      }
    }
    g.add(legGrp);
    g.userData.parts=p; return g;
  },

  // ══════════════════════════════════════════════════════
  // ── 사바나 생물 ────────────────────────────────────────
  // ══════════════════════════════════════════════════════

  // 얼룩말 (zebra) — 말 실루엣 + Canvas 줄무늬
  cm2_zebra(color) {
    const g=new THREE.Group(), p={};
    const stripeTex=canvasTex(64,128,(ctx,w,h)=>{
      ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,w,h);
      ctx.fillStyle='#111111';
      for(let y=0;y<h;y+=18){
        ctx.beginPath();
        ctx.rect(0,y,w,9); ctx.fill();
      }
    });
    const bodyMat=lms(0xffffff,{map:stripeTex});
    // 몸통
    const body=new THREE.Mesh(new THREE.BoxGeometry(0.58,0.44,0.92),bodyMat);
    body.position.y=0.58; g.add(body); p.body=body;
    // 엉덩이
    const hip=new THREE.Mesh(new THREE.SphereGeometry(0.24,7,6),bodyMat.clone());
    hip.scale.set(1.1,0.72,0.78); hip.position.set(0,0.66,0.36); g.add(hip);
    // 어깨
    const shoulder=new THREE.Mesh(new THREE.SphereGeometry(0.22,7,6),bodyMat.clone());
    shoulder.scale.set(1.05,0.75,0.72); shoulder.position.set(0,0.72,-0.28); g.add(shoulder);
    // 목
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.18,0.42,7),bodyMat.clone());
    neck.position.set(0,0.82,-0.52); neck.rotation.x=0.40; g.add(neck);
    // 머리
    const head=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.28,0.36),bodyMat.clone());
    head.position.set(0,0.78,-0.82); g.add(head); p.head=head;
    // 콧구멍
    const snout=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.12,0.18),bodyMat.clone());
    snout.position.set(0,0.70,-0.96); g.add(snout);
    // 갈기
    const mane=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.15,0.58),lm(0x111111));
    mane.position.set(0,0.94,-0.52); g.add(mane);
    // 귀
    for(const s of[-1,1]){
      const ear=new THREE.Mesh(new THREE.ConeGeometry(0.04,0.12,4),lm(0x111111));
      ear.position.set(s*0.09,0.96,-0.72); g.add(ear);
    }
    // 눈
    for(const s of[-1,1]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.025,5,5),lm(0x111111));
      eye.position.set(s*0.105,0.82,-0.896); g.add(eye);
    }
    // 4다리
    for(const[sx,sz] of [[-0.20,-0.26],[0.20,-0.26],[-0.20,0.30],[0.20,0.30]]){
      const thigh=new THREE.Mesh(new THREE.CylinderGeometry(0.060,0.050,0.32,6),bodyMat.clone());
      thigh.position.set(sx,0.26,sz); g.add(thigh);
      const shin=new THREE.Mesh(new THREE.CylinderGeometry(0.042,0.035,0.28,6),bodyMat.clone());
      shin.position.set(sx,0.02,sz+0.04); shin.rotation.x=0.15; g.add(shin);
      const hoof=new THREE.Mesh(new THREE.CylinderGeometry(0.040,0.042,0.08,6),lm(0x333322));
      hoof.position.set(sx,-0.12,sz+0.06); g.add(hoof);
    }
    // 꼬리
    const tail=new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.008,0.22,4),lm(0x111111));
    tail.rotation.x=Math.PI/2+0.4; tail.position.set(0,0.48,0.55); g.add(tail);
    const tailTip=new THREE.Mesh(new THREE.SphereGeometry(0.030,5,5),lm(0x111111));
    tailTip.position.set(0,0.38,0.70); g.add(tailTip);
    g.userData.parts=p; return g;
  },

  // 타조 (ostrich) — 작은 날개 + 솜털 몸통 + 긴 목
  cm2_ostrich(color) {
    const g=new THREE.Group(), p={};
    const WHITE=0xf5f5f5, SKIN=0xddaa88, DARK=0x111111;
    // 솜털 몸통 (검고 크게)
    const body=new THREE.Mesh(new THREE.SphereGeometry(0.26,9,8),lm(DARK));
    body.scale.set(0.88,1.02,1.05); body.position.y=0.55; g.add(body); p.body=body;
    // 흰 날개 패치
    for(const s of[-1,1]){
      const wp=new THREE.Mesh(new THREE.SphereGeometry(0.14,7,6),lm(WHITE));
      wp.scale.set(0.32,0.75,0.85); wp.position.set(s*0.228,0.54,0.02); g.add(wp);
    }
    // 꼬리 깃
    for(let i=0;i<5;i++){
      const q=new THREE.Mesh(new THREE.PlaneGeometry(0.055,0.18),
        lms(WHITE,{transparent:true,opacity:0.88,side:THREE.DoubleSide}));
      q.position.set((i-2)*0.040,0.36,0.30); g.add(q);
    }
    // ★ 긴 목
    for(let i=0;i<5;i++){
      const t=i/4;
      const ns=new THREE.Mesh(new THREE.CylinderGeometry(0.035-t*0.01,0.040-t*0.008,0.18,6),lm(SKIN));
      ns.position.set(0,0.82+i*0.175,-0.04+t*0.02); g.add(ns);
    }
    // 작은 머리
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.072,7,6),lm(SKIN));
    head.position.set(0,1.74,-0.02); g.add(head); p.head=head;
    // 큰 눈
    for(const s of[-1,1]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.026,5,5),lm(0x111111));
      eye.position.set(s*0.055,1.762,-0.065); g.add(eye);
      const shine=new THREE.Mesh(new THREE.SphereGeometry(0.008,4,4),bm(0xffffff));
      shine.position.set(s*0.058,1.768,-0.082); g.add(shine);
    }
    // 납작 부리
    const beak=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.030,0.12),lm(0xddcc88));
    beak.position.set(0,1.730,-0.122); g.add(beak);
    // ★ 긴 두 다리
    for(const s of[-1,1]){
      const thigh=new THREE.Mesh(new THREE.CylinderGeometry(0.048,0.040,0.36,6),lm(SKIN));
      thigh.position.set(s*0.082,0.22,0.04); g.add(thigh);
      const shin=new THREE.Mesh(new THREE.CylinderGeometry(0.028,0.022,0.38,6),lm(SKIN));
      shin.position.set(s*0.082,-0.12,0.08); shin.rotation.x=0.14; g.add(shin);
      const foot=new THREE.Mesh(new THREE.SphereGeometry(0.048,6,5),lm(DARK));
      foot.scale.set(1.0,0.35,1.60); foot.position.set(s*0.082,-0.30,0.14); g.add(foot);
    }
    g.userData.parts=p; return g;
  },

  // 하이에나 (hyena) — 경사진 등 + 점박이 + 귀
  cm2_hyena(color) {
    const g=new THREE.Group(), p={}, dark=new THREE.Color(color).multiplyScalar(0.48).getHex();
    // 앞이 높고 뒤가 낮은 몸통 (하이에나 특징)
    const body=new THREE.Mesh(new THREE.BoxGeometry(0.50,0.40,0.82),lm(color));
    body.position.y=0.38; g.add(body); p.body=body;
    const shoulder=new THREE.Mesh(new THREE.SphereGeometry(0.24,7,6),lm(color));
    shoulder.scale.set(1.08,0.88,0.78); shoulder.position.set(0,0.56,-0.24); g.add(shoulder);
    const hip=new THREE.Mesh(new THREE.SphereGeometry(0.18,7,5),lm(color));
    hip.scale.set(1.0,0.62,0.72); hip.position.set(0,0.30,0.32); g.add(hip);
    // 목 + 머리
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.16,0.30,6),lm(color));
    neck.position.set(0,0.60,-0.50); neck.rotation.x=0.35; g.add(neck);
    const head=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.28,0.34),lm(color));
    head.position.set(0,0.56,-0.74); g.add(head); p.head=head;
    // 큰 삼각 귀
    for(const s of[-1,1]){
      const ear=new THREE.Mesh(new THREE.ConeGeometry(0.060,0.16,4),lm(dark));
      ear.position.set(s*0.110,0.80,-0.70); g.add(ear);
      const earIn=new THREE.Mesh(new THREE.ConeGeometry(0.036,0.10,4),lm(0xffccaa));
      earIn.position.set(s*0.110,0.80,-0.702); g.add(earIn);
    }
    for(const s of[-1,1]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.028,5,5),lm(0xddaa00));
      eye.position.set(s*0.100,0.60,-0.876); g.add(eye);
      const pupil=new THREE.Mesh(new THREE.SphereGeometry(0.016,4,4),lm(0x111111));
      pupil.position.set(s*0.102,0.60,-0.900); g.add(pupil);
    }
    // 점박이 무늬
    for(const[sx,sy,sz] of [[0.18,0.48,0.10],[-0.18,0.48,0.10],[0.20,0.40,-0.04],
                              [-0.20,0.40,-0.04],[0.15,0.35,0.26],[-0.15,0.35,0.26]]){
      const spot=new THREE.Mesh(new THREE.SphereGeometry(0.038,5,4),lm(dark));
      spot.scale.set(1,0.28,1); spot.position.set(sx,sy,sz); g.add(spot);
    }
    // ★ 등 갈기
    const mane=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.12,0.60),lm(dark));
    mane.position.set(0,0.64,-0.10); g.add(mane);
    // 4다리
    for(const[sx,sz,h] of [[-0.18,-0.22,0.40],[0.18,-0.22,0.40],[-0.16,0.24,0.28],[0.16,0.24,0.28]]){
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.036,h,5),lm(color));
      leg.position.set(sx,0.38-h/2+0.10,sz); g.add(leg);
      const paw=new THREE.Mesh(new THREE.SphereGeometry(0.040,5,5),lm(dark));
      paw.scale.set(0.9,0.45,1.20); paw.position.set(sx,0.38-h+0.08,sz+0.02); g.add(paw);
    }
    g.userData.parts=p; return g;
  },

  // 악어 (croc) — 납작 긴 몸통 + 갑옷 등딱지 + 긴 턱
  cm2_croc(color) {
    const g=new THREE.Group(), p={}, dark=new THREE.Color(color).multiplyScalar(0.44).getHex();
    // 납작하고 긴 몸통
    const body=new THREE.Mesh(new THREE.BoxGeometry(0.52,0.22,1.10),lm(color));
    body.position.y=0.11; g.add(body); p.body=body;
    // ★ 등 갑옷 (골판)
    for(let i=0;i<8;i++){
      const row=new THREE.Group();
      for(const s of[-1,1]){
        const plate=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.055,0.10),lm(dark));
        plate.position.set(s*0.095,0.205,-0.40+i*0.115); row.add(plate);
      }
      g.add(row);
    }
    // 꼬리 (점차 가늘어짐)
    for(let i=0;i<7;i++){
      const t=i/6, r=0.085-t*0.052;
      const ts=new THREE.Mesh(new THREE.SphereGeometry(Math.max(r,0.020),6,5),lm(i%2===0?color:dark));
      ts.scale.set(1.0,0.42,1.0);
      ts.position.set(Math.sin(t*0.6)*0.04,0.06,0.62+i*0.12); g.add(ts);
    }
    // ★ 긴 납작 머리 + 이빨
    const head=new THREE.Mesh(new THREE.BoxGeometry(0.40,0.14,0.52),lm(color));
    head.position.set(0,0.07,-0.72); g.add(head); p.head=head;
    // 위턱
    const upperJaw=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.06,0.50),lm(color));
    upperJaw.position.set(0,0.11,-0.72); g.add(upperJaw);
    // 이빨
    for(let i=0;i<6;i++){
      const tooth=new THREE.Mesh(new THREE.ConeGeometry(0.013,0.042,3),lm(0xf5f5dc));
      tooth.position.set(-0.10+i*0.040,0.070,-0.940); tooth.rotation.x=-0.3; g.add(tooth);
    }
    // 눈 (볼록, 위로 돌출)
    for(const s of[-1,1]){
      const eyeBase=new THREE.Mesh(new THREE.SphereGeometry(0.030,6,6),lm(color));
      eyeBase.position.set(s*0.128,0.152,-0.615); g.add(eyeBase);
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.018,5,5),lm(0xddaa00));
      eye.position.set(s*0.130,0.162,-0.632); g.add(eye);
      const pupil=new THREE.Mesh(new THREE.SphereGeometry(0.010,4,4),lm(0x111111));
      pupil.scale.set(0.5,1,0.4); pupil.position.set(s*0.132,0.162,-0.645); g.add(pupil);
    }
    // 짧은 4다리 (옆으로 벌어짐)
    for(const[sx,sz] of [[-0.28,-0.22],[0.28,-0.22],[-0.26,0.20],[0.26,0.20]]){
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.028,0.14,5),lm(color));
      leg.position.set(sx,-0.01,sz); leg.rotation.z=sx<0?-1.4:1.4; g.add(leg);
      const foot=new THREE.Mesh(new THREE.SphereGeometry(0.040,5,5),lm(dark));
      foot.scale.set(1.3,0.38,1.10); foot.position.set(sx<0?sx-0.09:sx+0.09,-0.04,sz+0.01); g.add(foot);
    }
    g.userData.parts=p; return g;
  },

  // 치타 (cheetah) — 날렵한 체형 + 눈물선 + 점박이
  cm2_cheetah(color) {
    const g=new THREE.Group(), p={}, dark=new THREE.Color(color).multiplyScalar(0.45).getHex();
    // 날렵하고 긴 몸통
    const body=new THREE.Mesh(new THREE.BoxGeometry(0.38,0.30,0.98),lm(color));
    body.position.y=0.28; g.add(body); p.body=body;
    // 어깨 (좁고 깊은 가슴)
    const chest=new THREE.Mesh(new THREE.SphereGeometry(0.20,7,6),lm(color));
    chest.scale.set(0.88,0.92,0.75); chest.position.set(0,0.32,-0.36); g.add(chest);
    // 목 + 작은 머리
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.095,0.12,0.26,6),lm(color));
    neck.position.set(0,0.40,-0.60); neck.rotation.x=0.35; g.add(neck);
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.145,8,7),lm(color));
    head.scale.set(0.92,0.88,0.90); head.position.set(0,0.44,-0.80); g.add(head); p.head=head;
    // 작고 둥근 귀
    for(const s of[-1,1]){
      const ear=new THREE.Mesh(new THREE.ConeGeometry(0.036,0.08,4),lm(color));
      ear.position.set(s*0.090,0.555,-0.775); g.add(ear);
    }
    // ★ 눈물선 (치타 시그니처)
    for(const s of[-1,1]){
      const tear=new THREE.Mesh(new THREE.CylinderGeometry(0.007,0.004,0.10,4),lm(0x1a1a00));
      tear.position.set(s*0.065,0.425,-0.875); tear.rotation.z=s*0.20; tear.rotation.x=0.50;
      g.add(tear);
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.026,5,5),lm(0xddaa00));
      eye.position.set(s*0.088,0.472,-0.880); g.add(eye);
      const pupil=new THREE.Mesh(new THREE.SphereGeometry(0.015,4,4),lm(0x111111));
      pupil.position.set(s*0.090,0.472,-0.896); g.add(pupil);
    }
    // 점박이
    const SPOTS=[[0.14,0.38,-0.05],[-0.14,0.38,-0.05],[0.15,0.32,0.18],[-0.15,0.32,0.18],
                  [0,0.40,0.08],[0.13,0.28,0.35],[-0.13,0.28,0.35],[0,0.35,-0.22]];
    for(const[sx,sy,sz] of SPOTS){
      const sp=new THREE.Mesh(new THREE.SphereGeometry(0.030,5,4),lm(dark));
      sp.scale.set(1,0.28,1); sp.position.set(sx,sy,sz); g.add(sp);
    }
    // ★ 긴 꼬리 (균형용)
    for(let i=0;i<7;i++){
      const r=0.040-i*0.004;
      const ts=new THREE.Mesh(new THREE.SphereGeometry(Math.max(r,0.018),5,4),lm(i>4?dark:color));
      const a=(i/6.5)*1.6;
      ts.position.set(0,0.22+Math.sin(a)*0.18,0.52+i*0.18); g.add(ts);
    }
    // 4다리 (긴 유연한)
    for(const[sx,sz] of [[-0.14,-0.30],[0.14,-0.30],[-0.14,0.30],[0.14,0.30]]){
      const thigh=new THREE.Mesh(new THREE.CylinderGeometry(0.040,0.032,0.28,5),lm(color));
      thigh.position.set(sx,0.10,sz); g.add(thigh);
      const shin=new THREE.Mesh(new THREE.CylinderGeometry(0.028,0.022,0.24,5),lm(color));
      shin.position.set(sx,-0.10,sz+0.02); shin.rotation.x=0.18; g.add(shin);
      const paw=new THREE.Mesh(new THREE.SphereGeometry(0.034,5,5),lm(0xddccaa));
      paw.scale.set(0.9,0.45,1.15); paw.position.set(sx,-0.22,sz+0.04); g.add(paw);
    }
    g.userData.parts=p; return g;
  },

  // ★★ 왕상어 (giant_shark) — 상어보다 더 위협적
  cm2_giant_shark(color) {
    const g=new THREE.Group(), p={}, dark=new THREE.Color(color).multiplyScalar(0.42).getHex();
    // 거대 어뢰형 몸통
    const body=new THREE.Mesh(new THREE.SphereGeometry(0.32,10,8),lm(color));
    body.scale.set(0.66,0.62,3.20); g.add(body); p.body=body;
    // 흰 배
    const belly=new THREE.Mesh(new THREE.SphereGeometry(0.28,9,7),lm(0xf0f0ee));
    belly.scale.set(0.48,0.30,2.80); belly.position.set(0,-0.095,0); g.add(belly);
    // ★ 거대 등지느러미
    const dor=new THREE.Mesh(new THREE.ConeGeometry(0.18,0.78,3),lm(dark));
    dor.position.set(0,0.44,0.12); dor.rotation.z=-0.16; g.add(dor);
    // 꼬리 (강력한)
    for(const[y,rx] of [[0.18,-0.40],[-0.12,0.44]]){
      const t=new THREE.Mesh(new THREE.ConeGeometry(0.14,0.44,3),lm(color));
      t.rotation.x=Math.PI/2+rx; t.position.set(0,y,0.96); g.add(t);
    }
    // 가슴지느러미 (넓음)
    for(const s of[-1,1]){
      const pec=new THREE.Mesh(new THREE.ConeGeometry(0.14,0.55,3),lm(color));
      pec.position.set(s*0.44,-0.10,0.18); pec.rotation.z=s*(Math.PI/2+0.40); pec.rotation.x=0.28;
      g.add(pec);
    }
    // 눈 (검고 큰)
    const eye=new THREE.Mesh(new THREE.SphereGeometry(0.055,6,6),lm(0x111111));
    eye.position.set(0.272,0.05,-0.65); g.add(eye);
    const sh=new THREE.Mesh(new THREE.SphereGeometry(0.015,4,4),bm(0xffffff));
    sh.position.set(0.282,0.062,-0.680); g.add(sh);
    // 넓은 턱 + 이빨 열
    const jaw=new THREE.Mesh(new THREE.BoxGeometry(0.46,0.10,0.22),lm(0x334444));
    jaw.position.set(0,-0.15,-0.96); jaw.rotation.x=0.22; g.add(jaw);
    for(let i=0;i<7;i++){
      for(const row of[0,1]){
        const tooth=new THREE.Mesh(new THREE.ConeGeometry(0.020,0.070,4),lm(0xf5f5dc));
        tooth.position.set(-0.15+i*0.050,(row===0?-0.105:-0.125),-1.05);
        tooth.rotation.x=row===0?-0.4:0.3; g.add(tooth);
      }
    }
    // 옆줄 (측선)
    const lateral=new THREE.Mesh(new THREE.BoxGeometry(0.008,0.008,1.80),lm(0x667788));
    lateral.position.set(0.204,0.0,0); g.add(lateral);
    g.userData.parts=p; return g;
  },
};

// ─────────────────────────────────────────────────────────────────
export const DETAILED_SHAPE_MAP2 = {
  crucian:      'cm2_crucian',
  loach:        'cm2_loach',
  catfish:      'cm2_catfish',
  puffer:       'cm2_puffer',
  ray:          'cm2_ray',
  whale:        'cm2_whale',
  soft_turtle:  'cm2_soft_turtle',
  heron:        'cm2_heron',
  conch:        'cm2_conch',
  abalone:      'cm2_abalone',
  octopus:      'cm2_octopus',
  starfish:     'cm2_starfish',
  parrot:       'cm2_parrot',
  chameleon:    'cm2_chameleon',
  sloth:        'cm2_sloth',
  iguana:       'cm2_iguana',
  spider:       'cm2_spider',
  zebra:        'cm2_zebra',
  ostrich:      'cm2_ostrich',
  hyena:        'cm2_hyena',
  croc:         'cm2_croc',
  cheetah:      'cm2_cheetah',
  giant_shark:  'cm2_giant_shark',
  // crab / shark / jellyfish 기존 전용 빌더 유지
};
