import * as THREE from "three";

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
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
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      if (it.life <= 0) {
        this.scene.remove(it.obj);
        it.obj.geometry?.dispose?.();
        it.obj.material?.dispose?.();
        this.items.splice(i, 1);
      } else {
        it.decay(it.obj, Math.max(0, it.life / 0.3));
      }
    }
  }
}
