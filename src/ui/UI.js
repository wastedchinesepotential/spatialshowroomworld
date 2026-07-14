export class UI {
  constructor(experience) {
    this.experience = experience;
    this.loading = document.getElementById('loading');
    this.loadFill = document.getElementById('loading-fill');
    this.loadStatus = document.getElementById('loading-status');
    this.legend = document.getElementById('legend');
    this.prompt = document.getElementById('prompt');
    this.panel = document.getElementById('panel');
    this.perf = document.getElementById('perf');
    this.zoneBanner = document.getElementById('zone-banner');
    this.flashEl = document.getElementById('flash');
    this.rideBtn = document.getElementById('btn-vehicle');
    this.audioBtn = document.getElementById('btn-audio');
    this.focusEl = document.getElementById('focus');
    this._zoneTimer = null; this._flashTimer = null;
    document.getElementById('panel-close')?.addEventListener('click', () => this.closePanel());
    this.panel?.addEventListener('click', (e) => { if (e.target === this.panel) this.closePanel(); });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { this.experience.exitFocus?.(); this.closePanel(); }
    });
    this.focusEl?.addEventListener('pointerdown', (e) => { e.preventDefault(); this.experience.exitFocus?.(); });
    this._perfOn = false; this._fps = 60;
  }
  setLoading(p, status) {
    if (this.loadFill) {
      const circum = 289;
      this.loadFill.style.strokeDashoffset = circum - (p * circum);
    }
    if (status && this.loadStatus) this.loadStatus.textContent = status;
  }
  hideLoading() {
    this.setLoading(1, 'ENTER');
    setTimeout(() => this.loading?.classList.add('is-hidden'), 350);
  }
  setPrompt() {} hidePrompt() {}
  placePrompt() {}
  openPanel() {} closePanel() { this.panel?.classList.remove('is-on'); }
  showFocus() {} hideFocus() { this.focusEl?.classList.remove('is-on'); }
  setRide(on) { this.rideBtn?.classList.toggle('is-on', on); }
  showZone(name) {
    if (!this.zoneBanner) return;
    this.zoneBanner.textContent = `· ${name} ·`;
    this.zoneBanner.classList.add('is-on');
    clearTimeout(this._zoneTimer);
    this._zoneTimer = setTimeout(() => this.zoneBanner.classList.remove('is-on'), 2600);
  }
  flash(text) {
    if (!this.flashEl) return;
    this.flashEl.textContent = text;
    this.flashEl.classList.add('is-on');
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => this.flashEl.classList.remove('is-on'), 1400);
  }
  toggleAudio() { 
    const on = this.experience.audio?.toggle(); 
    if (this.audioBtn) {
      this.audioBtn.classList.toggle('is-off', !on); 
      this.audioBtn.innerHTML = '<span>♪</span>';
    }
  }
  togglePerf() { this._perfOn = !this._perfOn; this.perf?.classList.toggle('is-on', this._perfOn); }
  updatePerf(delta) {
    if (!this._perfOn) return;
    this._fps += (1 / delta - this._fps) * 0.1;
    if (this.perf) this.perf.textContent = `${String(Math.round(this._fps)).padStart(2, '0')} fps`;
  }
}
