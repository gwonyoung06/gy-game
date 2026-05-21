import * as THREE from 'three';

const lm = (c, o={}) => new THREE.MeshLambertMaterial({ color:c, ...o });
const lms = (c, o={}) => new THREE.MeshLambertMaterial({ color:c, flatShading:true, ...o });
const bm = (c, o={}) => new THREE.MeshBasicMaterial({ color:c, ...o });

function canvasTex(w, h, fn) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  fn(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  return t;
}

function hx(n) {
  return '#' + n.toString(16).padStart(6,'0');
}

// ─── cm4_pteranodon ───────────────────────────────────────────────
function cm4_pteranodon(color) {
  const g = new THREE.Group();
  const c = color;
  const bodyMat = lms(c);
  const crestMat = lms(0xcc5533);
  const beakMat = lms(0xddbb55);
  const skinMat = lms(c, { transparent:true, opacity:0.82, side:THREE.DoubleSide });

  // Body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22,8,7), bodyMat);
  body.scale.set(0.8, 0.65, 1.6); g.add(body);

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.12,0.28,6), bodyMat);
  neck.position.set(0,0.12,-0.32); neck.rotation.x = 0.4; g.add(neck);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14,8,7), bodyMat);
  head.scale.set(1,0.75,1.2); head.position.set(0,0.22,-0.54); g.add(head);

  // Crest — long backward spike
  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.04,0.5,5), crestMat);
  crest.rotation.x = -1.1; crest.position.set(0,0.34,-0.38); g.add(crest);

  // Beak
  const beak = new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.008,0.34,5), beakMat);
  beak.rotation.x = Math.PI/2; beak.position.set(0,0.18,-0.78); g.add(beak);

  // Eyes
  for (const x of [-0.07,0.07]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028,6,6), lms(0x221100));
    eye.position.set(x,0.28,-0.62); g.add(eye);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.012,4,4), bm(0xffffff));
    shine.position.set(x+0.01,0.295,-0.645); g.add(shine);
  }

  // Wings — using canvas texture for membrane veins
  const wingTex = canvasTex(256,128,(ctx,w,h)=>{
    ctx.fillStyle = hx(color);
    ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.5;
    for (let i=0;i<6;i++) {
      ctx.beginPath(); ctx.moveTo(w*0.05,h*0.5);
      ctx.quadraticCurveTo(w*(0.3+i*0.12),h*(i%2===0?0.1:0.9),w*0.95,h*(0.1+i*0.14));
      ctx.stroke();
    }
  });
  const wMat = new THREE.MeshLambertMaterial({ map:wingTex, transparent:true, opacity:0.84, side:THREE.DoubleSide });
  const wings = [];
  for (const sx of [-1,1]) {
    // Main membrane — wide triangle-ish shape
    const wGeo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      0,0,0,   sx*1.1,0.08,-0.1,  sx*0.9,0.04,0.5,
      0,0,0,   sx*0.9,0.04,0.5,   sx*0.3,0.0,0.7,
      0,0,0,   sx*0.3,0.0,0.7,    0,-0.05,0.72,
    ]);
    wGeo.setAttribute('position', new THREE.BufferAttribute(verts,3));
    wGeo.computeVertexNormals();
    const wing = new THREE.Mesh(wGeo, wMat.clone());
    wing.position.set(sx*0.16, 0.04, 0.0);
    g.add(wing); wings.push(wing);

    // Wing finger bone
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.012,1.12,5), lms(c));
    bone.rotation.z = sx * 1.25; bone.rotation.x = 0.18;
    bone.position.set(sx*0.52,0.04,-0.06); g.add(bone);
  }
  g.userData.wings = wings;

  // Small hind legs
  for (const x of [-0.1,0.1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.03,0.28,5), bodyMat);
    leg.position.set(x,-0.12,0.24); leg.rotation.x = 0.3; g.add(leg);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.05,5,4), bodyMat);
    foot.position.set(x,-0.26,0.36); g.add(foot);
  }

  // Tail
  for (let i=0;i<4;i++) {
    const ts = new THREE.Mesh(new THREE.SphereGeometry(0.06-i*0.01,5,4), bodyMat);
    ts.position.set(0,-0.02+i*0.02,0.32+i*0.16); g.add(ts);
  }

  g.userData.parts = { body, head, wings };
  return g;
}

