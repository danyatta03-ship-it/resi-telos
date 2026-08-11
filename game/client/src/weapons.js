import * as THREE from "three";

export const WEAPONS = {
  pistol: { name: "Pistol", damage: 30, rpm: 300,  mag: 12, reload: 1.2, recoil: 0.04, spread: 0.004, range: 200 },
  rifle:  { name: "Rifle",  damage: 18, rpm: 720,  mag: 30, reload: 1.8, recoil: 0.025, spread: 0.010, range: 350 },
};

export class Viewmodel {
  // Renders arms + gun in a separate overlay scene so it never clips through walls.
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dl = new THREE.DirectionalLight(0xffffff, 0.6); dl.position.set(1, 2, 1); this.scene.add(dl);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
    this.camera.position.set(0, 0, 0);

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.gun = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.10, 0.35),
      new THREE.MeshLambertMaterial({ color: 0x1c1c1c })
    );
    body.position.set(0.14, -0.14, -0.32);
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.28, 10),
      new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.14, -0.115, -0.5);
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.14, 0.08),
      new THREE.MeshLambertMaterial({ color: 0x0f0f0f })
    );
    grip.position.set(0.14, -0.22, -0.2);
    this.gun.add(body, barrel, grip);

    // Arms
    const armMat = new THREE.MeshLambertMaterial({ color: 0xd7b48f });
    const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.35, 8), armMat);
    rArm.rotation.z = Math.PI / 2.2; rArm.position.set(0.05, -0.22, -0.15);
    this.gun.add(rArm);

    this.group.add(this.gun);
    this.muzzle = new THREE.PointLight(0xffcc66, 0, 3, 2);
    this.muzzle.position.set(0.14, -0.11, -0.65);
    this.gun.add(this.muzzle);
    this.flash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.18),
      new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0, depthWrite: false })
    );
    this.flash.position.set(0.14, -0.11, -0.66);
    this.gun.add(this.flash);

    this.recoilKick = 0;
    this.reloading = 0;   // seconds remaining
    this.bob = 0;
  }

  setWeapon(kind) {
    this.gun.scale.setScalar(kind === "rifle" ? 1.3 : 1.0);
  }
  shoot() {
    this.recoilKick = 0.08;
    this.muzzle.intensity = 3;
    this.flash.material.opacity = 1;
    this.flash.rotation.z = Math.random() * Math.PI;
  }
  startReload(dur) { this.reloading = dur; }

  update(dt, moving, running) {
    this.recoilKick = Math.max(0, this.recoilKick - dt * 0.9);
    this.muzzle.intensity *= Math.pow(0.001, dt);
    this.flash.material.opacity *= Math.pow(0.0005, dt);
    this.bob += dt * (running ? 12 : 7) * (moving ? 1 : 0);
    const bobY = Math.sin(this.bob) * (running ? 0.012 : 0.006);
    const bobX = Math.cos(this.bob * 0.5) * (running ? 0.010 : 0.005);
    let ry = -this.recoilKick;
    if (this.reloading > 0) {
      this.reloading = Math.max(0, this.reloading - dt);
      ry -= 0.6 * Math.sin(Math.min(1, this.reloading * 4) * Math.PI);
    }
    this.gun.position.set(bobX, bobY, 0);
    this.gun.rotation.set(ry, 0, 0);
  }

  render() {
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.clearDepth();
    this.renderer.render(this.scene, this.camera);
  }
}
