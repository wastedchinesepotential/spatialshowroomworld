import * as THREE from 'three';
import { config } from '../config.js';

/* Vehicle stub — the hoverboard from WorldDeTester, but minimal. On the planet
   it's driven by Player.flying (sphere mode). We keep just enough API so Experience
   doesn't crash when it references vehicle. */
export class Vehicle {
  constructor(experience) {
    this.experience = experience;
    this.mesh = new THREE.Group();
    this.seat = new THREE.Group();
    this.mesh.add(this.seat);

    // Flat board shape
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.08, 2.4),
      new THREE.MeshPhysicalMaterial({ color: 0x111122, metalness: 1, roughness: 0.1, clearcoat: 1 })
    );
    board.castShadow = true;
    this.mesh.add(board);

    // Glow strip
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.02, 2.0),
      new THREE.MeshBasicMaterial({ color: 0x00ffd5 })
    );
    strip.position.y = -0.05;
    this.mesh.add(strip);

    this.mesh.visible = false;
    experience.scene.add(this.mesh);

    this.body = null;
    this.position = new THREE.Vector3();
    this.chest = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, -1);
    this.up = new THREE.Vector3(0, 1, 0);
    this.heading = 0;
    this.speed = 0;
  }
  place() {}
  update() {}
  sync(pos) {
    if (pos) this.position.copy(pos);
    this.chest.copy(this.position).add(new THREE.Vector3(0, 1, 0));
  }
}
