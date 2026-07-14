import * as THREE from 'three';

export class Constellations {
  constructor(experience) {
    this.experience = experience;
    
    // Create a soft glowing circle texture so they look like light orbs, not square pixels
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const starTexture = new THREE.CanvasTexture(canvas);
    
    const geometry = new THREE.BufferGeometry();
    const particleCount = 6000;
    const posArray = new Float32Array(particleCount * 3);
    const scaleArray = new Float32Array(particleCount);
    const speedArray = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const r = 30 + Math.random() * 220; 
      const theta = 2 * Math.PI * Math.random();
      const phi = Math.acos(2 * Math.random() - 1);
      
      posArray[i3] = r * Math.sin(phi) * Math.cos(theta);
      posArray[i3 + 1] = (r * Math.sin(phi) * Math.sin(theta)) + 20; 
      posArray[i3 + 2] = r * Math.cos(phi);
      
      // Random base scale and random morph speed for each particle
      scaleArray[i] = 0.5 + Math.random() * 2.5; // Random size multiplier
      speedArray[i] = 0.2 + Math.random() * 1.5; // Random morphing speed
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scaleArray, 1));
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speedArray, 1));
    
    // Use a custom ShaderMaterial to make them independently morph and twinkle!
    this.uniforms = {
      uTime: { value: 0 },
      uBeat: { value: 0 },
      uTexture: { value: starTexture }
    };
    
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        precision highp float;
        uniform float uTime;
        uniform float uBeat;
        attribute float aScale;
        attribute float aSpeed;
        varying float vAlpha;
        
        void main() {
          // Smooth sine wave for size pulsing
          float pulse = sin(uTime * aSpeed + aScale * 10.0) * 0.5 + 0.5;
          
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          
          // Massive aggressive scaling smack on the SNAT beat
          float size = max(0.1, 120.0 * aScale * (0.5 + pulse + (uBeat * 15.0)));
          gl_PointSize = size / max(1.0, -mvPosition.z);
          
          // Twinkle alpha dynamically 
          vAlpha = clamp(pulse * 0.8 + 0.2 + (uBeat * 0.5), 0.0, 1.0);
          
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform sampler2D uTexture;
        uniform float uTime;
        varying float vAlpha;
        
        void main() {
          vec2 uv = gl_PointCoord;
          
          // Base melty orb slow wobble (always on)
          float wobbleAmp = 0.02;
          uv.x += sin(uv.y * 5.0 + uTime * 2.0) * wobbleAmp;
          uv.y += cos(uv.x * 5.0 + uTime * 1.5) * wobbleAmp;
          
          vec4 texColor = texture2D(uTexture, uv);
          gl_FragColor = vec4(texColor.rgb, texColor.a * vAlpha);
        }
      `
    });
    
    this.mesh = new THREE.Points(geometry, material);
    this.experience.scene.add(this.mesh);
  }
  
  update(delta, elapsed) {
    if (this.mesh) {
      // Gentle ambient rotation
      this.mesh.rotation.y = elapsed * 0.02;
      this.mesh.rotation.x = Math.sin(elapsed * 0.05) * 0.1;
      
      // Pass elapsed time to the shader to drive the morphing/twinkling!
      this.uniforms.uTime.value = elapsed;
      
      // Audio-reactive uniforms
      if (this.experience.audio) {
        const audioData = this.experience.audio.getAudioData();
        // Snappy attack, smooth decay for SNAT
        if (audioData.beat > this.uniforms.uBeat.value) {
          this.uniforms.uBeat.value = audioData.beat; // instant smack
        } else {
          this.uniforms.uBeat.value += (0 - this.uniforms.uBeat.value) * 0.1; // slow fade
        }
      }
    }
  }
}
