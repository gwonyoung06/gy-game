import * as THREE from 'three';

const lm  = (c, o={}) => new THREE.MeshLambertMaterial({ color:c, ...o });
const lms = (c, o={}) => new THREE.MeshLambertMaterial({ color:c, flatShading:true, ...o });
const bm  = (c, o={}) => new THREE.MeshBasicMaterial({ color:c, ...o });

function canvasTex(w, h, fn) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  fn(cv.getContext('2d'), w, h);
  return new THREE.CanvasTexture(cv);
}
function hx(n) { return '#' + n.toString(16).padStart(6,'0'); }

// ─── cm5_jade_rabbit ──────────────────────────────────────────────
// 옥토끼: 옥(jade) 빛 흰 토끼, 긴 귀, 방아 절구
function cm5_jade_rabbit(color) {
  const g = new THREE.Group();
  const jadeMat  = lm(0xd4f5e2, { transparent:true, opacity:0.92 });
  const whiteMat = lm(0xeeeeff);
  const pinkMat  = lm(0xffbbcc);
  const goldMat  = lm(0xffdd88);
  const glowMat  = bm(0xaaddff, { transparent:true, opacity:0.22, side:THREE.FrontSide });

  // Outer glow aura
  const aura = new THREE.Mesh(new THREE.SphereGeometry(0.52,10,8), glowMat);
  g.add(aura);

  // Body — round jade-white
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.28,9,8), whiteMat);
  body.scale.set(0.88,1.0,0.92); body.position.y=0.22; g.add(body);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2,9,8), whiteMat);
  head.scale.set(0.95,0.92,0.9); head.position.set(0,0.56,0); g.add(head);

  // Ears — long upright
  for (const x of [-0.1,0.1]) {
    const earOuter = new THREE.Mesh(new THREE.CapsuleGeometry(0.045,0.52,5,7), whiteMat);
    earOuter.position.set(x,1.04,0.02); g.add(earOuter);
    const earInner = new THREE.Mesh(new THREE.CapsuleGeometry(0.025,0.38,4,6), pinkMat);
    earInner.position.set(x,1.04,0.04); g.add(earInner);
  }

  // Face — eyes (large, sparkling)
  for (const x of [-0.08,0.08]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.038,7,7), lm(0xff4488));
    eye.position.set(x,0.6,-0.16); g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.022,5,5), lm(0x110033));
    pupil.position.set(x,0.6,-0.195); g.add(pupil);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.01,4,4), bm(0xffffff));
    shine.position.set(x-0.012,0.612,-0.2); g.add(shine);
    // Jade glint ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.048,0.008,5,10), lm(0x88ffcc));
    ring.position.set(x,0.6,-0.188); g.add(ring);
  }

  // Nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.018,5,4), pinkMat);
  nose.position.set(0,0.554,-0.196); g.add(nose);

  // Mouth — small curve (2 spheres)
  for (const mx of [-0.025,0.025]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.012,4,4), pinkMat);
    m.position.set(mx,0.534,-0.196); g.add(m);
  }

  // Cheek glow spots
  for (const x of [-0.13,0.13]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.04,6,5), bm(0xffaabb, { transparent:true, opacity:0.45 }));
    cheek.position.set(x,0.558,-0.17); g.add(cheek);
  }

  // Arms
  for (const x of [-0.24,0.24]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055,0.2,4,7), whiteMat);
    arm.position.set(x,0.24,-0.06); arm.rotation.z=x<0?0.7:-0.7; g.add(arm);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.06,6,5), whiteMat);
    paw.position.set(x<0?-0.36:0.36, 0.14,-0.02); g.add(paw);
  }

  // Legs
  for (const x of [-0.14,0.14]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07,0.18,4,7), whiteMat);
    leg.position.set(x,-0.06,0.04); g.add(leg);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.08,6,5), whiteMat);
    foot.scale.set(0.7,0.55,1.4); foot.position.set(x,-0.2,0.1); g.add(foot);
  }

  // Tail — fluffy white ball
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.1,7,6), whiteMat);
  tail.position.set(0,0.18,0.28); g.add(tail);

  // Mortar (절구) — accessory the rabbit holds/stands near
  const mortarBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.1,0.14,8), goldMat);
  mortarBase.position.set(0.3,0.06,0.0); g.add(mortarBase);
  const mortarTop = new THREE.Mesh(new THREE.TorusGeometry(0.12,0.03,6,10), goldMat);
  mortarTop.position.set(0.3,0.14,0.0); g.add(mortarTop);
  // Pestle
  const pestle = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.018,0.3,6), jadeMat);
  pestle.position.set(0.3,0.28,0.0); pestle.rotation.z=0.35; g.add(pestle);

  // Jade gem — on body
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.06,0), jadeMat);
  gem.position.set(0,0.32,-0.22); g.add(gem);

  // Floating star particles
  for (let i=0;i<6;i++) {
    const a = (i/6)*Math.PI*2;
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.024,0), lm(0xaaddff, { transparent:true, opacity:0.72 }));
    star.position.set(Math.cos(a)*0.44, 0.28+Math.sin(a*2)*0.12, Math.sin(a)*0.44);
    g.add(star);
  }

  g.userData.parts = { body, head };
  return g;
}

