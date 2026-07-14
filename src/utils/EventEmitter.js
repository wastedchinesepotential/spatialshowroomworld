/* Minimal event bus. Modules emit/on without importing each other directly. */
export class EventEmitter {
  constructor() {
    this._listeners = new Map();
  }
  on(name, cb) {
    if (!this._listeners.has(name)) this._listeners.set(name, new Set());
    this._listeners.get(name).add(cb);
    return () => this.off(name, cb);
  }
  off(name, cb) {
    this._listeners.get(name)?.delete(cb);
  }
  emit(name, payload) {
    this._listeners.get(name)?.forEach((cb) => cb(payload));
  }
}
