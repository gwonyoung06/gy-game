import * as THREE from 'three';

const _tgt = new THREE.Vector3();

/**
 * CameraController — Pointer Lock 기반 3인칭 카메라
 * - 좌클릭으로 마우스 잠금 → 이후 마우스로 자유롭게 시점 조작
 * - 이동 시 자동 yaw 추적 + 달리기 sway
 * - 포획 성공 시 카메라 흔들림 지원
 */
export class CameraController {
  constructor(camera, canvas) {
    this.camera  = camera;
    this.canvas  = canvas;

    this.yaw    = 0;
    this.pitch  = 0.38;
    this.distance       = 10;
    this.targetDistance = 10;
    this.minDist = 3;
    this.maxDist = 22;
    this.heightOffset = 1.6;
    this.sensitivity  = 0.0028;
    this.minPitch = 0.08;
    this.maxPitch = 1.25;

    this._currentPos  = new THREE.Vector3();
    this._initialized = false;

    // 자동 yaw
    this._autoYaw         = true;
    this._autoYawStrength = 0.022;

    // sway
    this._swayTime = 0;
    this._swayAmt  = 0;

    // 포획 흔들림
    this._shakeIntensity = 0;

    // Pointer Lock 상태
    this._locked = false;

    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onWheel     = this._handleWheel.bind(this);
    this._onLockChange = this._handleLockChange.bind(this);
    this._noContext   = e => e.preventDefault();

    window.addEventListener('mousemove',          this._onMouseMove);
    canvas.addEventListener('wheel',              this._onWheel, { passive: false });
    canvas.addEventListener('contextmenu',        this._noContext);
    document.addEventListener('pointerlockchange', this._onLockChange);
  }

  // ── Pointer Lock 진입/해제 ───────────────────────────────────
  requestLock() {
    if (!this._locked) this.canvas.requestPointerLock();
  }

  exitLock() {
    if (this._locked) document.exitPointerLock();
  }

  get isLocked() { return this._locked; }

  _handleLockChange() {
    this._locked = document.pointerLockElement === this.canvas;
  }

  _handleMouseMove(e) {
    if (!this._locked) return;
    this.yaw  -= e.movementX * this.sensitivity;
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch,
      this.pitch + e.movementY * this.sensitivity));
  }

  _handleWheel(e) {
    e.preventDefault();
    this.targetDistance = Math.max(this.minDist, Math.min(this.maxDist,
      this.targetDistance + e.deltaY * 0.018));
  }

  /** 포획 성공 시 호출 — 카메라 흔들림 */
  shake(intensity = 0.18) {
    this._shakeIntensity = Math.max(this._shakeIntensity, intensity);
  }

  update(targetPos, isMoving = false, playerYaw = 0, delta = 0.016) {
    // 줌 lerp
    this.distance += (this.targetDistance - this.distance) * Math.min(1, 10 * delta);

    // 자동 yaw: 이동 중이고 잠금 상태일 때 플레이어 뒤를 따라옴
    if (this._autoYaw && isMoving && this._locked) {
      let diff = playerYaw - this.yaw;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * this._autoYawStrength;
    }

    // sway
    const targetSway = isMoving ? 1.0 : 0.0;
    this._swayAmt += (targetSway - this._swayAmt) * Math.min(1, 5 * delta);
    if (isMoving) this._swayTime += delta * 7;
    const swayOffset = Math.sin(this._swayTime) * 0.055 * this._swayAmt;

    // 흔들림
    const shakeX = this._shakeIntensity > 0.01
      ? (Math.random() - 0.5) * this._shakeIntensity : 0;
    const shakeY = this._shakeIntensity > 0.01
      ? (Math.random() - 0.5) * this._shakeIntensity : 0;
    this._shakeIntensity = Math.max(0, this._shakeIntensity - 9 * delta);

    // 카메라 목표 위치
    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);
    const camX = targetPos.x + Math.sin(this.yaw) * this.distance * cosP + shakeX;
    const camZ = targetPos.z + Math.cos(this.yaw) * this.distance * cosP;
    const camY = targetPos.y + this.heightOffset + this.distance * sinP + swayOffset + shakeY;

    _tgt.set(camX, Math.max(0.6, camY), camZ);

    // 위치 lerp
    if (!this._initialized) {
      this._currentPos.copy(_tgt);
      this._initialized = true;
    } else {
      this._currentPos.x += (_tgt.x - this._currentPos.x) * Math.min(1, 7 * delta);
      this._currentPos.z += (_tgt.z - this._currentPos.z) * Math.min(1, 7 * delta);
      this._currentPos.y += (_tgt.y - this._currentPos.y) * Math.min(1, 12 * delta);
    }

    this.camera.position.copy(this._currentPos);
    this.camera.lookAt(targetPos.x, targetPos.y + this.heightOffset * 0.8, targetPos.z);

    // 미니맵용 yaw 저장
    if (targetPos) targetPos._yaw = this.yaw;
  }

  /** 터치 드래그로 yaw/pitch 직접 조작 (포인터락 불필요) */
  applyTouchLook(dx, dy) {
    this.yaw  -= dx * this.sensitivity * 0.8;
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch,
      this.pitch + dy * this.sensitivity * 0.8));
  }

  getForwardXZ() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
  }

  getRightXZ() {
    return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
  }

  dispose() {
    window.removeEventListener('mousemove',           this._onMouseMove);
    this.canvas.removeEventListener('wheel',          this._onWheel);
    this.canvas.removeEventListener('contextmenu',    this._noContext);
    document.removeEventListener('pointerlockchange', this._onLockChange);
    if (this._locked) document.exitPointerLock();
  }
}
