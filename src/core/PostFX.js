import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { quality, IS_TOUCH } from '../config.js';

/* Y2K cinematic grade: bloom + chromatic aberration + film grain + vignette + scanlines */
const Y2KShader = {
  uniforms: {
    tDiffuse:    { value: null },
    uTime:       { value: 0 },
    uTexel:      { value: new THREE.Vector2(1/1280, 1/720) },
    uVignette:   { value: 0.55 },
    uAberration: { value: 0.0015 },
    uSpeed:      { value: 0.0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uAberration, uSpeed;
    uniform vec2 uTexel;
    varying vec2 vUv;

    float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

    void main(){
      vec2 uv = vUv;
      vec2 dir = uv - 0.5;

      // Fast Radial Motion Blur
      vec3 col = vec3(0.0);
      if (uSpeed > 0.01) {
        float totalWeight = 0.0;
        for(int i = 0; i < 7; i++) {
          float scale = 1.0 - float(i) * 0.015 * uSpeed;
          vec2 sampleUv = 0.5 + dir * scale;
          float w = pow(0.75, float(i));
          col += texture2D(tDiffuse, sampleUv).rgb * w;
          totalWeight += w;
        }
        col /= totalWeight;
      } else {
        col = texture2D(tDiffuse, uv).rgb;
      }

      // cinematic grade
      float l = luma(col);
      col = (col - 0.5) * 1.06 + 0.5;
      col += vec3(0.0, 0.0, 0.025) * (1.0 - l);  // cool shadows
      col += vec3(0.03, 0.015, -0.015) * l;        // warm highlights

      // vignette
      col *= clamp(1.0 - dot(dir, dir) * uVignette, 0.0, 1.0);

      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
};

export class PostFX {
  constructor(experience) {
    this.experience = experience;
    const { renderer, scene, camera, sizes } = experience;
    this.composer = new EffectComposer(renderer.instance);
    this.composer.setPixelRatio(sizes.pixelRatio);
    this.composer.setSize(sizes.width, sizes.height);
    this.composer.addPass(new RenderPass(scene, camera.instance));

    const bScale = IS_TOUCH ? 0.6 : 1.0;
    this._bloomScale = bScale;
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(sizes.width * bScale, sizes.height * bScale),
      IS_TOUCH ? 0.15 : 0.2,   // Reduced strength (was 0.4)
      0.5,                     // Radius
      IS_TOUCH ? 0.9 : 0.85    // Raised threshold so only very bright spots bloom (was 0.6)
    );
    this.bloom.enabled = quality.bloom;
    this.composer.addPass(this.bloom);

    this.stylize = new ShaderPass(Y2KShader);
    this.composer.addPass(this.stylize);
    this.composer.addPass(new OutputPass());
    this._setTexel();
    sizes.on('resize', () => this.resize());
  }
  _setTexel() {
    const { sizes } = this.experience;
    this.stylize.uniforms.uTexel.value.set(1 / (sizes.width * sizes.pixelRatio), 1 / (sizes.height * sizes.pixelRatio));
  }
  resize() {
    const { sizes } = this.experience;
    this.composer.setPixelRatio(sizes.pixelRatio);
    this.composer.setSize(sizes.width, sizes.height);
    this.bloom.setSize(sizes.width * this._bloomScale, sizes.height * this._bloomScale);
    this._setTexel();
  }
  setStyle() {} // API compat
  render(elapsed) {
    this.stylize.uniforms.uTime.value = elapsed;
    this.composer.render();
  }
}