// ─── cm4_stegosaurus ──────────────────────────────────────────────
function cm4_stegosaurus(color) {
  const g = new THREE.Group();
  const bodyMat = lms(color);
  const plateMat = lms(0xcc4422);
  const spikeMat = lms(0xddcc88);

  // Body — large barrel
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42,9,7), bodyMat);
  body.scale.set(0.85,0.78,1.5); body.position.y=0.42; g.add(body);

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.22,0.38,7), bodyMat);
  neck.rotation.x=0.55; neck.position.set(0,0.62,-0.52); g.add(neck);

  // Head — small and low
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26,0.22,0.44), bodyMat);
  head.position.set(0,0.54,-0.84); g.add(head);

  // Beak/mouth
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.08,0.18), lms(0x886644));
  mouth.position.set(0,0.46,-1.0); g.add(mouth);

  // Eyes
  for (const x of [-0.12,0.12]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03,5,5), lms(0x442200));
    eye.position.set(x,0.6,-0.96); g.add(eye);
  }

  // Back plates — alternating, 2 rows
  const platePositions = [
    [-0.62,-0.08], [-0.38,0.08], [-0.14,0.0], [0.12,0.05],
    [0.36,0.0], [0.58,-0.06], [0.76,-0.14]
  ];
  for (let i=0;i<platePositions.length;i++) {
    const [bz,by] = platePositions[i];
    const h = 0.28 - Math.abs(bz)*0.08;
    for (const sx of [-1,1]) {
      const plate = new THREE.Mesh(
        new THREE.ConeGeometry(0.04, h, 4),
        plateMat
      );
      plate.scale.set(1.6,1,0.25);
      plate.position.set(sx*0.06, 0.42+by+h/2, bz);
      plate.rotation.z = sx*0.12;
      g.add(plate);
    }
  }

  // Tail spikes (4 pairs near tip)
  for (let i=0;i<4;i++) {
    const ts = new THREE.Mesh(new THREE.SphereGeometry(0.2-i*0.03,7,5), bodyMat);
    ts.position.set(0,0.32-i*0.04, 0.52+i*0.26); g.add(ts);
  }
  for (const pos of [[-0.14,0.14,1.56],[0.14,0.14,1.56],[-0.1,0.0,1.72],[0.1,0.0,1.72]]) {
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.03,0.28,4), spikeMat);
    sp.position.set(...pos);
    sp.rotation.z = pos[0]<0 ? -0.8 : 0.8; sp.rotation.x = 0.3;
    g.add(sp);
  }

  // Legs — 4 pillar legs
  for (const [x,z] of [[-0.3,-0.36],[-0.3,0.28],[0.3,-0.36],[0.3,0.28]]) {
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.09,0.34,6), bodyMat);
    upper.position.set(x,0.18,z); g.add(upper);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.1,0.28,6), bodyMat);
    lower.position.set(x,-0.02,z); g.add(lower);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.08,0.22), lms(0x665544));
    foot.position.set(x,-0.16,z+0.04); g.add(foot);
  }

  g.userData.parts = { body, head };
  return g;
}

// ─── cm4_triceratops ──────────────────────────────────────────────
function cm4_triceratops(color) {
  const g = new THREE.Group();
  const bodyMat = lms(color);
  const frill = lms(0xcc3322);
  const hornMat = lms(0xeeddaa);

  // Body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.46,9,7), bodyMat);
  body.scale.set(0.88,0.8,1.4); body.position.y=0.46; g.add(body);

  // Neck — thick
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.3,0.3,7), bodyMat);
  neck.rotation.x=0.5; neck.position.set(0,0.68,-0.52); g.add(neck);

  // Head — large
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3,8,7), bodyMat);
  head.scale.set(1,0.78,1.35); head.position.set(0,0.64,-0.86); g.add(head);

  // Frill — flat disc behind head
  const frillMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.46,0.4,0.06,12), frill);
  frillMesh.scale.set(1,1,0.55); frillMesh.rotation.x = Math.PI/2 + 0.15;
  frillMesh.position.set(0,0.76,-0.52); g.add(frillMesh);
  // Frill rim details
  for (let i=0;i<8;i++) {
    const a = (i/8)*Math.PI*2;
    const bump = new THREE.Mesh(new THREE.SphereGeometry(0.05,4,4), frill);
    bump.position.set(Math.sin(a)*0.42+0, 0.76+Math.cos(a)*0.18, -0.52);
    g.add(bump);
  }

  // Nose horn
  const noseHorn = new THREE.Mesh(new THREE.ConeGeometry(0.04,0.26,6), hornMat);
  noseHorn.rotation.x = Math.PI/2 - 0.3; noseHorn.position.set(0,0.68,-1.04); g.add(noseHorn);

  // Two brow horns
  for (const x of [-0.16,0.16]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05,0.46,6), hornMat);
    horn.rotation.x = Math.PI/2 - 0.5; horn.position.set(x,0.82,-0.84); g.add(horn);
  }

  // Eyes
  for (const x of [-0.22,0.22]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04,6,6), lms(0x441100));
    eye.position.set(x,0.7,-0.98); g.add(eye);
  }

  // Mouth line
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.3,0.07,0.16), lms(0x886644));
  jaw.position.set(0,0.53,-1.04); g.add(jaw);

  // Legs — 4 heavy pillar legs
  for (const [x,z] of [[-0.32,-0.38],[-0.32,0.26],[0.32,-0.38],[0.32,0.26]]) {
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.11,0.38,6), bodyMat);
    upper.position.set(x,0.2,z); g.add(upper);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.12,0.3,6), bodyMat);
    lower.position.set(x,-0.02,z); g.add(lower);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.1,0.26), lms(0x665544));
    foot.position.set(x,-0.16,z+0.04); g.add(foot);
  }

  // Tail
  for (let i=0;i<5;i++) {
    const ts = new THREE.Mesh(new THREE.SphereGeometry(0.18-i*0.03,6,5), bodyMat);
    ts.position.set(0,0.36-i*0.02, 0.56+i*0.24); g.add(ts);
  }

  g.userData.parts = { body, head };
  return g;
}

