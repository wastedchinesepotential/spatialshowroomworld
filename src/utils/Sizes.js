import { EventEmitter } from './EventEmitter.js';
import { quality } from '../config.js';

export class Sizes extends EventEmitter {
  constructor() {
    super();
    this.update();
    window.addEventListener('resize', () => { this.update(); this.emit('resize'); });
    window.addEventListener('orientationchange', () => {
      setTimeout(() => { this.update(); this.emit('resize'); }, 200);
    });
  }
  update() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, quality.pixelRatioMax);
  }
}
