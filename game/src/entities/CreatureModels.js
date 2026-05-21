/**
 * CreatureModels.js — ★1등급 상세 Three.js 모델 (15종)
 * grasshopper / mantis / frog 는 Creature.js 전용 빌더 사용
 * 나머지 15종을 cm_* 접두사로 새 빌더 추가
 */
import * as THREE from 'three';

// ─── 로컬 재질 헬퍼 (인스턴스별 생성) ────────────────────────────
const lm  = (color, opts = {}) =>
  new THREE.MeshLambertMaterial({ color, flatShading: true,  ...opts });
const lms = (color, opts = {}) =>
  new THREE.MeshLambertMaterial({ color, flatShading: false, ...opts });

// ─── Canvas Texture 헬퍼 ─────────────────────────────────────────
function canvasTex(w, h, drawFn) {
  const cv  = document.createElement('canvas');
  cv.width  = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  drawFn(ctx, w, h);
  const tex = new THREE.CanvasTexture(cv);
  return tex;
}

function hexStr(color) {
  return '#' + (color >>> 0).toString(16).padStart(6, '0');
}

// ─────────────────────────────────────────────────────────────────
// DETAILED_BUILDERS
// ─────────────────────────────────────────────────────────────────
export const DETAILED_BUILDERS = {

  // ════════════════════════════════════════════════════════════════
  // 1. 나비 (butterfly) — 컬러풀 날개 + 캔버스 무늬
  // ════════════════════════════════════════════════════════════════
  cm_butterfly(color) {
    const g     = new THREE.Group();
    const parts = {};
    const dark  = new THREE.Color(color).multiplyScalar(0.35).getHex();

    // 몸통 분절 (4개)
    const bodyGrp = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const r   = 0.058 - i * 0.010;
      const seg = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 6), lm(0x1a0800));
      seg.position.z = i * 0.072;
      bodyGrp.add(seg);
    }
    g.add(bodyGrp);
    parts.body = bodyGrp;

    // 더듬이
    for (const s of [-1, 1]) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.20, 4), lm(0x1a0800));
      ant.position.set(s * 0.028, 0.11, -0.09);
      ant.rotation.z = s * -0.50;
      ant.rotation.x = -0.30;
      g.add(ant);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.020, 5, 5), lm(0x1a0800));
      tip.position.set(s * 0.078, 0.22, -0.17);
      g.add(tip);
    }

    // 날개 텍스처
    const wTex = canvasTex(128, 128, (ctx, w, h) => {
      ctx.fillStyle = hexStr(color);
      ctx.fillRect(0, 0, w, h);
      // 베인
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth   = 1.5;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(w * 0.5, h * 0.8);
        ctx.quadraticCurveTo(
          Math.random() * w, Math.random() * h * 0.6,
          Math.random() * w, Math.random() * h * 0.3
        );
        ctx.stroke();
      }
      // 반점
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      [[25,55,10],[40,30,7],[85,55,10],[75,32,7],[52,20,5]].forEach(([x,y,r]) => {
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
      });
      // 흰 테두리 하이라이트
      const g2 = ctx.createRadialGradient(w*0.3, h*0.3, 4, w*0.5, h*0.5, w*0.6);
      g2.addColorStop(0, 'rgba(255,255,255,0.25)');
      g2.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);
    });

    const topMat = lms(0xffffff, { map: wTex, transparent: true, opacity: 0.88, side: THREE.DoubleSide });
    const botMat = lms(0xcc4400, { transparent: true, opacity: 0.82, side: THREE.DoubleSide });

    const leftWing  = new THREE.Group();
    const rightWing = new THREE.Group();
    const wings     = [];

    [[-1, leftWing], [1, rightWing]].forEach(([s, wg]) => {
      const top = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.24), topMat.clone());
      top.position.set(s * 0.22, 0.04, -0.04);
      top.rotation.x = -0.20;
      top.rotation.y =  s * 0.15;
      wg.add(top);
      wings.push(top);

      const bot = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.20), botMat.clone());
      bot.position.set(s * 0.18, 0.00, 0.13);
      bot.rotation.x = -0.15;
      wg.add(bot);
      wings.push(bot);

      g.add(wg);
    });
    parts.leftWing  = leftWing;
    parts.rightWing = rightWing;
    g.userData.wings = wings;
    g.userData.parts = parts;
    return g;
  },

  // ════════════════════════════════════════════════════════════════
  // 2. 무당벌레 (ladybug) — 빨간 반구 + 검정 반점
  // ════════════════════════════════════════════════════════════════
  cm_ladybug(color) {
    const g     = new THREE.Group();
    const parts = {};
    const BLK   = 0x111111;

    // 딱지날개 텍스처
    const sTex = canvasTex(64, 64, (ctx, w, h) => {
      ctx.fillStyle = '#dd2200';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#111111';
      ctx.fillRect(w/2 - 1.5, 0, 3, h);           // 중앙 봉합선
      [[14,18],[14,44],[50,18],[50,44],[32,32]].forEach(([x,y]) => {
        ctx.beginPath(); ctx.arc(x, y, 7.5, 0, Math.PI*2); ctx.fill();
      });
    });

    // 등딱지 (돔형)
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 8),
      lms(0xffffff, { map: sTex })
    );
    shell.scale.set(1.10, 0.68, 1.22);
    shell.position.y = 0.10;
    g.add(shell);
    parts.shell = shell;

    // 흑색 하면
    const under = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.06, 8), lm(BLK));
    under.position.y = 0.04;
    g.add(under);

    // 머리
    const head = new THREE.Group();
    const hm   = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 7), lm(BLK));
    hm.scale.set(1.2, 0.88, 1.0);
    hm.position.set(0, 0.09, -0.19);
    head.add(hm);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 5, 5), lm(0xffffff));
      eye.position.set(s * 0.050, 0.115, -0.252);
      head.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.015, 4, 4), lm(BLK));
      pupil.position.set(s * 0.050, 0.115, -0.268);
      head.add(pupil);
    }
    g.add(head);
    parts.head = head;

    // 더듬이
    for (const s of [-1, 1]) {
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.13, 4), lm(BLK));
      a.position.set(s * 0.038, 0.155, -0.22);
      a.rotation.z = s * -0.42; a.rotation.x = -0.50;
      g.add(a);
      const t = new THREE.Mesh(new THREE.SphereGeometry(0.014, 4, 4), lm(BLK));
      t.position.set(s * 0.066, 0.235, -0.295);
      g.add(t);
    }

    // 6다리 (3절)
    const legGrp = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const z = (i - 1) * 0.095;
      for (const s of [-1, 1]) {
        const u = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.010, 0.09, 4), lm(BLK));
        u.position.set(s*0.160, 0.020, z); u.rotation.z = s*1.30;
        legGrp.add(u);
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.007, 0.09, 4), lm(BLK));
        l.position.set(s*0.245, -0.040, z); l.rotation.z = s*0.65; l.rotation.x = 0.28;
        legGrp.add(l);
        const f = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.004, 0.06, 4), lm(BLK));
        f.position.set(s*0.300, -0.090, z); f.rotation.x = 0.65;
        legGrp.add(f);
      }
    }
    g.add(legGrp);
    parts.legs = legGrp;
    g.userData.parts = parts;
    return g;
  },

  // ════════════════════════════════════════════════════════════════
  // 3. 풍뎅이 (beetle) — 무지개 딱지 + 뿔
  // ════════════════════════════════════════════════════════════════
  cm_beetle(color) {
    const g     = new THREE.Group();
    const parts = {};
    const dark  = new THREE.Color(color).multiplyScalar(0.38).getHex();

    // 딱지 텍스처 (광택 그라디언트)
    const eTex = canvasTex(64, 64, (ctx, w, h) => {
      ctx.fillStyle = hexStr(color);
      ctx.fillRect(0, 0, w, h);
      const gr = ctx.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0,   'rgba(255,255,255,0.35)');
      gr.addColorStop(0.4, 'rgba(255,255,255,0.05)');
      gr.addColorStop(1,   'rgba(255,255,255,0.15)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
      // 결 선
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
      for (let r = 6; r < h; r += 7) {
        ctx.beginPath(); ctx.moveTo(0,r); ctx.lineTo(w,r); ctx.stroke();
      }
    });

    const elytra = new THREE.Mesh(
      new THREE.SphereGeometry(0.20, 10, 8),
      new THREE.MeshPhongMaterial({ map: eTex, flatShading: false, shininess: 70 })
    );
    elytra.scale.set(1.08, 0.64, 1.36);
    elytra.position.y = 0.10;
    g.add(elytra);
    parts.body = elytra;

    // 봉합선
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.040, 0.36), lm(dark));
    seam.position.set(0, 0.210, 0.04);
    g.add(seam);

    // 전흉배판
    const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 7), lm(dark));
    thorax.scale.set(1.10, 0.72, 0.95);
    thorax.position.set(0, 0.095, -0.220);
    g.add(thorax);

    // 머리
    const head = new THREE.Group();
    const hm   = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 7), lm(dark));
    hm.scale.set(1.0, 0.82, 0.96);
    hm.position.set(0, 0.075, -0.340);
    head.add(hm);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 5, 5), lm(0x111111));
      eye.position.set(s*0.058, 0.098, -0.396);
      head.add(eye);
    }
    g.add(head);
    parts.head = head;

    // ★ 뿔 (풍뎅이 특징)
    const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.020, 0.18, 5), lm(dark));
    horn.position.set(0, 0.155, -0.380);
    horn.rotation.x = -0.58;
    g.add(horn);
    const hornTip = new THREE.Mesh(new THREE.ConeGeometry(0.010, 0.055, 4), lm(0x0a0a00));
    hornTip.position.set(0, 0.260, -0.448);
    hornTip.rotation.x = -0.58;
    g.add(hornTip);

    // 더듬이 (쐐기 모양 곤봉)
    for (const s of [-1, 1]) {
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 4), lm(dark));
      a.position.set(s*0.038, 0.145, -0.345);
      a.rotation.z = s*-0.48; a.rotation.x = -0.42;
      g.add(a);
      const club = new THREE.Mesh(new THREE.SphereGeometry(0.018, 5, 5), lm(dark));
      club.position.set(s*0.072, 0.225, -0.420);
      g.add(club);
    }

    // 6다리
    const legGrp = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const z = -0.06 + i * 0.115;
      for (const s of [-1, 1]) {
        const u = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.011, 0.12, 4), lm(dark));
        u.position.set(s*0.175, 0.010, z); u.rotation.z = s*1.20;
        legGrp.add(u);
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.008, 0.10, 4), lm(dark));
        l.position.set(s*0.285, -0.050, z); l.rotation.z = s*0.58; l.rotation.x = 0.38;
        legGrp.add(l);
        const f = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.005, 0.07, 4), lm(dark));
        f.position.set(s*0.350, -0.110, z); f.rotation.x = 0.70;
        legGrp.add(f);
      }
    }
    g.add(legGrp);
    parts.legs = legGrp;
    g.userData.parts = parts;
    return g;
  },

  // ════════════════════════════════════════════════════════════════
  // 4. 귀뚜라미 (cricket) — 긴 더듬이 + 꼬리털
  // ════════════════════════════════════════════════════════════════
  cm_cricket(color) {
    const g     = new THREE.Group();
    const parts = {};
    const dark  = new THREE.Color(color).multiplyScalar(0.44).getHex();

    // 둥근 몸통
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 9, 8), lm(color));
    body.scale.set(0.94, 0.76, 1.28);
    body.position.y = 0.082;
    g.add(body);
    parts.body = body;

    // 날개덮개 (약간 어두운 덮개)
    for (const s of [-1, 1]) {
      const wc = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), lm(dark));
      wc.scale.set(0.68, 0.38, 1.08);
      wc.position.set(s*0.052, 0.108, 0.038);
      g.add(wc);
    }

    // 머리
    const head = new THREE.Group();
    const hm   = new THREE.Mesh(new THREE.SphereGeometry(0.096, 8, 7), lm(color));
    hm.scale.set(1.0, 1.0, 0.88);
    hm.position.set(0, 0.082, -0.198);
    head.add(hm);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 5, 5), lm(0x221100));
      eye.position.set(s*0.053, 0.102, -0.255);
      head.add(eye);
    }
    g.add(head);
    parts.head = head;

    // ★ 긴 더듬이 (3단 연결)
    for (const s of [-1, 1]) {
      const a1 = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.17, 4), lm(dark));
      a1.position.set(s*0.038, 0.135, -0.220); a1.rotation.z = s*-0.42; a1.rotation.x = -0.58;
      g.add(a1);
      const a2 = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.004, 0.21, 4), lm(dark));
      a2.position.set(s*0.095, 0.255, -0.355); a2.rotation.z = s*-0.20; a2.rotation.x = -0.80;
      g.add(a2);
      const a3 = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.002, 0.18, 4), lm(dark));
      a3.position.set(s*0.130, 0.375, -0.470); a3.rotation.z = s*-0.10; a3.rotation.x = -0.90;
      g.add(a3);
    }

    // ★ 뒷다리 (점프용 대형 3절)
    const hindLegs = new THREE.Group();
    for (const s of [-1, 1]) {
      const fem = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.019, 0.24, 5), lm(color));
      fem.position.set(s*0.115, 0.100, 0.155); fem.rotation.z = s*0.68; fem.rotation.x = -0.30;
      hindLegs.add(fem);
      const tib = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.011, 0.27, 5), lm(dark));
      tib.position.set(s*0.240, -0.018, 0.260); tib.rotation.z = s*0.20; tib.rotation.x = 0.72;
      hindLegs.add(tib);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.006, 0.09, 4), lm(dark));
      foot.position.set(s*0.252, -0.175, 0.358); foot.rotation.x = 1.28;
      hindLegs.add(foot);
    }
    g.add(hindLegs);
    parts.hindLegs = hindLegs;

    // 앞/중 다리
    const legGrp = new THREE.Group();
    for (let i = 0; i < 2; i++) {
      const z = -0.115 + i * 0.115;
      for (const s of [-1, 1]) {
        const u = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.009, 0.11, 4), lm(color));
        u.position.set(s*0.135, 0.010, z); u.rotation.z = s*1.22;
        legGrp.add(u);
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.007, 0.09, 4), lm(dark));
        l.position.set(s*0.234, -0.050, z); l.rotation.z = s*0.52; l.rotation.x = 0.48;
        legGrp.add(l);
        const f = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.004, 0.06, 4), lm(dark));
        f.position.set(s*0.295, -0.105, z); f.rotation.x = 0.80;
        legGrp.add(f);
      }
    }
    g.add(legGrp);
    parts.legs = legGrp;

    // ★ 꼬리털 (귀뚜라미 미모)
    for (const s of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.003, 0.17, 4), lm(dark));
      c.position.set(s*0.038, 0.070, 0.410); c.rotation.z = s*0.28; c.rotation.x = 0.48;
      g.add(c);
    }

    g.userData.parts = parts;
    return g;
  },

  // ════════════════════════════════════════════════════════════════
  // 5. 장수풍뎅이 (stag) — 대형 Y자 뿔 + 두 번째 소형 뿔
  // ════════════════════════════════════════════════════════════════
  cm_stag(color) {
    const g     = new THREE.Group();
    const parts = {};
    const dark  = new THREE.Color(color).multiplyScalar(0.32).getHex();
    const HRN   = 0x1e1000;

    // 큰 딱지날개
    const elytra = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 9), lm(color));
    elytra.scale.set(1.04, 0.68, 1.42);
    elytra.position.y = 0.12;
    g.add(elytra);
    parts.body = elytra;

    // 봉합선
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.045, 0.40), lm(dark));
    seam.position.set(0, 0.222, 0.04);
    g.add(seam);

    // 전흉배판 (넓고 납작)
    const thorax = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.118, 0.11, 8), lm(dark));
    thorax.position.set(0, 0.088, -0.225);
    g.add(thorax);

    // 머리
    const head = new THREE.Group();
    const hm   = new THREE.Mesh(new THREE.SphereGeometry(0.105, 8, 7), lm(dark));
    hm.scale.set(1.18, 0.78, 1.0);
    hm.position.set(0, 0.088, -0.385);
    head.add(hm);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.020, 5, 5), lm(0x111111));
      eye.position.set(s*0.075, 0.108, -0.440);
      head.add(eye);
    }
    g.add(head);
    parts.head = head;

    // ★★ 대형 Y자 뿔 (장수풍뎅이 핵심)
    const hornGrp = new THREE.Group();
    // 뿔 기부
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.038, 0.08, 6), lm(HRN));
    base.rotation.x = -0.50; base.position.set(0, 0.165, -0.360);
    hornGrp.add(base);
    // 주 뿔 줄기
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.30, 6), lm(HRN));
    shaft.rotation.x = -0.28; shaft.position.set(0, 0.256, -0.440);
    hornGrp.add(shaft);
    // Y자 갈래
    for (const s of [-1, 1]) {
      const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.015, 0.13, 5), lm(HRN));
      fork.rotation.x = s*0.32 - 0.10; fork.rotation.z = s*0.28;
      fork.position.set(s*0.036, 0.376, -0.514);
      hornGrp.add(fork);
    }
    // 가슴 소형 뿔
    const sHorn = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.020, 0.14, 5), lm(HRN));
    sHorn.rotation.x = -0.62; sHorn.position.set(0, 0.175, -0.205);
    hornGrp.add(sHorn);
    g.add(hornGrp);
    parts.horn = hornGrp;

    // 6다리 (굵고 강함)
    const legGrp = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const z = (i - 1) * 0.118;
      for (const s of [-1, 1]) {
        const u = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.014, 0.135, 5), lm(dark));
        u.position.set(s*0.210, 0.015, z); u.rotation.z = s*1.10;
        legGrp.add(u);
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.010, 0.125, 5), lm(dark));
        l.position.set(s*0.332, -0.050, z); l.rotation.z = s*0.50; l.rotation.x = 0.48;
        legGrp.add(l);
        const f = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.006, 0.075, 4), lm(dark));
        f.position.set(s*0.402, -0.115, z); f.rotation.x = 0.82;
        legGrp.add(f);
        // 발톱
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.038, 3), lm(0x111111));
        claw.position.set(s*0.422, -0.160, z+0.018); claw.rotation.z = s*1.80;
        legGrp.add(claw);
      }
    }
    g.add(legGrp);
    parts.legs = legGrp;
    g.userData.parts = parts;
    return g;
  },

  // ════════════════════════════════════════════════════════════════
  // 6. 지렁이 (worm) — 분절 물결 몸통 + 환대
  // ════════════════════════════════════════════════════════════════
  cm_worm(color) {
    const g     = new THREE.Group();
    const parts = {};
    const pink  = new THREE.Color(color).lerp(new THREE.Color(0xff9999), 0.35).getHex();
    const segs  = [];

    for (let i = 0; i < 11; i++) {
      const t   = i / 10;
      const r   = 0.062 * (1 - t * 0.42) * (i === 0 ? 0.70 : 1.0);
      const seg = new THREE.Mesh(
        new THREE.SphereGeometry(r, 7, 6),
        lm(i % 2 === 0 ? color : pink)
      );
      seg.scale.set(1.0, 0.84, 1.12);
      seg.position.set(Math.sin(t * Math.PI * 2.2) * 0.045, 0.038, i * 0.096 - 0.22);
      g.add(seg);
      segs.push(seg);
    }
    parts.segments = segs;

    // 환대 (클리텔룸 — 환형동물 특징)
    const clitellum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.060, 0.060, 0.088, 7),
      lm(new THREE.Color(color).lerp(new THREE.Color(0xff8888), 0.45).getHex())
    );
    clitellum.rotation.x = Math.PI / 2;
    clitellum.position.set(Math.sin(0.33 * Math.PI * 2.2) * 0.045, 0.038, 0.33 * 10 * 0.096 - 0.22);
    g.add(clitellum);

    // 눈 (아주 작음)
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.010, 4, 4), lm(0x111111));
      eye.position.set(s*0.028, 0.056, -0.250);
      g.add(eye);
    }

    g.userData.parts = parts;
    return g;
  },

  // ════════════════════════════════════════════════════════════════
  // 7. 두더지 (mole) — 분홍 성형코 + 대형 앞발
  // ════════════════════════════════════════════════════════════════
  cm_mole(color) {
    const g     = new THREE.Group();
    const parts = {};
    const PINK  = 0xffbbaa;
    const dark  = 0x1e1208;

    // 통통한 몸통
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.20, 10, 9), lm(color));
    body.scale.set(0.93, 0.84, 1.18);
    body.position.y = 0.12;
    g.add(body);
    parts.body = body;

    // 머리 (몸통과 자연스럽게 연결)
    const head = new THREE.Group();
    const hm   = new THREE.Mesh(new THREE.SphereGeometry(0.145, 9, 8), lm(color));
    hm.scale.set(0.88, 0.84, 0.98);
    hm.position.set(0, 0.130, -0.220);
    head.add(hm);
    // 작은 눈 (거의 퇴화)
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 4, 4), lm(0x111111));
      eye.position.set(s*0.063, 0.162, -0.298);
      head.add(eye);
    }
    g.add(head);
    parts.head = head;

    // ★ 성형코 (별모양 — star-nosed mole 특징)
    for (let i = 0; i < 11; i++) {
      const a   = (i / 11) * Math.PI * 2;
      const ten = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.006, 0.052, 4), lm(PINK));
      ten.position.set(Math.cos(a)*0.030, 0.118 + Math.sin(a)*0.018, -0.364);
      ten.rotation.z = -Math.sin(a)*0.48; ten.rotation.x = -0.58;
      head.add(ten);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 6), lm(PINK));
    nose.position.set(0, 0.118, -0.374);
    head.add(nose);

    // ★ 삽날 앞발 (두더지 시그니처)
    const pawGrp = new THREE.Group();
    for (const s of [-1, 1]) {
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), lm(color));
      shoulder.position.set(s*0.168, 0.098, -0.082);
      pawGrp.add(shoulder);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.028, 0.11, 5), lm(color));
      arm.position.set(s*0.215, 0.038, -0.082); arm.rotation.z = s*0.92;
      pawGrp.add(arm);
      const palm = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 6), lm(PINK));
      palm.scale.set(1.45, 0.38, 0.98);
      palm.position.set(s*0.315, -0.008, -0.082);
      pawGrp.add(palm);
      // 굴착 발톱 5개
      for (let ci = 0; ci < 5; ci++) {
        const ca  = (ci - 2) * 0.20;
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.052, 4), lm(dark));
        claw.position.set(s*(0.352 + Math.sin(ca)*0.028), -0.032, -0.068 + ci*0.006);
        claw.rotation.z = s*(Math.PI/2 + ca*0.30);
        pawGrp.add(claw);
      }
    }
    g.add(pawGrp);
    parts.frontPaws = pawGrp;

    // 뒷발 (소형)
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.014, 0.09, 5), lm(color));
      leg.position.set(s*0.148, 0.018, 0.198); leg.rotation.z = s*1.0;
      g.add(leg);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.030, 5, 5), lm(PINK));
      foot.scale.set(0.68, 0.38, 1.08);
      foot.position.set(s*0.236, -0.028, 0.216);
      g.add(foot);
    }
    // 짧은 꼬리
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.007, 0.09, 4), lm(color));
    tail.rotation.x = Math.PI/2; tail.position.set(0, 0.058, 0.348);
    g.add(tail);

    g.userData.parts = parts;
    return g;
  },

  // ════════════════════════════════════════════════════════════════
  // 8. 달팽이 (snail) — 나선형 껍데기 + 눈자루
  // ════════════════════════════════════════════════════════════════
  cm_snail(color) {
    const g      = new THREE.Group();
    const parts  = {};
    const shellC = new THREE.Color(color).lerp(new THREE.Color(0xaa8800), 0.5).getHex();
    const BODY   = 0xcebb90;

    // 껍데기 텍스처 (나선 띠)
    const sTex = canvasTex(64, 64, (ctx, w, h) => {
      ctx.fillStyle = hexStr(shellC);
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 2.5;
      for (let r = 6; r < 34; r += 7) {
        ctx.beginPath(); ctx.arc(w/2, h/2, r, 0, Math.PI*2); ctx.stroke();
      }
      const g2 = ctx.createRadialGradient(w*0.35, h*0.35, 2, w*0.5, h*0.5, w*0.48);
      g2.addColorStop(0, 'rgba(255,255,255,0.22)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);
    });

    // 껍데기 (토러스 + 끝 구)
    const shellGrp = new THREE.Group();
    const shell    = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.082, 9, 14),
      lms(0xffffff, { map: sTex })
    );
    shell.rotation.x = Math.PI/2 + 0.28; shell.rotation.z = 0.28;
    shell.position.set(0.038, 0.220, 0.060);
    shellGrp.add(shell);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.065, 7, 6),
      lm(new THREE.Color(shellC).multiplyScalar(0.78).getHex()));
    tip.position.set(0.038, 0.298, 0.060);
    shellGrp.add(tip);
    g.add(shellGrp);
    parts.shell = shellGrp;

    // 부드러운 몸통
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 9, 7), lm(BODY));
    body.scale.set(0.74, 0.44, 1.78);
    body.position.set(0, 0.038, 0.016);
    g.add(body);
    parts.body = body;

    // 머리
    const head = new THREE.Group();
    const hm   = new THREE.Mesh(new THREE.SphereGeometry(0.088, 8, 7), lm(BODY));
    hm.scale.set(1.0, 0.84, 0.98);
    hm.position.set(0, 0.068, -0.198);
    head.add(hm);
    // ★ 눈자루 (달팽이 특징)
    for (const s of [-1, 1]) {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.009, 0.135, 4), lm(BODY));
      stalk.position.set(s*0.030, 0.155, -0.215); stalk.rotation.z = s*0.28; stalk.rotation.x = -0.48;
      head.add(stalk);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 5, 5), lm(0x1a0a04));
      eye.position.set(s*0.042, 0.258, -0.282);
      head.add(eye);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.009, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      shine.position.set(s*0.044, 0.265, -0.292);
      head.add(shine);
      // 작은 감각 더듬이
      const s2 = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.005, 0.075, 4), lm(BODY));
      s2.position.set(s*0.026, 0.108, -0.228); s2.rotation.z = s*0.48; s2.rotation.x = -0.40;
      head.add(s2);
    }
    g.add(head);
    parts.head = head;

    // 발바닥
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.036, 0.428), lm(0xbba878));
    foot.position.set(0, -0.002, 0.006);
    g.add(foot);

    g.userData.parts = parts;
    return g;
  },

  // ════════════════════════════════════════════════════════════════
  // 9. 공벌레 (pill bug) — 장갑 분절 등딱지
  // ════════════════════════════════════════════════════════════════
  cm_pill_bug(color) {
    const g     = new THREE.Group();
    const parts = {};
    const dark  = new THREE.Color(color).multiplyScalar(0.44).getHex();
    const light = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.22).getHex();
    const CNT   = 7;

    const segs  = [];
    for (let i = 0; i < CNT; i++) {
      const t   = i / (CNT - 1);
      const wid = 0.42 + Math.sin(t * Math.PI) * 0.50;
      const seg = new THREE.Mesh(
        new THREE.SphereGeometry(0.06 + wid*0.09, 8, 6),
        lm(i % 2 === 0 ? color : dark)
      );
      seg.scale.set(1.28, 0.44 + wid*0.18, 0.68);
      seg.position.set(0, 0.068, (i - 3) * 0.090);
      g.add(seg);
      segs.push(seg);
    }
    parts.segments = segs;

    // 머리 판
    const head = new THREE.Group();
    const hm   = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 7), lm(dark));
    hm.scale.set(1.18, 0.52, 0.78);
    hm.position.set(0, 0.058, -0.322);
    head.add(hm);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 4, 4), lm(0x111111));
      eye.position.set(s*0.054, 0.078, -0.360);
      head.add(eye);
    }
    for (const s of [-1, 1]) {
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.130, 4), lm(dark));
      a.position.set(s*0.035, 0.088, -0.358); a.rotation.z = s*-0.38; a.rotation.x = -0.48;
      head.add(a);
    }
    g.add(head);
    parts.head = head;

    // 14다리 (7쌍, 등각류 스타일)
    const legGrp = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      for (const s of [-1, 1]) {
        const u = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.006, 0.075, 4), lm(dark));
        u.position.set(s*0.142, -0.010, (i-3)*0.090); u.rotation.z = s*1.42;
        legGrp.add(u);
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.004, 0.065, 4), lm(dark));
        l.position.set(s*0.214, -0.058, (i-3)*0.090); l.rotation.z = s*0.50; l.rotation.x = 0.58;
        legGrp.add(l);
      }
    }
    g.add(legGrp);
    parts.legs = legGrp;

    // 꼬리 수지 (uropod)
    for (const s of [-1, 1]) {
      const ur = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.004, 0.088, 4), lm(dark));
      ur.position.set(s*0.028, 0.038, 0.375); ur.rotation.z = s*0.18; ur.rotation.x = 0.38;
      g.add(ur);
    }

    g.userData.parts = parts;
    return g;
  },

  // ════════════════════════════════════════════════════════════════
  // 10. 지네 (centipede) — 12분절 + 독발
  // ════════════════════════════════════════════════════════════════
  cm_centipede(color) {
    const g     = new THREE.Group();
    const parts = {};
    const dark  = new THREE.Color(color).multiplyScalar(0.44).getHex();
    const legC  = new THREE.Color(color).lerp(new THREE.Color(0xff7700), 0.42).getHex();
    const NSEG  = 12;
    const segs  = [];

    for (let i = 0; i < NSEG; i++) {
      const t       = i / (NSEG - 1);
      const r       = 0.058 - t * 0.013;
      const segGrp  = new THREE.Group();

      const body = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 5), lm(i%2===0 ? color : dark));
      body.scale.set(1.10, 0.52, 0.98);
      segGrp.add(body);

      // 분절당 1쌍 다리
      for (const s of [-1, 1]) {
        const u = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.005, 0.115, 4), lm(legC));
        u.position.set(s*0.088, 0, 0); u.rotation.z = s*1.30;
        segGrp.add(u);
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.004, 0.095, 4), lm(legC));
        l.position.set(s*0.178, -0.058, 0.010); l.rotation.z = s*0.48; l.rotation.x = 0.58;
        segGrp.add(l);
        const f = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.003, 0.065, 4), lm(legC));
        f.position.set(s*0.236, -0.114, 0.016); f.rotation.x = 0.88;
        segGrp.add(f);
      }

      segGrp.position.set(Math.sin(t*Math.PI*2.4)*0.038, 0.036, i*0.088 - 0.52);
      g.add(segGrp);
      segs.push(segGrp);
    }
    parts.segments = segs;

    // 머리
    const head = new THREE.Group();
    const hm   = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 7), lm(dark));
    hm.scale.set(1.18, 0.68, 0.98);
    hm.position.set(Math.sin(-0.5*2.4)*0.038, 0.036, -0.562);
    head.add(hm);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 5, 5), lm(0x111111));
      eye.position.set(s*0.046, 0.065, -0.600);
      head.add(eye);
    }
    g.add(head);
    parts.head = head;

    // ★ 독발 (forcipules)
    for (const s of [-1, 1]) {
      const fang = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.014, 0.130, 4), lm(0x2a1800));
      fang.position.set(s*0.038, 0.036, -0.618); fang.rotation.z = s*0.80; fang.rotation.x = -0.48;
      g.add(fang);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.045, 3), lm(0x111111));
      tip.position.set(s*0.068, 0.010, -0.690); tip.rotation.z = s*1.50;
      g.add(tip);
    }
    // 긴 더듬이
    for (const s of [-1, 1]) {
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.003, 0.210, 4), lm(dark));
      a.position.set(s*0.038, 0.075, -0.575); a.rotation.z = s*-0.28; a.rotation.x = -0.70;
      g.add(a);
    }

    g.userData.parts = parts;
    return g;
  },

  // ════════════════════════════════════════════════════════════════
  // 11. 올챙이 (tadpole) — 둥근 머리 + 납작 꼬리
  // ════════════════════════════════════════════════════════════════
  cm_tadpole(color) {
    const g     = new THREE.Group();
    const parts = {};
    const dark  = new THREE.Color(color).multiplyScalar(0.48).getHex();
    const light = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.28).getHex();

    // 둥근 몸통
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.138, 9, 8), lm(color));
    body.scale.set(1.0, 0.82, 1.0);
    body.position.set(0, 0.058, -0.038);
    g.add(body);
    parts.body = body;

    // 밝은 배
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.108, 8, 6), lm(light));
    belly.scale.set(0.88, 0.48, 0.88);
    belly.position.set(0, 0.028, -0.020);
    g.add(belly);

    // 눈 (올챙이 — 뚜렷하게)
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), lm(0x1a1a2a));
      eye.position.set(s*0.074, 0.098, -0.098);
      g.add(eye);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.009, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      shine.position.set(s*0.078, 0.105, -0.115);
      g.add(shine);
    }

    // 작은 입
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.022, 5, 4), lm(0x2a1a0a));
    mouth.scale.set(1.1, 0.38, 0.58); mouth.position.set(0, 0.028, -0.178);
    g.add(mouth);

    // 아가미 (측면 돌기)
    for (const s of [-1, 1]) {
      const gill = new THREE.Mesh(new THREE.SphereGeometry(0.020, 5, 5),
        lm(new THREE.Color(color).lerp(new THREE.Color(0xff8888), 0.28).getHex()));
      gill.scale.set(0.48, 0.78, 0.98); gill.position.set(s*0.118, 0.058, 0.038);
      g.add(gill);
    }

    // ★ 납작한 꼬리 (올챙이 특징)
    const tailGrp = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const t   = i / 7;
      const w   = 0.078 * (1 - t*0.68);
      const h   = 0.038 * (1 - t*0.78);
      const ts  = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.068), lm(dark));
      ts.position.set(Math.sin(t*Math.PI*0.8)*0.028, 0.038, 0.088 + i*0.068);
      tailGrp.add(ts);
    }
    g.add(tailGrp);
    parts.tail = tailGrp;

    g.userData.parts = parts;
    return g;
  },

  // ════════════════════════════════════════════════════════════════
  // 12. 소금쟁이 (water strider) — 초극장 중간다리 + 수면 보조개
  // ════════════════════════════════════════════════════════════════
  cm_water_strider(color) {
    const g     = new THREE.Group();
    const parts = {};
    const dark  = new THREE.Color(color).multiplyScalar(0.44).getHex();

    // 가느다란 몸통
    const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.040, 0.028, 0.30, 6), lm(color));
    bodyMesh.rotation.x = Math.PI/2; bodyMesh.position.y = 0.075;
    g.add(bodyMesh);
    const headM = new THREE.Mesh(new THREE.SphereGeometry(0.058, 7, 6), lm(color));
    headM.position.set(0, 0.075, -0.198);
    g.add(headM);
    parts.body = bodyMesh;

    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 5, 5), lm(0x1a1a00));
      eye.position.set(s*0.040, 0.095, -0.228);
      g.add(eye);
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.003, 0.148, 4), lm(dark));
      a.position.set(s*0.022, 0.118, -0.230); a.rotation.z = s*-0.38; a.rotation.x = -0.58;
      g.add(a);
    }

    const legGrp = new THREE.Group();
    // 짧은 앞다리
    for (const s of [-1, 1]) {
      const u = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.007, 0.11, 4), lm(dark));
      u.position.set(s*0.075, 0.038, -0.095); u.rotation.z = s*1.42;
      legGrp.add(u);
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.005, 0.09, 4), lm(dark));
      l.position.set(s*0.175, -0.010, -0.088); l.rotation.z = s*0.58; l.rotation.x = 0.38;
      legGrp.add(l);
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.003, 0.06, 4), lm(dark));
      f.position.set(s*0.238, -0.058, -0.078); f.rotation.x = 0.78;
      legGrp.add(f);
    }
    // ★ 극단적으로 긴 중간다리 (수면 스케이팅)
    for (const s of [-1, 1]) {
      const u = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.008, 0.175, 4), lm(color));
      u.position.set(s*0.085, 0.035, 0); u.rotation.z = s*1.55;
      legGrp.add(u);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.006, 0.195, 4), lm(dark));
      m.position.set(s*0.245, -0.018, 0); m.rotation.z = s*1.02; m.rotation.x = 0.10;
      legGrp.add(m);
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.004, 0.175, 4), lm(dark));
      l.position.set(s*0.395, -0.018, 0); l.rotation.z = s*0.38; l.rotation.x = 0.28;
      legGrp.add(l);
    }
    // 짧은 뒷다리
    for (const s of [-1, 1]) {
      const u = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.007, 0.125, 4), lm(dark));
      u.position.set(s*0.085, 0.038, 0.118); u.rotation.z = s*1.45;
      legGrp.add(u);
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.005, 0.105, 4), lm(dark));
      l.position.set(s*0.195, -0.010, 0.135); l.rotation.z = s*0.58; l.rotation.x = 0.30;
      legGrp.add(l);
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.003, 0.075, 4), lm(dark));
      f.position.set(s*0.275, -0.048, 0.155); f.rotation.x = 0.68;
      legGrp.add(f);
    }
    g.add(legGrp);
    parts.legs = legGrp;

    // 수면 보조개 (다리 끝 수면 접촉점)
    const dimpleGrp = new THREE.Group();
    [[0.238,-0.058],[0.395,-0.018],[0.275,-0.048]].forEach(([xAbs, y]) => {
      for (const s of [-1, 1]) {
        const d = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.025, 0.004, 7),
          lms(0x88ccff, { transparent: true, opacity: 0.42 })
        );
        d.position.set(s*xAbs, y, 0);
        dimpleGrp.add(d);
      }
    });
    g.add(dimpleGrp);

    g.userData.parts = parts;
    return g;
  },

  // ════════════════════════════════════════════════════════════════
  // 13. 물방개 (water beetle) — 노란 테두리 + 노 모양 뒷발
  // ════════════════════════════════════════════════════════════════
  cm_water_beetle(color) {
    const g     = new THREE.Group();
    const parts = {};
    const dark  = new THREE.Color(color).multiplyScalar(0.38).getHex();
    const GOLD  = 0xdd9900;

    // 유선형 타원 몸통
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), lm(color));
    body.scale.set(0.94, 0.54, 1.44);
    body.position.y = 0.090;
    g.add(body);
    parts.body = body;

    // ★ 황색 테두리 (물방개 특징)
    const border = new THREE.Mesh(
      new THREE.TorusGeometry(0.162, 0.013, 4, 15),
      lm(GOLD)
    );
    border.scale.set(0.94, 0.23, 1.40); border.position.y = 0.082;
    g.add(border);

    // 광택 (MeshPhong)
    const sheen = new THREE.Mesh(new THREE.SphereGeometry(0.154, 8, 6),
      new THREE.MeshPhongMaterial({ color, flatShading: false, shininess: 85, transparent: true, opacity: 0.28 }));
    sheen.scale.set(0.90, 0.42, 1.32); sheen.position.set(0, 0.135, 0);
    g.add(sheen);

    // 전흉 + 머리
    const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 7), lm(dark));
    thorax.scale.set(1.12, 0.68, 0.88); thorax.position.set(0, 0.078, -0.238);
    g.add(thorax);
    const head = new THREE.Group();
    const hm   = new THREE.Mesh(new THREE.SphereGeometry(0.080, 8, 7), lm(dark));
    hm.scale.set(1.02, 0.76, 0.88); hm.position.set(0, 0.068, -0.362);
    head.add(hm);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 5, 5), lm(0x111111));
      eye.position.set(s*0.054, 0.095, -0.398);
      head.add(eye);
    }
    g.add(head); parts.head = head;

    // ★ 노 모양 뒷다리 (수영용)
    const hindGrp = new THREE.Group();
    for (const s of [-1, 1]) {
      const u = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.013, 0.155, 5), lm(dark));
      u.position.set(s*0.172, 0.008, 0.155); u.rotation.z = s*1.15;
      hindGrp.add(u);
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.009, 0.175, 5), lm(dark));
      l.position.set(s*0.312, -0.055, 0.175); l.rotation.z = s*0.48; l.rotation.x = 0.28;
      hindGrp.add(l);
      // 노 (납작한 플레이트)
      const paddle = new THREE.Mesh(new THREE.PlaneGeometry(0.095, 0.052),
        lms(dark, { side: THREE.DoubleSide }));
      paddle.position.set(s*0.392, -0.095, 0.192); paddle.rotation.z = s*0.20; paddle.rotation.y = 0.28;
      hindGrp.add(paddle);
      // 털
      for (let fi = 0; fi < 4; fi++) {
        const hair = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.002, 0.038, 3), lm(dark));
        hair.position.set(s*0.392, -0.092 + (fi-1.5)*0.011, 0.208); hair.rotation.z = s*0.10;
        hindGrp.add(hair);
      }
    }
    g.add(hindGrp); parts.hindLegs = hindGrp;

    // 앞/중 다리
    const legGrp = new THREE.Group();
    for (let i = 0; i < 2; i++) {
      const z = -0.060 + i*0.138;
      for (const s of [-1, 1]) {
        const u = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.009, 0.12, 4), lm(dark));
        u.position.set(s*0.155, 0.008, z); u.rotation.z = s*1.20;
        legGrp.add(u);
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.007, 0.10, 4), lm(dark));
        l.position.set(s*0.264, -0.042, z); l.rotation.z = s*0.50; l.rotation.x = 0.48;
        legGrp.add(l);
        const f = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.004, 0.065, 4), lm(dark));
        f.position.set(s*0.328, -0.095, z); f.rotation.x = 0.78;
        legGrp.add(f);
      }
    }
    g.add(legGrp); parts.legs = legGrp;

    // 공기방울 (딱지날개 아래 저장 공기)
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5),
      lms(0xccefff, { transparent: true, opacity: 0.28 }));
    bubble.position.set(0, 0.020, 0.098);
    g.add(bubble);

    g.userData.parts = parts;
    return g;
  },

  // ════════════════════════════════════════════════════════════════
  // 14. 유충 (larvae) — 크림색 굼벵이 + 갈색 머리
  // ════════════════════════════════════════════════════════════════
  cm_larvae(color) {
    const g     = new THREE.Group();
    const parts = {};
    const CREAM = 0xf0e8c8;
    const dark  = new THREE.Color(color).multiplyScalar(0.52).getHex();
    const NSEG  = 8;
    const segs  = [];

    for (let i = 0; i < NSEG; i++) {
      const t   = i / (NSEG - 1);
      const r   = 0.082 - t * 0.018;
      const seg = new THREE.Mesh(
        new THREE.SphereGeometry(r, 7, 6),
        lm(i === 0 ? color : CREAM)
      );
      seg.scale.set(1.0, 0.84, 1.04);
      // 살짝 구부러진 자세
      const angle = t * Math.PI * 0.32;
      seg.position.set(Math.sin(angle)*0.075, 0.058 + Math.sin(angle*0.5)*0.018, t*0.548 - 0.210);
      g.add(seg);
      segs.push(seg);
    }
    parts.segments = segs;

    // 분절 링 (주름)
    for (let i = 1; i < NSEG - 1; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.064, 0.008, 3, 8),
        lm(new THREE.Color(CREAM).multiplyScalar(0.82).getHex())
      );
      ring.position.copy(segs[i].position); ring.rotation.x = Math.PI/2;
      g.add(ring);
    }

    // 머리 (갈색, 구별됨)
    const head = new THREE.Group();
    const hm   = new THREE.Mesh(new THREE.SphereGeometry(0.090, 8, 7), lm(color));
    hm.scale.set(1.0, 0.86, 0.98); hm.position.set(0, 0.058, -0.248);
    head.add(hm);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 5, 5), lm(0x111111));
      eye.position.set(s*0.052, 0.086, -0.298);
      head.add(eye);
    }
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.020, 5, 4), lm(0x1a0a00));
    mouth.scale.set(1.1, 0.56, 0.75); mouth.position.set(0, 0.038, -0.330);
    head.add(mouth);
    g.add(head); parts.head = head;

    // 짧은 앞다리 (굼벵이 3쌍)
    const legGrp = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      for (const s of [-1, 1]) {
        const u = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.006, 0.065, 4), lm(color));
        u.position.set(s*0.085, 0.000, -0.145 + i*0.068); u.rotation.z = s*1.42;
        legGrp.add(u);
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.005, 0.055, 4), lm(dark));
        l.position.set(s*0.148, -0.038, -0.122 + i*0.068); l.rotation.z = s*0.58; l.rotation.x = 0.48;
        legGrp.add(l);
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.028, 3), lm(0x0a0a00));
        claw.position.set(s*0.182, -0.065, -0.105 + i*0.068); claw.rotation.z = s*1.78;
        legGrp.add(claw);
      }
    }
    g.add(legGrp); parts.legs = legGrp;

    g.userData.parts = parts;
    return g;
  },

  // ════════════════════════════════════════════════════════════════
  // 15. 반딧불 (firefly) — 발광 꼬리 + 반투명 날개
  // ════════════════════════════════════════════════════════════════
  cm_firefly(color) {
    const g     = new THREE.Group();
    const parts = {};
    const BLK   = 0x111100;
    const GLOW  = 0xaaff44;

    // 몸통 분절
    const bodyGrp = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const r   = 0.050 - i * 0.008;
      const seg = new THREE.Mesh(
        new THREE.SphereGeometry(r, 7, 6),
        lm(i === 0 ? 0x221100 : (i === 3 ? GLOW : BLK))
      );
      seg.scale.set(1.0, 0.74, 1.0);
      seg.position.z = i * 0.072;
      bodyGrp.add(seg);
    }
    g.add(bodyGrp); parts.body = bodyGrp;

    // ★ 발광 꼬리 (반딧불 핵심)
    const glowGrp = new THREE.Group();
    const glowSeg = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 8, 6),
      new THREE.MeshBasicMaterial({ color: GLOW })
    );
    glowSeg.scale.set(1.0, 0.64, 1.0); glowSeg.position.z = 0.215;
    glowGrp.add(glowSeg);
    // 광채 아우라 (2겹)
    const glow1 = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 6),
      new THREE.MeshBasicMaterial({ color: GLOW, transparent: true, opacity: 0.20 }));
    glow1.position.z = 0.215; glowGrp.add(glow1);
    const glow2 = new THREE.Mesh(new THREE.SphereGeometry(0.145, 7, 5),
      new THREE.MeshBasicMaterial({ color: 0x88ff22, transparent: true, opacity: 0.10 }));
    glow2.position.z = 0.215; glowGrp.add(glow2);
    g.add(glowGrp); parts.glow = glowGrp;

    // 전흉 + 머리
    const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.068, 7, 6), lm(0x332200));
    thorax.position.z = -0.075; g.add(thorax);
    const head = new THREE.Group();
    const hm   = new THREE.Mesh(new THREE.SphereGeometry(0.062, 7, 6), lm(0x221100));
    hm.position.z = -0.178; head.add(hm);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.020, 5, 5), lm(0x664400));
      eye.position.set(s*0.042, 0.020, -0.218); head.add(eye);
    }
    g.add(head); parts.head = head;

    // 더듬이
    for (const s of [-1, 1]) {
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.004, 0.135, 4), lm(BLK));
      a.position.set(s*0.026, 0.058, -0.195); a.rotation.z = s*-0.38; a.rotation.x = -0.48;
      g.add(a);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.013, 4, 4), lm(BLK));
      tip.position.set(s*0.050, 0.135, -0.265); g.add(tip);
    }

    // 날개 (반투명)
    const wMat  = lms(0x224400, { transparent: true, opacity: 0.52, side: THREE.DoubleSide });
    const wingGrp = new THREE.Group();
    const wings   = [];
    [[-0.195, 0.028, -0.018, 0.275, 0.095], [0.195, 0.028, -0.018, 0.275, 0.095],
     [-0.155, 0.020,  0.058, 0.215, 0.080], [0.155, 0.020,  0.058, 0.215, 0.080]
    ].forEach(([x, y, z, w, h]) => {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wMat.clone());
      wing.position.set(x, y, z); wingGrp.add(wing); wings.push(wing);
    });
    g.add(wingGrp); parts.wings = wingGrp;
    g.userData.wings = wings;

    // 6다리
    const legGrp = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const z = (i - 1) * 0.068;
      for (const s of [-1, 1]) {
        const u = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.006, 0.085, 4), lm(BLK));
        u.position.set(s*0.088, 0.000, z); u.rotation.z = s*1.28;
        legGrp.add(u);
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.004, 0.075, 4), lm(BLK));
        l.position.set(s*0.165, -0.038, z); l.rotation.z = s*0.48; l.rotation.x = 0.38;
        legGrp.add(l);
        const f = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.003, 0.048, 4), lm(BLK));
        f.position.set(s*0.215, -0.075, z); f.rotation.x = 0.68;
        legGrp.add(f);
      }
    }
    g.add(legGrp); parts.legs = legGrp;

    g.userData.parts = parts;
    return g;
  },
};

// ─────────────────────────────────────────────────────────────────
// DETAILED_SHAPE_MAP — type 문자열 → 신규 빌더 키
// ─────────────────────────────────────────────────────────────────
export const DETAILED_SHAPE_MAP = {
  butterfly:    'cm_butterfly',
  ladybug:      'cm_ladybug',
  beetle:       'cm_beetle',
  cricket:      'cm_cricket',
  stag:         'cm_stag',
  worm:         'cm_worm',
  mole:         'cm_mole',
  snail:        'cm_snail',
  pill_bug:     'cm_pill_bug',
  centipede:    'cm_centipede',
  tadpole:      'cm_tadpole',
  water_strider:'cm_water_strider',
  water_beetle: 'cm_water_beetle',
  larvae:       'cm_larvae',
  firefly:      'cm_firefly',
};