// ─── cm4_brachiosaurus ────────────────────────────────────────────
function cm4_brachiosaurus(color) {
  const g = new THREE.Group();
  const bodyMat = lms(color);
  const spotTex = canvasTex(128,128,(ctx,w,h)=>{
    ctx.fillStyle = hx(color); ctx.fillRect(0,0,w,h);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for(let i=0;i<18;i++){
      const x=Math.random()*w, y=Math.random()*h, r=4+Math.random()*10;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    }
  });
  const bodyTexMat = new THREE.MeshLambertMaterial({ map:spotTex });

  // Body — large barrel
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.44,9,7), bodyTexMat);
  body.scale.set(0.9,0.82,1.55); body.position.y=0.6; g.add(body);

  // Long neck — 6 segments curving upward
  const neckSegs = 6;
  for (let i=0;i<neckSegs;i++) {
    const r = 0.18 - i*0.02;
    const ns = new THREE.Mesh(new THREE.CylinderGeometry(r,r+0.02,0.36,6), bodyTexMat);
    ns.position.set(0, 0.82+i*0.36, -0.28-i*0.14);
    ns.rotation.x = 0.28 + i*0.04;
    g.add(ns);
  }

  // Head — small
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.2,0.4), bodyTexMat);
  head.position.set(0, 2.92, -0.98); g.add(head);

  // Nostrils bump on top of head
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06,5,4), bodyTexMat);
  nose.scale.set(1.4,0.7,0.9); nose.position.set(0,3.04,-0.88); g.add(nose);

  // Eyes
  for (const x of [-0.1,0.1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03,5,5), lms(0x331100));
    eye.position.set(x,2.98,-1.06); g.add(eye);
  }

  // Legs — 4 tall pillars
  for (const [x,z] of [[-0.34,-0.44],[-0.34,0.36],[0.34,-0.44],[0.34,0.36]]) {
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.12,0.52,6), bodyTexMat);
    upper.position.set(x,0.3,z); g.add(upper);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.13,0.44,6), bodyTexMat);
    lower.position.set(x,-0.08,z); g.add(lower);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.14,6,5), bodyTexMat);
    foot.scale.set(1.2,0.6,1.3); foot.position.set(x,-0.28,z); g.add(foot);
  }

  // Tail — long, 7 segments
  for (let i=0;i<7;i++) {
    const r = 0.22-i*0.025;
    const ts = new THREE.Mesh(new THREE.SphereGeometry(r,6,5), bodyTexMat);
    ts.position.set(0, 0.48-i*0.04, 0.62+i*0.3); g.add(ts);
  }

  g.userData.parts = { body, head };
  return g;
}