// ─── cm5_moon_crab ────────────────────────────────────────────────
// 달 게: 은빛 갑각, 달빛 발광 클로, 8다리
function cm5_moon_crab(color) {
  const g = new THREE.Group();
  const shellMat = lm(0xbbc8dd);
  const glowMat  = bm(0xaaccff, { transparent:true, opacity:0.55 });
  const eyeMat   = lm(0xeeeeff);
  const clawMat  = lm(0xddeeff);

  // Shell canvas — crescent moon pattern
  const shellTex = canvasTex(128,128,(ctx,w,h)=>{
    // Base silver-blue
    const grad = ctx.createRadialGradient(w/2,h/2,8, w/2,h/2,60);
    grad.addColorStop(0,'#d0dcee'); grad.addColorStop(1,'#8899bb');
    ctx.fillStyle=grad; ctx.fillRect(0,0,w,h);
    // Crescent marking
    ctx.fillStyle='rgba(180,200,255,0.45)';
    ctx.beginPath(); ctx.arc(w*0.5,h*0.5,28,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(80,100,160,0.35)';
    ctx.beginPath(); ctx.arc(w*0.58,h*0.44,22,0,Math.PI*2); ctx.fill();
    // Ridge lines
    ctx.strokeStyle='rgba(150,170,210,0.5)'; ctx.lineWidth=2;
    for(let i=0;i<5;i++){
      ctx.beginPath(); ctx.arc(w/2,h/2, 15+i*10,Math.PI*0.8,Math.PI*2.2); ctx.stroke();
    }
  });
  const shellTexMat = new THREE.MeshLambertMaterial({ map:shellTex });

  // Main carapace — wide flat dome
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.34,10,8), shellTexMat);
  shell.scale.set(1.35,0.52,1.0); shell.position.y=0.22; g.add(shell);

  // Underbody
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.28,8,6), lm(0x99aabb));
  belly.scale.set(1.2,0.32,0.9); belly.position.y=0.1; g.add(belly);

  // Eyes on stalks
  for (const x of [-0.18,0.18]) {
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.02,0.2,6), shellMat);
    stalk.position.set(x,0.36,-0.24); stalk.rotation.x=-0.4; g.add(stalk);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055,7,7), eyeMat);
    eye.position.set(x,0.46,-0.34); g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.032,6,6), lm(0x223366));
    pupil.position.set(x,0.46,-0.39); g.add(pupil);
    const eyeGlow = new THREE.Mesh(new THREE.SphereGeometry(0.065,7,7), glowMat);
    eyeGlow.position.set(x,0.46,-0.34); g.add(eyeGlow);
  }

  // Mouth area
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.24,0.06,0.12), lm(0x8899aa));
  mouth.position.set(0,0.14,-0.3); g.add(mouth);
  // Mandibles
  for (const x of [-0.08,0.08]) {
    const mand = new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.012,0.12,4), shellMat);
    mand.position.set(x,0.14,-0.38); mand.rotation.x=0.5; mand.rotation.z=x<0?0.3:-0.3; g.add(mand);
  }

  // Big claws — 2
  for (const x of [-1,1]) {
    // Upper arm
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.055,0.28,6), shellMat);
    upper.position.set(x*0.34,0.16,-0.14); upper.rotation.z=x*(-1.1); upper.rotation.x=0.3; g.add(upper);
    // Lower arm
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.06,0.24,6), shellMat);
    lower.position.set(x*0.52,0.1,-0.3); lower.rotation.z=x*(-0.9); lower.rotation.x=0.5; g.add(lower);
    // Claw base
    const clawBase = new THREE.Mesh(new THREE.SphereGeometry(0.1,7,6), clawMat);
    clawBase.scale.set(1.2,0.8,1.0); clawBase.position.set(x*0.64,0.06,-0.48); g.add(clawBase);
    // Upper claw finger
    const cf1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.02,0.2,5), clawMat);
    cf1.position.set(x*0.68,0.12,-0.6); cf1.rotation.z=x*(-0.4); cf1.rotation.x=-0.6; g.add(cf1);
    // Lower claw finger
    const cf2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.016,0.18,5), clawMat);
    cf2.position.set(x*0.64,0.0,-0.6); cf2.rotation.z=x*(-0.4); cf2.rotation.x=0.5; g.add(cf2);
    // Claw glow
    const cg = new THREE.Mesh(new THREE.SphereGeometry(0.12,7,6), glowMat);
    cg.position.set(x*0.64,0.06,-0.48); g.add(cg);
  }

  // Walking legs — 3 pairs each side
  for (const sx of [-1,1]) {
    for (let li=0;li<3;li++) {
      const angle = sx*(0.5+li*0.25);
      const zOff = -0.1+li*0.18;
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.022,0.3,5), shellMat);
      upper.position.set(sx*0.38, 0.12, zOff);
      upper.rotation.z=angle; upper.rotation.x=0.2; g.add(upper);
      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.024,0.26,5), shellMat);
      lower.position.set(sx*0.56, -0.02, zOff+0.06);
      lower.rotation.z=angle*0.7; lower.rotation.x=0.5; g.add(lower);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.014,0.1,4), lm(0xaabbcc));
      tip.position.set(sx*0.68,-0.14,zOff+0.1);
      tip.rotation.z=angle*0.4; tip.rotation.x=0.6; g.add(tip);
    }
  }

  // Moon glow ring around shell
  const moonRing = new THREE.Mesh(new THREE.TorusGeometry(0.44,0.025,6,20), bm(0xbbddff, { transparent:true, opacity:0.4 }));
  moonRing.rotation.x=Math.PI/2 - 0.15; moonRing.position.y=0.24; g.add(moonRing);

  g.userData.parts = { body: shell };
  return g;
}

