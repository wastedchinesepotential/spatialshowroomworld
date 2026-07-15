import * as THREE from 'three';

export class Shoe {
  constructor(experience) {
    this.experience = experience;
    this.scene = experience.scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    
    this._build();
  }

  _build() {
    this.mesh = new THREE.Group();
    this.mesh.position.set(0, 15, 0); // Lifted even higher
    this.mesh.rotation.z = THREE.MathUtils.degToRad(35); // +35 on Z
    
    this.orbitLight = new THREE.PointLight(0xffffff, 8, 40);
    this.mesh.add(this.orbitLight);
    
    this.mesh.add(this.orbitLight);
    
    const gltf = this.experience.assets.get('shoe');
    if (gltf && gltf.scene) {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 24.0 / maxDim;
      model.scale.setScalar(scale);
      
      const center = box.getCenter(new THREE.Vector3());
      model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
      
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material.side = THREE.DoubleSide;
            child.material.transparent = false;
            child.material.alphaTest = 0.5;
            child.material.needsUpdate = true;
          }
        }
      });
      
      this.mesh.add(model);
    }
    
    this.group.add(this.mesh);
  }

  update(delta, elapsed) {
    if (this.mesh) {
      this.mesh.position.y = 15 + Math.sin(elapsed * 1.5) * 1.5;
      this.mesh.rotation.y = elapsed * 0.2;
      
      if (this.orbitLight) {
        const radius = 15;
        this.orbitLight.position.x = Math.sin(elapsed * 0.5) * radius;
        this.orbitLight.position.z = Math.cos(elapsed * 0.5) * radius;
        this.orbitLight.position.y = Math.sin(elapsed * 0.7) * 5 + 5;
      }
    }
  }
}