// ─── cm4_raptor ───────────────────────────────────────────────────
function cm4_raptor(color) {
  const g = new THREE.Group();
  // Stripe canvas texture
  const stripeTex = canvasTex(128,64,(ctx,w,h)=>{
    ctx.fillStyle = hx(color); ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth=5;
    for(let i=0;i<6;i++){
      ctx.beginPath(); ctx.moveTo(i*22,0); ctx.lineTo(i*22-20,h); ctx.stroke();
    }
  });
  const bodyMat = new THREE.MeshLambertMaterial({ map:stripeTex });
  const clawMat = lms(0xddcc99);

  // Body — lean, forward-tilted
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.26,8,7), bodyMat);
  body.scale.set(0.78,0.68,1.35); body.position.set(0,0.52,-0.1);
  body.rotation.x = 0.32; g.add(body);

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.14,0.32,6), bodyMat);
  neck.rotation.x=0.62; neck.position.set(0,0.74,-0.42); g.add(neck);

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28,0.2,0.44), bodyMat);
  head.position.set(0,0.86,-0.66); g.add(head);

  // Jaw
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.08,0.4), lms(0x886655));
  jaw.position.set(0,0.73,-0.68); g.add(jaw);

  // Teeth
  for (let i=0;i<5;i++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.016,0.05,4), lms(0xf5f5dc));
    tooth.position.set(-0.12+i*0.06, 0.76, -0.88);
    tooth.rotation.x=-0.3; g.add(tooth);
  }

  // Eyes with slit pupils
  for (const x of [-0.12,0.12]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.038,6,6), lms(0xffaa00));
    eye.position.set(x,0.9,-0.8); g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.022,5,5), lms(0x110000));
    pupil.position.set(x,0.9,-0.836); g.add(pupil);
  }

  // Small arms
  for (const x of [-0.22,0.22]) {
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.045,0.22,5), bodyMat);
    upper.position.set(x,0.6,-0.2); upper.rotation.z=x<0?-0.9:0.9; upper.rotation.x=0.7; g.add(upper);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.05,0.18,5), bodyMat);
    lower.position.set(x<0?-0.34:0.34, 0.48,-0.18); lower.rotation.z=x<0?-0.6:0.6; lower.rotation.x=0.9; g.add(lower);
    for (let ci=0;ci<3;ci++) {
      const cl = new THREE.Mesh(new THREE.ConeGeometry(0.015,0.07,4), clawMat);
      cl.position.set((x<0?-0.42:0.42)+ci*0.02*Math.sign(x), 0.38-ci*0.02, -0.14);
      cl.rotation.z=x<0?-0.4:0.4; g.add(cl);
    }
  }

  // Powerful hind legs
  for (const x of [-0.18,0.18]) {
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.085,0.4,6), bodyMat);
    thigh.position.set(x,0.28,0.1); g.add(thigh);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.1,0.34,6), bodyMat);
    shin.position.set(x,0.0,0.22); shin.rotation.x=-0.4; g.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.07,0.24), lms(0x665533));
    foot.position.set(x,-0.15,0.34); g.add(foot);
    // Sickle claw — signature raptor feature
    const sickle = new THREE.Mesh(new THREE.ConeGeometry(0.022,0.18,4), clawMat);
    sickle.position.set(x,-0.1,0.28); sickle.rotation.x=-1.2; sickle.rotation.z=x<0?0.2:-0.2; g.add(sickle);
  }

  // Tail — stiff, horizontal
  for (let i=0;i<6;i++) {
    const ts = new THREE.Mesh(new THREE.SphereGeometry(0.14-i*0.018,6,5), bodyMat);
    ts.position.set(0, 0.42-i*0.03, 0.36+i*0.22); g.add(ts);
  }

  g.userData.parts = { body, head };
  return g;
}

