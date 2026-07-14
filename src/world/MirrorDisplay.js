import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

export class MirrorDisplay {
  constructor(experience) {
    this.experience = experience;
    this.group = new THREE.Group();
    this.experience.scene.add(this.group);
    
    // Position it near spawn (spawn is x=0, z=7)
    // Place it to the left, angled towards the spawn
    this.group.position.set(-4, 0, 5);
    this.group.rotation.y = Math.PI / 4; 
    
    // Create the mirror
    // Make it quite large to accommodate the big avatar!
    const width = 6;
    const height = 9;
    const geo = new THREE.PlaneGeometry(width, height);
    
    this.mirror = new Reflector(geo, {
      clipBias: 0.003,
      textureWidth: 1024,
      textureHeight: 1024,
      color: 0x8899a6
    });
    this.mirror.position.y = height / 2;
    this.group.add(this.mirror);
    
    // Add a sleek chrome frame
    const frameGeo = new THREE.BoxGeometry(width + 0.4, height + 0.4, 0.1);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 1.0,
      roughness: 0.1
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.y = height / 2;
    frame.position.z = -0.06;
    this.group.add(frame);
    
    // Add cinematic lighting (Neon Cyan + Warm Orange)
    
    // Main spotlight pointing where the player stands
    this.spotLight = new THREE.SpotLight(0xffddaa, 20, 15, Math.PI / 4, 0.5, 1);
    this.spotLight.position.set(0, height + 1, 2);
    this.spotLight.target.position.set(0, height / 2, 4);
    this.spotLight.castShadow = true;
    this.group.add(this.spotLight);
    this.group.add(this.spotLight.target);
    
    // Neon strips on the sides
    const stripGeo = new THREE.CylinderGeometry(0.04, 0.04, height + 0.4, 8);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0x00ffd5 });
    
    const leftStrip = new THREE.Mesh(stripGeo, stripMat);
    leftStrip.position.set(-(width / 2 + 0.2), height / 2, 0.05);
    this.group.add(leftStrip);
    
    const rightStrip = new THREE.Mesh(stripGeo, stripMat);
    rightStrip.position.set((width / 2 + 0.2), height / 2, 0.05);
    this.group.add(rightStrip);
    
    // Point lights mimicking the neon strips casting light on the player
    const leftLight = new THREE.PointLight(0x00ffd5, 10, 8, 2);
    leftLight.position.set(-(width / 2 + 0.5), height / 2, 1.0);
    this.group.add(leftLight);
    
    const rightLight = new THREE.PointLight(0x00ffd5, 10, 8, 2);
    rightLight.position.set((width / 2 + 0.5), height / 2, 1.0);
    this.group.add(rightLight);
  }
}
