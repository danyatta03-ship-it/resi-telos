import * as THREE from "three";

const SPEED = 6;
const RUN = 10;
const JUMP = 5.5;
const GRAV = 18;
const EYE = 1.7;
const RADIUS = 0.45;

export class Player {
  constructor(canvas) {
    this.pos = new THREE.Vector3(0, EYE, 0);
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.onGround = true;
    this.keys = new Set();
    this.canvas = canvas;
    this.locked = false;
    this.recoil = 0;   // added to pitch, decays
    this.fovKick = 0;  // added to fov, decays
    this.running = false;

    canvas.addEventListener("click", () => canvas.requestPointerLock());
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.yaw   -= e.movementX * 0.0025;
      this.pitch -= e.movementY * 0.0025;
      this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch));
    });
    window.addEventListener("keydown", (e) => this.keys.add(e.code));
    window.addEventListener("keyup",   (e) => this.keys.delete(e.code));
  }

  forward(out = new THREE.Vector3()) {
    out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    return out;
  }
  right(out = new THREE.Vector3()) {
    out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    return out;
  }
  lookDir(out = new THREE.Vector3()) {
    const p = this.pitch + this.recoil;
    const cp = Math.cos(p);
    out.set(-Math.sin(this.yaw) * cp, Math.sin(p), -Math.cos(this.yaw) * cp);
    return out;
  }

  addRecoil(v) { this.recoil = Math.min(0.25, this.recoil + v); this.fovKick = Math.min(6, this.fovKick + 2); }

  update(dt, ground, collide) {
    this.running = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const speed = this.running ? RUN : SPEED;
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
    if (this.onGround && this.keys.has("Space")) { this.vel.y = JUMP; this.onGround = false; }

    // Horizontal collide
    const delta = new THREE.Vector3(this.vel.x * dt, 0, this.vel.z * dt);
    collide(this.pos, delta, RADIUS);
    // Vertical
    this.pos.y += this.vel.y * dt;

    const gy = ground(this.pos.x, this.pos.z) + EYE;
    if (this.pos.y <= gy) { this.pos.y = gy; this.vel.y = 0; this.onGround = true; }
    else this.onGround = false;

    // decays
    this.recoil = Math.max(0, this.recoil - dt * 1.2);
    this.fovKick = Math.max(0, this.fovKick - dt * 20);
  }
}