// ─── cm4_t_rex ────────────────────────────────────────────────────
function cm4_t_rex(color) {
  const g = new THREE.Group();
  const scaleTex = canvasTex(128,128,(ctx,w,h)=>{
    ctx.fillStyle = hx(color); ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth=2;
    for (let r=0;r<h;r+=10) {
      for (let c=(r/10%2)*5;c<w;c+=10) {
        ctx.beginPath(); ctx.arc(c,r,4,0,Math.PI*2); ctx.stroke();
      }
    }
  });
  const bodyMat = new THREE.MeshLambertMaterial({ map:scaleTex });
  const toothMat = lms(0xf5f5dc);

  // Body — massive barrel
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5,10,8), bodyMat);
  body.scale.set(0.82,0.76,1.45); body.position.y=0.62; g.add(body);

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.3,0.4,7), bodyMat);
  neck.rotation.x=0.45; neck.position.set(0,0.96,-0.42); g.add(neck);

  // Head — huge
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.72,0.46,0.82), bodyMat);
  head.position.set(0,1.2,-0.82); g.add(head);

  // Upper jaw detail
  const upperJaw = new THREE.Mesh(new THREE.BoxGeometry(0.62,0.16,0.68), bodyMat);
  upperJaw.position.set(0,1.08,-0.86); g.add(upperJaw);

  // Lower jaw
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.58,0.14,0.68), lms(0x997766));
  jaw.position.set(0,0.94,-0.86); g.add(jaw);

  // Teeth — upper and lower rows
  for (let i=0;i<7;i++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.026,0.08,4), toothMat);
    tooth.position.set(-0.22+i*0.074, 1.02, -1.16);
    tooth.rotation.x=-0.25; g.add(tooth);
    const tooth2 = new THREE.Mesh(new THREE.ConeGeometry(0.022,0.07,4), toothMat);
    tooth2.position.set(-0.2+i*0.07, 0.96, -1.14);
    tooth2.rotation.x=Math.PI+0.25; g.add(tooth2);
  }

  // Eyes — small, deep-set
  for (const x of [-0.24,0.24]) {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.06,0.08), bodyMat);
    brow.position.set(x,1.32,-1.04); g.add(brow);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055,7,7), lms(0xaa2200));
    eye.position.set(x,1.24,-1.08); g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.03,5,5), lms(0x110000));
    pupil.position.set(x,1.24,-1.13); g.add(pupil);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.012,4,4), bm(0xffffff));
    shine.position.set(x-0.02,1.255,-1.135); g.add(shine);
  }

  // Tiny arms — vestigial but detailed
  for (const x of [-0.38,0.38]) {
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.06,0.3,6), bodyMat);
    upper.position.set(x,0.78,-0.22); upper.rotation.z=x<0?-0.9:0.9; upper.rotation.x=0.7; g.add(upper);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.07,0.24,6), bodyMat);
    lower.position.set(x<0?-0.56:0.56, 0.64,-0.18); lower.rotation.z=x<0?-0.65:0.65; lower.rotation.x=0.9; g.add(lower);
    for (let ci=0;ci<2;ci++) {
      const cl = new THREE.Mesh(new THREE.ConeGeometry(0.02,0.09,4), lms(0xccbbaa));
      cl.position.set((x<0?-0.66:0.66), 0.52-ci*0.04, -0.12);
      cl.rotation.z=x<0?-0.3:0.3; g.add(cl);
    }
  }

  // Massive hind legs
  for (const x of [-0.28,0.28]) {
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.14,0.52,7), bodyMat);
    thigh.position.set(x,0.3,0.22); g.add(thigh);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.16,0.44,7), bodyMat);
    shin.position.set(x,-0.02,0.34); shin.rotation.x=-0.4; g.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.24,0.12,0.38), lms(0x665544));
    foot.position.set(x,-0.24,0.5); g.add(foot);
    // Claws
    for (let ci=0;ci<3;ci++) {
      const cl = new THREE.Mesh(new THREE.ConeGeometry(0.025,0.1,4), lms(0xccbbaa));
      cl.position.set(x-0.07+ci*0.07,-0.3,0.68); cl.rotation.x=0.5; g.add(cl);
    }
  }

  // Powerful tail — 8 segments
  for (let i=0;i<8;i++) {
    const r = 0.34-i*0.035;
    const ts = new THREE.Mesh(new THREE.SphereGeometry(r,7,5), bodyMat);
    ts.position.set(0, 0.5-i*0.04, 0.66+i*0.28); g.add(ts);
  }

  g.userData.parts = { body, head };
  return g;
}

// ─── cm4_spinosaurus ──────────────────────────────────────────────
function cm4_spinosaurus(color) {
  const g = new THREE.Group();
  const bodyMat = lms(color);
  const sailMat = lms(0xff6633, { transparent:true, opacity:0.88 });

  // Body — slightly longer than t_rex, more upright
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.46,9,8), bodyMat);
  body.scale.set(0.82,0.72,1.5); body.position.set(0,0.58,-0.08); g.add(body);

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.24,0.42,7), bodyMat);
  neck.rotation.x=0.38; neck.position.set(0,0.9,-0.46); g.add(neck);

  // Head — longer, crocodilian
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28,0.24,0.72), bodyMat);
  head.position.set(0,1.1,-0.86); g.add(head);

  // Long snout
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.16,0.44), bodyMat);
  snout.position.set(0,1.04,-1.22); g.add(snout);

  // Jaw
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.1,0.68), lms(0x997766));
  jaw.position.set(0,0.94,-0.9); g.add(jaw);

  // Conical fish-catching teeth
  for (let i=0;i<8;i++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.02,0.07,4), lms(0xf5f5dc));
    tooth.position.set(-0.12+(i%4)*0.08+Math.floor(i/4)*0.0, 0.98-(Math.floor(i/4)*0.1), -1.06-(Math.floor(i/4)*0.28));
    tooth.rotation.x=-0.2; g.add(tooth);
  }

  // Eyes
  for (const x of [-0.12,0.12]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04,6,6), lms(0x446622));
    eye.position.set(x,1.16,-1.0); g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.024,5,5), lms(0x111100));
    pupil.position.set(x,1.16,-1.04); g.add(pupil);
  }

  // Sail — dorsal neural spines (signature feature)
  const sailPositions = [-0.36,-0.18,0.0,0.16,0.32,0.44,0.54,0.6,0.56,0.46,0.3];
  const sailHeights =   [0.22, 0.36,0.52,0.62,0.68,0.66,0.58,0.46,0.34,0.22,0.14];
  for (let i=0;i<sailPositions.length;i++) {
    const bz = sailPositions[i];
    const sh = sailHeights[i];
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.022,sh,5), sailMat);
    spine.position.set(0, 0.58+sh/2, bz); g.add(spine);
    // Sail membrane between spines
    if (i<sailPositions.length-1) {
      const memGeo = new THREE.BufferGeometry();
      const nextZ = sailPositions[i+1];
      const nextH = sailHeights[i+1];
      const verts = new Float32Array([
        0, 0.58+sh, bz,
        0, 0.58+nextH, nextZ,
        0, 0.58, nextZ,
        0, 0.58+sh, bz,
        0, 0.58, nextZ,
        0, 0.58, bz,
      ]);
      memGeo.setAttribute('position', new THREE.BufferAttribute(verts,3));
      memGeo.computeVertexNormals();
      const mem = new THREE.Mesh(memGeo, new THREE.MeshLambertMaterial({ color:0xff7744, transparent:true, opacity:0.55, side:THREE.DoubleSide }));
      g.add(mem);
    }
  }

  // Arms — longer than t_rex
  for (const x of [-0.32,0.32]) {
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.065,0.36,6), bodyMat);
    upper.position.set(x,0.7,-0.14); upper.rotation.z=x<0?-0.85:0.85; upper.rotation.x=0.65; g.add(upper);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.075,0.3,6), bodyMat);
    lower.position.set(x<0?-0.5:0.5, 0.56,-0.1); lower.rotation.z=x<0?-0.6:0.6; lower.rotation.x=0.85; g.add(lower);
  }

  // Hind legs
  for (const x of [-0.24,0.24]) {
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.11,0.46,6), bodyMat);
    thigh.position.set(x,0.28,0.2); g.add(thigh);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.13,0.38,6), bodyMat);
    shin.position.set(x,0.0,0.3); shin.rotation.x=-0.38; g.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.1,0.32), lms(0x665544));
    foot.position.set(x,-0.18,0.44); g.add(foot);
  }

  // Tail
  for (let i=0;i<8;i++) {
    const ts = new THREE.Mesh(new THREE.SphereGeometry(0.3-i*0.03,7,5), bodyMat);
    ts.position.set(0, 0.46-i*0.04, 0.62+i*0.26); g.add(ts);
  }

  g.userData.parts = { body, head };
  return g;
}

