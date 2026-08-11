import * as THREE from "three";
import mapboxgl from "mapbox-gl";

// Build a Three.js mesh from Mapbox 'building' features currently loaded,
// projected into local meters relative to `origin` (a LngLat).
// Used for local raycasting: ground height, and hitscan blocking (optional).
export class BuildingsCache {
  constructor(map, origin) {
    this.map = map;
    this.origin = origin;
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ visible: false }));
    this.raycaster = new THREE.Raycaster();
    this.down = new THREE.Vector3(0, -1, 0);
    this.dirty = true;
    map.on("sourcedata", (e) => { if (e.sourceId === "composite") this.dirty = true; });
  }

  setOrigin(lngLat) { this.origin = lngLat; this.dirty = true; }

  // Convert lng/lat to local meters (east=+x, north=+z? We use east=+x, north=-z to match three's -z forward).
  _project(lng, lat) {
    const R = 6378137;
    const dLng = (lng - this.origin.lng) * Math.PI / 180;
    const dLat = (lat - this.origin.lat) * Math.PI / 180;
    const x = dLng * R * Math.cos(this.origin.lat * Math.PI / 180);
    const z = -dLat * R;
    return [x, z];
  }

  rebuildIfNeeded() {
    if (!this.dirty) return;
    const feats = this.map.querySourceFeatures("composite", { sourceLayer: "building" });
    const positions = [];
    const indices = [];
    let base = 0;
    const push = (x, y, z) => positions.push(x, y, z);

    for (const f of feats) {
      const h = (f.properties?.height ?? f.properties?.render_height ?? 8);
      const minH = f.properties?.min_height ?? 0;
      const geom = f.geometry;
      const polys = geom.type === "Polygon" ? [geom.coordinates] :
                    geom.type === "MultiPolygon" ? geom.coordinates : [];
      for (const poly of polys) {
        const ring = poly[0];
        if (!ring || ring.length < 3) continue;
        const localRing = ring.map(([lng, lat]) => this._project(lng, lat));
        // Top face (fan triangulation — buildings are ~convex enough for raycast against roof)
        const start = base;
        for (const [x, z] of localRing) push(x, h, z);
        for (let i = 1; i < localRing.length - 1; i++) {
          indices.push(start, start + i, start + i + 1);
        }
        // Walls
        const wallStart = positions.length / 3;
        for (let i = 0; i < localRing.length; i++) {
          const [x, z] = localRing[i];
          push(x, minH, z);
          push(x, h, z);
        }
        for (let i = 0; i < localRing.length - 1; i++) {
          const a = wallStart + i * 2;
          indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
        }
        base = positions.length / 3;
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    this.mesh.geometry.dispose();
    this.mesh.geometry = g;
    this.dirty = false;
  }

  groundY(x, z) {
    this.rebuildIfNeeded();
    if (!this.mesh.geometry.attributes.position) return 0;
    const origin = new THREE.Vector3(x, 2000, z);
    this.raycaster.set(origin, this.down);
    this.raycaster.far = 3000;
    const hit = this.raycaster.intersectObject(this.mesh, false);
    return hit.length ? hit[0].point.y : 0;
  }
}
