import * as THREE from 'three';

export class Y2KSky {
  constructor(experience) {
    this.experience = experience;
    this.group = new THREE.Group();
    this.experience.scene.add(this.group);

    // Y2K Chrome Material (Standard so it doesn't render black without HDRI)
    this.chromeMat = new THREE.MeshStandardMaterial({
      color: 0x88aacc, // subtle blue tint
      metalness: 0.3,
      roughness: 0.2,
      emissive: 0x223344,
      emissiveIntensity: 0.5
    });

    // Cyan Wireframe Material
    this.wireMat = new THREE.MeshBasicMaterial({
      color: 0x00ffd5,
      wireframe: true,
      transparent: true,
      opacity: 0.2
    });

    // Massive Interlocking Halos (Gyroscope vibe)
    this.halos = [];
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.TorusGeometry(200 + i * 40, 2, 16, 128);
      const mesh = new THREE.Mesh(geo, this.chromeMat);
      mesh.position.set(0, 250, 0); // Hovering high above
      mesh.rotation.x = Math.random() * Math.PI;
      mesh.rotation.y = Math.random() * Math.PI;
      
      const speed = (Math.random() - 0.5) * 0.15;
      this.halos.push({ mesh, speed });
      this.group.add(mesh);
    }

    // Floating Geometric Shards (Tetrahedrons)
    this.shards = [];
    for (let i = 0; i < 40; i++) {
      const geo = new THREE.TetrahedronGeometry(Math.random() * 20 + 8, 0);
      const mesh = new THREE.Mesh(geo, Math.random() > 0.4 ? this.chromeMat : this.wireMat);
      mesh.position.set(
        (Math.random() - 0.5) * 800,
        50 + Math.random() * 400, // Varying heights
        (Math.random() - 0.5) * 800
      );
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      
      // If it's a wireframe, make it slightly emissive
      if (mesh.material === this.wireMat) {
        mesh.scale.setScalar(1.5); // wireframes are slightly larger
      }

      this.shards.push({
        mesh,
        rotSpeed: new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8),
        floatSpeed: Math.random() * 0.5 + 0.1,
        yBase: mesh.position.y
      });
      this.group.add(mesh);
    }
  }

  update(delta, elapsed) {
    // Gyroscopic halo spin
    for (const h of this.halos) {
      h.mesh.rotation.x += h.speed * delta;
      h.mesh.rotation.y += h.speed * 0.8 * delta;
    }
    
    // Shards float and spin
    for (const s of this.shards) {
      s.mesh.rotation.x += s.rotSpeed.x * delta;
      s.mesh.rotation.y += s.rotSpeed.y * delta;
      s.mesh.rotation.z += s.rotSpeed.z * delta;
      s.mesh.position.y = s.yBase + Math.sin(elapsed * s.floatSpeed) * 15;
    }
  }
}