// ─── cm4_ankylosaurus ─────────────────────────────────────────────
function cm4_ankylosaurus(color) {
  const g = new THREE.Group();
  const bodyMat = lms(color);
  const plateMat = lms(0x888866);
  const spikeMat = lms(0x554433);
  const clubMat = lms(0x776655);

  // Body — very wide, armored
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.44,9,7), bodyMat);
  body.scale.set(1.15,0.62,1.55); body.position.y=0.38; g.add(body);

  // Armor plates on back (rows)
  for (let row=0;row<4;row++) {
    for (let col=-3;col<=3;col++) {
      const plate = new THREE.Mesh(new THREE.SphereGeometry(0.07,5,4), plateMat);
      plate.scale.set(1,0.55,1);
      plate.position.set(col*0.12, 0.58+Math.random()*0.04, row*0.28-0.36);
      g.add(plate);
    }
  }

  // Lateral spikes (along sides)
  for (let i=0;i<5;i++) {
    for (const sx of [-1,1]) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.04,0.22,5), spikeMat);
      sp.position.set(sx*0.46, 0.46, -0.44+i*0.24);
      sp.rotation.z=sx*1.3; sp.rotation.x=0.2;
      g.add(sp);
    }
  }

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.24,0.26,6), bodyMat);
  neck.rotation.x=0.48; neck.position.set(0,0.5,-0.66); g.add(neck);

  // Head — wide, flat, armored
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46,0.24,0.42), plateMat);
  head.position.set(0,0.44,-0.94); g.add(head);

  // Head spikes at corners
  for (const [x,z] of [[-0.22,-0.82],[-0.22,-1.04],[0.22,-0.82],[0.22,-1.04]]) {
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.03,0.14,5), spikeMat);
    sp.position.set(x,0.52,z); sp.rotation.x=-0.3; g.add(sp);
  }

  // Eyes
  for (const x of [-0.16,0.16]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032,5,5), lms(0x334400));
    eye.position.set(x,0.5,-1.02); g.add(eye);
  }

  // Mouth
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.36,0.08,0.24), lms(0x776655));
  jaw.position.set(0,0.34,-1.04); g.add(jaw);

  // Legs — 4 short, wide
  for (const [x,z] of [[-0.38,-0.42],[-0.38,0.3],[0.38,-0.42],[0.38,0.3]]) {
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.11,0.28,6), bodyMat);
    upper.position.set(x,0.18,z); g.add(upper);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.12,0.22,6), bodyMat);
    lower.position.set(x,0.0,z); g.add(lower);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.1,0.28), lms(0x665544));
    foot.position.set(x,-0.12,z+0.06); g.add(foot);
  }

  // Club tail — 4 tail segments + big ball
  for (let i=0;i<4;i++) {
    const ts = new THREE.Mesh(new THREE.SphereGeometry(0.18-i*0.015,6,5), bodyMat);
    ts.position.set(0, 0.28-i*0.02, 0.68+i*0.24); g.add(ts);
  }
  // Club ball
  const club = new THREE.Mesh(new THREE.SphereGeometry(0.2,7,6), clubMat);
  club.scale.set(1.4,1,0.9); club.position.set(0,0.18,1.64); g.add(club);
  for (const [cx,cz] of [[-0.12,1.58],[0.12,1.58],[0,1.72],[-0.1,1.7],[0.1,1.7]]) {
    const csp = new THREE.Mesh(new THREE.ConeGeometry(0.04,0.2,5), spikeMat);
    csp.position.set(cx,0.32,cz); csp.rotation.x=-0.2; g.add(csp);
  }

  g.userData.parts = { body, head };
  return g;
}

