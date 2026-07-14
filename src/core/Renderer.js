import * as THREE from 'three';
import { config } from '../config.js';

export class Renderer {
  constructor(experience) {
    this.experience = experience;
    const { canvas, sizes } = experience;
    this.instance = new THREE.WebGLRenderer({
      canvas, antialias: sizes.pixelRatio < 1.5,
      powerPreference: 'high-performance', stencil: false,
    });
    this.instance.setSize(sizes.width, sizes.height);
    this.instance.setPixelRatio(sizes.pixelRatio);
    this.instance.shadowMap.enabled = true;
    this.instance.shadowMap.type = THREE.PCFSoftShadowMap;
    this.instance.toneMapping = THREE.ACESFilmicToneMapping;
    this.instance.toneMappingExposure = config.exposure;
    this.instance.setClearColor(config.color.fog, 1);
    sizes.on('resize', () => this.resize());
  }
  resize() {
    const { sizes } = this.experience;
    this.instance.setSize(sizes.width, sizes.height);
    this.instance.setPixelRatio(sizes.pixelRatio);
  }
}
