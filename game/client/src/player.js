import * as THREE from "three";

const SPEED = 6;      // m/s walk
const RUN = 10;       // m/s run
const JUMP = 5.5;     // m/s
const GRAV = 18;      // m/s^2
const EYE = 1.7;

export class Player {
  constructor(canvas) {
    this.pos = new THREE.Vector3(0, EYE, 0);
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.onGround = true;
    this.keys = new Set();
    this.canvas = canvas;
    this.locked = false;

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
    const cp = Math.cos(this.pitch);
    out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    return out;
  }

  update(dt, ground) {
    const speed = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? RUN : SPEED;
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

    this.pos.addScaledVector(this.vel, dt);
    const gy = ground(this.pos.x, this.pos.z) + EYE;
    if (this.pos.y <= gy) { this.pos.y = gy; this.vel.y = 0; this.onGround = true; }
    else this.onGround = false;
  }
}