// ─── cm4_parasaurolophus ──────────────────────────────────────────
function cm4_parasaurolophus(color) {
  const g = new THREE.Group();
  const bodyMat = lms(color);
  const crestMat = lms(0xdd4422);

  // Body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.4,9,7), bodyMat);
  body.scale.set(0.84,0.78,1.45); body.position.y=0.56; g.add(body);

  // Neck — medium
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.2,0.38,7), bodyMat);
  neck.rotation.x=0.42; neck.position.set(0,0.82,-0.48); g.add(neck);

  // Head — duck-billed
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2,8,7), bodyMat);
  head.scale.set(0.9,0.75,1.3); head.position.set(0,0.98,-0.74); g.add(head);

  // Duck bill — flat wide snout
  const bill = new THREE.Mesh(new THREE.BoxGeometry(0.38,0.1,0.32), bodyMat);
  bill.position.set(0,0.86,-1.04); g.add(bill);

  // Lower bill
  const lowerBill = new THREE.Mesh(new THREE.BoxGeometry(0.34,0.07,0.28), lms(0x998877));
  lowerBill.position.set(0,0.78,-1.02); g.add(lowerBill);

  // Cranial crest — long hollow tube extending back
  const crest = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.06,0.72,6), crestMat);
  crest.rotation.x = Math.PI/2 - 0.22; crest.position.set(0,1.18,-0.56); g.add(crest);

  // Crest tip
  const crestTip = new THREE.Mesh(new THREE.SphereGeometry(0.05,5,5), crestMat);
  crestTip.position.set(0,1.28,-0.06); g.add(crestTip);

  // Eyes
  for (const x of [-0.14,0.14]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035,6,6), lms(0x223300));
    eye.position.set(x,1.02,-0.88); g.add(eye);
  }

  // Forelegs — shorter
  for (const x of [-0.26,0.26]) {
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.07,0.32,6), bodyMat);
    upper.position.set(x,0.48,-0.28); upper.rotation.z=x<0?-0.7:0.7; upper.rotation.x=0.5; g.add(upper);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.08,0.28,6), bodyMat);
    lower.position.set(x<0?-0.42:0.42, 0.34,-0.18); lower.rotation.z=x<0?-0.5:0.5; lower.rotation.x=0.7; g.add(lower);
    const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.08,0.18), lms(0x665544));
    hoof.position.set(x<0?-0.52:0.52, 0.22,-0.12); g.add(hoof);
  }

  // Hind legs — powerful
  for (const x of [-0.24,0.24]) {
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.1,0.44,6), bodyMat);
    thigh.position.set(x,0.3,0.22); g.add(thigh);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.12,0.36,6), bodyMat);
    shin.position.set(x,0.02,0.34); shin.rotation.x=-0.38; g.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.1,0.3), lms(0x665544));
    foot.position.set(x,-0.16,0.46); g.add(foot);
  }

  // Tail
  for (let i=0;i<6;i++) {
    const ts = new THREE.Mesh(new THREE.SphereGeometry(0.22-i*0.026,7,5), bodyMat);
    ts.position.set(0, 0.42-i*0.04, 0.56+i*0.28); g.add(ts);
  }

  g.userData.parts = { body, head };
  return g;
}

