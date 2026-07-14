import * as THREE from 'three';
import { config } from '../config.js';

export class Camera {
  constructor(experience) {
    this.experience = experience;
    const { sizes, scene } = experience;
    this.instance = new THREE.PerspectiveCamera(config.camera.fov, sizes.width / sizes.height, 0.1, 1000);
    this.instance.position.set(0, 8, 14);
    scene.add(this.instance);
    this.yaw = -0.21;
    this.pitch = -0.06;
    this.distance = config.camera.distance;
    this.target = new THREE.Vector3(0, 1, 0);
    this._desired = new THREE.Vector3();
    this._lookAt = new THREE.Vector3();
    sizes.on('resize', () => this.resize());
  }
  resize() {
    const { sizes } = this.experience;
    this.instance.aspect = sizes.width / sizes.height;
    this.instance.updateProjectionMatrix();
  }
  setTarget(v) { this.target.copy(v); }
  orbit(dx, dy) {
    this.yaw -= dx * config.camera.yawSpeed;
    this.pitch += dy * config.camera.pitchSpeed;
    this.pitch = Math.min(Math.max(this.pitch, config.camera.pitchMin), config.camera.pitchMax);
  }
  zoom(delta) {
    this.distance = Math.min(Math.max(this.distance + delta, config.camera.minDist), config.camera.maxDist);
  }
  getYaw() { return this.yaw; }
  update(dt = 0.016) {
    const cosP = Math.cos(this.pitch);

    this._desired.set(
      this.target.x + Math.sin(this.yaw) * cosP * this.distance,
      this.target.y + config.camera.height + Math.sin(this.pitch) * this.distance,
      this.target.z + Math.cos(this.yaw) * cosP * this.distance
    );
    const lerpFactor = 1.0 - Math.pow(1.0 - config.camera.damping, dt * 60);
    this.instance.position.lerp(this._desired, lerpFactor);
    
    this._lookAt.set(this.target.x, this.target.y, this.target.z);
    this.instance.lookAt(this._lookAt);
  }
  snap() {
    const cosP = Math.cos(this.pitch);
    this._desired.set(
      this.target.x + Math.sin(this.yaw) * cosP * this.distance,
      this.target.y + config.camera.height + Math.sin(this.pitch) * this.distance,
      this.target.z + Math.cos(this.yaw) * cosP * this.distance
    );
    this.instance.position.copy(this._desired);
    this._lookAt.set(this.target.x, this.target.y + 0.8, this.target.z);
    this.instance.lookAt(this._lookAt);
  }
  followSphere(target, forward, up, dist, height) {
    this._desired.copy(target).addScaledVector(forward, -dist).addScaledVector(up, height);
    this.instance.position.lerp(this._desired, config.camera.damping);
    this.instance.up.copy(up);
    this.instance.lookAt(target);
  }
  followWalk(target, forward, up, dist) {
    const height = config.camera.height + this.pitch * 3.0;
    this._desired.copy(target).addScaledVector(forward, -dist).addScaledVector(up, height);
    this.instance.position.lerp(this._desired, config.camera.damping);
    this.instance.up.copy(up);
    this._lookAt.copy(target);
    this.instance.lookAt(this._lookAt);
  }
}
