import * as THREE from 'three';

export class Footsteps {
  constructor(experience) {
    this.experience = experience;
    this.count = 40;
    this.idx = 0;
    
    // A simple quad. The shader will draw a soft ring on it.
    const geo = new THREE.PlaneGeometry(1, 1);
    
    // We need a custom attribute for per-instance life/opacity
    const lifeArray = new Float32Array(this.count);
    geo.setAttribute('aLife', new THREE.InstancedBufferAttribute(lifeArray, 1));
    
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending, // Glowing effect
      side: THREE.DoubleSide,
      vertexShader: `
        attribute float aLife;
        varying vec2 vUv;
        varying float vLife;
        void main() {
          vUv = uv;
          vLife = aLife;
          vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying float vLife;
        void main() {
          // Distance from center
          float dist = distance(vUv, vec2(0.5));
          
          // Create a soft ring (brightest at 0.3 radius, fades out by 0.5)
          float ring = smoothstep(0.5, 0.4, dist) * smoothstep(0.1, 0.35, dist);
          
          // Multiply by life for smooth fading
          float alpha = ring * vLife * 1.5; 
          
          // White glowing color
          gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
        }
      `
    });
    
    this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    experience.scene.add(this.mesh);

    this.petals = [];
    for(let i=0; i<this.count; i++) {
       this.petals.push({ 
         pos: new THREE.Vector3(), 
         rot: new THREE.Euler(), 
         life: 0 
       });
    }
    
    // Initialize all invisible
    const dummy = new THREE.Object3D();
    dummy.scale.setScalar(0);
    dummy.updateMatrix();
    for (let i = 0; i < this.count; i++) {
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  emit(pos, facing = 0) {
    let j = this.idx % this.count;
    const p = this.petals[j];
    
    // Alternate left and right foot
    const isLeft = (this.idx % 2 === 0);
    // Tighter offset for ripples so they center near the foot
    const offsetSide = isLeft ? 0.2 : -0.2;
    const offsetForward = 0.1;
    
    // Calculate global offset based on facing direction
    const offsetX = Math.cos(facing) * offsetSide + Math.sin(facing) * offsetForward;
    const offsetZ = -Math.sin(facing) * offsetSide + Math.cos(facing) * offsetForward;
    
    p.pos.set(
      pos.x + offsetX,
      0.02, // Just above the floor to avoid z-fighting
      pos.z + offsetZ
    );
    
    // Flat on ground
    p.rot.set(-Math.PI / 2, 0, 0);
    
    p.life = 1.0; 
    this.idx++;
  }

  update(delta) {
    const dummy = new THREE.Object3D();
    let updated = false;
    
    for (let i = 0; i < this.count; i++) {
      const p = this.petals[i];
      if (p.life > 0) {
        // Ripples fade smoothly over ~1.2 seconds
        p.life -= delta * 0.8; 
        
        dummy.position.copy(p.pos);
        dummy.rotation.copy(p.rot);
        
        // Expand outward as it dies to simulate a ripple spreading
        const progress = 1.0 - Math.max(p.life, 0); 
        dummy.scale.setScalar(0.8 + progress * 3.2); // Scale mapping for the quad
        
        dummy.updateMatrix();
        this.mesh.setMatrixAt(i, dummy.matrix);
        
        // Update per-instance life
        this.mesh.geometry.attributes.aLife.setX(i, Math.max(p.life, 0));
        
        updated = true;
      } else if (p.life > -1) {
        // Just died
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(i, dummy.matrix);
        this.mesh.geometry.attributes.aLife.setX(i, 0);
        
        p.life = -1; // marked dead
        updated = true;
      }
    }
    
    if (updated) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.mesh.geometry.attributes.aLife.needsUpdate = true;
    }
  }
}
