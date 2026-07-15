import * as THREE from 'three';
import { config, IS_TOUCH } from '../config.js';

export class FloatingOrbs {
  constructor(experience) {
    this.experience = experience;
    this.count = 15; // Halved from 30
    this.R = config.planet.radius;
    
    this.orbs = [];
    
    // Liquid metal orbs
    const geo = new THREE.SphereGeometry(1.5, 16, 16);
    
    const matParams = {
      color: 0xffffff, // White base so instanceColor controls it
      metalness: 1.0,
      roughness: 0.05,
      emissive: 0x000000,
      emissiveIntensity: 0.0
    };
    if (!IS_TOUCH) {
      matParams.clearcoat = 1.0;
      matParams.clearcoatRoughness = 0.0;
    }
    const mat = IS_TOUCH ? new THREE.MeshStandardMaterial(matParams) : new THREE.MeshPhysicalMaterial(matParams);

    this.uniforms = { uTime: { value: 0 } };

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uniforms.uTime;

      shader.vertexShader = `
        uniform float uTime;
        
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
        // Extreme liquid morphing
        float disp = fbm(position * 5.0 + uTime * 2.0) * 0.25; 
        vec3 displacedPosition = position + normal * disp;

        float eps = 0.01;
        vec3 t1 = cross(normal, vec3(0.0, 1.0, 0.0));
        if (length(t1) < 0.001) t1 = cross(normal, vec3(1.0, 0.0, 0.0));
        vec3 tangent1 = normalize(t1);
        vec3 tangent2 = normalize(cross(normal, tangent1));

        vec3 pos1 = position + tangent1 * eps;
        vec3 pos2 = position + tangent2 * eps;
        
        float disp1 = fbm(pos1 * 5.0 + uTime * 2.0) * 0.25;
        float disp2 = fbm(pos2 * 5.0 + uTime * 2.0) * 0.25;

        vec3 newPos1 = pos1 + normal * disp1;
        vec3 newPos2 = pos2 + normal * disp2;

        objectNormal = normalize(cross(newPos1 - displacedPosition, newPos2 - displacedPosition));
        `
      );

      shader.vertexShader = shader.vertexShader.replace(
        `#include <begin_vertex>`,
        `
        #include <begin_vertex>
        transformed = displacedPosition;
        vPos = position;
        `
      );
      
