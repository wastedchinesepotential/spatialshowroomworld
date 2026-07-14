import * as THREE from 'three';
import { quality, IS_TOUCH } from '../config.js';

/* Massive flat liquid-chrome plane replacing the planet */
export class ShowroomFloor {
  constructor(experience) {
    this.experience = experience;
    
    // Resolution based on quality config (128 for mobile, 512 for desktop)
    const geo = new THREE.PlaneGeometry(1000, 1000, quality.floorRes, quality.floorRes);
    
    // Use StandardMaterial on mobile to save performance
    const matParams = {
      color: 0xffffff, // Bright white for debugging
      metalness: 0.2,  
      roughness: 0.5,
    };
    if (!IS_TOUCH) {
      matParams.clearcoat = 0.5;
      matParams.envMapIntensity = 0.0;
    }
    const mat = IS_TOUCH ? new THREE.MeshStandardMaterial(matParams) : new THREE.MeshPhysicalMaterial(matParams);

    this.uniforms = {
      uTime: { value: 0 },
      uPlayerPos: { value: new THREE.Vector3() }
    };
    this.rippleIdx = 0;

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uniforms.uTime;
      shader.uniforms.uPlayerPos = this.uniforms.uPlayerPos;

      // --- VERTEX SHADER ---
      shader.vertexShader = `
        uniform float uTime;
        varying vec3 vObjPos;
        
        // Simplex 3D Noise 
        vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
        vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
        float snoise(vec3 v){
          const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
          const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i  = floor(v + dot(v, C.yyy) );
          vec3 x0 = v - i + dot(i, C.xxx) ;
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min( g.xyz, l.zxy );
          vec3 i2 = max( g.xyz, l.zxy );
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy; 
          vec3 x3 = x0 - D.yyy;      
          i = mod(i, 289.0 );
          vec4 p = permute( permute( permute(
                     i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                   + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                   + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
          float n_ = 0.142857142857;
          vec3  ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_ );
          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4( x.xy, y.xy );
          vec4 b1 = vec4( x.zw, y.zw );
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
          vec3 p0 = vec3(a0.xy,h.x);
          vec3 p1 = vec3(a0.zw,h.y);
          vec3 p2 = vec3(a1.xy,h.z);
          vec3 p3 = vec3(a1.zw,h.w);
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
          p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
        }

        uniform vec3 uPlayerPos;

        float fbm(vec3 x) {
          float v = 0.0; float a = 0.5; vec3 shift = vec3(100);
          for (int i = 0; i < 3; ++i) { v += a * snoise(x); x = x * 2.0 + shift; a *= 0.5; }
          return v;
        }

      ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        `#include <beginnormal_vertex>`,
        `
        #include <beginnormal_vertex>
        vObjPos = position;
        
        // Z is up in PlaneGeometry local space
        float disp = fbm(vec3(position.xy * 0.06, uTime * 0.2)) * 0.4;
        
        // The plane is rotated -90deg on X, so world XZ corresponds to local XY: (x, -y)
        float distToPlayer = distance(vec2(position.x, -position.y), uPlayerPos.xz);
        // Smoothly flatten the floor within a 2.5m radius of the player!
        float playerBlend = smoothstep(1.5, 3.5, distToPlayer);
        
        disp *= playerBlend;
        vec3 displacedPosition = position + vec3(0.0, 0.0, 1.0) * disp;

        float eps = 0.1;
        vec3 pos1 = position + vec3(eps, 0.0, 0.0);
        vec3 pos2 = position + vec3(0.0, eps, 0.0);
        
        float dist1 = distance(vec2(pos1.x, -pos1.y), uPlayerPos.xz);
        float disp1 = fbm(vec3(pos1.xy * 0.06, uTime * 0.2)) * 0.4 * smoothstep(1.5, 3.5, dist1);

        float dist2 = distance(vec2(pos2.x, -pos2.y), uPlayerPos.xz);
        float disp2 = fbm(vec3(pos2.xy * 0.06, uTime * 0.2)) * 0.4 * smoothstep(1.5, 3.5, dist2);

        vec3 newPos1 = pos1 + vec3(0.0, 0.0, 1.0) * disp1;
        vec3 newPos2 = pos2 + vec3(0.0, 0.0, 1.0) * disp2;

        objectNormal = normalize(cross(newPos1 - displacedPosition, newPos2 - displacedPosition));
        `
      );

      shader.vertexShader = shader.vertexShader.replace(
        `#include <begin_vertex>`,
        `
        #include <begin_vertex>
        transformed = displacedPosition;
        `
      );

      // --- FRAGMENT SHADER ---
      // We will skip the sunset plasma for now since it's a sleek chrome showroom,
      // but we will keep it slightly reflective.
      shader.fragmentShader = `
        uniform float uTime;
        varying vec3 vObjPos;
      ` + shader.fragmentShader;
      
    };

    this.mesh = new THREE.Mesh(geo, mat);
    // Rotate to lay flat on XZ plane
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.receiveShadow = true;
    experience.scene.add(this.mesh);

    // Physics Collider
    const RAPIER = experience.physics.RAPIER;
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -1.0, 0);
    this.body = experience.physics.world.createRigidBody(bodyDesc);
    this.collider = experience.physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(500, 1, 500),
      this.body
    );
  }

  update(delta, elapsed, playerPos) {
    if (this.uniforms) {
      this.uniforms.uTime.value = elapsed;
      if (playerPos) {
        this.uniforms.uPlayerPos.value.copy(playerPos);
      }
    }
  }

  addRipple(pos, time) {
    const idx = this.rippleIdx % 10;
    // Map world XZ to plane local XY (rotation.x = -90)
    this.uniforms.uRipples.value[idx].set(pos.x, -pos.z, 0, time);
    this.rippleIdx++;
  }
}