// ─── cm5_meteor_bug ───────────────────────────────────────────────
// 운석충: 운석에서 태어난 갑충, 불꽃 날개, 크레이터 갑옷
function cm5_meteor_bug(color) {
  const g = new THREE.Group();
  const rockMat  = lm(0x665544);
  const fireMat  = bm(0xff6622, { transparent:true, opacity:0.78 });
  const emberMat = lm(0xff4400);
  const coreMat  = bm(0xffdd00, { transparent:true, opacity:0.9 });

  // Rock/crater shell canvas
  const rockTex = canvasTex(128,128,(ctx,w,h)=>{
    ctx.fillStyle='#5c4433'; ctx.fillRect(0,0,w,h);
    // Craters
    for(let i=0;i<12;i++){
      const cx=Math.random()*w, cy=Math.random()*h, cr=3+Math.random()*10;
      const rg = ctx.createRadialGradient(cx,cy,1,cx,cy,cr);
      rg.addColorStop(0,'rgba(0,0,0,0.55)'); rg.addColorStop(0.6,'rgba(100,80,60,0.2)'); rg.addColorStop(1,'rgba(100,80,60,0)');
      ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(cx,cy,cr,0,Math.PI*2); ctx.fill();
    }
    // Hot cracks
    ctx.strokeStyle='rgba(255,120,0,0.5)'; ctx.lineWidth=1.5;
    for(let i=0;i<6;i++){
      ctx.beginPath(); ctx.moveTo(w/2,h/2);
      let cx2=w/2, cy2=h/2;
      for(let j=0;j<5;j++){
        cx2+=(-15+Math.random()*30); cy2+=(-15+Math.random()*30);
        ctx.lineTo(cx2,cy2);
      }
      ctx.stroke();
    }
  });
  const shellTexMat = new THREE.MeshLambertMaterial({ map:rockTex });

  // Body — irregular meteor rock shape
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.28,9,7), shellTexMat);
  body.scale.set(0.95,0.82,1.18); body.position.y=0.24; g.add(body);

  // Rock bumps on back
  for (let i=0;i<7;i++) {
    const a = (i/7)*Math.PI*2;
    const bump = new THREE.Mesh(new THREE.SphereGeometry(0.06+Math.random()*0.04,5,4), rockMat);
    bump.position.set(Math.cos(a)*0.2, 0.34+Math.random()*0.1, Math.sin(a)*0.16);
    bump.scale.set(1,0.6+Math.random()*0.3,1); g.add(bump);
  }

  // Head — forward, glowing eyes
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17,8,7), shellTexMat);
  head.scale.set(0.95,0.88,1.0); head.position.set(0,0.34,-0.32); g.add(head);

  // Eyes — lava glow
  for (const x of [-0.08,0.08]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.042,7,7), lm(0xff8800));
    eye.position.set(x,0.38,-0.46); g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.024,5,5), lm(0xff2200));
    pupil.position.set(x,0.38,-0.5); g.add(pupil);
    const eyeCore = new THREE.Mesh(new THREE.SphereGeometry(0.01,4,4), bm(0xffff88));
    eyeCore.position.set(x,0.38,-0.505); g.add(eyeCore);
    const eyeGlow = new THREE.Mesh(new THREE.SphereGeometry(0.065,7,7), bm(0xff6600, { transparent:true, opacity:0.4 }));
    eyeGlow.position.set(x,0.38,-0.46); g.add(eyeGlow);
  }

  // Mandibles — rock-hard
  for (const x of [-0.1,0.1]) {
    const mand = new THREE.Mesh(new THREE.CylinderGeometry(0.028,0.016,0.2,5), rockMat);
    mand.position.set(x,0.3,-0.54); mand.rotation.z=x<0?0.6:-0.6; mand.rotation.x=0.6; g.add(mand);
  }

  // Fire wings — 2 pairs
  const wings = [];
  for (const sx of [-1,1]) {
    for (const bk of [0,1]) {
      const wGeo = new THREE.BufferGeometry();
      const scale = bk===0 ? 1.0 : 0.7;
      const verts = new Float32Array([
        0,0.28,0,
        sx*(0.26+bk*0.04)*scale, 0.44-bk*0.08, -0.2+bk*0.1,
        sx*(0.52+bk*0.04)*scale, 0.2,  0.12+bk*0.05,
        0,0.28,0,
        sx*(0.52+bk*0.04)*scale, 0.2,  0.12+bk*0.05,
        sx*(0.24)*scale, 0.14, 0.28,
      ]);
      wGeo.setAttribute('position', new THREE.BufferAttribute(verts,3));
      wGeo.computeVertexNormals();
      const wMat = new THREE.MeshBasicMaterial({
        color: bk===0 ? 0xff6622 : 0xff9944,
        transparent:true, opacity: bk===0 ? 0.72 : 0.55,
        side:THREE.DoubleSide
      });
      const wing = new THREE.Mesh(wGeo, wMat);
      g.add(wing); wings.push(wing);
    }
  }
  g.userData.wings = wings;

  // Legs — 3 pairs, rock-armored
  for (const sx of [-1,1]) {
    for (let li=0;li<3;li++) {
      const zOff = -0.12+li*0.18;
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.038,0.032,0.24,5), rockMat);
      upper.position.set(sx*0.26, 0.1, zOff);
      upper.rotation.z=sx*(-1.0); upper.rotation.x=0.2; g.add(upper);
      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.028,0.036,0.22,5), rockMat);
      lower.position.set(sx*0.42,-0.04,zOff+0.08);
      lower.rotation.z=sx*(-0.75); lower.rotation.x=0.5; g.add(lower);
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.02,0.1,4), lm(0x443322));
      claw.position.set(sx*0.56,-0.16,zOff+0.12);
      claw.rotation.z=sx*(-0.4); claw.rotation.x=0.7; g.add(claw);
    }
  }

  // Tail — short, glowing tip
  for (let i=0;i<3;i++) {
    const ts = new THREE.Mesh(new THREE.SphereGeometry(0.1-i*0.02,6,5), rockMat);
    ts.position.set(0, 0.22-i*0.03, 0.28+i*0.18); g.add(ts);
  }
  const tailGlow = new THREE.Mesh(new THREE.SphereGeometry(0.07,6,5), coreMat);
  tailGlow.position.set(0,0.15,0.62); g.add(tailGlow);

  // Meteor trail particles (floating embers)
  for (let i=0;i<8;i++) {
    const a = (i/8)*Math.PI*2;
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.02+Math.random()*0.02,4,4), bm(0xff6600, { transparent:true, opacity:0.6+Math.random()*0.3 }));
    ember.position.set(Math.cos(a)*0.38, 0.22+Math.random()*0.28, Math.sin(a)*0.38);
    g.add(ember);
  }

  g.userData.parts = { body, head, wings };
  return g;
}

