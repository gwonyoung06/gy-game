/**
 * CreatureModels3.js — ★★★3등급 10종 상세 Three.js 모델
 * cm3_ 접두사 빌더 + DETAILED_SHAPE_MAP3
 */
import * as THREE from 'three';

const lm  = (c,o={}) => new THREE.MeshLambertMaterial({ color:c, flatShading:true,  ...o });
const lms = (c,o={}) => new THREE.MeshLambertMaterial({ color:c, flatShading:false, ...o });
const bm  = (c,o={}) => new THREE.MeshBasicMaterial({ color:c, ...o });

function canvasTex(w,h,fn){
  const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
  fn(cv.getContext('2d'),w,h); return new THREE.CanvasTexture(cv);
}
const hx = c=>'#'+(c>>>0).toString(16).padStart(6,'0');

export const DETAILED_BUILDERS3 = {

  // ════════════════════════════════════════════════════
  // 1. 설표 (snow_leopard) — 흰/회색 + 큰 발 + 긴 두꺼운 꼬리
  // ════════════════════════════════════════════════════
  cm3_snow_leopard(color) {
    const g=new THREE.Group(), p={};
    const spotTex=canvasTex(64,64,(ctx,w,h)=>{
      ctx.fillStyle='#e8e8f0'; ctx.fillRect(0,0,w,h);
      ctx.fillStyle='rgba(80,80,110,0.55)';
      [[12,14,8],[44,12,7],[28,35,9],[52,40,7],[10,50,6],[40,55,8],[25,18,5]].forEach(([x,y,r])=>{
        ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
        // 링 반점 (설표 특징)
        ctx.strokeStyle='rgba(60,60,90,0.5)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.arc(x,y,r+2.5,0,Math.PI*2); ctx.stroke();
      });
    });
    const mat=lms(0xffffff,{map:spotTex});
    // 몸통
    const body=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.34,0.95),mat.clone());
    body.position.y=0.24; g.add(body); p.body=body;
    const shoulder=new THREE.Mesh(new THREE.SphereGeometry(0.22,7,6),mat.clone());
    shoulder.scale.set(1.08,0.82,0.78); shoulder.position.set(0,0.34,-0.30); g.add(shoulder);
    const hip=new THREE.Mesh(new THREE.SphereGeometry(0.19,7,5),mat.clone());
    hip.scale.set(1.05,0.72,0.75); hip.position.set(0,0.26,0.32); g.add(hip);
    // 목
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.14,0.24,6),mat.clone());
    neck.position.set(0,0.38,-0.55); neck.rotation.x=0.35; g.add(neck);
    // 머리
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.155,8,7),mat.clone());
    head.scale.set(1.02,0.94,0.96); head.position.set(0,0.42,-0.76); g.add(head); p.head=head;
    for(const s of[-1,1]){
      const ear=new THREE.Mesh(new THREE.ConeGeometry(0.040,0.09,4),lm(0xddddee));
      ear.position.set(s*0.090,0.548,-0.740); g.add(ear);
    }
    for(const s of[-1,1]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.026,5,5),lm(0x88cc44));
      eye.position.set(s*0.092,0.452,-0.874); g.add(eye);
      const pupil=new THREE.Mesh(new THREE.SphereGeometry(0.014,4,4),lm(0x111111));
      pupil.position.set(s*0.094,0.452,-0.890); g.add(pupil);
    }
    // 코 + 수염
    const nose=new THREE.Mesh(new THREE.SphereGeometry(0.022,5,5),lm(0xffaabb));
    nose.scale.set(1.1,0.7,0.8); nose.position.set(0,0.430,-0.890); g.add(nose);
    for(const[s,z] of [[-1,-0.875],[1,-0.875],[-1,-0.855],[1,-0.855]]){
      const w2=new THREE.Mesh(new THREE.CylinderGeometry(0.002,0.001,0.10,3),lm(0xffffff));
      w2.position.set(s*0.065,0.425,z); w2.rotation.z=s*0.2; w2.rotation.x=0.1; g.add(w2);
    }
    // ★ 두꺼운 긴 꼬리 (설표 핵심)
    for(let i=0;i<9;i++){
      const t=i/8, r=0.055-t*0.020;
      const ts=new THREE.Mesh(new THREE.SphereGeometry(Math.max(r,0.022),6,5),mat.clone());
      const a=(i/8.0)*2.2;
      ts.position.set(0,0.18+Math.sin(a)*0.22,0.52+i*0.175); g.add(ts);
    }
    // ★ 큰 발
    for(const[sx,sz] of [[-0.16,-0.30],[0.16,-0.30],[-0.16,0.30],[0.16,0.30]]){
      const thigh=new THREE.Mesh(new THREE.CylinderGeometry(0.048,0.038,0.26,5),mat.clone());
      thigh.position.set(sx,0.10,sz); g.add(thigh);
      const shin=new THREE.Mesh(new THREE.CylinderGeometry(0.034,0.026,0.22,5),mat.clone());
      shin.position.set(sx,-0.06,sz+0.02); shin.rotation.x=0.16; g.add(shin);
      const paw=new THREE.Mesh(new THREE.SphereGeometry(0.050,6,5),lm(0xddddee));
      paw.scale.set(1.20,0.42,1.30); paw.position.set(sx,-0.18,sz+0.05); g.add(paw);
    }
    g.userData.parts=p; return g;
  },

  // ════════════════════════════════════════════════════
  // 2. 북극곰 (polar_bear) — 거대 흰곰 + 검은 코
  // ════════════════════════════════════════════════════
  cm3_polar_bear(color) {
    const g=new THREE.Group(), p={};
    const W=0xf8f8f5, DARK=0x111111, NOSE=0x2a2a2a;
    // 거대 몸통
    const body=new THREE.Mesh(new THREE.SphereGeometry(0.30,10,9),lm(W));
    body.scale.set(1.0,0.92,1.42); body.position.y=0.38; g.add(body); p.body=body;
    // 엉덩이
    const hip=new THREE.Mesh(new THREE.SphereGeometry(0.26,8,7),lm(W));
    hip.scale.set(1.05,0.82,0.82); hip.position.set(0,0.42,0.44); g.add(hip);
    // 어깨 (근육질)
    const shoulder=new THREE.Mesh(new THREE.SphereGeometry(0.26,8,7),lm(W));
    shoulder.scale.set(1.10,0.88,0.80); shoulder.position.set(0,0.52,-0.35); g.add(shoulder);
    // 목 (짧고 굵음)
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.22,0.22,7),lm(W));
    neck.position.set(0,0.62,-0.56); neck.rotation.x=0.28; g.add(neck);
    // 큰 머리
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.22,9,8),lm(W));
    head.scale.set(0.96,0.90,1.02); head.position.set(0,0.66,-0.80); g.add(head); p.head=head;
    // 작고 둥근 귀
    for(const s of[-1,1]){
      const ear=new THREE.Mesh(new THREE.SphereGeometry(0.050,6,6),lm(W));
      ear.position.set(s*0.155,0.825,-0.748); g.add(ear);
    }
    // 긴 주둥이
    const snout=new THREE.Mesh(new THREE.SphereGeometry(0.12,8,7),lm(W));
    snout.scale.set(0.72,0.62,1.10); snout.position.set(0,0.608,-0.960); g.add(snout);
    // ★ 검은 코
    const nose=new THREE.Mesh(new THREE.SphereGeometry(0.042,6,6),lm(NOSE));
    nose.scale.set(1.0,0.72,0.80); nose.position.set(0,0.615,-1.020); g.add(nose);
    // 눈 (작고 검음)
    for(const s of[-1,1]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.022,5,5),lm(DARK));
      eye.position.set(s*0.108,0.692,-0.920); g.add(eye);
      const sh=new THREE.Mesh(new THREE.SphereGeometry(0.007,4,4),bm(0xffffff));
      sh.position.set(s*0.112,0.698,-0.935); g.add(sh);
    }
    // ★ 거대한 발 + 발톱
    for(const[sx,sz] of [[-0.22,-0.28],[0.22,-0.28],[-0.22,0.32],[0.22,0.32]]){
      const thigh=new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.062,0.34,6),lm(W));
      thigh.position.set(sx,0.20,sz); g.add(thigh);
      const shin=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.044,0.28,6),lm(W));
      shin.position.set(sx,-0.02,sz+0.04); shin.rotation.x=0.18; g.add(shin);
      const paw=new THREE.Mesh(new THREE.SphereGeometry(0.075,7,6),lm(W));
      paw.scale.set(1.25,0.40,1.35); paw.position.set(sx,-0.16,sz+0.06); g.add(paw);
      for(let ci=0;ci<5;ci++){
        const claw=new THREE.Mesh(new THREE.ConeGeometry(0.009,0.042,3),lm(NOSE));
        claw.position.set(sx+(ci-2)*0.016,-0.175,sz+0.115); claw.rotation.x=-0.4; g.add(claw);
      }
    }
    // 작은 꼬리
    const tail=new THREE.Mesh(new THREE.SphereGeometry(0.040,5,5),lm(W));
    tail.position.set(0,0.34,0.72); g.add(tail);
    g.userData.parts=p; return g;
  },

  // ════════════════════════════════════════════════════
  // 3. 순록 (reindeer) — 거대 뿔 + 털복숭이 + 굽
  // ════════════════════════════════════════════════════
  cm3_reindeer(color) {
    const g=new THREE.Group(), p={};
    const dark=new THREE.Color(color).multiplyScalar(0.48).getHex();
    const ANTLER=0x8B5E3C, HOOF=0x222211, WHITE=0xf0ede8;
    // 몸통
    const body=new THREE.Mesh(new THREE.BoxGeometry(0.54,0.44,1.02),lm(color));
    body.position.y=0.60; g.add(body); p.body=body;
    const hip=new THREE.Mesh(new THREE.SphereGeometry(0.25,7,6),lm(color));
    hip.scale.set(1.08,0.80,0.80); hip.position.set(0,0.68,0.40); g.add(hip);
    const shoulder=new THREE.Mesh(new THREE.SphereGeometry(0.24,7,6),lm(color));
    shoulder.scale.set(1.10,0.85,0.78); shoulder.position.set(0,0.78,-0.32); g.add(shoulder);
    // 흰 목 패치
    const neckPatch=new THREE.Mesh(new THREE.CylinderGeometry(0.10,0.16,0.32,6),lm(WHITE));
    neckPatch.position.set(0,0.86,-0.58); neckPatch.rotation.x=0.38; g.add(neckPatch);
    // 목
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.18,0.30,6),lm(color));
    neck.position.set(0,0.86,-0.56); neck.rotation.x=0.38; g.add(neck);
    // 머리
    const head=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.26,0.38),lm(color));
    head.position.set(0,0.82,-0.84); g.add(head); p.head=head;
    const snout=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.16,0.20),lm(WHITE));
    snout.position.set(0,0.76,-0.98); g.add(snout);
    // 코 (루돌프 느낌으로 약간 빨간)
    const nose=new THREE.Mesh(new THREE.SphereGeometry(0.030,5,5),lm(0xcc4444));
    nose.position.set(0,0.755,-1.060); g.add(nose);
    for(const s of[-1,1]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.022,5,5),lm(0x111111));
      eye.position.set(s*0.098,0.845,-0.922); g.add(eye);
    }
    // 귀
    for(const s of[-1,1]){
      const ear=new THREE.Mesh(new THREE.SphereGeometry(0.040,6,5),lm(color));
      ear.scale.set(0.5,1.0,0.6); ear.position.set(s*0.115,0.895,-0.798); g.add(ear);
    }
    // ★★ 거대 뿔 (순록 핵심)
    const antlerGrp=new THREE.Group(); p.antlers=antlerGrp;
    for(const s of[-1,1]){
      // 주 줄기
      const shaft=new THREE.Mesh(new THREE.CylinderGeometry(0.016,0.026,0.40,5),lm(ANTLER));
      shaft.position.set(s*0.072,1.10,-0.820); shaft.rotation.z=s*0.20; shaft.rotation.x=-0.10;
      antlerGrp.add(shaft);
      // 위 가지들
      const BRANCHES=[
        [s*0.100,1.34,-0.790, s*0.35,-0.15, 0.22],
        [s*0.120,1.38,-0.770, s*0.55,-0.20, 0.18],
        [s*0.088,1.28,-0.810, s*0.15,-0.05, 0.20],
        [s*0.060,1.44,-0.800, s*0.10,-0.28, 0.15],
      ];
      for(const[bx,by,bz,rz,rx,len] of BRANCHES){
        const br=new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.013,len,4),lm(ANTLER));
        br.position.set(bx,by,bz); br.rotation.z=rz; br.rotation.x=rx;
        antlerGrp.add(br);
        const tip=new THREE.Mesh(new THREE.SphereGeometry(0.012,4,4),lm(ANTLER));
        tip.position.set(bx+Math.sin(rz)*len*0.5,by+len*0.4,bz); antlerGrp.add(tip);
      }
    }
    g.add(antlerGrp);
    // 4다리 + 굽
    for(const[sx,sz] of [[-0.20,-0.30],[0.20,-0.30],[-0.20,0.34],[0.20,0.34]]){
      const thigh=new THREE.Mesh(new THREE.CylinderGeometry(0.058,0.048,0.36,6),lm(color));
      thigh.position.set(sx,0.28,sz); g.add(thigh);
      const shin=new THREE.Mesh(new THREE.CylinderGeometry(0.038,0.030,0.30,6),lm(dark));
      shin.position.set(sx,0.00,sz+0.02); shin.rotation.x=0.14; g.add(shin);
      const hoof=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.038,0.08,6),lm(HOOF));
      hoof.position.set(sx,-0.14,sz+0.04); g.add(hoof);
    }
    // 꼬리
    const tail=new THREE.Mesh(new THREE.SphereGeometry(0.040,5,5),lm(WHITE));
    tail.position.set(0,0.56,0.60); g.add(tail);
    g.userData.parts=p; return g;
  },

  // ════════════════════════════════════════════════════
  // 4. 매머드 (mammoth) — 장대한 엄니 + 털 + 거대 귀
  // ════════════════════════════════════════════════════
  cm3_mammoth(color) {
    const g=new THREE.Group(), p={};
    const dark=new THREE.Color(color).multiplyScalar(0.45).getHex();
    const FUR=new THREE.Color(color).lerp(new THREE.Color(0x884422),0.3).getHex();
    const TUSK=0xfff5dc, DARK=0x111111;
    // ★ 거대 몸통 (털 텍스처)
    const furTex=canvasTex(64,64,(ctx,w,h)=>{
      ctx.fillStyle=hx(FUR); ctx.fillRect(0,0,w,h);
      ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=1;
      for(let i=0;i<30;i++){
        const x=Math.random()*w, y=Math.random()*h;
        ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+(Math.random()-0.5)*8,y+Math.random()*10);
        ctx.stroke();
      }
    });
    const body=new THREE.Mesh(new THREE.SphereGeometry(0.38,10,9),lms(FUR,{map:furTex}));
    body.scale.set(1.08,0.98,1.52); body.position.y=0.65; g.add(body); p.body=body;
    // ★ 등혹 (매머드 특징)
    const hump=new THREE.Mesh(new THREE.SphereGeometry(0.22,8,7),lm(FUR));
    hump.scale.set(1.0,0.75,0.70); hump.position.set(0,1.08,-0.25); g.add(hump);
    // 어깨 근육
    const shoulder=new THREE.Mesh(new THREE.SphereGeometry(0.30,8,7),lm(FUR));
    shoulder.scale.set(1.12,0.90,0.82); shoulder.position.set(0,0.88,-0.38); g.add(shoulder);
    // 목
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.26,0.32,7),lm(FUR));
    neck.position.set(0,0.88,-0.68); neck.rotation.x=0.32; g.add(neck);
    // 큰 머리
    const head=new THREE.Mesh(new THREE.BoxGeometry(0.52,0.48,0.52),lm(FUR));
    head.position.set(0,0.82,-1.00); g.add(head); p.head=head;
    const headTop=new THREE.Mesh(new THREE.SphereGeometry(0.26,8,7),lm(FUR));
    headTop.scale.set(1.0,0.88,0.88); headTop.position.set(0,1.04,-0.98); g.add(headTop);
    // ★ 거대 귀 (부채형)
    for(const s of[-1,1]){
      const ear=new THREE.Mesh(new THREE.SphereGeometry(0.14,7,6),lm(FUR));
      ear.scale.set(0.35,1.0,0.80); ear.position.set(s*0.285,0.90,-0.90); g.add(ear);
    }
    // 눈
    for(const s of[-1,1]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.028,5,5),lm(DARK));
      eye.position.set(s*0.180,0.888,-1.080); g.add(eye);
      const sh=new THREE.Mesh(new THREE.SphereGeometry(0.008,4,4),bm(0xffffff));
      sh.position.set(s*0.185,0.895,-1.098); g.add(sh);
    }
    // ★ 코 (굵고 긴 코끼리 코)
    for(let i=0;i<6;i++){
      const t=i/5, r=0.055-t*0.020;
      const ts=new THREE.Mesh(new THREE.SphereGeometry(Math.max(r,0.025),6,5),lm(FUR));
      ts.scale.set(0.90,1.0,0.90);
      ts.position.set(0,0.660-i*0.080,-1.055+Math.sin(i*0.6)*0.04); g.add(ts);
    }
    // ★★ 거대 휘어진 엄니 (매머드 시그니처)
    for(const s of[-1,1]){
      for(let i=0;i<8;i++){
        const t=i/7, r=0.038-t*0.018;
        const ts=new THREE.Mesh(new THREE.SphereGeometry(Math.max(r,0.012),5,4),lm(TUSK));
        const a=t*Math.PI*0.85;
        ts.position.set(s*(0.155+Math.sin(a)*0.22),0.620-Math.cos(a)*0.28,-1.025+Math.cos(a)*0.18);
        g.add(ts);
      }
    }
    // 4다리 (굵고 기둥 같음)
    for(const[sx,sz] of [[-0.26,-0.38],[0.26,-0.38],[-0.26,0.40],[0.26,0.40]]){
      const pillar=new THREE.Mesh(new THREE.CylinderGeometry(0.085,0.095,0.65,7),lm(FUR));
      pillar.position.set(sx,0.33,sz); g.add(pillar);
      const hoof=new THREE.Mesh(new THREE.CylinderGeometry(0.092,0.098,0.09,7),lm(DARK));
      hoof.position.set(sx,0.005,sz); g.add(hoof);
    }
    // 짧은 꼬리
    const tail=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.010,0.15,4),lm(dark));
    tail.rotation.x=Math.PI/2+0.5; tail.position.set(0,0.62,0.78); g.add(tail);
    g.userData.parts=p; return g;
  },

  // ════════════════════════════════════════════════════
  // 5. 고릴라 (gorilla) — 너클보행 + 거대 등/가슴
  // ════════════════════════════════════════════════════
  cm3_gorilla(color) {
    const g=new THREE.Group(), p={};
    const dark=new THREE.Color(color).multiplyScalar(0.38).getHex();
    const SKIN=0x2a1a0a, FACE=0x1a1208;
    // ★ 거대한 몸통 (은등 느낌)
    const body=new THREE.Mesh(new THREE.SphereGeometry(0.34,10,9),lm(color));
    body.scale.set(1.12,1.05,1.05); body.position.y=0.58; g.add(body); p.body=body;
    const chest=new THREE.Mesh(new THREE.SphereGeometry(0.28,9,8),lm(dark));
    chest.scale.set(1.0,0.92,0.55); chest.position.set(0,0.62,-0.35); g.add(chest);
    // ★ 은색 등 (실버백)
    const silverback=new THREE.Mesh(new THREE.SphereGeometry(0.28,8,7),lm(0xaaaaaa));
    silverback.scale.set(1.05,0.60,0.95); silverback.position.set(0,0.78,0.12); g.add(silverback);
    // 목 (없는 것처럼 짧음)
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.22,0.16,7),lm(color));
    neck.position.set(0,0.90,-0.28); g.add(neck);
    // 큰 머리 (시상 능선)
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.24,9,8),lm(FACE));
    head.scale.set(0.95,0.98,1.02); head.position.set(0,1.02,-0.32); g.add(head); p.head=head;
    // ★ 시상 능선 (두정부 볏)
    const sagittal=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.10,0.26),lm(color));
    sagittal.position.set(0,1.14,-0.28); g.add(sagittal);
    // 안와 상융기 (눈두덩)
    const brow=new THREE.Mesh(new THREE.BoxGeometry(0.38,0.055,0.08),lm(color));
    brow.position.set(0,1.04,-0.48); g.add(brow);
    // 납작 넓은 코
    const nose=new THREE.Mesh(new THREE.BoxGeometry(0.10,0.065,0.04),lm(SKIN));
    nose.position.set(0,0.980,-0.518); g.add(nose);
    for(const s of[-1,1]){
      const nostril=new THREE.Mesh(new THREE.SphereGeometry(0.018,4,4),lm(FACE));
      nostril.position.set(s*0.030,0.972,-0.530); g.add(nostril);
    }
    for(const s of[-1,1]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.025,5,5),lm(0x443322));
      eye.position.set(s*0.115,1.025,-0.486); g.add(eye);
      const pupil=new THREE.Mesh(new THREE.SphereGeometry(0.015,4,4),lm(FACE));
      pupil.position.set(s*0.118,1.025,-0.504); g.add(pupil);
    }
    // 입 (두꺼운 입술)
    const lip=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.045,0.06),lm(SKIN));
    lip.position.set(0,0.950,-0.516); g.add(lip);
    // ★ 긴 팔 (너클보행)
    const armGrp=new THREE.Group(); p.arms=armGrp;
    for(const s of[-1,1]){
      const shoulder=new THREE.Mesh(new THREE.SphereGeometry(0.10,7,6),lm(color));
      shoulder.position.set(s*0.385,0.72,-0.10); armGrp.add(shoulder);
      const upper=new THREE.Mesh(new THREE.CylinderGeometry(0.065,0.055,0.38,6),lm(color));
      upper.position.set(s*0.460,0.56,-0.10); upper.rotation.z=s*0.45; armGrp.add(upper);
      const lower=new THREE.Mesh(new THREE.CylinderGeometry(0.048,0.038,0.36,6),lm(dark));
      lower.position.set(s*0.560,0.32,-0.10); lower.rotation.z=s*0.20; armGrp.add(lower);
      // 너클 (주먹 쥔 손)
      const knuckle=new THREE.Mesh(new THREE.SphereGeometry(0.065,7,6),lm(SKIN));
      knuckle.scale.set(1.0,0.68,0.85); knuckle.position.set(s*0.620,0.12,-0.08); armGrp.add(knuckle);
    }
    g.add(armGrp);
    // 다리 (짧고 굵음)
    for(const s of[-1,1]){
      const thigh=new THREE.Mesh(new THREE.CylinderGeometry(0.090,0.078,0.38,6),lm(color));
      thigh.position.set(s*0.148,0.22,0.14); g.add(thigh);
      const shin=new THREE.Mesh(new THREE.CylinderGeometry(0.068,0.056,0.30,6),lm(dark));
      shin.position.set(s*0.148,0.00,0.22); shin.rotation.x=0.20; g.add(shin);
      const foot=new THREE.Mesh(new THREE.SphereGeometry(0.068,6,5),lm(SKIN));
      foot.scale.set(0.95,0.42,1.40); foot.position.set(s*0.148,-0.14,0.32); g.add(foot);
    }
    g.userData.parts=p; return g;
  },

  // ════════════════════════════════════════════════════
  // 6. 코브라 (cobra) — 넓은 후드 + 비늘 + 혀
  // ════════════════════════════════════════════════════
  cm3_cobra(color) {
    const g=new THREE.Group(), p={};
    const dark=new THREE.Color(color).multiplyScalar(0.44).getHex();
    const BELLY=0xeeddaa, TONGUE=0xff2244;
    // ★ 직립한 몸통 (S자 코일 + 들어올린 앞부분)
    const segs=[]; const NSEG=14;
    for(let i=0;i<NSEG;i++){
      const t=i/(NSEG-1);
      let x,y,z;
      if(i<4){ // 아래 코일
        const a=(i/3)*Math.PI*0.8;
        x=Math.sin(a)*0.08; y=0.04+i*0.04; z=Math.cos(a)*0.10-0.04;
      } else { // 직립 S자
        const tt=(i-4)/9;
        x=Math.sin(tt*Math.PI*1.5)*0.06;
        y=0.20+tt*0.58;
        z=-0.04+Math.sin(tt*Math.PI)*0.04;
      }
      const r=0.075-t*0.038;
      const seg=new THREE.Mesh(new THREE.SphereGeometry(Math.max(r,0.020),7,6),
        lm(i%2===0?color:dark));
      seg.scale.set(1.0,0.82,1.0); seg.position.set(x,y,z); g.add(seg); segs.push(seg);
    }
    p.segments=segs;
    // 배 (밝은 색)
    for(let i=2;i<NSEG;i++){
      const pos=segs[i].position;
      const belly=new THREE.Mesh(new THREE.SphereGeometry(0.048-i*0.002,5,4),lm(BELLY));
      belly.scale.set(0.65,0.30,0.95); belly.position.set(pos.x,pos.y,pos.z-0.02); g.add(belly);
    }
    // ★ 후드 (코브라 핵심)
    const hood=new THREE.Mesh(new THREE.SphereGeometry(0.18,10,8),
      lm(new THREE.Color(color).lerp(new THREE.Color(0xffffff),0.15).getHex()));
    hood.scale.set(1.55,1.10,0.24); hood.position.set(0,0.72,-0.02); g.add(hood); p.hood=hood;
    // 후드 무늬 (안경 문양)
    const hoodMark=new THREE.Mesh(new THREE.TorusGeometry(0.068,0.016,4,10),lm(dark));
    hoodMark.scale.set(1.4,1.0,0.2); hoodMark.position.set(0,0.72,-0.03); g.add(hoodMark);
    // 머리
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.088,8,7),lm(color));
    head.scale.set(1.0,0.78,1.05); head.position.set(0,0.80,-0.01); g.add(head); p.head=head;
    // 눈
    for(const s of[-1,1]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.022,5,5),lm(0xffdd00));
      eye.position.set(s*0.058,0.815,-0.070); g.add(eye);
      const pupil=new THREE.Mesh(new THREE.SphereGeometry(0.012,4,4),lm(0x111111));
      pupil.scale.set(0.4,1,0.4); pupil.position.set(s*0.062,0.815,-0.086); g.add(pupil);
    }
    // ★ 갈라진 혀
    const tongueBase=new THREE.Mesh(new THREE.CylinderGeometry(0.008,0.006,0.06,4),lm(TONGUE));
    tongueBase.rotation.x=Math.PI/2; tongueBase.position.set(0,0.780,-0.090); g.add(tongueBase);
    for(const s of[-1,1]){
      const fork=new THREE.Mesh(new THREE.CylinderGeometry(0.004,0.003,0.05,3),lm(TONGUE));
      fork.position.set(s*0.012,0.780,-0.122); fork.rotation.z=s*0.35; fork.rotation.x=Math.PI/2;
      g.add(fork);
    }
    // 비늘 무늬
    for(let i=2;i<NSEG-2;i+=2){
      const pos=segs[i].position;
      const scale2=new THREE.Mesh(new THREE.SphereGeometry(0.040,4,3),lm(dark));
      scale2.scale.set(1.1,0.22,0.95); scale2.position.copy(pos);
      scale2.position.z-=0.045; g.add(scale2);
    }
    g.userData.parts=p; return g;
  },

  // ════════════════════════════════════════════════════
  // 7. 재규어 (jaguar) — 낮은 자세 + 강한 링 반점
  // ════════════════════════════════════════════════════
  cm3_jaguar(color) {
    const g=new THREE.Group(), p={};
    const dark=new THREE.Color(color).multiplyScalar(0.44).getHex();
    const spotTex=canvasTex(64,64,(ctx,w,h)=>{
      ctx.fillStyle=hx(color); ctx.fillRect(0,0,w,h);
      // 재규어 특유의 링 반점 (내부 점 있는 원)
      const SPOTS=[[14,16],[46,14],[28,36],[52,38],[12,50],[42,52],[28,16]];
      SPOTS.forEach(([x,y])=>{
        ctx.strokeStyle='rgba(50,20,0,0.65)'; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.arc(x,y,7,0,Math.PI*2); ctx.stroke();
        ctx.fillStyle='rgba(50,20,0,0.38)';
        ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();
      });
    });
    const smat=lms(0xffffff,{map:spotTex});
    // 낮고 근육질 몸통
    const body=new THREE.Mesh(new THREE.BoxGeometry(0.50,0.38,1.0),smat.clone());
    body.position.y=0.22; g.add(body); p.body=body;
    const shoulder=new THREE.Mesh(new THREE.SphereGeometry(0.26,7,6),smat.clone());
    shoulder.scale.set(1.12,0.88,0.80); shoulder.position.set(0,0.32,-0.30); g.add(shoulder);
    const hip=new THREE.Mesh(new THREE.SphereGeometry(0.22,7,5),smat.clone());
    hip.scale.set(1.08,0.75,0.76); hip.position.set(0,0.24,0.32); g.add(hip);
    // 목
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.16,0.26,6),smat.clone());
    neck.position.set(0,0.38,-0.58); neck.rotation.x=0.38; g.add(neck);
    // 크고 둥근 머리
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.20,9,8),smat.clone());
    head.scale.set(1.05,0.98,0.98); head.position.set(0,0.40,-0.78); g.add(head); p.head=head;
    for(const s of[-1,1]){
      const ear=new THREE.Mesh(new THREE.ConeGeometry(0.050,0.12,4),lm(color));
      ear.position.set(s*0.118,0.562,-0.748); g.add(ear);
      const earIn=new THREE.Mesh(new THREE.ConeGeometry(0.030,0.08,4),lm(0xffaaaa));
      earIn.position.set(s*0.118,0.562,-0.750); g.add(earIn);
    }
    for(const s of[-1,1]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.030,5,5),lm(0x44cc00));
      eye.position.set(s*0.108,0.428,-0.890); g.add(eye);
      const pupil=new THREE.Mesh(new THREE.SphereGeometry(0.017,4,4),lm(0x111111));
      pupil.position.set(s*0.110,0.428,-0.908); g.add(pupil);
    }
    // 코 + 수염
    const nose=new THREE.Mesh(new THREE.SphereGeometry(0.028,5,5),lm(0xffaabb));
    nose.scale.set(1.1,0.72,0.8); nose.position.set(0,0.402,-0.904); g.add(nose);
    // ★ S자 긴 꼬리
    for(let i=0;i<7;i++){
      const t=i/6, r=0.045-t*0.014;
      const ts=new THREE.Mesh(new THREE.SphereGeometry(r,5,4),i>5?lm(dark):smat.clone());
      const a=(i/6.5)*2.0;
      ts.position.set(0,0.16+Math.sin(a)*0.22,0.54+i*0.19); g.add(ts);
    }
    // 낮고 굵은 4다리
    for(const[sx,sz] of [[-0.18,-0.30],[0.18,-0.30],[-0.18,0.30],[0.18,0.30]]){
      const thigh=new THREE.Mesh(new THREE.CylinderGeometry(0.058,0.048,0.26,5),smat.clone());
      thigh.position.set(sx,0.08,sz); g.add(thigh);
      const shin=new THREE.Mesh(new THREE.CylinderGeometry(0.040,0.032,0.22,5),smat.clone());
      shin.position.set(sx,-0.06,sz+0.02); shin.rotation.x=0.16; g.add(shin);
      const paw=new THREE.Mesh(new THREE.SphereGeometry(0.046,6,5),lm(0xddccaa));
      paw.scale.set(1.10,0.44,1.20); paw.position.set(sx,-0.18,sz+0.04); g.add(paw);
    }
    g.userData.parts=p; return g;
  },

  // ════════════════════════════════════════════════════
  // 8. 코끼리 (elephant) — 긴 코 + 넓은 귀 + 상아
  // ════════════════════════════════════════════════════
  cm3_elephant(color) {
    const g=new THREE.Group(), p={};
    const dark=new THREE.Color(color).multiplyScalar(0.48).getHex();
    const TUSK=0xfff5dc, DARK=0x111111;
    // 거대 몸통
    const body=new THREE.Mesh(new THREE.SphereGeometry(0.38,10,9),lm(color));
    body.scale.set(1.05,0.98,1.50); body.position.y=0.65; g.add(body); p.body=body;
    // 어깨 + 엉덩이
    const shoulder=new THREE.Mesh(new THREE.SphereGeometry(0.30,8,7),lm(color));
    shoulder.scale.set(1.08,0.88,0.82); shoulder.position.set(0,0.82,-0.40); g.add(shoulder);
    const hip=new THREE.Mesh(new THREE.SphereGeometry(0.28,8,7),lm(color));
    hip.scale.set(1.05,0.80,0.80); hip.position.set(0,0.72,0.48); g.add(hip);
    // 목 (짧고 굵음)
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.25,0.26,7),lm(color));
    neck.position.set(0,0.88,-0.72); neck.rotation.x=0.28; g.add(neck);
    // 큰 머리
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.30,9,8),lm(color));
    head.scale.set(0.98,0.95,0.95); head.position.set(0,0.88,-1.02); g.add(head); p.head=head;
    // ★ 넓은 귀 (아프리카 코끼리)
    for(const s of[-1,1]){
      const ear=new THREE.Mesh(new THREE.SphereGeometry(0.26,8,7),lm(dark));
      ear.scale.set(0.28,1.10,1.15); ear.position.set(s*0.332,0.88,-0.98); g.add(ear);
      const earIn=new THREE.Mesh(new THREE.SphereGeometry(0.20,7,6),lm(new THREE.Color(color).lerp(new THREE.Color(0xffaaaa),0.3).getHex()));
      earIn.scale.set(0.18,0.88,0.92); earIn.position.set(s*0.318,0.88,-0.984); g.add(earIn);
    }
    // 이마 + 머리 정수리 두 혹
    const dome=new THREE.Mesh(new THREE.SphereGeometry(0.16,7,6),lm(color));
    dome.scale.set(1.0,0.60,0.75); dome.position.set(0,1.14,-0.98); g.add(dome);
    // 눈 (작고 옆에)
    for(const s of[-1,1]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.025,5,5),lm(DARK));
      eye.position.set(s*0.225,0.925,-1.102); g.add(eye);
      const sh=new THREE.Mesh(new THREE.SphereGeometry(0.008,4,4),bm(0xffffff));
      sh.position.set(s*0.232,0.932,-1.118); g.add(sh);
    }
    // ★★ 긴 코 (코끼리 핵심 — 6절 + S커브)
    const trunkGrp=new THREE.Group(); p.trunk=trunkGrp;
    const TRUNK_POS=[
      [0,0.78,-1.18],[0,0.66,-1.24],[0,0.52,-1.26],[0,0.38,-1.22],
      [0,0.26,-1.12],[0,0.14,-0.98]
    ];
    for(let i=0;i<TRUNK_POS.length;i++){
      const t=i/(TRUNK_POS.length-1);
      const r=0.068-t*0.025;
      const ts=new THREE.Mesh(new THREE.SphereGeometry(Math.max(r,0.030),7,6),lm(color));
      ts.scale.set(0.88,1.0,0.88); ts.position.set(...TRUNK_POS[i]); trunkGrp.add(ts);
    }
    // 코 끝 (주름+노스트릴)
    const tip=new THREE.Mesh(new THREE.SphereGeometry(0.040,6,6),lm(dark));
    tip.position.set(0,0.078,-0.920); trunkGrp.add(tip);
    g.add(trunkGrp);
    // ★ 상아 2개
    for(const s of[-1,1]){
      for(let i=0;i<5;i++){
        const t=i/4, r=0.028-t*0.014;
        const ts=new THREE.Mesh(new THREE.SphereGeometry(Math.max(r,0.010),5,4),lm(TUSK));
        const a=t*Math.PI*0.65;
        ts.position.set(s*(0.118+Math.sin(a)*0.14),0.738-Math.sin(a)*0.055,-1.120-Math.cos(a)*0.22);
        g.add(ts);
      }
    }
    // 4다리 (기둥 형)
    for(const[sx,sz] of [[-0.24,-0.36],[0.24,-0.36],[-0.24,0.40],[0.24,0.40]]){
      const pillar=new THREE.Mesh(new THREE.CylinderGeometry(0.090,0.098,0.68,7),lm(color));
      pillar.position.set(sx,0.34,sz); g.add(pillar);
      const hoof=new THREE.Mesh(new THREE.CylinderGeometry(0.096,0.102,0.09,7),lm(DARK));
      hoof.position.set(sx,0.005,sz); g.add(hoof);
    }
    // 꼬리 (얇고 털 술)
    const tail=new THREE.Mesh(new THREE.CylinderGeometry(0.014,0.006,0.20,4),lm(dark));
    tail.rotation.x=Math.PI/2+0.5; tail.position.set(0,0.62,0.82); g.add(tail);
    const tailTip=new THREE.Mesh(new THREE.SphereGeometry(0.028,5,5),lm(DARK));
    tailTip.position.set(0,0.52,1.00); g.add(tailTip);
    g.userData.parts=p; return g;
  },

  // ════════════════════════════════════════════════════
  // 9. 코뿔소 (rhino) — 갑옷 피부 + 큰 뿔 + 낮은 자세
  // ════════════════════════════════════════════════════
  cm3_rhino(color) {
    const g=new THREE.Group(), p={};
    const dark=new THREE.Color(color).multiplyScalar(0.42).getHex();
    const HORN=0x2a2218, DARK=0x111111;
    // 갑옷 피부 텍스처
    const skinTex=canvasTex(64,64,(ctx,w,h)=>{
      ctx.fillStyle=hx(color); ctx.fillRect(0,0,w,h);
      ctx.strokeStyle='rgba(0,0,0,0.22)'; ctx.lineWidth=2;
      // 주름선
      for(let y=8;y<h;y+=14){ ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(w/3,y-3,2*w/3,y+3,w,y);ctx.stroke(); }
    });
    // 무거운 몸통
    const body=new THREE.Mesh(new THREE.SphereGeometry(0.36,10,9),lms(color,{map:skinTex}));
    body.scale.set(1.10,0.92,1.48); body.position.y=0.52; g.add(body); p.body=body;
    // 두꺼운 목 + 등혹
    const shoulder=new THREE.Mesh(new THREE.SphereGeometry(0.30,8,7),lm(color));
    shoulder.scale.set(1.12,0.98,0.82); shoulder.position.set(0,0.78,-0.36); g.add(shoulder);
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.26,0.22,7),lm(color));
    neck.position.set(0,0.72,-0.64); neck.rotation.x=0.22; g.add(neck);
    // 머리 (납작 넓음)
    const head=new THREE.Mesh(new THREE.BoxGeometry(0.48,0.36,0.52),lm(color));
    head.position.set(0,0.60,-0.96); g.add(head); p.head=head;
    const snout=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.28,0.28),lm(dark));
    snout.position.set(0,0.54,-1.14); g.add(snout);
    // ★★ 큰 앞뿔 + 작은 뒷뿔
    const horn1=new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.055,0.32,6),lm(HORN));
    horn1.rotation.x=-0.22; horn1.position.set(0,0.72,-1.16); g.add(horn1);
    const horn2=new THREE.Mesh(new THREE.CylinderGeometry(0.014,0.035,0.16,5),lm(HORN));
    horn2.rotation.x=-0.22; horn2.position.set(0,0.72,-0.92); g.add(horn2);
    // 눈 (작고 옆에)
    for(const s of[-1,1]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.026,5,5),lm(DARK));
      eye.position.set(s*0.188,0.650,-1.000); g.add(eye);
      const sh=new THREE.Mesh(new THREE.SphereGeometry(0.008,4,4),bm(0xffffff));
      sh.position.set(s*0.195,0.658,-1.016); g.add(sh);
    }
    // 작은 귀
    for(const s of[-1,1]){
      const ear=new THREE.Mesh(new THREE.SphereGeometry(0.048,6,5),lm(dark));
      ear.scale.set(0.55,1.0,0.65); ear.position.set(s*0.195,0.748,-0.880); g.add(ear);
    }
    // 주름 (피부 주름선)
    for(const z of[-0.10,0.15,0.38]){
      const fold=new THREE.Mesh(new THREE.TorusGeometry(0.355,0.022,4,16,Math.PI*1.2),lm(dark));
      fold.scale.set(1.08,0.28,1.45); fold.position.set(0,0.52,z);
      fold.rotation.y=Math.PI/2; g.add(fold);
    }
    // ★ 기둥 다리 4개
    for(const[sx,sz] of [[-0.24,-0.32],[0.24,-0.32],[-0.24,0.38],[0.24,0.38]]){
      const pillar=new THREE.Mesh(new THREE.CylinderGeometry(0.098,0.105,0.55,7),lm(color));
      pillar.position.set(sx,0.28,sz); g.add(pillar);
      const hoof=new THREE.Mesh(new THREE.CylinderGeometry(0.102,0.108,0.08,7),lm(DARK));
      hoof.position.set(sx,0.005,sz); g.add(hoof);
    }
    // 작은 꼬리
    const tail=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.010,0.14,4),lm(dark));
    tail.rotation.x=Math.PI/2+0.45; tail.position.set(0,0.52,0.76); g.add(tail);
    g.userData.parts=p; return g;
  },

  // ════════════════════════════════════════════════════
  // 10. 펭귄 (penguin) — 흑백 + 통통 비율 + 지느러미 팔
  // ════════════════════════════════════════════════════
  cm3_penguin(color) {
    const g=new THREE.Group(), p={};
    const BLK=0x111111, WHT=0xffffff, ORG=0xff8800;
    // 통통한 수직 몸통
    const body=new THREE.Mesh(new THREE.SphereGeometry(0.24,9,8),lm(BLK));
    body.scale.set(0.82,1.35,0.86); body.position.y=0.28; g.add(body); p.body=body;
    // ★ 흰 배 (펭귄 핵심 패턴)
    const belly=new THREE.Mesh(new THREE.SphereGeometry(0.20,8,7),lm(WHT));
    belly.scale.set(0.60,1.10,0.55); belly.position.set(0,0.28,-0.08); g.add(belly);
    // ★ 지느러미 팔
    for(const s of[-1,1]){
      const flipper=new THREE.Mesh(new THREE.SphereGeometry(0.12,7,6),lm(BLK));
      flipper.scale.set(0.28,0.95,1.30); flipper.position.set(s*0.235,0.22,0.02);
      flipper.rotation.z=s*0.18; g.add(flipper);
      const flipTip=new THREE.Mesh(new THREE.ConeGeometry(0.025,0.10,4),lm(BLK));
      flipTip.position.set(s*0.235,-0.06,0.08); flipTip.rotation.z=s*0.3; flipTip.rotation.x=0.4;
      g.add(flipTip);
    }
    // 큰 머리 (body와 거의 같은 크기)
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.20,9,8),lm(BLK));
    head.scale.set(0.94,1.0,0.94); head.position.set(0,0.66,-0.04); g.add(head); p.head=head;
    // 흰 얼굴 패치
    const face=new THREE.Mesh(new THREE.SphereGeometry(0.16,7,6),lm(WHT));
    face.scale.set(0.78,0.82,0.38); face.position.set(0,0.68,-0.12); g.add(face);
    // 눈 (귀엽고 크게)
    for(const s of[-1,1]){
      const eye=new THREE.Mesh(new THREE.SphereGeometry(0.042,6,6),lm(BLK));
      eye.position.set(s*0.092,0.710,-0.192); g.add(eye);
      const shine=new THREE.Mesh(new THREE.SphereGeometry(0.016,4,4),bm(WHT));
      shine.position.set(s*0.100,0.722,-0.225); g.add(shine);
    }
    // 황색 눈 테두리 (황제펭귄 느낌)
    for(const s of[-1,1]){
      const ring=new THREE.Mesh(new THREE.TorusGeometry(0.038,0.009,4,8),lm(ORG));
      ring.position.set(s*0.092,0.710,-0.196); ring.rotation.y=Math.PI/2; g.add(ring);
    }
    // ★ 주황 부리
    const beak=new THREE.Mesh(new THREE.ConeGeometry(0.040,0.12,4),lm(ORG));
    beak.rotation.x=Math.PI/2; beak.position.set(0,0.648,-0.248); g.add(beak);
    // 발 (주황)
    for(const s of[-1,1]){
      const foot=new THREE.Mesh(new THREE.SphereGeometry(0.050,6,5),lm(ORG));
      foot.scale.set(1.20,0.35,1.55); foot.position.set(s*0.072,-0.04,0.02); g.add(foot);
      // 발가락 3개
      for(let fi=0;fi<3;fi++){
        const toe=new THREE.Mesh(new THREE.CylinderGeometry(0.010,0.007,0.085,4),lm(ORG));
        const fa=(fi-1)*0.32;
        toe.position.set(s*(0.072+Math.sin(fa)*0.02),-0.040,-0.062+fi*0.006);
        toe.rotation.x=-0.5; toe.rotation.z=fa*0.4; g.add(toe);
      }
    }
    g.userData.parts=p; return g;
  },
};

// ─────────────────────────────────────────────────────────────────
export const DETAILED_SHAPE_MAP3 = {
  snow_leopard: 'cm3_snow_leopard',
  polar_bear:   'cm3_polar_bear',
  reindeer:     'cm3_reindeer',
  mammoth:      'cm3_mammoth',
  gorilla:      'cm3_gorilla',
  cobra:        'cm3_cobra',
  jaguar:       'cm3_jaguar',
  elephant:     'cm3_elephant',
  rhino:        'cm3_rhino',
  penguin:      'cm3_penguin',
};
