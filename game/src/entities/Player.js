import * as THREE from 'three';

// Three.js r155+ made position/scale read-only getters ??can't use Object.assign.
// Use this helper instead of _mkMesh(...), { position, scale }).
function _mkMesh(geo, mat, props = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (props.position) m.position.copy(props.position);
  if (props.scale)    m.scale.copy(props.scale);
  if (props.rotation) m.rotation.copy(props.rotation);
  return m;
}

/**
 * Player ??AAA-quality stylized explorer character
 *
 * Skeleton hierarchy (Groups = pivot joints, all coords relative to parent):
 *
 *  root (world feet)
 *  ?붴? hips [y=0.90]           ??locomotion pivot, hip sway
 *      ?쒋? spine0 [y=0.02]     ??lower spine flex
 *      ?? ?붴? spine1 [y=0.22]  ??upper spine twist (counter walk)
 *      ??    ?붴? chest [y=0.06]
 *      ??        ?쒋? neck [y=0.42] ??headGroup [y=0.20] ??hatGroup
 *      ??        ?쒋? clavL  ??shoulderL ??upperArmL ??elbowL ??wristL
 *      ??        ?쒋? clavR  ??shoulderR ??upperArmR ??elbowR ??wristR ??netGroup
 *      ??        ?붴? packGroup (backpack, no animation)
 *      ?쒋? thighL [x=-0.14] ??kneeL ??ankleL
 *      ?붴? thighR [x= 0.14] ??kneeR ??ankleR
 *
 * Every visual mesh is offset inside its parent group so the group
 * origin sits exactly at the anatomical joint ??rotations always
 * happen from the correct pivot.
 */

// ?? Module-level reuse vectors ?????????????????????????????????????
const _mv  = new THREE.Vector3();
const _zero = new THREE.Vector3(0, 0, 0);
const _vn   = new THREE.Vector3();
const _vel = new THREE.Vector3();

// ?? Color palette (explorer/hunter) ???????????????????????????????
const C = {
  skin:     0xFFB082,
  skinDark: 0xE8956A,
  hair:     0x1C0F08,
  jacket:   0x3E5C76,   // slate-blue field jacket
  jacketDk: 0x2C3F52,
  shirt:    0xC8B99A,   // cream undershirt
  pants:    0x4A4235,   // dark olive
  pantsDk:  0x342E26,
  belt:     0x1A1208,
  boot:     0x1A0F08,
  bootSole: 0x0A0806,
  hat:      0x7A5C1E,
  hatBand:  0x3A2A08,
  hatBrim:  0x6A4E18,
  pack:     0xA83C00,
  packDk:   0x7A2C00,
  strap:    0x6A2800,
  metal:    0x7A7A7A,
  metalSh:  0xAAAAAA,
  wood:     0x7A5020,
  woodDk:   0x4A3010,
  rope:     0xC8B870,
  iris:     0x4A7090,
  white:    0xF4F0E8,
};

// Quick Lambert material factory
const lm = (color, flat = true) =>
  new THREE.MeshLambertMaterial({ color, flatShading: flat });

// ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
export class Player {
  constructor(scene) {
    this.scene       = scene;
    this.speed       = 14;
    this.captureRange = 5;
    this.swingSpeed  = 1.0;
    this.isSwinging  = false;
    this.swingTimer  = 0;
    this.swingDuration = 0.3;
    this.keys        = {};

    // Animation state
    this._walkTime   = 0;
    this._idleTime   = 0;
    this._speedBlend = 0;   // 0 = fully idle, 1 = full run
    this._isMoving   = false;

    // All joint groups, keyed by name
    this._j = {};

    // Backwards-compat refs used by Game.js / WaveSystem
    this.armR = null;
    this.netGroup = null;

    this._keyDown = e => { this.keys[e.code] = true; };
    this._keyUp   = e => { this.keys[e.code] = false; };
    window.addEventListener('keydown', this._keyDown);
    window.addEventListener('keyup',   this._keyUp);

    this._buildMesh();
  }