// ─── cm5_moon_spirit ──────────────────────────────────────────────
// 달 정령: 반투명 달빛 정령, 크리스탈 형태, 유령처럼 부유
function cm5_moon_spirit(color) {
  const g = new THREE.Group();
  const spiritMat = lm(0xbbddff, { transparent:true, opacity:0.75 });
  const crystalMat = lm(0xddeeff, { transparent:true, opacity:0.88 });
  const coreMat   = bm(0xeeeeff, { transparent:true, opacity:0.95 });
  const glowMat   = bm(0xaaccff, { transparent:true, opacity:0.25, side:THREE.FrontSide });
  const accentMat = lm(0x88bbff);

  // Outer glow sphere
  const outerGlow = new THREE.Mesh(new THREE.SphereGeometry(0.6,10,8), glowMat);
  g.add(outerGlow);
  const midGlow = new THREE.Mesh(new THREE.SphereGeometry(0.48,10,8), bm(0xccddff, { transparent:true, opacity:0.15, side:THREE.FrontSide }));
  g.add(midGlow);

  // Main body — teardrop / ghost shape
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.28,10,9), spiritMat);
  body.scale.set(0.88,1.15,0.88); body.position.y=0.22; g.add(body);

  // Crystal core — glowing center
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.14,1), crystalMat);
  core.position.y=0.26; g.add(core);
  const innerCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.07,0), coreMat);
  innerCore.position.y=0.26; g.add(innerCore);

  // Head — rounded
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22,10,9), spiritMat);
  head.scale.set(0.9,0.88,0.9); head.position.set(0,0.54,0); g.add(head);

  // Face — moon crescent eyes
  for (const x of [-0.09,0.09]) {
    // Crescent eye shape using two overlapping circles (canvas texture)
    const eyeOuter = new THREE.Mesh(new THREE.SphereGeometry(0.04,7,7), lm(0x2244aa));
    eyeOuter.position.set(x,0.58,-0.2); g.add(eyeOuter);
    const eyeInner = new THREE.Mesh(new THREE.SphereGeometry(0.025,6,6), bm(0xaaccff));
    eyeInner.position.set(x+0.012,0.592,-0.22); g.add(eyeInner);
    // Eye glow
    const eg = new THREE.Mesh(new THREE.SphereGeometry(0.055,7,7), bm(0x4488ff, { transparent:true, opacity:0.45 }));
    eg.position.set(x,0.58,-0.2); g.add(eg);
  }

  // Moon symbol on forehead
  const moonSymbol = new THREE.Mesh(new THREE.TorusGeometry(0.055,0.016,6,12, Math.PI*1.5), lm(0xffffff));
  moonSymbol.position.set(0,0.68,-0.2); moonSymbol.rotation.z=0.8; g.add(moonSymbol);

  // Spirit tail — ghostly wisps
  for (let i=0;i<3;i++) {
    const wispAngle = (i/3)*Math.PI*2;
    const wisp = new THREE.Mesh(new THREE.CapsuleGeometry(0.04-i*0.005, 0.34+i*0.1,4,6), lm(0xaabbff, { transparent:true, opacity:0.5-i*0.1 }));
    wisp.position.set(Math.sin(wispAngle)*0.08, -0.1-i*0.1, Math.cos(wispAngle)*0.08);
    wisp.rotation.x=0.3+i*0.15; wisp.rotation.z=wispAngle;
    g.add(wisp);
  }

  // Floating crystal shards
  for (let i=0;i<8;i++) {
    const a = (i/8)*Math.PI*2;
    const r = 0.32+Math.random()*0.1;
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.032,0), lm(0xccddff, { transparent:true, opacity:0.7 }));
    shard.position.set(Math.cos(a)*r, 0.22+Math.sin(a*3)*0.14, Math.sin(a)*r);
    shard.rotation.set(Math.random(),Math.random(),Math.random());
    g.add(shard);
  }

  // Arm-like wisps
  for (const x of [-1,1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.04,0.28,4,7), spiritMat);
    arm.position.set(x*0.28,0.28,0.04); arm.rotation.z=x*0.9; g.add(arm);
    const hand = new THREE.Mesh(new THREE.OctahedronGeometry(0.055,0), crystalMat);
    hand.position.set(x*0.42,0.18,0.04); g.add(hand);
    const handGlow = new THREE.Mesh(new THREE.SphereGeometry(0.07,6,6), bm(0x88ccff, { transparent:true, opacity:0.45 }));
    handGlow.position.set(x*0.42,0.18,0.04); g.add(handGlow);
  }

  // Moon orbiting ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42,0.018,6,22), lm(0xaabbff, { transparent:true, opacity:0.55 }));
  ring.rotation.x=Math.PI/3; ring.position.y=0.26; g.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.38,0.012,5,20), lm(0xbbddff, { transparent:true, opacity:0.4 }));
  ring2.rotation.x=Math.PI/2.5; ring2.rotation.y=Math.PI/4; ring2.position.y=0.26; g.add(ring2);

  g.userData.parts = { body, head };
  return g;
}

