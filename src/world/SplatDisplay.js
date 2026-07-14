import * as THREE from 'three';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';

export class SplatDisplay {
  constructor(experience) {
    this.experience = experience;
    this.loadPromises = [];
    
    // Create Left Splat
    this.viewerLeft = this._createViewer(-45, '/assets/EC_FRAME-SPLAT-CLIPPED.0000280.ply');
    
    // Create Right Splat (lower it even further)
    this.viewerRight = this._createViewer(45, '/assets/EC_FRAME-SPLAT-CLIPPED.0000024.ply', -6);
  }

  _createViewer(xPos, path, yPos = 0) {
    let viewer;
    try {
      viewer = new GaussianSplats3D.DropInViewer({
        sharedMemoryForWorkers: false,
        ignoreDevicePixelRatio: false,
      });
      
      viewer.position.set(xPos, yPos, 0); // Ground level, offset to left/right
      viewer.baseY = yPos; // Store base Y for bobbing
      this.experience.scene.add(viewer);
      
      const p = viewer.addSplatScene(path, {
        splatAlphaRemovalThreshold: 5,
        showLoadingUI: false,
        position: [0, 0, 0],    // Zeroed out local center for true turntable rotation
        rotation: [1, 0, 0, 0], // 180-degree rotation on X to flip it right-side up
        scale: [15, 15, 15]
      }).catch((err) => {
        console.warn("DropInViewer addSplatScene failed, falling back to standard Viewer", err);
        return this._fallbackViewer(xPos, path, yPos);
      });
      this.loadPromises.push(p);
      return viewer;
    } catch (e) {
      console.warn("DropInViewer not found in this library version. Falling back to standard Viewer.", e);
      return this._fallbackViewer(xPos, path, yPos);
    }
  }

  _fallbackViewer(xPos, path, yPos = 0) {
    const fallback = new GaussianSplats3D.Viewer({
      camera: this.experience.camera.instance,
      renderer: this.experience.renderer.instance,
      scene: this.experience.scene,
      useBuiltInControls: false,
      sharedMemoryForWorkers: false,
      ignoreDevicePixelRatio: false,
    });
    
    const p = fallback.addSplatScene(path, {
      showLoadingUI: false,
      position: [xPos, yPos, 0], // For the fallback viewer, we must apply global translation
      rotation: [1, 0, 0, 0],
      scale: [15, 15, 15]
    }).then(() => {
      fallback.start();
    });
    this.loadPromises.push(p);
    
    fallback.baseY = yPos;
    return fallback; // Note: fallback is not a THREE.Group, so we can't rotate it easily
  }

  update(delta, elapsed) {
    // Continuous rotation for left splat
    if (this.viewerLeft && this.viewerLeft.isGroup) {
      this.viewerLeft.rotation.y = elapsed * 0.3;
    } else if (this.viewerLeft && this.viewerLeft.update) {
      this.viewerLeft.update();
    }
    
    // Continuous opposite rotation for right splat, with independent bobbing
    if (this.viewerRight && this.viewerRight.isGroup) {
      this.viewerRight.rotation.y = elapsed * -0.3;
      this.viewerRight.position.y = (this.viewerRight.baseY || 0) + Math.sin(elapsed * 1.1 + 3.14) * 1.8;
    } else if (this.viewerRight && this.viewerRight.update) {
      this.viewerRight.update();
    }
  }
}