// ─── cm4_giganotosaurus ───────────────────────────────────────────
function cm4_giganotosaurus(color) {
  const g = new THREE.Group();
  // Canvas — subtle ridge pattern
  const ridgeTex = canvasTex(128,128,(ctx,w,h)=>{
    ctx.fillStyle = hx(color); ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth=3;
    for(let i=0;i<8;i++){
      ctx.beginPath();
      ctx.moveTo(0, i*h/7);
      ctx.bezierCurveTo(w*0.3,i*h/7+15, w*0.7,i*h/7-15, w,i*h/7);
      ctx.stroke();
    }
  });
  const bodyMat = new THREE.MeshLambertMaterial({ map:ridgeTex });
  const toothMat = lms(0xf0ece0);

  // Body — larger than t_rex, slightly longer skull
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.52,10,8), bodyMat);
  body.scale.set(0.84,0.74,1.55); body.position.set(0,0.64,-0.06); g.add(body);

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.32,0.42,7), bodyMat);
  neck.rotation.x=0.42; neck.position.set(0,1.0,-0.44); g.add(neck);

  // Head — longer than t_rex
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.76,0.44,0.9), bodyMat);
  head.position.set(0,1.22,-0.88); g.add(head);

  // Upper jaw
  const upperJaw = new THREE.Mesh(new THREE.BoxGeometry(0.66,0.16,0.76), bodyMat);
  upperJaw.position.set(0,1.08,-0.92); g.add(upperJaw);

  // Lower jaw
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.62,0.15,0.72), lms(0x8a6655));
  jaw.position.set(0,0.93,-0.92); g.add(jaw);

  // Teeth — more numerous
  for (let i=0;i<9;i++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.024,0.075,4), toothMat);
    tooth.position.set(-0.26+i*0.065, 1.01, -1.22);
    tooth.rotation.x=-0.22; g.add(tooth);
    const tooth2 = new THREE.Mesh(new THREE.ConeGeometry(0.02,0.065,4), toothMat);
    tooth2.position.set(-0.24+i*0.06, 0.94, -1.2);
    tooth2.rotation.x=Math.PI+0.22; g.add(tooth2);
  }

  // Eyes — larger than t_rex, more forward-facing
  for (const x of [-0.26,0.26]) {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.07,0.1), bodyMat);
    brow.position.set(x,1.36,-1.06); g.add(brow);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06,7,7), lms(0xcc4400));
    eye.position.set(x,1.26,-1.1); g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.034,5,5), lms(0x110000));
    pupil.position.set(x,1.26,-1.16); g.add(pupil);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.014,4,4), bm(0xffffff));
    shine.position.set(x-0.022,1.275,-1.162); g.add(shine);
  }

  // Arms — slightly longer than t_rex
  for (const x of [-0.4,0.4]) {
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.065,0.34,6), bodyMat);
    upper.position.set(x,0.8,-0.22); upper.rotation.z=x<0?-0.88:0.88; upper.rotation.x=0.68; g.add(upper);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.075,0.28,6), bodyMat);
    lower.position.set(x<0?-0.58:0.58, 0.66,-0.18); lower.rotation.z=x<0?-0.62:0.62; lower.rotation.x=0.9; g.add(lower);
  }

  // Massive hind legs
  for (const x of [-0.3,0.3]) {
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.15,0.56,7), bodyMat);
    thigh.position.set(x,0.32,0.24); g.add(thigh);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.17,0.46,7), bodyMat);
    shin.position.set(x,0.0,0.38); shin.rotation.x=-0.4; g.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.26,0.14,0.42), lms(0x665544));
    foot.position.set(x,-0.22,0.54); g.add(foot);
    for (let ci=0;ci<3;ci++) {
      const cl = new THREE.Mesh(new THREE.ConeGeometry(0.028,0.12,4), lms(0xccbbaa));
      cl.position.set(x-0.08+ci*0.08,-0.3,0.72); cl.rotation.x=0.5; g.add(cl);
    }
  }

  // Long heavy tail — 9 segments
  for (let i=0;i<9;i++) {
    const r = 0.36-i*0.032;
    const ts = new THREE.Mesh(new THREE.SphereGeometry(r,7,5), bodyMat);
    ts.position.set(0, 0.52-i*0.04, 0.72+i*0.3); g.add(ts);
  }

  g.userData.parts = { body, head };
  return g;
}

// ─── Exports ──────────────────────────────────────────────────────
export const DETAILED_BUILDERS4 = {
  cm4_pteranodon,
  cm4_stegosaurus,
  cm4_triceratops,
  cm4_brachiosaurus,
  cm4_raptor,
  cm4_t_rex,
  cm4_spinosaurus,
  cm4_ankylosaurus,
  cm4_parasaurolophus,
  cm4_giganotosaurus,
};

export const DETAILED_SHAPE_MAP4 = {
  pteranodon:      'cm4_pteranodon',
  stegosaurus:     'cm4_stegosaurus',
  triceratops:     'cm4_triceratops',
  brachiosaurus:   'cm4_brachiosaurus',
  raptor:          'cm4_raptor',
  t_rex:           'cm4_t_rex',
  spinosaurus:     'cm4_spinosaurus',
  ankylosaurus:    'cm4_ankylosaurus',
  parasaurolophus: 'cm4_parasaurolophus',
  giganotosaurus:  'cm4_giganotosaurus',
};
