import * as THREE from 'three';

/**
 * Multi-drone manager. All 5 drones are pre-created at startup (shader compiles once,
 * no lag spikes). They start hidden and are revealed one-by-one via addOrb().
 * 
 * During flight, drones switch to a spiral trail behind the player,
 * anchored to the CAMERA direction so they rotate with the player on mobile.
 */
export class Drone {
  constructor(experience) {
    this.experience = experience;
    this.maxOrbs = 5;
    this.activeCount = 0;
    this.drones = [];

    this.uniforms = { uTime: { value: 0 } };

    // Pre-allocate all reusable vectors (zero GC pressure in update loop)
    this._up = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._orbitPos = new THREE.Vector3();
    this._trailPos = new THREE.Vector3();
    this._targetPos = new THREE.Vector3();
    this._scaleVec = new THREE.Vector3();
    this._camDir = new THREE.Vector3();
    this._camRight = new THREE.Vector3();
    this._trailBlend = 0;

    // Pre-build the shared geometry and material once
    this._geo = new THREE.SphereGeometry(0.15, 32, 32);
    this._mat = this._buildMaterial();

    // Pre-create ALL 5 drones at construction time
    for (let i = 0; i < this.maxOrbs; i++) {
      const group = new THREE.Group();
      this.experience.scene.add(group);

      const mesh = new THREE.Mesh(this._geo, this._mat.clone());
      mesh.material.onBeforeCompile = this._mat.onBeforeCompile;
      group.add(mesh);

      const light = new THREE.PointLight(0xffffff, 0, 20, 2);
      light.castShadow = false; // Fixed: 5 point lights casting shadows was rendering the scene 30 extra times per frame!
      light.shadow.bias = -0.001;
      group.add(light);

      group.scale.setScalar(0.001);
      group.visible = true;

      this.drones.push({
        group,
        mesh,
        light,
        orbitAngle: (2 * Math.PI / this.maxOrbs) * i,
        spawnScale: 0,
        active: false
      });
    }
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
        float disp = fbm(position * 4.0 + uTime * 1.5) * 0.08;
        vec3 displacedPosition = position + normal * disp;

        float eps = 0.01;
        vec3 tangent1 = normalize(cross(normal, vec3(0.0, 1.0, 0.0)));
        if (length(tangent1) < 0.001) tangent1 = normalize(cross(normal, vec3(1.0, 0.0, 0.0)));
        vec3 tangent2 = normalize(cross(normal, tangent1));

        vec3 pos1 = position + tangent1 * eps;
        vec3 pos2 = position + tangent2 * eps;
        
        float disp1 = fbm(pos1 * 4.0 + uTime * 1.5) * 0.08;
        float disp2 = fbm(pos2 * 4.0 + uTime * 1.5) * 0.08;

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
        
        vec3 col1 = vec3(0.0, 1.0, 0.8);
        vec3 col2 = vec3(1.0, 0.2, 0.6);
        vec3 col3 = vec3(1.0, 0.6, 0.0);
        
        float blend1 = sin(vPos.y * 20.0 + uTime * 3.0) * 0.5 + 0.5;
        float blend2 = cos(vPos.x * 15.0 - uTime * 2.0) * 0.5 + 0.5;
        
        vec3 grad = mix(col1, col2, blend1);
        grad = mix(grad, col3, blend2);
        
        totalEmissiveRadiance = grad * 2.5;
        `
      );
    };

    return mat;
  }

  addOrb() {
    if (this.activeCount >= this.maxOrbs) return this.activeCount;
    this.drones[this.activeCount].active = true;
    this.drones[this.activeCount].spawnScale = 0;
    this.activeCount++;
    for (let i = 0; i < this.activeCount; i++) {
      this.drones[i].orbitAngle = (2 * Math.PI / this.activeCount) * i;
    }
    
    // Show Spirit Bomb button if we reach max
    if (this.activeCount === this.maxOrbs) {
      const btn = document.getElementById('btn-bomb');
      if (btn) btn.style.display = 'block';
    }
    
    return this.activeCount;
  }

  reset() {
    this.activeCount = 0;
    for (let i = 0; i < this.maxOrbs; i++) {
      this.drones[i].active = false;
      this.drones[i].spawnScale = 0;
    }
    
    const btn = document.getElementById('btn-bomb');
    if (btn) btn.style.display = 'none';
  }

  getCount() { return this.activeCount; }

  update(delta, elapsed) {
    this.uniforms.uTime.value = elapsed;

    const player = this.experience.world?.player;
    if (!player) return;

    // Detect flight state
    const isFlying = player.flying;
    const isFlyingForward = isFlying && player._isFlyingForward;

    // Blend between orbit (0) and trail (1)
    const targetBlend = isFlyingForward ? 1.0 : 0.0;
    this._trailBlend += (targetBlend - this._trailBlend) * Math.min(delta * 4.0, 1.0);

    // Follow speed: tighter during flight
    const followLerp = isFlying ? Math.min(delta * 15.0, 1.0) : Math.min(delta * 5.0, 1.0);

    // Use CAMERA direction for trail so it rotates with the player on mobile
    const cam = this.experience.camera;
    this._camDir.set(0, 0, -1).applyQuaternion(cam.instance.quaternion);
    this._camDir.y = 0; // Flatten to horizontal
    this._camDir.normalize();
    this._camRight.set(this._camDir.z, 0, -this._camDir.x); // Perpendicular on XZ

    // Player basis for orbit mode
    this._up.copy(player.surfaceUp || new THREE.Vector3(0, 1, 0));
    this._fwd.copy(player.forward || new THREE.Vector3(0, 0, -1));
    this._right.crossVectors(this._fwd, this._up).normalize();

    const orbitRadius = 2.5;
    const orbitSpeed = 1.5;
    const orbitHeight = 3.0;

    // Spiral trail params — each orb at a different angle/depth behind
    const trailBaseDepth = 4.5; // Pushed further back so it doesn't clip feet
    const trailRadius = 1.2;
    const trailHeight = 1.0;

    for (let i = 0; i < this.maxOrbs; i++) {
      const d = this.drones[i];

      // Spawn/despawn scale
      const targetSpawn = d.active ? 1.0 : 0.0;
      d.spawnScale += (targetSpawn - d.spawnScale) * delta * 5.0;
      const s = 3.0 * d.spawnScale;
      this._scaleVec.set(s, s, s);
      d.group.scale.lerp(this._scaleVec, delta * 5.0);

      // === ORBIT POSITION (walking/idle) ===
      d.orbitAngle += delta * orbitSpeed;
      this._orbitPos.copy(player.position);
      this._orbitPos.addScaledVector(this._right, Math.cos(d.orbitAngle) * orbitRadius);
      this._orbitPos.addScaledVector(this._fwd, Math.sin(d.orbitAngle) * orbitRadius);
      this._orbitPos.addScaledVector(this._up, orbitHeight + Math.sin(elapsed * 2 + i) * 0.2);

      // === SPIRAL TRAIL (flying) ===
      // Each drone spirals at a unique angle, staggered in depth behind player
      const activeIdx = d.active ? this._getActiveIndex(i) : i;
      const depthStep = trailBaseDepth + activeIdx * 1.5; // Each one further back
      const spiralAngle = elapsed * 3.0 + activeIdx * (2 * Math.PI / Math.max(this.activeCount, 1));
      const spiralX = Math.cos(spiralAngle) * trailRadius;
      const spiralY = Math.sin(spiralAngle) * trailRadius;

      this._trailPos.copy(player.position);
      this._trailPos.addScaledVector(this._camDir, -depthStep); // Behind camera direction
      this._trailPos.addScaledVector(this._camRight, spiralX);
      this._trailPos.y += trailHeight + spiralY;

      // === BLEND ===
      this._targetPos.lerpVectors(this._orbitPos, this._trailPos, this._trailBlend);
      d.group.position.lerp(this._targetPos, followLerp);

      // Light
      const targetInt = d.active ? 30.0 * d.spawnScale : 0;
      d.light.intensity += (targetInt - d.light.intensity) * delta * 5.0;
      d.light.distance += (45.0 - d.light.distance) * delta * 5.0;
    }
  }

  _getActiveIndex(globalIdx) {
    let count = 0;
    for (let j = 0; j < globalIdx; j++) {
      if (this.drones[j].active) count++;
    }
    return count;
  }
}
