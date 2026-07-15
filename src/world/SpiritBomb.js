import * as THREE from 'three';

export class SpiritBomb {
  constructor(experience) {
    this.experience = experience;
    this.RAPIER = experience.physics.RAPIER;

    // Create a giant orb mesh using the exact Drone shader logic
    const geo = new THREE.SphereGeometry(3.0, 32, 32);
    this.uniforms = { uTime: { value: 0 } };
    const mat = this._buildMaterial();
    
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.material.onBeforeCompile = mat.onBeforeCompile;
    
    // Core light
    this.light = new THREE.PointLight(0xffffff, 0, 100, 2);
    this.light.castShadow = false;
    this.mesh.add(this.light);

    this.experience.scene.add(this.mesh);

    this.active = false;
    this.charging = false;
    this.chargeTimer = 0;
    this.lifeTimer = 0;
    this.body = null;
    
    this.blurAmt = 0; // Exposed for Experience.js postfx
    
    // Hide initially
    this.mesh.scale.setScalar(0.001);
    this.mesh.visible = true;
  }

  _buildMaterial() {
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x444444,
      metalness: 1.0,
      roughness: 0.2,
      emissive: 0xffaa55,
      emissiveIntensity: 0.5
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uniforms.uTime;
      shader.vertexShader = `
        uniform float uTime;
        varying vec3 vPos;
        // Simplex noise chunk
        vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
        vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
        float snoise(vec3 v){
          const vec2  C = vec2(1.0/6.0, 1.0/3.0);
          const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i  = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min( g.xyz, l.zxy );
          vec3 i2 = max( g.xyz, l.zxy );
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          i = mod(i, 289.0);
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
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
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
        // High frequency displacement for wavy orb
        float disp = fbm(position * 2.0 + uTime * 2.0) * 0.15;
        vec3 displacedPosition = position + normal * disp;

        float eps = 0.01;
        vec3 tangent1 = normalize(cross(normal, vec3(0.0, 1.0, 0.0)));
        if (length(tangent1) < 0.001) tangent1 = normalize(cross(normal, vec3(1.0, 0.0, 0.0)));
        vec3 tangent2 = normalize(cross(normal, tangent1));

        vec3 pos1 = position + tangent1 * eps;
        vec3 pos2 = position + tangent2 * eps;
        
        float disp1 = fbm(pos1 * 2.0 + uTime * 2.0) * 0.15;
        float disp2 = fbm(pos2 * 2.0 + uTime * 2.0) * 0.15;

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

      shader.fragmentShader = `
        uniform float uTime;
        varying vec3 vPos;
      ` + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        `#include <emissivemap_fragment>`,
        `
        #include <emissivemap_fragment>
        // Exact same color blend as Drone.js (scaled down frequency to match giant sphere)
        vec3 col1 = vec3(0.0, 1.0, 0.8);
        vec3 col2 = vec3(1.0, 0.2, 0.6);
        vec3 col3 = vec3(1.0, 0.6, 0.0);
        
        float blend1 = sin(vPos.y * 1.0 + uTime * 3.0) * 0.5 + 0.5;
        float blend2 = cos(vPos.x * 0.75 - uTime * 2.0) * 0.5 + 0.5;
        
        vec3 grad = mix(col1, col2, blend1);
        grad = mix(grad, col3, blend2);
        
        totalEmissiveRadiance = grad * 2.5; 
        `
      );
    };

    return mat;
  }

  cast() {
    if (this.active || this.charging) return;
    
    // Absorb the 5 drones
    if (this.experience.world?.drone) {
      this.experience.world.drone.reset();
    }
    
    const player = this.experience.world?.player;
    if (!player) return;

    this.charging = true;
    this.chargeTimer = 0;
    this.active = false;
    this.blurAmt = 0;
    
    // Play SFX
    if (this.experience.audio) {
      this.experience.audio.playSpiritBomb();
    }
    
    // Freeze player input so they drop to idle!
    player._frozen = true;
    player._forceFall = true; // Force the falling float idle animation while standing on the ground!

    // Start directly above player's head
    this.mesh.position.copy(player.position);
    this.mesh.position.y += 10.0; // High above
    this.mesh.scale.setScalar(0.001);
  }

  _launch() {
    this.charging = false;
    this.active = true;
    this.lifeTimer = 0;

    const player = this.experience.world?.player;
    if (player) {
      player._frozen = false; // Unfreeze player!
      player._forceFall = false;
    }

    const cam = this.experience.camera.instance;
    const launchDir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
    
    // Trigger Heavy Camera Shake on Launch
    if (this.experience.camera) {
      this.experience.camera.shake = 1.2;
    }

    // Spawn Rapier body
    const desc = this.RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(this.mesh.position.x, this.mesh.position.y, this.mesh.position.z)
      .setCcdEnabled(true);
      
    this.body = this.experience.physics.world.createRigidBody(desc);
    
    // Very bouncy!
    const colliderDesc = this.RAPIER.ColliderDesc.ball(3.0)
      .setRestitution(1.2) // Increased bounce significantly!
      .setFriction(0.1)
      .setMass(50.0);
      
    this.experience.physics.world.createCollider(colliderDesc, this.body);

    // Apply massive impulse forward and slightly up
    const impulse = launchDir.multiplyScalar(3000.0);
    impulse.y += 200.0; // slight arc
    this.body.applyImpulse(impulse, true);
    
    // Track previous Y velocity to detect bounces manually
    this._prevVy = this.body.linvel().y;
  }

  update(delta, elapsed) {
    this.uniforms.uTime.value = elapsed;

    if (this.charging) {
      this.chargeTimer += delta;
      
      const p = Math.min(this.chargeTimer / 1.5, 1.0);
      
      // Build up Blur and Shake
      this.blurAmt = p * 1.5;
      if (this.experience.camera) {
        this.experience.camera.shake = p * 0.15; // Building tension shake
      }
      
      // Grow over 1.5 seconds
      const s = p * 1.5; // Final scale 1.5 (radius 4.5)
      this.mesh.scale.setScalar(s);
      
      this.light.intensity = s * 50.0;
      
      const player = this.experience.world?.player;
      if (player) {
        // Keep it above player's head while charging
        this.mesh.position.copy(player.position);
        this.mesh.position.y += 8.0 + Math.sin(elapsed * 10) * 0.5; // Shake slightly
        
        // Face player away from camera (forward)
        if (this.experience.camera) {
          player.facing = this.experience.camera.getYaw() + Math.PI;
        }
      }
      
      // Launch!
      if (this.chargeTimer >= 1.5) {
        this._launch();
      }
      return;
    }

    if (!this.active) return;
    
    // Fade blur after launch
    if (this.blurAmt > 0) {
      this.blurAmt -= delta * 1.5;
      if (this.blurAmt < 0) this.blurAmt = 0;
    }

    this.lifeTimer += delta;

    // Fade out and die after 15s
    if (this.lifeTimer > 15.0) {
      this.active = false;
      this.mesh.scale.setScalar(0.001);
      this.light.intensity = 0;
      this.blurAmt = 0;
      
      if (this.body) {
        this.experience.physics.world.removeRigidBody(this.body);
        this.body = null;
      }
      return;
    }

    // Sync mesh to physics body
    if (this.body) {
      const pos = this.body.translation();
      this.mesh.position.set(pos.x, pos.y, pos.z);
      
      const vel = this.body.linvel();
      
      // Manual bounce detection
      if (this._prevVy < -2.0 && vel.y > 0.0) {
        // We bounced!
        
        // Apply crazy physics: multiply horizontal velocity and blast it back up!
        this.body.setLinvel({ x: vel.x * 1.3, y: vel.y, z: vel.z * 1.3 }, true);
        this.body.applyImpulse({ x: 0, y: 1500, z: 0 }, true);
        
        if (this.experience.world?.sparks) {
          const impactPos = new THREE.Vector3(pos.x, pos.y - 3.0, pos.z);
          const up = new THREE.Vector3(0, 1, 0);
          this.experience.world.sparks.emit(impactPos, up, 100, 0xffff00); // Bright Yellow!
        }
      }
      this._prevVy = vel.y;
      
      // Also check if we smashed into the other floating orbs
      const orbs = this.experience.world?.orbs;
      if (orbs) {
        for (let i = 0; i < orbs.count; i++) {
          const dummy = new THREE.Object3D();
          orbs.mesh.getMatrixAt(i, dummy.matrix);
          dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
          
          const dist = dummy.position.distanceTo(this.mesh.position);
          if (dist < 4.5) { 
            // BOOM!
            if (this.experience.world?.sparks) {
              const dir = dummy.position.clone().sub(this.mesh.position).normalize();
              const impactPos = dummy.position.clone().sub(dir.multiplyScalar(1.5));
              this.experience.world.sparks.emit(impactPos, dir, 50, 0xffff00); // Bright Yellow!
            }
          }
        }
      }
    }
  }
}