// ─── cm5_moon_guardian ────────────────────────────────────────────
// 달의 수호자 (보스): 보름달 갑옷, 창, 왕관, 달빛 오라
function cm5_moon_guardian(color) {
  const g = new THREE.Group();
  const armorMat   = lm(0xbbccee);
  const armorDark  = lm(0x7788bb);
  const lunarMat   = lm(0xeeeeff);
  const cloakMat   = lm(0x9999cc, { transparent:true, opacity:0.88 });
  const glowMat    = bm(0xaabbff, { transparent:true, opacity:0.22, side:THREE.FrontSide });
  const spearMat   = lm(0xccddff);
  const goldMat    = lm(0xddcc88);
  const eyeGlowMat = bm(0xddeeff, { transparent:true, opacity:0.65 });

  // Boss aura — 3 rings
  for (let ri=0;ri<3;ri++) {
    const aura = new THREE.Mesh(new THREE.SphereGeometry(0.68+ri*0.1,12,10), bm(0xaabbff, { transparent:true, opacity:0.12-ri*0.03, side:THREE.FrontSide }));
    g.add(aura);
  }

  // Cloak — left and right panels
  for (const x of [-1,1]) {
    const cloak = new THREE.Mesh(new THREE.BufferGeometry(), cloakMat);
    const verts = new Float32Array([
      x*0.16,0.36,0.26,  x*0.52,0.36,-0.1,  x*0.58,0.1,0.38,
      x*0.16,0.36,0.26,  x*0.58,0.1,0.38,   x*0.1,0.1,0.52,
      x*0.1,0.1,0.52,   x*0.58,0.1,0.38,    x*0.46,-0.46,0.38,
      x*0.1,0.1,0.52,   x*0.46,-0.46,0.38,  x*0.06,-0.5,0.54,
    ]);
    cloak.geometry.setAttribute('position', new THREE.BufferAttribute(verts,3));
    cloak.geometry.computeVertexNormals();
    g.add(cloak);
  }

  // Body armor — torso
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3,10,9), armorMat);
  body.scale.set(0.88,0.95,0.84); body.position.y=0.38; g.add(body);

  // Chest crescent moon emblem
  const emblem = new THREE.Mesh(new THREE.TorusGeometry(0.1,0.022,6,14, Math.PI*1.6), lunarMat);
  emblem.position.set(0,0.42,-0.24); emblem.rotation.z=0.4; g.add(emblem);
  const emblemStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.04,0), goldMat);
  emblemStar.position.set(0,0.52,-0.24); g.add(emblemStar);

  // Shoulder pauldrons
  for (const x of [-1,1]) {
    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.16,8,7), armorMat);
    pauldron.scale.set(0.9,0.75,1.1); pauldron.position.set(x*0.36,0.48,-0.05); g.add(pauldron);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15,0.02,5,10), armorDark);
    rim.rotation.z=Math.PI/2; rim.position.set(x*0.37,0.48,-0.05); g.add(rim);
    // Shoulder spike
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.04,0.2,6), lunarMat);
    spike.position.set(x*0.38,0.62,-0.05); g.add(spike);
  }

  // Neck guard
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.18,0.2,8), armorMat);
  neck.position.set(0,0.6,-0.02); g.add(neck);

  // Helmet
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.22,10,9), armorMat);
  helm.scale.set(1,1.1,0.95); helm.position.set(0,0.88,0.02); g.add(helm);

  // Helmet visor / face guard
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28,0.14,0.06), armorDark);
  visor.position.set(0,0.86,-0.2); g.add(visor);

  // Helmet crest — crescent
  const helmCrest = new THREE.Mesh(new THREE.TorusGeometry(0.18,0.028,6,14, Math.PI), lunarMat);
  helmCrest.rotation.x=-Math.PI/2+0.2; helmCrest.position.set(0,1.06,0); g.add(helmCrest);

  // Helmet crown spikes
  for (let i=0;i<5;i++) {
    const a = (i/5)*Math.PI - Math.PI/2;
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.025,0.14+Math.sin((i/4)*Math.PI)*0.06,5), goldMat);
    sp.position.set(Math.cos(a)*0.18, 1.1, Math.sin(a)*0.06-0.02);
    sp.rotation.z=-Math.cos(a)*0.4; g.add(sp);
  }

  // Eyes — boss glow
  for (const x of [-0.09,0.09]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.042,7,7), lm(0xaabbff));
    eye.position.set(x,0.88,-0.22); g.add(eye);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.024,5,5), lm(0x2233aa));
    core.position.set(x,0.88,-0.26); g.add(core);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.01,4,4), bm(0xffffff));
    shine.position.set(x-0.014,0.892,-0.265); g.add(shine);
    const eg = new THREE.Mesh(new THREE.SphereGeometry(0.065,7,7), eyeGlowMat);
    eg.position.set(x,0.88,-0.22); g.add(eg);
  }

  // Arms — armored
  for (const x of [-1,1]) {
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.065,0.3,7), armorMat);
    upper.position.set(x*0.38,0.36,-0.02); upper.rotation.z=x*0.75; upper.rotation.x=0.15; g.add(upper);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.07,6,6), armorMat);
    elbow.position.set(x*0.5,0.22,-0.02); g.add(elbow);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.07,0.28,7), armorMat);
    lower.position.set(x*0.58,0.1,-0.02); lower.rotation.z=x*0.9; lower.rotation.x=0.1; g.add(lower);
    const gauntlet = new THREE.Mesh(new THREE.SphereGeometry(0.08,7,6), armorMat);
    gauntlet.position.set(x*0.66,-0.0,-0.02); g.add(gauntlet);
  }

  // Legs — armored
  for (const x of [-0.16,0.16]) {
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.09,0.36,7), armorMat);
    thigh.position.set(x,0.08,0.04); g.add(thigh);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.09,6,6), armorMat);
    knee.position.set(x,-0.1,0.06); g.add(knee);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.1,0.3,7), armorMat);
    shin.position.set(x,-0.22,0.04); g.add(shin);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.17,0.1,0.26), armorDark);
    boot.position.set(x,-0.34,0.1); g.add(boot);
  }

  // Spear — right hand
  const spearShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.016,1.4,6), spearMat);
  spearShaft.position.set(0.78,0.42,-0.08); spearShaft.rotation.z=0.15; spearShaft.rotation.x=-0.22; g.add(spearShaft);
  const spearTip = new THREE.Mesh(new THREE.ConeGeometry(0.04,0.28,6), lunarMat);
  spearTip.position.set(0.86,1.04,-0.24); spearTip.rotation.z=0.15; spearTip.rotation.x=-0.22; g.add(spearTip);
  // Spear moon decoration
  const spearMoon = new THREE.Mesh(new THREE.TorusGeometry(0.07,0.014,5,10, Math.PI*1.5), goldMat);
  spearMoon.position.set(0.8,0.86,-0.2); spearMoon.rotation.z=1.2; g.add(spearMoon);

  // Floating moon particles
  for (let i=0;i<10;i++) {
    const a=(i/10)*Math.PI*2;
    const r=0.58+Math.random()*0.08;
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.018+Math.random()*0.016,4,4), bm(0xddeeff, { transparent:true, opacity:0.6+Math.random()*0.3 }));
    p.position.set(Math.cos(a)*r, 0.28+Math.sin(a*2.5)*0.2, Math.sin(a)*r);
    g.add(p);
  }

  g.userData.parts = { body, head: helm };
  return g;
}

// ─── Exports ──────────────────────────────────────────────────────
export const DETAILED_BUILDERS5 = {
  cm5_jade_rabbit,
  cm5_moon_crab,
  cm5_meteor_bug,
  cm5_moon_spirit,
  cm5_moon_guardian,
};

export const DETAILED_SHAPE_MAP5 = {
  jade_rabbit:   'cm5_jade_rabbit',
  moon_crab:     'cm5_moon_crab',
  meteor_bug:    'cm5_meteor_bug',
  moon_spirit:   'cm5_moon_spirit',
  moon_guardian: 'cm5_moon_guardian',
};
