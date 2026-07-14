export class Joystick {
  constructor() {
    this.x = 0; this.y = 0; this.magnitude = 0; this.active = false;
    this.radius = 52; this._ox = 0; this._oy = 0;
    this.el = document.createElement('div'); this.el.className = 'joystick';
    this.thumb = document.createElement('div'); this.thumb.className = 'joystick__thumb';
    this.el.appendChild(this.thumb); document.body.appendChild(this.el);
  }
  start(cx, cy) {
    this.active = true; this._ox = cx; this._oy = cy;
    this.el.style.left = `${cx}px`; this.el.style.top = `${cy}px`;
    this.el.classList.add('is-on'); this.move(cx, cy);
  }
  move(cx, cy) {
    let dx = cx - this._ox, dy = cy - this._oy;
    const dist = Math.hypot(dx, dy);
    if (dist > this.radius) { dx *= this.radius / dist; dy *= this.radius / dist; }
    this.thumb.style.transform = `translate(${dx}px, ${dy}px)`;
    this.x = dx / this.radius; this.y = dy / this.radius;
    this.magnitude = Math.min(dist / this.radius, 1);
  }
  end() {
    this.active = false; this.x = this.y = this.magnitude = 0;
    this.thumb.style.transform = 'translate(0,0)'; this.el.classList.remove('is-on');
  }
}
