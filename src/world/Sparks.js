import * as THREE from 'three';

export class Sparks {
  constructor(experience) {
    this.experience = experience;
    this.count = 2000;
    
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(this.count * 3);
    const vel = new Float32Array(this.count * 3);
    const life = new Float32Array(this.count); // 0 means dead
    
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
    geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
    
    this.uniforms = {
      uColor: { value: new THREE.Color(0xffaa22) } // Intense orange/gold spark
    };
    
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexShader: `
        attribute float aLife;
        varying float vLife;
        void main() {
          vLife = aLife;
          if (aLife <= 0.0) {
            gl_Position = vec4(0.0);
            return;
          }
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          
          // MASSIVE point size
          gl_PointSize = 150.0 * aLife * (30.0 / -mvPosition.z);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vLife;
        void main() {
          if (vLife <= 0.0) discard;
          
          vec2 p = gl_PointCoord - vec2(0.5);
          float a = atan(p.x, p.y);
          float r = length(p);
          float v = 1.256637; // 2 * PI / 5 for pentagon
          float d = cos(floor(0.5 + a / v) * v - a) * r;
          
          if(d > 0.4) discard;
          
          // Pentagonal glowing center
          float alpha = vLife * pow(smoothstep(0.4, 0.0, d), 2.0) * 3.0;
          gl_FragColor = vec4(uColor, alpha);
        }
      `
    });
    
    this.points = new THREE.Points(geo, mat);
    this.points.renderOrder = 999; // Render on top of everything
    this.points.frustumCulled = false; // Fix particles disappearing based on camera angle
    this.experience.scene.add(this.points);
    this.idx = 0;
  }
  
  emit(pos, normal, count = 100) {
    const geo = this.points.geometry;
    const p = geo.attributes.position.array;
    const v = geo.attributes.aVel.array;
    const l = geo.attributes.aLife.array;
    
    for(let i=0; i<count; i++) {
      let j = this.idx % this.count;
      p[j*3] = pos.x; p[j*3+1] = pos.y; p[j*3+2] = pos.z;
      
      // Spray cone around normal
      const rDir = new THREE.Vector3(
        (Math.random() - 0.5) * 4.0 + normal.x * 2.0,
        (Math.random() - 0.5) * 4.0 + normal.y * 2.0,
        (Math.random() - 0.5) * 4.0 + normal.z * 2.0
      ).normalize();
      
      // Extremely fast
      const speed = 15.0 + Math.random() * 45.0; 
      v[j*3] = rDir.x * speed;
      v[j*3+1] = rDir.y * speed;
      v[j*3+2] = rDir.z * speed;
      
      l[j] = 1.0; 
      
      this.idx++;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aVel.needsUpdate = true;
    geo.attributes.aLife.needsUpdate = true;
  }
  
  update(delta) {
    const geo = this.points.geometry;
    const p = geo.attributes.position.array;
    const v = geo.attributes.aVel.array;
    const l = geo.attributes.aLife.array;
    let updated = false;
    
    for(let i=0; i<this.count; i++) {
      if (l[i] > 0) {
        l[i] -= delta * 1.5; // die slightly slower
        
        // Add heavy gravity to sparks
        v[i*3+1] -= 30.0 * delta; 
        
        p[i*3] += v[i*3] * delta;
        p[i*3+1] += v[i*3+1] * delta;
        p[i*3+2] += v[i*3+2] * delta;
        updated = true;
      }
    }
    if (updated) {
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aLife.needsUpdate = true;
    }
  }
}
