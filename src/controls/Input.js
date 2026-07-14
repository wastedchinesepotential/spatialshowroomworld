import { Joystick } from './Joystick.js';
import { IS_TOUCH } from '../config.js';

export class Input {
  constructor(experience) {
    this.experience = experience;
    this.canvas = experience.canvas;
    this.camera = experience.camera;
    this.moveX = 0; this.moveZ = 0; this.strafeX = 0;
    this.run = false; this.jump = false; this.interact = false;
    this.toggleVehicle = false; this.toggleDrone = false; this.toggleAvatar = false; this.ascend = false; this._holdJump = false;
    this.keys = new Set(); this.joystick = new Joystick();
    this._joyId = null; this._lookId = null;
    this._lookLast = { x: 0, y: 0 }; this._lookMoved = 0; this._lookStart = 0;
    this._bindKeyboard(); this._bindPointer(); this._bindButtons();
  }
  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (this.experience.focusItem && !e.repeat) { this.experience.exitFocus(); return; }
      this.keys.add(k);
      if (this.experience.audio) this.experience.audio.start();
      if (k === ' ') { this.jump = true; e.preventDefault(); }
      if (k === 'q') this.descend = true;
      if (k === 'e' && !e.repeat) this.interact = true;
      if (k === 'f' && !e.repeat) this.toggleVehicle = true; // Flight toggle
      if (k === 'n') this.toggleAvatar = true;
      if (k === 'o') this.toggleDrone = true;
      if (k === 'm') this.experience.ui.toggleAudio();
      if (k === 'p') this.experience.ui.togglePerf();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }
  _bindPointer() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => this._onDown(e));
    c.addEventListener('pointermove', (e) => this._onMove(e));
    window.addEventListener('pointerup', (e) => this._onUp(e));
    window.addEventListener('pointercancel', (e) => this._onUp(e));
    c.addEventListener('wheel', (e) => { this.camera.zoom(e.deltaY * 0.01); e.preventDefault(); }, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  _onDown(e) {
    if (this.experience.audio) this.experience.audio.start();
    const touch = e.pointerType === 'touch';
    if (touch && e.clientX < window.innerWidth * 0.5 && this._joyId === null) {
      this._joyId = e.pointerId; this.joystick.start(e.clientX, e.clientY);
    } else if (this._lookId === null) {
      this._lookId = e.pointerId;
      this._lookLast.x = e.clientX; this._lookLast.y = e.clientY;
      this._lookMoved = 0; this._lookStart = performance.now();
    }
    try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
  }
  _onMove(e) {
    if (e.pointerId === this._joyId) { this.joystick.move(e.clientX, e.clientY); }
    else if (e.pointerId === this._lookId) {
      let dx = e.clientX - this._lookLast.x, dy = e.clientY - this._lookLast.y;
      
      if (IS_TOUCH) {
        dx *= 2.5; // Flat 2.5x look sensitivity boost on all touch gestures
        dy *= 2.5;
        if (this.joystick.active && this.joystick.y < -0.1) {
          const boost = 1.0 + (Math.abs(this.joystick.y) * 1.5);
          dx *= boost;
          dy *= boost;
        }
      }
      
      this.camera.orbit(dx, dy);
      this._lookMoved += Math.abs(dx) + Math.abs(dy);
      this._lookLast.x = e.clientX; this._lookLast.y = e.clientY;
    }
  }
  _onUp(e) {
    if (e.pointerId === this._joyId) { this.joystick.end(); this._joyId = null; }
    else if (e.pointerId === this._lookId) { this._lookId = null; }
  }
  _bindButtons() {
    const press = (id, fn) => document.getElementById(id)?.addEventListener('pointerdown', (e) => {
      e.preventDefault(); if (this.experience.audio) this.experience.audio.start(); fn();
    });
    press('btn-jump', () => { this.jump = true; });
    press('btn-vehicle', () => { this.toggleVehicle = true; });
    press('btn-drone', () => { this.toggleDrone = true; });
    press('btn-avatar', () => { this.toggleAvatar = true; });
    press('btn-home', () => { this.experience.goHome(); });
    press('btn-audio', () => { this.experience.ui.toggleAudio(); });
    document.getElementById('btn-jump')?.addEventListener('pointerdown', () => { this._holdJump = true; });
    window.addEventListener('pointerup', () => { this._holdJump = false; });
    window.addEventListener('pointercancel', () => { this._holdJump = false; });
    if (IS_TOUCH) {
      document.body.classList.add('is-touch');
      document.getElementById('legend')?.classList.add('is-hidden');
    }
  }
  isLooking() { return this._lookId !== null; }
  update() {
    let mx = 0, mz = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) mz += 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) mz -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) mx += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) mx -= 1;
    if (this.joystick.active) { mx += this.joystick.x; mz += -this.joystick.y; }
    
    let sx = 0;
    if (this.keys.has('e')) sx += 1;
    
    this.moveX = mx; this.moveZ = mz; this.strafeX = sx;
    this.run = this.keys.has('shift') || this.joystick.magnitude > 0.85;
    
    // One-shot dash trigger (restrict mobile dash to mostly forward movements)
    const canMobileDash = IS_TOUCH ? (this.joystick.y < -0.3) : true;
    if (this.run && !this._wasRun && canMobileDash) this.dash = true;
    this._wasRun = this.run;
    
    this.ascend = this.keys.has(' ') || this._holdJump;
    this.descend = this.keys.has('q');
  }
  endFrame() { this.jump = false; this.dash = false; this.interact = false; this.toggleVehicle = false; this.toggleDrone = false; this.toggleAvatar = false; }
}
