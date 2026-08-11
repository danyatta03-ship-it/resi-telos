import * as THREE from "three";

const SPEED = 6;
const RUN = 10;
const CROUCH_SPEED = 3;
const JUMP = 5.5;
const GRAV = 18;
const EYE = 1.7;
const CROUCH_EYE = 1.1;
const RADIUS = 0.45;

export class Player {
  constructor(canvas, onEvent = () => {}) {
    this.pos = new THREE.Vector3(0, EYE, 0);
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.onGround = true;
    this.keys = new Set();
    this.canvas = canvas;
    this.locked = false;
    this.recoil = 0;
    this.fovKick = 0;
    this.running = false;
    this.crouching = false;
    this.ads = false;
    this.eyeH = EYE;
    this.footAcc = 0;
    this.onEvent = onEvent; // 'jump' | 'step'

    canvas.addEventListener("click", () => canvas.requestPointerLock());
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      const sens = this.ads ? 0.0012 : 0.0025;
      this.yaw   -= e.movementX * sens;
      this.pitch -= e.movementY * sens;
      this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch));
    });
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === "KeyC") this.crouching = !this.crouching;
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
  }
  setAds(on) { this.ads = on; }
  forward(out = new THREE.Vector3()) { out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); return out; }
  right(out = new THREE.Vector3())   { out.set( Math.cos(this.yaw), 0, -Math.sin(this.yaw)); return out; }
  lookDir(out = new THREE.Vector3()) {
    const p = this.pitch + this.recoil;
    const cp = Math.cos(p);
    out.set(-Math.sin(this.yaw) * cp, Math.sin(p), -Math.cos(this.yaw) * cp);
    return out;
  }
  addRecoil(v) { this.recoil = Math.min(0.25, this.recoil + v); this.fovKick = Math.min(6, this.fovKick + 2); }

  update(dt, ground, collide) {
    this.running = !this.crouching && !this.ads && (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"));
    const speed = this.crouching ? CROUCH_SPEED : (this.running ? RUN : (this.ads ? 4 : SPEED));
    const wish = new THREE.Vector3();
    const f = this.forward(), r = this.right();
    if (this.keys.has("KeyW")) wish.add(f);
    if (this.keys.has("KeyS")) wish.sub(f);
    if (this.keys.has("KeyD")) wish.add(r);
    if (this.keys.has("KeyA")) wish.sub(r);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);

    this.vel.x = wish.x;
    this.vel.z = wish.z;
    this.vel.y -= GRAV * dt;
    if (this.onGround && this.keys.has("Space") && !this.crouching) {
      this.vel.y = JUMP; this.onGround = false;
      this.onEvent("jump");
    }

    const delta = new THREE.Vector3(this.vel.x * dt, 0, this.vel.z * dt);
    collide(this.pos, delta, RADIUS);
    this.pos.y += this.vel.y * dt;

    // Eye height lerp for crouch
    const targetEye = this.crouching ? CROUCH_EYE : EYE;
    this.eyeH += (targetEye - this.eyeH) * Math.min(1, dt * 10);

    const gy = ground(this.pos.x, this.pos.z) + this.eyeH;
    if (this.pos.y <= gy) { this.pos.y = gy; this.vel.y = 0; this.onGround = true; }
    else this.onGround = false;

    // Footsteps
    const horizSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && horizSpeed > 0.5) {
      this.footAcc += dt * horizSpeed * 0.5;
      if (this.footAcc > 1.0) { this.footAcc = 0; this.onEvent("step"); }
    }

    this.recoil = Math.max(0, this.recoil - dt * 1.2);
    this.fovKick = Math.max(0, this.fovKick - dt * 20);
  }
}
