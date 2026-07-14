import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* Loads the Rylee avatar + walk animation GLB.
   Using the same BRYPPGwalk for the walk loop and RyleePunk as the avatar mesh. */
const GLB = {
  avatar: './public/assets/RyleePunkOptimized.glb',
  avatarNew: './public/assets/bryanwifebeaterRUNTESTMOBILE.glb',
  idleAnim: './public/assets/BRYPPGIDLEGLB.glb',
  wanderAnim: './public/assets/animations/wander.glb',
  flightIdle: './public/assets/FLIGHT/flightidle.glb',
  flyingLoop: './public/assets/FLIGHT/flyingforward.glb',
  flyBoost: './public/assets/FLIGHT/flyboost.glb',
  shoe: './public/assets/jordancactus.glb',
};

export class AssetLoader {
  constructor() { this.gltf = new GLTFLoader(); this.cache = {}; }
  _loadGLB(key, url) {
    return new Promise((resolve) => {
      this.gltf.load(url,
        (g) => { this.cache[key] = g; resolve(g); },
        undefined,
        (e) => { console.warn('[AssetLoader] GLB failed:', key, e); resolve(null); });
    });
  }
  async preload(onProgress) {
    const jobs = Object.entries(GLB).map(([k, u]) => () => this._loadGLB(k, u));
    let done = 0;
    await Promise.all(jobs.map((j) => j().then((r) => { onProgress?.(++done / jobs.length); return r; })));
  }
  get(key) { return this.cache[key] || null; }
}
