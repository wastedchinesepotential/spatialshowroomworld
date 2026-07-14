import { EventEmitter } from './EventEmitter.js';

export class Time extends EventEmitter {
  constructor() {
    super();
    this.start = performance.now();
    this.current = this.start;
    this.elapsed = 0;
    this.delta = 1 / 60;
    this.running = true;
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.current = performance.now();
    });
    requestAnimationFrame(() => this._tick());
  }
  _tick() {
    const now = performance.now();
    this.delta = Math.min(Math.max((now - this.current) / 1000, 0.008), 0.05);
    this.current = now;
    this.elapsed = (now - this.start) / 1000;
    if (!document.hidden) this.emit('tick', { delta: this.delta, elapsed: this.elapsed });
    requestAnimationFrame(() => this._tick());
  }
}
