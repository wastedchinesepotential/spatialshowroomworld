import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { config, quality, IS_TOUCH } from '../config.js';

export class Environment {
  constructor(experience) {
    this.experience = experience;
    this.scene = experience.scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this._fog();
    this._lights();
  }

  _fog() {
    this.scene.fog = new THREE.FogExp2(0x1a264a, 0.012); // Slightly brighter blue hour fog
    this.scene.background = new THREE.Color(0x1a264a);   // Slightly brighter blue hour sky
  }

  _lights() {
    // Ambient bounce light
    const fill = new THREE.AmbientLight(0x887799, 2.1); // Warmer, 30% lower ambient
    this.experience.scene.add(fill);

    // Moonlight / Sun replacement
    this.moon = new THREE.DirectionalLight(0xff9944, 1.75); // Warm sunset orange, 30% lower
    // Lowered Y from 50 to 15 to stretch and widen the ground reflection!
    this.moon.position.set(-150, 15, -80).applyAxisAngle(new THREE.Vector3(0, 1, 0), -60 * Math.PI / 180);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    this.moon.shadow.camera.left = -250;
    this.moon.shadow.camera.right = 250;
    this.moon.shadow.camera.top = 250;
    this.moon.shadow.camera.bottom = -250;
    this.moon.shadow.camera.far = 1000;
    this.experience.scene.add(this.moon);
    this.experience.scene.add(this.moon.target);

    // Cool Rim Light for Chiaroscuro Contrast
    const rimLight = new THREE.DirectionalLight(0x88ccff, 1.2); // Cool cyan/blue
    // Lowered Y from 30 to 10 to stretch and widen the ground reflection!
    rimLight.position.set(150, 10, 80).applyAxisAngle(new THREE.Vector3(0, 1, 0), -60 * Math.PI / 180);
    this.experience.scene.add(rimLight);

    // Giant overhead spotlight for the shoe area
    this.podiumLight = new THREE.SpotLight(0xffeedd, 2800); // Warm white, 30% lower
    this.podiumLight.position.set(80, 70, 100); // Raised slightly from 40 to 70
    this.podiumLight.angle = Math.PI / 8;
    this.podiumLight.penumbra = 0.5;      
    this.podiumLight.decay = 2;
    this.podiumLight.distance = 300;
    this.podiumLight.castShadow = true;
    this.podiumLight.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    this.podiumLight.shadow.bias = -0.0001;
    
    const target = new THREE.Object3D();
    target.position.set(0, 5, 0); // Aim at sneaker
    this.scene.add(target);
    this.podiumLight.target = target;
    
    this.group.add(this.podiumLight);

    // Dynamic Player Light (Follows player slightly from above)
    this.playerLight = new THREE.SpotLight(0xcc88ff, 300); // Purple rim light for contrast
    this.playerLight.angle = Math.PI / 4;
    this.playerLight.penumbra = 0.5;
    this.playerLight.decay = 2;
    this.playerLight.distance = 150;
    this.playerLight.castShadow = true;
    this.playerLight.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    this.playerLight.shadow.bias = -0.0004;
    this.group.add(this.playerLight, this.playerLight.target);
  }

  update(delta, elapsed) {
    const t = this.experience.controlTarget;
    if (t) {
      if (this.playerLight) {
        this.playerLight.target.position.copy(t);
        this.playerLight.position.copy(t).add(new THREE.Vector3(10, 30, 10));
      }
    }
  }
}
