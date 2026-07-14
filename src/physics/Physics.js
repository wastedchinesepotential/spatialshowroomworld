import RAPIER from '@dimforge/rapier3d-compat';
import { config } from '../config.js';

export class Physics {
  constructor(experience) {
    this.experience = experience;
    this.world = null;
    this.RAPIER = RAPIER;
  }
  async init() {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: -config.player.gravity, z: 0 });
  }
  addStaticBox(hx, hy, hz, x, y, z, rotationY = 0) {
    const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
    if (rotationY) {
      const h = rotationY / 2;
      desc.setRotation({ x: 0, y: Math.sin(h), z: 0, w: Math.cos(h) });
    }
    const body = this.world.createRigidBody(desc);
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz), body);
    return body;
  }
  step(dt) {
    if (!this.world) return;
    this.world.timestep = dt;
    this.world.step();
  }
}