  // ?? Geometry helpers ????????????????????????????????????????????
  /** Box with geometry origin at top centre (so the joint pivot sits at top) */
  _boxFromTop(w, h, d) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(0, -h / 2, 0);
    return g;
  }
  /** Box with geometry origin at bottom centre */
  _boxFromBot(w, h, d) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(0, h / 2, 0);
    return g;
  }

  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
  _buildMesh() {
    const j = this._j;   // joint map
    const root = new THREE.Group();

    // ?? HIPS ?????????????????????????????????????????????????????
    const hips = new THREE.Group();
    hips.position.y = 0.90;
    root.add(hips);
    j.hips = hips;

    // Pelvis block (visual, not a joint)
    const pelvisMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.50, 0.20, 0.30),
      lm(C.pants)
    );
    pelvisMesh.position.y = -0.10;
    hips.add(pelvisMesh);

    // Belt
    hips.add(_mkMesh(
      new THREE.BoxGeometry(0.52, 0.055, 0.32), lm(C.belt)
    , { position: new THREE.Vector3(0, 0.02, 0) }));

    // Belt buckle
    hips.add(_mkMesh(
      new THREE.BoxGeometry(0.07, 0.055, 0.04), lm(C.metalSh)
    , { position: new THREE.Vector3(0, 0.02, -0.165) }));

    // ?? SPINE ?????????????????????????????????????????????????????
    const spine0 = new THREE.Group();
    spine0.position.y = 0.04;
    hips.add(spine0);
    j.spine0 = spine0;

    // Abdomen
    spine0.add(_mkMesh(
      new THREE.BoxGeometry(0.44, 0.26, 0.28), lm(C.shirt)
    , { position: new THREE.Vector3(0, 0.13, 0) }));

    const spine1 = new THREE.Group();
    spine1.position.y = 0.26;
    spine0.add(spine1);
    j.spine1 = spine1;

    // ?? CHEST ?????????????????????????????????????????????????????
    const chest = new THREE.Group();
    chest.position.y = 0.04;
    spine1.add(chest);
    j.chest = chest;

    // Jacket front panels
    chest.add(_mkMesh(
      new THREE.BoxGeometry(0.70, 0.42, 0.34), lm(C.jacket)
    , { position: new THREE.Vector3(0, 0.21, 0) }));

    // Jacket lapels
    for (const sx of [-1, 1]) {
      const lapel = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.24, 0.04), lm(C.jacketDk)
      );
      lapel.position.set(sx * 0.16, 0.30, -0.17);
      lapel.rotation.z = -sx * 0.28;
      chest.add(lapel);
    }

    // Shirt visible at neck
    chest.add(_mkMesh(
      new THREE.BoxGeometry(0.20, 0.12, 0.05), lm(C.shirt)
    , { position: new THREE.Vector3(0, 0.38, -0.165) }));

    // Chest pockets
    for (const sx of [-1, 1]) {
      const pocket = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.14, 0.04), lm(C.jacketDk)
      );
      pocket.position.set(sx * 0.22, 0.26, -0.17);
      chest.add(pocket);
    }

    // ?? NECK ??????????????????????????????????????????????????????
    const neck = new THREE.Group();
    neck.position.y = 0.43;
    chest.add(neck);
    j.neck = neck;

    neck.add(_mkMesh(
      new THREE.CylinderGeometry(0.095, 0.115, 0.18, 8), lm(C.skin, false)
    , { position: new THREE.Vector3(0, 0.09, 0) }));

    // ?? HEAD ??????????????????????????????????????????????????????
    const headGroup = new THREE.Group();
    headGroup.position.y = 0.20;
    neck.add(headGroup);
    j.head = headGroup;

    // Skull ??slightly tapered
    const skullMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.40, 0.44, 0.38), lm(C.skin, false)
    );
    skullMesh.position.y = 0.22;
    headGroup.add(skullMesh);

    // Jaw / cheeks slightly wider
    const jawMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.10, 0.34), lm(C.skin, false)
    );
    jawMesh.position.set(0, 0.07, 0.01);
    headGroup.add(jawMesh);

    // Eyes (socket + iris + pupil + shine)
    const eyeWhiteMat = lm(C.white, false);
    const irisMat     = lm(C.iris, false);
    const pupilMat    = lm(0x111118, false);
    const shineMat    = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    for (const sx of [-1, 1]) {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), eyeWhiteMat);
      socket.position.set(sx * 0.128, 0.265, -0.178);
      headGroup.add(socket);

      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.044, 7, 6), irisMat);
      iris.position.set(sx * 0.128, 0.265, -0.205);
      headGroup.add(iris);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.027, 6, 6), pupilMat);
      pupil.position.set(sx * 0.128, 0.265, -0.220);
      headGroup.add(pupil);

      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.010, 4, 4), shineMat);
      shine.position.set(sx * 0.120, 0.274, -0.228);
      headGroup.add(shine);

      // Eyelid crease
      const lid = new THREE.Mesh(
        new THREE.BoxGeometry(0.10, 0.018, 0.018), lm(C.skinDark)
      );
      lid.position.set(sx * 0.128, 0.282, -0.178);
      headGroup.add(lid);

      // Eyebrow
      const brow = new THREE.Mesh(
        new THREE.BoxGeometry(0.115, 0.024, 0.022), lm(C.hair)
      );
      brow.position.set(sx * 0.128, 0.326, -0.176);
      brow.rotation.z = sx * 0.10;
      headGroup.add(brow);

      // Ear
      const ear = new THREE.Mesh(
        new THREE.BoxGeometry(0.038, 0.076, 0.050), lm(C.skinDark, false)
      );
      ear.position.set(sx * 0.220, 0.230, -0.04);
      headGroup.add(ear);
    }

    // Nose
    const nose = new THREE.Mesh(
      new THREE.BoxGeometry(0.058, 0.042, 0.065), lm(C.skinDark, false)
    );
    nose.position.set(0, 0.195, -0.205);
    headGroup.add(nose);

    // Mouth
    const mouth = new THREE.Mesh(
      new THREE.BoxGeometry(0.095, 0.022, 0.020), lm(0xAA7060)
    );
    mouth.position.set(0, 0.148, -0.192);
    headGroup.add(mouth);

    // ?? HAT ???????????????????????????????????????????????????????
    const hatGroup = new THREE.Group();
    hatGroup.position.y = 0.44;
    headGroup.add(hatGroup);
    j.hat = hatGroup;

    // Brim
    hatGroup.add(_mkMesh(
      new THREE.CylinderGeometry(0.46, 0.46, 0.04, 14), lm(C.hatBrim)
    , { position: new THREE.Vector3(0, 0.02, 0) }));

    // Crown
    hatGroup.add(_mkMesh(
      new THREE.CylinderGeometry(0.235, 0.255, 0.24, 10), lm(C.hat)
    , { position: new THREE.Vector3(0, 0.15, 0) }));

    // Top slightly domed
    hatGroup.add(_mkMesh(
      new THREE.CylinderGeometry(0.195, 0.235, 0.04, 10), lm(C.hat)
    , { position: new THREE.Vector3(0, 0.26, 0) }));

    // Hat band
    hatGroup.add(_mkMesh(
      new THREE.CylinderGeometry(0.257, 0.257, 0.055, 10), lm(C.hatBand)
    , { position: new THREE.Vector3(0, 0.065, 0) }));

    // Hat pin / badge (detail)
    hatGroup.add(_mkMesh(
      new THREE.SphereGeometry(0.018, 5, 5), lm(C.metalSh, false)
    , { position: new THREE.Vector3(-0.12, 0.085, -0.22) }));

    // ?? BACKPACK ??????????????????????????????????????????????????
    const pack = new THREE.Group();
    pack.position.set(0, 0.14, 0.215);
    chest.add(pack);

    // Main body
    pack.add(_mkMesh(
      new THREE.BoxGeometry(0.36, 0.52, 0.20), lm(C.pack)
    , { position: new THREE.Vector3(0, 0.09, 0) }));

    // Top flap
    const flap = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.14, 0.05), lm(C.packDk)
    );
    flap.position.set(0, 0.40, -0.125);
    flap.rotation.x = -0.25;
    pack.add(flap);

    // Front pocket
    pack.add(_mkMesh(
      new THREE.BoxGeometry(0.28, 0.22, 0.06), lm(C.packDk)
    , { position: new THREE.Vector3(0, -0.09, -0.13) }));

    // Side pouches
    for (const sx of [-1, 1]) {
      pack.add(_mkMesh(
        new THREE.BoxGeometry(0.06, 0.18, 0.14), lm(C.packDk)
      , { position: new THREE.Vector3(sx * 0.21, 0.04, -0.03) }));
    }

    // Shoulder straps
    for (const sx of [-1, 1]) {
      const str = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.48, 0.04), lm(C.strap)
      );
      str.position.set(sx * 0.13, 0.16, -0.12);
      str.rotation.x = -0.12;
      pack.add(str);
    }

    // ?? ARMS ??LEFT ???????????????????????????????????????????????
    // Clavicle (shoulder socket pivot)
    const clavL = new THREE.Group();
    clavL.position.set(-0.345, 0.36, 0);
    chest.add(clavL);
    j.clavL = clavL;

    // Shoulder cap
    clavL.add(_mkMesh(
      new THREE.SphereGeometry(0.118, 8, 6), lm(C.jacket)
    , { scale: new THREE.Vector3(1, 0.82, 0.82) }));

    // Upper arm pivot (below shoulder)
    const uArmL = new THREE.Group();
    uArmL.position.y = -0.118;
    clavL.add(uArmL);
    j.uArmL = uArmL;

    uArmL.add(_mkMesh(
      this._boxFromTop(0.185, 0.295, 0.185), lm(C.jacket)
    , {}));

    // Elbow pivot
    const elbowL = new THREE.Group();
    elbowL.position.y = -0.295;
    uArmL.add(elbowL);
    j.elbowL = elbowL;

    // Elbow cap
    elbowL.add(_mkMesh(
      new THREE.SphereGeometry(0.075, 6, 5), lm(C.jacketDk)
    , {}));

    // Forearm
    elbowL.add(_mkMesh(
      this._boxFromTop(0.158, 0.265, 0.158), lm(C.shirt)
    , {}));

    // Wrist / hand pivot
    const wristL = new THREE.Group();
    wristL.position.y = -0.265;
    elbowL.add(wristL);
    j.wristL = wristL;

    wristL.add(_mkMesh(
      new THREE.BoxGeometry(0.158, 0.115, 0.110), lm(C.skin, false)
    , { position: new THREE.Vector3(0, -0.058, 0) }));

    // ?? ARMS ??RIGHT ??????????????????????????????????????????????
    const clavR = new THREE.Group();
    clavR.position.set(0.345, 0.36, 0);
    chest.add(clavR);
    j.clavR = clavR;

    clavR.add(_mkMesh(
      new THREE.SphereGeometry(0.118, 8, 6), lm(C.jacket)
    , { scale: new THREE.Vector3(1, 0.82, 0.82) }));

    const uArmR = new THREE.Group();
    uArmR.position.y = -0.118;
    clavR.add(uArmR);
    j.uArmR = uArmR;

    uArmR.add(_mkMesh(
      this._boxFromTop(0.185, 0.295, 0.185), lm(C.jacket)
    , {}));

    const elbowR = new THREE.Group();
    elbowR.position.y = -0.295;
    uArmR.add(elbowR);
    j.elbowR = elbowR;

    elbowR.add(_mkMesh(
      new THREE.SphereGeometry(0.075, 6, 5), lm(C.jacketDk)
    , {}));

    elbowR.add(_mkMesh(
      this._boxFromTop(0.158, 0.265, 0.158), lm(C.shirt)
    , {}));

    const wristR = new THREE.Group();
    wristR.position.y = -0.265;
    elbowR.add(wristR);
    j.wristR = wristR;

    wristR.add(_mkMesh(
      new THREE.BoxGeometry(0.158, 0.115, 0.110), lm(C.skin, false)
    , { position: new THREE.Vector3(0, -0.058, 0) }));

    // ?? NET (bug-catching net attached to right wrist) ?????????????
    const netGroup = new THREE.Group();
    netGroup.position.set(0.02, -0.12, -0.05);
    netGroup.rotation.x = -0.18;   // slight forward tilt at rest
    wristR.add(netGroup);
    this.netGroup = netGroup;

    // Handle ??bamboo/wood pole with visible segments
    const handleMat = lm(C.wood);
    const handleDkMat = lm(C.woodDk);
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035 - i * 0.002, 0.040 - i * 0.002, 0.32, 8),
        i % 2 === 0 ? handleMat : handleDkMat
      );
      seg.position.y = 0.16 + i * 0.32;
      netGroup.add(seg);
    }

    // Grip wrap (tape at hand position)
    const gripWrap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.046, 0.046, 0.22, 8), lm(C.rope)
    );
    gripWrap.position.y = 0.11;
    netGroup.add(gripWrap);

    // Metal ring connector
    const connector = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, 0.08, 8), lm(C.metal)
    );
    connector.position.y = 1.56;
    netGroup.add(connector);

    // Net ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.355, 0.026, 8, 24), lm(C.metalSh, false)
    );
    ring.position.y = 1.60;
    ring.rotation.x = Math.PI / 2;
    netGroup.add(ring);

    // Net mesh (semi-transparent hemisphere)
    const netGeo = new THREE.SphereGeometry(0.33, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const netMesh = new THREE.Mesh(netGeo, new THREE.MeshLambertMaterial({
      color: 0xD8D4A8, transparent: true, opacity: 0.28,
      side: THREE.DoubleSide, depthWrite: false,
    }));
    netMesh.position.y = 1.60;
    netMesh.rotation.x = Math.PI;
    netGroup.add(netMesh);

    // Net wireframe (visible threads)
    const netWire = new THREE.Mesh(netGeo.clone(),
      new THREE.MeshBasicMaterial({
        color: 0xBCB888, transparent: true, opacity: 0.50, wireframe: true,
      })
    );
    netWire.position.y = 1.60;
    netWire.rotation.x = Math.PI;
    netGroup.add(netWire);

    // ?? LEGS ??LEFT ???????????????????????????????????????????????
    const thighL = new THREE.Group();
    thighL.position.set(-0.145, -0.02, 0);
    hips.add(thighL);
    j.thighL = thighL;

    // Thigh ??pivot at top (hip socket)
    thighL.add(_mkMesh(
      this._boxFromTop(0.215, 0.385, 0.215), lm(C.pants)
    , {}));

    // Knee pivot
    const kneeL = new THREE.Group();
    kneeL.position.y = -0.385;
    thighL.add(kneeL);
    j.kneeL = kneeL;

    // Knee cap detail
    kneeL.add(_mkMesh(
      new THREE.SphereGeometry(0.080, 6, 5), lm(C.pantsDk)
    , {}));

    // Shin
    kneeL.add(_mkMesh(
      this._boxFromTop(0.178, 0.355, 0.178), lm(C.pants)
    , {}));

    // Ankle pivot
    const ankleL = new THREE.Group();
    ankleL.position.y = -0.355;
    kneeL.add(ankleL);
    j.ankleL = ankleL;

    // Boot upper
    ankleL.add(_mkMesh(
      new THREE.BoxGeometry(0.205, 0.22, 0.220), lm(C.boot)
    , { position: new THREE.Vector3(0, 0.11, 0) }));

    // Boot sole
    ankleL.add(_mkMesh(
      new THREE.BoxGeometry(0.225, 0.065, 0.380), lm(C.bootSole)
    , { position: new THREE.Vector3(0, 0.022, -0.045) }));

    // Toe box
    ankleL.add(_mkMesh(
      new THREE.BoxGeometry(0.205, 0.125, 0.210), lm(C.boot)
    , { position: new THREE.Vector3(0, 0.062, -0.175) }));

    // Boot laces (small details)
    for (let i = 0; i < 3; i++) {
      ankleL.add(_mkMesh(
        new THREE.BoxGeometry(0.22, 0.014, 0.018), lm(C.rope)
      , { position: new THREE.Vector3(0, 0.08 + i * 0.045, -0.108) }));
    }

    // ?? LEGS ??RIGHT ??????????????????????????????????????????????
    const thighR = new THREE.Group();
    thighR.position.set(0.145, -0.02, 0);
    hips.add(thighR);
    j.thighR = thighR;

    thighR.add(_mkMesh(
      this._boxFromTop(0.215, 0.385, 0.215), lm(C.pants)
    , {}));

    const kneeR = new THREE.Group();
    kneeR.position.y = -0.385;
    thighR.add(kneeR);
    j.kneeR = kneeR;

    kneeR.add(_mkMesh(
      new THREE.SphereGeometry(0.080, 6, 5), lm(C.pantsDk)
    , {}));

    kneeR.add(_mkMesh(
      this._boxFromTop(0.178, 0.355, 0.178), lm(C.pants)
    , {}));

    const ankleR = new THREE.Group();
    ankleR.position.y = -0.355;
    kneeR.add(ankleR);
    j.ankleR = ankleR;

    ankleR.add(_mkMesh(
      new THREE.BoxGeometry(0.205, 0.22, 0.220), lm(C.boot)
    , { position: new THREE.Vector3(0, 0.11, 0) }));

    ankleR.add(_mkMesh(
      new THREE.BoxGeometry(0.225, 0.065, 0.380), lm(C.bootSole)
    , { position: new THREE.Vector3(0, 0.022, -0.045) }));

    ankleR.add(_mkMesh(
      new THREE.BoxGeometry(0.205, 0.125, 0.210), lm(C.boot)
    , { position: new THREE.Vector3(0, 0.062, -0.175) }));

    for (let i = 0; i < 3; i++) {
      ankleR.add(_mkMesh(
        new THREE.BoxGeometry(0.22, 0.014, 0.018), lm(C.rope)
      , { position: new THREE.Vector3(0, 0.08 + i * 0.045, -0.108) }));
    }

    // ?? GROUND SHADOW DISC ????????????????????????????????????????
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.52, 14),
      new THREE.MeshBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false,
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    root.add(shadow);
    this._shadowMesh = shadow;

    // ?? FINISH ????????????????????????????????????????????????????
    root.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
      }
    });

    // Set initial ankle tilt (slight forward lean = natural stand)
    if (j.ankleL) j.ankleL.rotation.x = -0.05;
    if (j.ankleR) j.ankleR.rotation.x = -0.05;

    // Idle arm pose ??left arm slightly bent, right arm holds net down
    if (j.uArmL) j.uArmL.rotation.z =  0.08;
    if (j.uArmR) j.uArmR.rotation.z = -0.08;
    if (j.elbowL) j.elbowL.rotation.x = 0.22;
    if (j.elbowR) j.elbowR.rotation.x = 0.14;

    // ── 포획 범위 링 표시기 ───────────────────────────────────────
    // 반경 1 기준 → scale 로 captureRange 에 맞춤 (동적 변경 가능)
    const ringGeo = new THREE.TorusGeometry(1, 0.028, 4, 52);
    ringGeo.rotateX(Math.PI / 2);
    this._rangeRingMat = new THREE.MeshBasicMaterial({
      color: 0x4ecdc4,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this._rangeRing = new THREE.Mesh(ringGeo, this._rangeRingMat);
    this._rangeRing.position.y = 0.08;
    this._rangeRing.scale.setScalar(this.captureRange);
    root.add(this._rangeRing);
    this._swingFlash = 0;

    this.mesh = root;
    this.scene.add(root);

    // Backwards compat
    this.armR = j.uArmR;
    this.legL = j.thighL;
    this.legR = j.thighR;
  }

  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
  // UPDATE
  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
  update(delta, camCtrl, world) {
    this._updateMovement(delta, camCtrl, world);
    this._updateSwing(delta);
    this._updateAnimation(delta);
    this._updateRangeRing(delta);
  }

  _updateRangeRing(delta) {
    if (!this._rangeRing) return;
    // 반경을 captureRange 에 동기화 (상점 업그레이드로 변경 가능)
    this._rangeRing.scale.setScalar(this.captureRange);
    // 스윙 플래시 감소
    if (this._swingFlash > 0) {
      this._swingFlash = Math.max(0, this._swingFlash - delta * 4);
    }
    // 기본 맥동 + 스윙 플래시 합산 + 업그레이드 부스트
    const boost = this._ringBoost ?? 0;
    const pulse = 0.18 + boost + Math.sin(Date.now() * 0.0025) * (0.06 + boost * 0.5);
    const flash = this._swingFlash * 0.65;
    this._rangeRingMat.opacity = Math.min(0.92, pulse + flash);
    // 플래시 시 색상 전환 (흰색 → 청록)
    const f = this._swingFlash;
    this._rangeRingMat.color.setRGB(
      THREE.MathUtils.lerp(0x4e / 255, 1.0, f),
      THREE.MathUtils.lerp(0xcd / 255, 1.0, f),
      THREE.MathUtils.lerp(0xc4 / 255, 1.0, f)
    );
  }

  _updateMovement(delta, camCtrl, world) {
    const fwd   = camCtrl.getForwardXZ();
    const right = camCtrl.getRightXZ();
    _mv.set(0, 0, 0);

    if (this.keys['KeyW'] || this.keys['ArrowUp'])    _mv.addScaledVector(fwd,   1);
    if (this.keys['KeyS'] || this.keys['ArrowDown'])  _mv.addScaledVector(fwd,  -1);
    if (this.keys['KeyA'] || this.keys['ArrowLeft'])  _mv.addScaledVector(right,-1);
    if (this.keys['KeyD'] || this.keys['ArrowRight']) _mv.addScaledVector(right, 1);

    const hasInput = _mv.lengthSq() > 0;
    this._isMoving = hasInput;

    if (hasInput) {
      _mv.normalize();
      // 터치 조이스틱 아날로그 스케일 (키보드는 항상 1.0)
      const analogScale = this._touchSpeedScale ?? 1.0;
      // _zero 재사용: lerp는 인수를 수정하지 않으므로 _mv를 직접 스케일한 임시값 필요
      // → _vn에 복사 후 스케일 → lerp 타겟으로 사용 (allocation 없음)
      _vn.copy(_mv).multiplyScalar(this.speed * Math.max(0.25, analogScale));
      _vel.lerp(_vn, Math.min(1, 10 * delta));
    } else {
      _vel.lerp(_zero, Math.min(1, 13 * delta));
    }

    const moveLen = _vel.length();
    if (moveLen > 0.05) {
      this.mesh.position.addScaledVector(_vel, delta);
      // _vn 재사용: 방향 계산용 (lerp 후 재사용 안전)
      _vn.copy(_vel).normalize();
      const targetAngle = Math.atan2(_vn.x, _vn.z) + Math.PI;
      let diff = targetAngle - this.mesh.rotation.y;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.mesh.rotation.y += diff * Math.min(1, 14 * delta);
    }

    const boundary = 120;
    this.mesh.position.x = Math.max(-boundary, Math.min(boundary, this.mesh.position.x));
    this.mesh.position.z = Math.max(-boundary, Math.min(boundary, this.mesh.position.z));

    if (world?._obstacles) {
      const px = this.mesh.position.x;
      const pz = this.mesh.position.z;
      const PR = 0.4;
      for (const obs of world._obstacles) {
        const dx = px - obs.x, dz = pz - obs.z;
        const distSq = dx * dx + dz * dz;
        if (distSq > 400) continue;
        const dist = Math.sqrt(distSq);
        const minD = PR + obs.r;
        if (dist < minD && dist > 0.001) {
          const push = (minD - dist) / dist;
          this.mesh.position.x += dx * push;
          this.mesh.position.z += dz * push;
        }
      }
    }

    // 지형 높이 스냅 ─────────────────────────────────────────────
    if (world) {
      const px = this.mesh.position.x;
      const pz = this.mesh.position.z;
      const D  = 0.5; // 경사 샘플 간격

      // 4방향 샘플로 경사 기울기 반영 (최댓값 기준으로 Y 스냅)
      const h0 = world.getHeight(px,     pz);
      const hF = world.getHeight(px,     pz - D); // 앞
      const hB = world.getHeight(px,     pz + D); // 뒤
      const hL = world.getHeight(px - D, pz);     // 좌
      const hR = world.getHeight(px + D, pz);     // 우

      // 발 범위 안에서 가장 높은 지점을 기준으로 발이 뚫리지 않게
      const maxH = Math.max(h0, hF, hB, hL, hR);
      const terrainY = Math.max(0, maxH) + 0.22;

      if (this.mesh.position.y < terrainY) {
        // 지형 아래로 클리핑 절대 금지 — 즉시 스냅
        this.mesh.position.y = terrainY;
      } else {
        // 경사 위를 걸을 때 부드러운 정착 (중력감)
        this.mesh.position.y += (terrainY - this.mesh.position.y) * Math.min(1, 14 * delta);
      }

      // 경사에 맞게 캐릭터 기울기 (지형 법선 추정)
      const slopeX = (hR - hL) / (2 * D);
      const slopeZ = (hF - hB) / (2 * D);
      const maxTilt = 0.40; // 최대 기울기 (라디안)
      const targetRX = Math.max(-maxTilt, Math.min(maxTilt, -slopeZ));
      const targetRZ = Math.max(-maxTilt, Math.min(maxTilt, -slopeX));
      this.mesh.rotation.x += (targetRX - this.mesh.rotation.x) * Math.min(1, 8 * delta);
      this.mesh.rotation.z += (targetRZ - this.mesh.rotation.z) * Math.min(1, 8 * delta);
    } else {
      const terrainY = 0.22;
      if (this.mesh.position.y < terrainY) this.mesh.position.y = terrainY;
    }
  }

  // ?? SWING with anticipation + follow-through ???????????????????
  _updateSwing(delta) {
    if (!this.isSwinging) return;
    this.swingTimer += delta;
    const t = this.swingTimer / (this.swingDuration / this.swingSpeed);
    const j = this._j;

    if (t < 0.18) {
      // Anticipation: arm winds back
      const p = t / 0.18;
      if (j.uArmR)  j.uArmR.rotation.x  = p * (-0.55);
      if (j.elbowR) j.elbowR.rotation.x = 0.14 + p * 0.40;
      if (j.clavR)  j.clavR.rotation.x  = p * (-0.12);
    } else if (t < 0.72) {
      // Strike: fast forward sweep
      const p = (t - 0.18) / 0.54;
      if (j.uArmR)  j.uArmR.rotation.x  = -0.55 + p * (-Math.PI * 0.85);
      if (j.elbowR) j.elbowR.rotation.x = 0.54 - p * 0.38;
      if (j.clavR)  j.clavR.rotation.x  = -0.12 - p * 0.14;
      if (j.spine1) j.spine1.rotation.y = -p * 0.18;
    } else {
      // Follow-through + return
      const p = (t - 0.72) / 0.28;
      if (j.uArmR)  j.uArmR.rotation.x  = (-Math.PI * 0.85) + p * (Math.PI * 0.85);
      if (j.elbowR) j.elbowR.rotation.x = THREE.MathUtils.lerp(0.16, 0.14, p);
      if (j.clavR)  j.clavR.rotation.x  = THREE.MathUtils.lerp(-0.26, 0, p);
      if (j.spine1) j.spine1.rotation.y = THREE.MathUtils.lerp(-0.18, 0, p);
    }

    if (this.swingTimer >= this.swingDuration / this.swingSpeed) {
      this.isSwinging = false;
      this.swingTimer = 0;
      if (j.uArmR)  j.uArmR.rotation.x  = 0;
      if (j.elbowR) j.elbowR.rotation.x = 0.14;
      if (j.clavR)  j.clavR.rotation.x  = 0;
      if (j.spine1) j.spine1.rotation.y = 0;
    }
  }

  // ?? FULL ANIMATION SYSTEM ?????????????????????????????????????
  _updateAnimation(delta) {
    const j = this._j;
    const speed     = _vel.length();
    const speedNorm = Math.min(1, speed / this.speed);

    // Blend smoothly between idle (0) and running (1)
    this._speedBlend += (speedNorm - this._speedBlend) * Math.min(1, 7 * delta);
    const blend = this._speedBlend;
    const idleW = 1 - blend;

    // Advance time accumulators
    // Walk freq: 6 Hz at full speed ??feels snappy but not frantic
    this._walkTime += delta * (6.0 + blend * 2.5);
    this._idleTime += delta;
    const wt = this._walkTime;
    const it = this._idleTime;

    const sw  = Math.sin(wt);         // primary limb phase  (-1??)
    const sw2 = Math.sin(wt * 2);     // double frequency    (bob / hip sway)

    // ????????????????????????????????????????????????????????????
    // IDLE: BREATHING + WEIGHT SHIFT
    // ????????????????????????????????????????????????????????????
    const breath    = Math.sin(it * 1.55) * idleW;        // ~0.25 Hz breath
    const weightSh  = Math.sin(it * 0.58) * idleW;        // subtle sway

    // Chest swells with each breath
    if (j.chest) {
      j.chest.scale.y = 1 + breath * 0.016;
      j.chest.scale.z = 1 + breath * 0.010;
    }

    // Clavicles rise as chest expands
    if (j.clavL) j.clavL.position.y = breath * 0.013;
    if (j.clavR) j.clavR.position.y = breath * 0.013;

    // Hip weight shift (rock side to side)
    if (j.hips && !this.isSwinging) {
      j.hips.position.x  = weightSh * 0.022 * idleW;
      j.hips.rotation.z  = weightSh * 0.018 * idleW;
    }

    // Subtle thigh lean with weight shift
    if (j.thighL) j.thighL.rotation.z =  weightSh * 0.016 * idleW;
    if (j.thighR) j.thighR.rotation.z = -weightSh * 0.016 * idleW;

    // Head micro-drift (alive, not frozen)
    if (j.head) {
      j.head.rotation.z = Math.sin(it * 0.38) * 0.010 * idleW;
      j.head.rotation.x = breath * 0.007 * 0.5;
    }

    // Hat secondary motion ??slightly lags behind head
    if (j.hat) {
      j.hat.rotation.x = Math.sin(it * 0.55 + 0.4) * 0.006 * idleW;
      j.hat.rotation.z = Math.sin(it * 0.28) * 0.005 * idleW;
    }

    // ????????????????????????????????????????????????????????????
    // WALK / RUN CYCLE (only when moving)
    // ????????????????????????????????????????????????????????????
    if (blend > 0.005 && !this.isSwinging) {
      const w = blend;

      // THIGHS ??alternating forward/back swing
      const thighAmp = THREE.MathUtils.lerp(0, 0.52, w);
      if (j.thighL) j.thighL.rotation.x =  sw * thighAmp;
      if (j.thighR) j.thighR.rotation.x = -sw * thighAmp;

      // KNEES ??bend on the trailing leg
      //   back leg bends knee; front leg is extended
      const kBendL = Math.max(0, -sw) * THREE.MathUtils.lerp(0, 0.60, w);
      const kBendR = Math.max(0,  sw) * THREE.MathUtils.lerp(0, 0.60, w);
      if (j.kneeL) j.kneeL.rotation.x = kBendL;
      if (j.kneeR) j.kneeR.rotation.x = kBendR;

      // ANKLES ??dorsiflex on landing foot
      const ankAmpL = THREE.MathUtils.lerp(-0.05, 0.22, w);
      const ankAmpR = THREE.MathUtils.lerp(-0.05, 0.22, w);
      if (j.ankleL) j.ankleL.rotation.x = Math.max(-0.05,  sw) * ankAmpL - 0.05;
      if (j.ankleR) j.ankleR.rotation.x = Math.max(-0.05, -sw) * ankAmpR - 0.05;

      // HIPS ??subtle rotation + vertical bob
      if (j.hips) {
        j.hips.rotation.y = sw * 0.10 * w;
        j.hips.position.y = 0.90 + Math.abs(sw2) * -0.038 * w; // 구조 오프셋(0.90) 유지 + 걸음 진폭
        j.hips.position.x = sw2 * 0.022 * w;            // side-to-side
      }

      // SPINE ??counter-rotates against hips for natural twist
      if (j.spine0) j.spine0.rotation.y = -sw * 0.08 * w;
      if (j.spine1) j.spine1.rotation.y = -sw * 0.05 * w;

      // UPPER ARMS ??counter-swing to legs
      const armSwingAmp = THREE.MathUtils.lerp(0, 0.48, w);
      if (j.uArmL) j.uArmL.rotation.x = -sw * armSwingAmp;
      if (j.uArmR) j.uArmR.rotation.x =  sw * armSwingAmp * 0.25; // right arm minimal (holds net)

      // ELBOWS ??bend on back-swing
      if (j.elbowL) j.elbowL.rotation.x = 0.22 + Math.max(0, -sw) * 0.28 * w;
      if (j.elbowR) j.elbowR.rotation.x = 0.14 + Math.max(0,  sw) * 0.14 * w;

      // HEAD stabilisation ??counter-rotate to stay level
      if (j.neck) j.neck.rotation.y = sw * 0.035 * w;

    } else if (!this.isSwinging) {
      // Smoothly return walk joints to neutral
      const rs = Math.min(1, 7 * delta);
      const lerp = THREE.MathUtils.lerp;

      if (j.thighL) { j.thighL.rotation.x = lerp(j.thighL.rotation.x, 0, rs); }
      if (j.thighR) { j.thighR.rotation.x = lerp(j.thighR.rotation.x, 0, rs); }
      if (j.kneeL)  { j.kneeL.rotation.x  = lerp(j.kneeL.rotation.x,  0, rs); }
      if (j.kneeR)  { j.kneeR.rotation.x  = lerp(j.kneeR.rotation.x,  0, rs); }
      if (j.ankleL) { j.ankleL.rotation.x = lerp(j.ankleL.rotation.x, -0.05, rs); }
      if (j.ankleR) { j.ankleR.rotation.x = lerp(j.ankleR.rotation.x, -0.05, rs); }
      if (j.hips)   {
        j.hips.rotation.y = lerp(j.hips.rotation.y, 0, rs);
        j.hips.position.y = lerp(j.hips.position.y, 0.90, rs); // 구조 오프셋으로 복귀
      }
      if (j.spine0) { j.spine0.rotation.y = lerp(j.spine0.rotation.y, 0, rs); }
      if (j.spine1) { j.spine1.rotation.y = lerp(j.spine1.rotation.y, 0, rs); }
      if (j.uArmL)  { j.uArmL.rotation.x  = lerp(j.uArmL.rotation.x,  0, rs); }
      if (j.uArmR)  { j.uArmR.rotation.x  = lerp(j.uArmR.rotation.x,  0, rs); }
      if (j.elbowL) { j.elbowL.rotation.x = lerp(j.elbowL.rotation.x, 0.22, rs); }
      if (j.elbowR) { j.elbowR.rotation.x = lerp(j.elbowR.rotation.x, 0.14, rs); }
      if (j.neck)   { j.neck.rotation.y   = lerp(j.neck.rotation.y,   0, rs); }
    }
  }


  // ── Public API ─────────────────────────────────────────────────
  /** 포획 동작: 팔 스윙 애니메이션 트리거 */
  swing() {
    if (this.isSwinging) return;
    this.isSwinging = true;
    this.swingTimer = 0;
    this._swingFlash = 1.0;
  }

  /** 카메라 기준 XZ 전방 벡터 반환 (WaveSystem.tryCapture 에서 사용) */
  getForward(camCtrl) {
    return camCtrl.getForwardXZ();
  }

  /** 플레이어 월드 위치 (Three.js Vector3) */
  get position() {
    return this.mesh.position;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
    window.removeEventListener('keydown', this._keyDown);
    window.removeEventListener('keyup',   this._keyUp);
  }
}
