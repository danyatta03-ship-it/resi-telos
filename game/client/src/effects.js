import * as THREE from "three";

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.grenades = new Map();
  }
  tracer(from, to, color = 0xffee88) {
    const g = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 });
    const line = new THREE.Line(g, m);
    this.scene.add(line);
    this.items.push({ obj: line, life: 0.09, decay: (o, t) => o.material.opacity = t });
  }
  spark(at, color = 0xffaa33) {
    const g = new THREE.SphereGeometry(0.08, 6, 6);
    const m = new THREE.MeshBasicMaterial({ color, transparent: true });
    const s = new THREE.Mesh(g, m);
    s.position.copy(at);
    this.scene.add(s);
    this.items.push({ obj: s, life: 0.25, decay: (o, t) => { o.material.opacity = t; o.scale.setScalar(1 + (1 - t) * 2); } });
  }
  explosion(at) {
    // Fireball
    const g = new THREE.SphereGeometry(1, 16, 12);
    const m = new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0.9 });
    const s = new THREE.Mesh(g, m);
    s.position.copy(at);
    this.scene.add(s);
    this.items.push({ obj: s, life: 0.6, decay: (o, t) => { o.material.opacity = t * 0.9; o.scale.setScalar(1 + (1 - t) * 6); } });
    // Point light
    const light = new THREE.PointLight(0xffcc66, 8, 20, 2);
    light.position.copy(at);
    this.scene.add(light);
    this.items.push({ obj: light, life: 0.4, decay: (o, t) => o.intensity = 8 * t });
    // Shockwave ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffeecc, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(at); ring.position.y = Math.max(0.1, at.y - 0.5);
    this.scene.add(ring);
    this.items.push({ obj: ring, life: 0.5, decay: (o, t) => { o.material.opacity = t * 0.8; o.scale.setScalar(1 + (1 - t) * 12); } });
    // Debris
    for (let i = 0; i < 12; i++) {
      const d = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true })
      );
      d.position.copy(at);
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random(), Math.random() - 0.5).normalize().multiplyScalar(0.06);
      this.scene.add(d);
      this.items.push({
        obj: d, life: 0.5,
        decay: (o, t) => { o.material.opacity = t; o.position.add(dir); dir.y -= 0.005; },
      });
    }
  }

  spawnGrenade(id, pos, vel) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0x2b4a1c })
    );
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.grenades.set(id, { mesh, vel: vel.clone(), pos: pos.clone() });
  }
  removeGrenade(id) {
    const g = this.grenades.get(id);
    if (g) { this.scene.remove(g.mesh); g.mesh.geometry.dispose(); }
    this.grenades.delete(id);
  }

  update(dt, ground) {
    // Grenade physics: gravity + ground bounce
    for (const [id, g] of this.grenades) {
      g.vel.y -= 18 * dt;
      g.pos.addScaledVector(g.vel, dt);
      const gy = ground ? ground(g.pos.x, g.pos.z) : 0;
      if (g.pos.y < gy + 0.12) {
        g.pos.y = gy + 0.12;
        g.vel.y = -g.vel.y * 0.35;
        g.vel.x *= 0.6; g.vel.z *= 0.6;
      }
      g.mesh.position.copy(g.pos);
      g.mesh.rotation.x += dt * 6; g.mesh.rotation.z += dt * 4;
    }
    // Timed items
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      if (it.life <= 0) {
        this.scene.remove(it.obj);
        it.obj.geometry?.dispose?.();
        it.obj.material?.dispose?.();
        this.items.splice(i, 1);
      } else {
        it.decay(it.obj, Math.max(0, it.life / 0.5));
      }
    }
  }
}
