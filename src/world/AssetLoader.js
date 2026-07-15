import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* Loads the Rylee avatar + walk animation GLB.
   Using the same BRYPPGwalk for the walk loop and RyleePunk as the avatar mesh. */
const GLB = {
  avatar: '/assets/RyleePunkOptimized.glb',
  avatarNew: '/assets/bryanwifebeaterRUNTESTMOBILE.glb',
  idleAnim: '/assets/BRYPPGIDLEGLB.glb',
  wanderAnim: '/assets/animations/wander.glb',
  flightIdle: '/assets/FLIGHT/flightidle.glb',
  flyingLoop: '/assets/FLIGHT/flyingforward.glb',
  flyBoost: '/assets/FLIGHT/flyboost.glb',
  shoe: '/assets/cactusjackmerged-compressed.glb',
};

import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export class AssetLoader {
  constructor() { 
    this.gltf = new GLTFLoader(); 
    
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    this.gltf.setDRACOLoader(dracoLoader);
    
    this.cache = {}; 
  }
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
