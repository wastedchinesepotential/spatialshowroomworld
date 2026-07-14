import * as THREE from 'three';
import { IS_TOUCH } from '../config.js';

export class Podium {
  constructor(experience) {
    this.experience = experience;
    this.group = new THREE.Group();
    this.experience.scene.add(this.group);

    this.uniforms = { uTime: { value: 0 } };

    this._buildSneaker();
  }

  _applyLiquidShader(mat) {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uniforms.uTime;

      shader.vertexShader = `
        uniform float uTime;
        
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
        // Moderate displacement for the podium/sneaker so they still look structural
        float disp = fbm(position * 0.15 + uTime * 0.4) * 0.5;
        vec3 displacedPosition = position + normal * disp;

        float eps = 0.1;
        vec3 tangent1 = normalize(cross(normal, vec3(0.0, 1.0, 0.0)));
        if (length(tangent1) < 0.001) tangent1 = normalize(cross(normal, vec3(1.0, 0.0, 0.0)));
        vec3 tangent2 = normalize(cross(normal, tangent1));

        vec3 pos1 = position + tangent1 * eps;
        vec3 pos2 = position + tangent2 * eps;
        
        float disp1 = fbm(pos1 * 0.15 + uTime * 0.4) * 0.5;
        float disp2 = fbm(pos2 * 0.15 + uTime * 0.4) * 0.5;

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
        `
      );
    };
  }

  _buildSneaker() {
    this.sneaker = new THREE.Group();
    this.sneaker.position.set(0, 8, 0); // Hovering in the air
    
    const gltf = this.experience.assets.get('shoe');
    if (gltf && gltf.scene) {
      const model = gltf.scene;
      
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      
      // Make the shoe 2x massive (length ~ 24)
      const scale = 24.0 / maxDim;
      model.scale.setScalar(scale);
      
      // Center the model directly on the floor
      const center = box.getCenter(new THREE.Vector3());
      model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
      
      const colors = new Set();
      
      model.traverse((child) => {
        if (child.isMesh) {
          if (child.material) {
             let hex = '#ffffff';
             if (child.material.color) {
               hex = '#' + child.material.color.getHexString();
               colors.add(hex);
             }
             
             // Convert to particles instead of a solid mesh
             const pointsMat = new THREE.PointsMaterial({
               color: hex,
               size: 0.15,
               sizeAttenuation: true,
               transparent: true,
               opacity: 0.9
             });
             
             // Make particles perfectly circular
             pointsMat.onBeforeCompile = (shader) => {
               shader.fragmentShader = shader.fragmentShader.replace(
                 `#include <map_particle_fragment>`,
                 `
                 #include <map_particle_fragment>
                 if (length(gl_PointCoord - vec2(0.5)) > 0.5) discard;
                 `
               );
             };
             
             const points = new THREE.Points(child.geometry, pointsMat);
             points.position.copy(child.position);
             points.rotation.copy(child.rotation);
             points.scale.copy(child.scale);
             
             child.parent.add(points);
             child.visible = false; // Hide the original rough mesh
          }
        }
      });
      
      console.log('--- Shoe Colors Data ---');
      console.log(Array.from(colors));
      console.log('------------------------');
      
      this.sneaker.add(model);
      
    } else {
      // Sleek geometric placeholder sneaker (fallback)
      const matParams = { color: 0xff4400, metalness: 0.3, roughness: 0.4 };
      if (!IS_TOUCH) { matParams.clearcoat = 1.0; matParams.clearcoatRoughness = 0.1; }
      const mat = IS_TOUCH ? new THREE.MeshStandardMaterial(matParams) : new THREE.MeshPhysicalMaterial(matParams);
      
      const matWhite = IS_TOUCH ? 
        new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.8 }) : 
        new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.8 });

      this._applyLiquidShader(mat); this._applyLiquidShader(matWhite);

      const soleGeo = new THREE.BoxGeometry(4, 1, 10);
      const sole = new THREE.Mesh(soleGeo, matWhite); sole.position.y = 0.5; sole.castShadow = true;
      const upperGeo = new THREE.BoxGeometry(3.8, 2.5, 8);
      const upper = new THREE.Mesh(upperGeo, mat); upper.position.set(0, 2.25, -0.5); upper.castShadow = true;
      const toeGeo = new THREE.CylinderGeometry(1.9, 1.9, 3.8, 32);
      const toe = new THREE.Mesh(toeGeo, mat); toe.rotation.z = Math.PI / 2; toe.position.set(0, 2.25, 3.5); toe.castShadow = true;
      const topGeo = new THREE.BoxGeometry(3.6, 3, 3);
      const top = new THREE.Mesh(topGeo, mat); top.position.set(0, 4.5, -2.5); top.rotation.x = -0.2; top.castShadow = true;

      this.sneaker.add(sole, upper, toe, top);
      this.sneaker.scale.setScalar(2.0);
    }
    
    this.group.add(this.sneaker);
  }

  update(delta, elapsed) {
    this.uniforms.uTime.value = elapsed;
    
    // Add dynamic floating bob to the sneaker
    if (this.sneaker) {
      this.sneaker.position.y = 8 + Math.sin(elapsed * 1.5) * 1.5;
      this.sneaker.rotation.y = elapsed * 0.2;
      
      // Optionally rotate the sole particles slightly
      if (this.soleParticles) {
        this.soleParticles.rotation.y = elapsed * 0.2;
      }
    }
  }
}