      shader.vertexShader = `
        varying vec3 vPos;
        varying float vIsTarget;
      ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        `#include <begin_vertex>`,
        `
        #include <begin_vertex>
        transformed = displacedPosition;
        vPos = position;
        #ifdef USE_INSTANCING_COLOR
           vIsTarget = step(0.5, instanceColor.r);
        #else
           vIsTarget = 0.0;
        #endif
        `
      );

      shader.fragmentShader = `
        uniform float uTime;
        varying vec3 vPos;
        varying float vIsTarget;
      ` + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        `#include <dithering_fragment>`,
        `
        #include <dithering_fragment>
        
        if (vIsTarget > 0.5) {
          vec3 col1 = vec3(0.0, 1.0, 0.8);
          vec3 col2 = vec3(1.0, 0.2, 0.6);
          vec3 col3 = vec3(1.0, 0.6, 0.0);
          
          float blend1 = sin(vPos.y * 2.0 + uTime * 3.0) * 0.5 + 0.5;
          float blend2 = cos(vPos.x * 1.5 - uTime * 2.0) * 0.5 + 0.5;
          
          vec3 grad = mix(col1, col2, blend1);
          grad = mix(grad, col3, blend2);
          
          // Breathing pulse — intensity oscillates between 1.0 and 2.5
          float pulse = sin(uTime * 4.0) * 0.5 + 0.5;
          float intensity = 1.0 + pulse * 1.5;
          
          gl_FragColor = vec4(grad * intensity, 1.0);
        }
        `
      );
    };
    
    // Create the single InstancedMesh
    this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false; // Fix instances disappearing when looking away from origin
    experience.scene.add(this.mesh);

    const dummy = new THREE.Object3D();

    for (let i = 0; i < this.count; i++) {
      const position = new THREE.Vector3(
        (Math.random() - 0.5) * 100,
        1.5 + Math.random() * 40.0, // Wider vertical range
        (Math.random() - 0.5) * 100
      );
      
      const yBase = position.y;
      
      let light = null;
      if (!IS_TOUCH) {
        light = new THREE.PointLight(0xff6622, 10, 15);
        light.castShadow = false;
        light.position.copy(position);
        experience.scene.add(light);
      }
      
      // 3D Wander velocity
      const vel = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize();
      
      const baseSpeed = 1.5 + Math.random() * 2.0; 
      
      this.orbs.push({
        position,
        light,
        vel,
        baseSpeed,
        speed: baseSpeed,
        yBase,
        phase: Math.random() * Math.PI * 2
      });
      
      dummy.position.copy(position);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
      this.mesh.setColorAt(i, new THREE.Color(0x050505)); // Default dark metallic
    }
    
    // Gamification Target Setup
    this.targetIndex = Math.floor(Math.random() * this.count);
    this.mesh.setColorAt(this.targetIndex, new THREE.Color(0xffffff));
    
    this.mesh.instanceColor.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(delta, elapsed) {
    if (this.uniforms) this.uniforms.uTime.value = elapsed;

    const dummy = new THREE.Object3D();

    for (let i = 0; i < this.orbs.length; i++) {
      const orb = this.orbs[i];
      
      // 3D Drift
      orb.vel.x += Math.sin(elapsed * 0.5 + orb.phase) * delta * 0.5;
      orb.vel.y += Math.cos(elapsed * 0.6 + orb.phase) * delta * 0.5;
      orb.vel.z += Math.cos(elapsed * 0.4 + orb.phase) * delta * 0.5;
      orb.vel.normalize();

      // Move along 3D path
      orb.position.addScaledVector(orb.vel, orb.speed * delta);
      
      // Keep them within the showroom
      if (orb.position.x > 80) { orb.position.x = 80; orb.vel.x *= -1; }
      if (orb.position.x < -80) { orb.position.x = -80; orb.vel.x *= -1; }
      if (orb.position.z > 80) { orb.position.z = 80; orb.vel.z *= -1; }
      if (orb.position.z < -80) { orb.position.z = -80; orb.vel.z *= -1; }
      
      // Ceiling bound
      if (orb.position.y > 60) { orb.position.y = 60; orb.vel.y *= -1; }

      // Gravitational repulsion field near the ground
      const REPULSION_HEIGHT = 1.5;
      if (orb.position.y < REPULSION_HEIGHT) {
        const squash = REPULSION_HEIGHT - orb.position.y;
        orb.position.y += squash + (Math.pow(squash, 2) * 0.5);
        if (orb.vel.y < 0) orb.vel.y *= -1; // Bounce up
      }
      
      // Update light position if desktop
      if (orb.light) {
        orb.light.position.copy(orb.position);
      }
    }

    // --- Physics / Collisions ---
    const R_ORB = 1.5;
    
    // Build obstacle list
    const obstacles = [];
    if (this.experience.world) {
      const w = this.experience.world;
      if (w.podium && w.podium.group) obstacles.push({ pos: w.podium.group.position, r: 15 });
      if (w.splat && w.splat.viewerLeft) obstacles.push({ pos: w.splat.viewerLeft.position, r: 18 });
      if (w.splat && w.splat.viewerRight) obstacles.push({ pos: w.splat.viewerRight.position, r: 18 });
    }

    const pPos = this.experience.world?.player?.position;
    const R_PLAYER = 1.5;

    for (let i = 0; i < this.orbs.length; i++) {
      const orb = this.orbs[i];
      
      // Obstacle collisions
      for (const obs of obstacles) {
        const dx = orb.position.x - obs.pos.x;
        const dy = orb.position.y - obs.pos.y;
        const dz = orb.position.z - obs.pos.z;
        const dist = Math.hypot(dx, dy, dz);
        const minDist = R_ORB + obs.r;
        
        if (dist < minDist && dist > 0.1) {
          const normal = new THREE.Vector3(dx, dy, dz).normalize();
          orb.vel.copy(normal);
          orb.position.addScaledVector(normal, minDist - dist);
        }
      }

      // Player collision
      if (pPos) {
        const dx = orb.position.x - pPos.x;
        const dy = orb.position.y - pPos.y;
        const dz = orb.position.z - pPos.z;
        const dist3D = Math.hypot(dx, dy, dz);
        
        // Give the target orb a slightly larger collection radius
        const targetBonus = (i === this.targetIndex) ? 1.5 : 0.0;
        const minDist = R_ORB + R_PLAYER + targetBonus;
        
        if (dist3D < minDist && dist3D > 0.1) {
          const normal = new THREE.Vector3(dx, dy, dz).normalize();
          
          orb.vel.copy(normal);
          orb.position.addScaledVector(normal, minDist - dist3D);
          
          // Momentum boost
          orb.speed = Math.min(orb.speed + 15.0, 30.0);
          
          // Sparks!
          if (this.experience.world?.sparks) {
            const cPos = new THREE.Vector3().copy(pPos).addScaledVector(normal, R_PLAYER);
            const sparkColor = (i === this.targetIndex) ? 0xffaa22 : 0x00aaff; // Gold for target, blue for others
            this.experience.world.sparks.emit(cPos, normal, 5, sparkColor);
          }
          
          // Gamification Check!
          if (i === this.targetIndex) {
            
            // Play sparkle audio!
            if (this.experience.audio) {
              this.experience.audio.playSparkle(orb.position);
            }
            
            // Turn off current target
            this.mesh.setColorAt(this.targetIndex, new THREE.Color(0x050505));
            
            // Pick a new random target
            let next = this.targetIndex;
            while (next === this.targetIndex) next = Math.floor(Math.random() * this.count);
            this.targetIndex = next;
            
            // Light up new target
            this.mesh.setColorAt(this.targetIndex, new THREE.Color(0xffffff));
            this.mesh.instanceColor.needsUpdate = true;
            
            // Reward: spawn a new orbiting drone companion!
            if (this.experience.world?.drone) {
              this.experience.world.drone.addOrb();
            }
          }
        }
      }
      // Shoe collision
      const shoeRadius = 14.0;
      const dxS = orb.position.x;
      const dyS = orb.position.y - 15;
      const dzS = orb.position.z;
      const distS = Math.hypot(dxS, dyS, dzS);
      if (distS < shoeRadius && distS > 0.1) {
        const normal = new THREE.Vector3(dxS, dyS, dzS).normalize();
        orb.vel.copy(normal);
        orb.position.addScaledVector(normal, shoeRadius - distS);
        // Sparks!
        if (this.experience.world?.sparks) {
          const cPos = new THREE.Vector3(0, 15, 0).addScaledVector(normal, shoeRadius);
          this.experience.world.sparks.emit(cPos, normal, 5, 0xffffff);
        }
      }
    }

    // 2. Orbs vs Orbs
    for (let i = 0; i < this.orbs.length; i++) {
      for (let j = i + 1; j < this.orbs.length; j++) {
        const o1 = this.orbs[i];
        const o2 = this.orbs[j];
        const dx = o1.position.x - o2.position.x;
        const dz = o1.position.z - o2.position.z;
        const dist2D = Math.hypot(dx, dz);
        const minDist = R_ORB * 2;
        if (dist2D < minDist) {
          const normal = new THREE.Vector3(dx, 0, dz).normalize();
          
          o1.vel.copy(normal);
          o2.vel.copy(normal).negate();
          
          const overlap = (minDist - dist2D) * 0.5;
          o1.position.x += normal.x * overlap;
          o1.position.z += normal.z * overlap;
          o2.position.x -= normal.x * overlap;
          o2.position.z -= normal.z * overlap;

          // Momentum boost on both
          const transfer = 5.0;
          o1.speed = Math.min(o1.speed + transfer, 30.0);
          o2.speed = Math.min(o2.speed + transfer, 30.0);
          
          if (this.experience.world?.sparks) {
            const cPos = new THREE.Vector3(
              o2.position.x + normal.x * R_ORB,
              (o1.position.y + o2.position.y) * 0.5,
              o2.position.z + normal.z * R_ORB
            );
            this.experience.world.sparks.emit(cPos, normal, 50);
          }
        }
      }
    }


    // 4. Friction and Matrix Update
    for (let i = 0; i < this.orbs.length; i++) {
      const orb = this.orbs[i];
      if (orb.speed > orb.baseSpeed) {
        orb.speed = Math.max(orb.speed - delta * 15.0, orb.baseSpeed);
      }
      
      dummy.position.copy(orb.position);
      
      // Pulse the target orb's scale to make it more obvious, larger and harder pulse
      if (i === this.targetIndex) {
        const pulse = 1.4 + Math.sin(elapsed * 8.0) * 0.4; // 1.0 -> 1.8 fast breathing
        dummy.scale.setScalar(pulse);
      } else {
        dummy.scale.setScalar(1.0);
      }
      
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    
    // Pulse the target orb's point light too (desktop only)
    const targetOrb = this.orbs[this.targetIndex];
    if (targetOrb && targetOrb.light) {
      targetOrb.light.intensity = 15 + Math.sin(elapsed * 8.0) * 12;
    }
    
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
