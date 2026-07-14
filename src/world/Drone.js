import * as THREE from 'three';

export class Drone {
  constructor(experience) {
    this.experience = experience;
    this.group = new THREE.Group();
    this.experience.scene.add(this.group);

    this.uniforms = { uTime: { value: 0 } };

    // Drone visual (small metallic orb)
    const geo = new THREE.SphereGeometry(0.15, 32, 32);
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
        
        vec3 col1 = vec3(0.0, 1.0, 0.8); // Cyan
        vec3 col2 = vec3(1.0, 0.2, 0.6); // Magenta
        vec3 col3 = vec3(1.0, 0.6, 0.0); // Orange
        
        float blend1 = sin(vPos.y * 20.0 + uTime * 3.0) * 0.5 + 0.5;
        float blend2 = cos(vPos.x * 15.0 - uTime * 2.0) * 0.5 + 0.5;
        
        vec3 grad = mix(col1, col2, blend1);
        grad = mix(grad, col3, blend2);
        
        totalEmissiveRadiance = grad * 2.5; // Animated gradient glow
        `
      );
    };

    this.mesh = new THREE.Mesh(geo, mat);
    this.group.add(this.mesh);

    // Drone light
    this.light = new THREE.PointLight(0xffffff, 5, 20, 2); 
    this.light.castShadow = true;
    this.light.shadow.bias = -0.001;
    this.group.add(this.light);

    this.orbitAngle = 0;
    this.active = false;
    this.group.visible = true; // ALWAYS true so the shader compiles on frame 1 to prevent lag spike
    this._spawnScale = 0;
  }

  update(delta, elapsed) {
    this.uniforms.uTime.value = elapsed;

    const input = this.experience.input;
    if (input && input.toggleDrone) {
      this.active = !this.active;
    }

    // Smoothly animate the spawn/despawn scale (0.0 to 1.0)
    const targetSpawn = this.active ? 1.0 : 0.0;
    this._spawnScale += (targetSpawn - this._spawnScale) * delta * 5.0;

    const player = this.experience.world?.player;
    if (!player) return;

    // Orbit parameters
    const radius = 2.5; // Wider orbit for giant avatar
    const speed = 1.5;  // Orbit speed
    const heightOffset = 5.0; // Above head but within camera frame
    
    // Constant large scale, modulated by the spawn animation
    const targetScale = 3.0 * this._spawnScale;
    this.group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 5.0);
    
    this.orbitAngle += delta * speed;

    // Calculate position relative to player
    const targetPos = player.position.clone();
    
    // Create a local right/forward basis from player's up vector
    const up = player.surfaceUp || new THREE.Vector3(0, 1, 0);
    const forward = player.forward || new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3().crossVectors(forward, up).normalize();

    // Calculate orbit offset
    const offsetX = Math.cos(this.orbitAngle) * radius;
    const offsetZ = Math.sin(this.orbitAngle) * radius;

    // High intensity light for giant avatar, faded by spawn animation
    const targetIntensity = 30.0 * this._spawnScale;
    const targetDistance = 45.0;
    this.light.intensity += (targetIntensity - this.light.intensity) * delta * 5.0;
    this.light.distance += (targetDistance - this.light.distance) * delta * 5.0;

    // Apply offset to target position using local basis
    const orbitOffset = new THREE.Vector3()
      .addScaledVector(right, offsetX)
      .addScaledVector(forward, offsetZ)
      .addScaledVector(up, heightOffset + Math.sin(elapsed * 2) * 0.2); // Hover bob

    targetPos.add(orbitOffset);

    // Smooth follow
    this.group.position.lerp(targetPos, Math.min(delta * 5.0, 1.0));
  }
}
