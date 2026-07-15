import { config } from '../config.js';
import { Environment } from './Environment.js';
import { Player } from './Player.js';
import { ShowroomFloor } from './ShowroomFloor.js';
import { FloatingOrbs } from './FloatingOrbs.js';
import { Drone } from './Drone.js';
import { Sparks } from './Sparks.js';
import { Podium } from './Podium.js';
import { Footsteps } from './Footsteps.js';
import { EvercoastDisplay } from './EvercoastDisplay.js';
import { Constellations } from './Constellations.js';
import { SpiritBomb } from './SpiritBomb.js';

export class World {
  constructor(experience) {
    this.experience = experience;
    this.scene = experience.scene;

    this.environment = new Environment(experience);
    this.player = new Player(experience);
    this.ground = new ShowroomFloor(experience);
    this.podium = new Podium(experience);
    
    this.orbs = new FloatingOrbs(experience);
    this.drone = new Drone(experience);
    this.spiritBomb = new SpiritBomb(experience);
    this.sparks = new Sparks(experience);
    this.footsteps = new Footsteps(experience);
    
    // Load the Gaussian Splat
    this.splat = new EvercoastDisplay(experience);
    
    // Load the rotating starfield
    this.constellations = new Constellations(experience);

    experience.player = this.player;
  }

  updateScenery(delta, elapsed) {
    this.environment.update(delta, elapsed);
    if (this.podium) this.podium.update(delta, elapsed);
    this.ground.update(delta, elapsed, this.player?.position);
    this.orbs.update(delta, elapsed);
    if (this.drone) this.drone.update(delta, elapsed);
    
    // Check for Spirit Bomb cast
    const input = this.experience.input;
    if (input && input.castBomb && this.drone && this.drone.activeCount === 5) {
      this.spiritBomb.cast();
    }
    
    if (this.spiritBomb) this.spiritBomb.update(delta, elapsed);
    
    if (this.sparks) this.sparks.update(delta, elapsed);
    if (this.footsteps) this.footsteps.update(delta, elapsed);
    if (this.splat) this.splat.update(delta, elapsed);
    if (this.constellations) this.constellations.update(delta, elapsed);
  }
}
