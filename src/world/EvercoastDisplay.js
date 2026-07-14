import * as THREE from 'three';
import * as Evercoast from '@evercoast/three';

export class EvercoastDisplay {
  constructor(experience) {
    this.experience = experience;
    this.loadPromises = [];
    
    const playerApiConfig = new Evercoast.PlayerApiConfig();
    playerApiConfig.maxFramerate = 30;

    this.playerApiLeft = Evercoast.createPlayerApi(this.experience.renderer.instance, playerApiConfig);
    this.playerApiLeft.loop = true;
    this.playerApiLeft.muted = true;
    
    this.playerApiRight = Evercoast.createPlayerApi(this.experience.renderer.instance, playerApiConfig);
    this.playerApiRight.loop = true;
    this.playerApiRight.muted = true;

    this.playerApiBack = Evercoast.createPlayerApi(this.experience.renderer.instance, playerApiConfig);
    this.playerApiBack.loop = true;
    this.playerApiBack.muted = true;
    
    // Create Left Volumetric
    this.meshLeft = null;
    const pLeft = this.playerApiLeft.open('https://streaming.evercoast.com/RLab/test.BryantestRy.ec.take.001/25607/ecz_med/test.BryantestRy.ec.take.001.med.ecz')
      .then(mesh => {
        this.meshLeft = mesh;
        mesh.position.set(-45, 0, 0); 
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.scale.set(0.01, 0.01, 0.01); // Start invisible for fade-in
        this.experience.scene.add(mesh);
        if (this.playerApiLeft.play) this.playerApiLeft.play().catch(() => {});
      });
    this.loadPromises.push(pLeft);
      
    // Create Right Volumetric
    this.meshRight = null;
    const pRight = this.playerApiRight.open('https://streaming.evercoast.com/RLab/GADemo.bryan.ec.take.002/26065/ecz_med/GADemo.bryan.ec.take.002.med.ecz')
      .then(mesh => {
        this.meshRight = mesh;
        mesh.position.set(45, 0, 0); 
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.scale.set(0.01, 0.01, 0.01); // Start invisible for fade-in
        this.experience.scene.add(mesh);
        if (this.playerApiRight.play) this.playerApiRight.play().catch(() => {});
      });
    this.loadPromises.push(pRight);

    // Create Back Volumetric
    this.meshBack = null;
    const pBack = this.playerApiBack.open('https://streaming.evercoast.com/RLab/Bryan.Run.ec.take.002/25030/ecz_med/Bryan.Run.ec.take.002.med.ecz')
      .then(mesh => {
        this.meshBack = mesh;
        mesh.position.set(0, 0, -45); 
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.scale.set(0.01, 0.01, 0.01); // Start invisible for fade-in
        this.experience.scene.add(mesh);
        if (this.playerApiBack.play) this.playerApiBack.play().catch(() => {});
      });
    this.loadPromises.push(pBack);

    window.addEventListener('pointerdown', () => {
      if (this.playerApiLeft && this.playerApiLeft.play) this.playerApiLeft.play().catch(() => {});
      if (this.playerApiRight && this.playerApiRight.play) this.playerApiRight.play().catch(() => {});
      if (this.playerApiBack && this.playerApiBack.play) this.playerApiBack.play().catch(() => {});
    }, { once: true });
  }

  update(delta, elapsed) {
    if (this.playerApiLeft && this.playerApiLeft.update) this.playerApiLeft.update(delta);
    if (this.playerApiRight && this.playerApiRight.update) this.playerApiRight.update(delta);
    if (this.playerApiBack && this.playerApiBack.update) this.playerApiBack.update(delta);

    // Smooth scaling fade-in & continuous rotation
    if (this.meshLeft) {
      this.meshLeft.rotation.y = elapsed * 0.3;
      if (this.meshLeft.scale.x < 14.9) {
        this.meshLeft.scale.lerp(new THREE.Vector3(15, 15, 15), delta * 2.0);
      }
    }
    if (this.meshRight) {
      this.meshRight.rotation.y = elapsed * -0.3;
      if (this.meshRight.scale.x < 14.9) {
        this.meshRight.scale.lerp(new THREE.Vector3(15, 15, 15), delta * 2.0);
      }
    }
    if (this.meshBack) {
      this.meshBack.rotation.y = elapsed * 0.3;
      if (this.meshBack.scale.x < 14.9) {
        this.meshBack.scale.lerp(new THREE.Vector3(15, 15, 15), delta * 2.0);
      }
    }
  }
}
