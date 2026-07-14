import * as THREE from 'three';

export class Animator {
  constructor() { this.library = new Map(); }
  extractAnimations(gltf, fileKey = '') {
    if (!gltf || !gltf.animations) return;
    for (let i = 0; i < gltf.animations.length; i++) {
      const clip = gltf.animations[i];
      let name = (clip.name || '').toLowerCase().replace(/mixamo.com/gi, '').replace(/armature\|/gi, '').trim();
      
      if (!name || name === 'action' || name === 'armatureaction') {
        name = fileKey ? fileKey.toLowerCase() + (i > 0 ? `_${i}` : '') : 'unnamed_' + Math.floor(Math.random() * 1000);
      }
      
      const cleanClip = clip.clone();
      cleanClip.tracks = cleanClip.tracks.filter(t => !t.name.endsWith('.scale'));
      
      if (!this.library.has(name)) {
        this.library.set(name, cleanClip);
      }
      
      // Also register the first animation under the fileKey name directly, 
      // ensuring we can always fetch it by the filename we loaded it with.
      if (i === 0 && fileKey) {
        const keyName = fileKey.toLowerCase();
        if (!this.library.has(keyName)) {
          this.library.set(keyName, cleanClip);
        }
      }
    }
  }
  getClip(name) {
    if (!name) return null;
    name = name.toLowerCase();
    // 1. Try exact match first
    if (this.library.has(name)) {
      return this.library.get(name);
    }
    // 2. Loose fallback match
    for (let [key, clip] of this.library.entries()) {
      if (key.includes(name) || name.includes(key)) {
        return clip;
      }
    }
    return null;
  }
  getAvailableClips() { return Array.from(this.library.keys()); }
}
