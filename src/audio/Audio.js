import * as THREE from 'three';

export class Audio {
  constructor(experience) {
    this.experience = experience;
    this.started = false;
    this.enabled = true; // Music on by default
    
    this.listener = new THREE.AudioListener();
    this.listener.setMasterVolume(1); // Start unmuted
    
    // Robust AudioContext unlocker for all browsers
    const unlockAudio = () => {
      if (this.listener.context) {
        if (this.listener.context.state === 'suspended') {
          this.listener.context.resume();
        }
        if (this.listener.context.state === 'running') {
          window.removeEventListener('click', unlockAudio);
          window.removeEventListener('touchstart', unlockAudio);
          window.removeEventListener('keydown', unlockAudio);
        }
      }
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    this.stems = {};
    this.audioLoader = new THREE.AudioLoader();
  }
  
  async loadStems(onProgress) {
    const files = {
      splat1:  '/assets/sounds/palisade/05.31.26 palisade glames BASS.mp3', // Splat 1 is BASS
      shoe:    '/assets/sounds/palisade/05.31.26 palisade glames DRUGS.mp3', // Shoe is DRUGS
      splat2:  '/assets/sounds/palisade/05.31.26 palisade glames SNAT.mp3',
      impact:  '/assets/sounds/techimpact.wav'
    };
    
    const entries = Object.entries(files);
    let loaded = 0;
    
    await Promise.all(entries.map(([key, path]) => {
      return new Promise((resolve) => {
        this.audioLoader.load(
          path, 
          (buffer) => {
            this.stems[key] = buffer;
            loaded++;
            if (onProgress) onProgress(loaded / entries.length);
            resolve();
          },
          null, // onProgress
          (err) => {
            console.warn(`[Audio] Failed to load or decode: ${path}`, err);
            // RESOLVE anyway so we don't freeze the entire loading screen!
            resolve();
          }
        );
      });
    }));
  }
  
  attachListener(target) {
    target.add(this.listener);
  }
  
  attachStems(shoe, splat1, splat2) {
    this.started = true;
    
    // Tech Impact (SFX)
    if (this.stems.impact) {
      this.impactAudio = new THREE.PositionalAudio(this.listener);
      this.impactAudio.setBuffer(this.stems.impact);
      this.impactAudio.setRefDistance(6);
      this.impactAudio.setMaxDistance(30);
      this.impactAudio.setLoop(false);
      this.impactAudio.setVolume(1.0);
      this.experience.scene.add(this.impactAudio);
    }
    
    // Shoe (DRUGS)
    if (this.stems.shoe) {
      this.shoeAudio = new THREE.PositionalAudio(this.listener);
      this.shoeAudio.setBuffer(this.stems.shoe);
      this.shoeAudio.setRefDistance(12);
      this.shoeAudio.setMaxDistance(100);
      this.shoeAudio.setLoop(true);
      this.shoeAudio.setVolume(1.0);
      if (shoe && shoe.add) shoe.add(this.shoeAudio);
    }
    
    // Splat1 (BASS)
    if (this.stems.splat1) {
      this.splat1Audio = new THREE.PositionalAudio(this.listener);
      this.splat1Audio.setBuffer(this.stems.splat1);
      this.splat1Audio.setRefDistance(12);
      this.splat1Audio.setMaxDistance(100);
      this.splat1Audio.setLoop(true);
      this.splat1Audio.setVolume(1.0);
      if (splat1 && splat1.add) splat1.add(this.splat1Audio);
    }
    
    // Splat2 (SNAT)
    if (this.stems.splat2) {
      this.splat2Audio = new THREE.PositionalAudio(this.listener);
      this.splat2Audio.setBuffer(this.stems.splat2);
      this.splat2Audio.setRefDistance(12);
      this.splat2Audio.setMaxDistance(100);
      this.splat2Audio.setLoop(true);
      this.splat2Audio.setVolume(1.0);
      if (splat2 && splat2.add) splat2.add(this.splat2Audio);
    }
    
    // Start them all in sync
    if (this.shoeAudio) this.shoeAudio.play();
    if (this.splat1Audio) this.splat1Audio.play();
    if (this.splat2Audio) this.splat2Audio.play();
    
    // We connect raw AnalyserNodes directly to the gain nodes (BEFORE the 3D panner).
    // This makes the audio-reactivity completely immune to distance falloff!
    const ctx = this.listener.context;
    
    this.snatAnalyser = ctx.createAnalyser();
    this.snatAnalyser.fftSize = 32;
    // Connect to gain BEFORE the panner so it doesn't lose strength with distance
    if (this.splat2Audio) {
      this.splat2Audio.gain.connect(this.snatAnalyser);
    }
    this.snatData = new Uint8Array(this.snatAnalyser.frequencyBinCount);
  }

  toggle() {
    this.enabled = !this.enabled;
    
    // Resume context if suspended (browser autoplay policy)
    if (this.listener.context.state === 'suspended') {
      this.listener.context.resume();
    }
    
    // Smooth volume fade using Web Audio API
    const target = this.enabled ? 1.0 : 0.0;
    const now = this.listener.context.currentTime;
    this.listener.gain.gain.setTargetAtTime(target, now, 0.1);
    
    return this.enabled;
  }
  
  getAudioData() {
    if (!this.snatAnalyser || !this.enabled) return { beat: 0 };
    
    // --- SNAT BEAT (Size) ---
    this.snatAnalyser.getByteFrequencyData(this.snatData);
    let snatSum = 0;
    for (let i = 0; i < this.snatData.length; i++) snatSum += this.snatData[i];
    let avgSnat = (snatSum / this.snatData.length) / 255.0;
    
    // Multiply by a high factor to guarantee it jumps wildly
    let beat = Math.pow(avgSnat, 3.0) * 3.5; 
    if (beat < 0.05) beat = 0;
    
    return { beat };
  }
  
  playImpact(position) {
    if (!this.enabled || !this.impactAudio) return;
    
    const now = performance.now();
    // 2-second cooldown to prevent spamming
    if (this._lastImpact && (now - this._lastImpact < 2000)) return; 
    this._lastImpact = now;
    
    if (this.impactAudio.isPlaying) this.impactAudio.stop();
    
    // Play slightly above the player to give directional verticality
    this.impactAudio.position.copy(position);
    this.impactAudio.position.y += 3.0; 
    
    this.impactAudio.play();
  }
  
  footstep() {
    if (!this.enabled || !this.listener.context) return;
    
    const ctx = this.listener.context;
    if (ctx.state === 'suspended') return;
    
    const t = ctx.currentTime;
    
    // Low frequency thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    // Pitch envelope for the thud
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.1);
    
    // Volume envelope (subtle footprint sound)
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    
    osc.start(t);
    osc.stop(t + 0.1);
  }
  
  // Legacy stubs to prevent breaking older code calls
  start() {
    if (this.listener.context.state === 'suspended') {
      this.listener.context.resume();
    }
  }
  chime() {}
  
  update(delta, isWalking, grounded, speed) {
    if (!this.started || !this.enabled) return;

    // Simulate Doppler / Hyperspace pitch bend based on flight speed
    // (Disabled for now, keeping it in our back pocket)
    /*
    let targetPitch = 1.0;
    if (speed > 15) {
      targetPitch = 1.0 + ((speed - 15) / 50.0) * 0.3; 
    }
    
    const k = Math.min(delta * 4, 1);
    const currentRate = this.shoeAudio.getPlaybackRate() || 1.0;
    const newRate = currentRate + (targetPitch - currentRate) * k;

    if (this.shoeAudio.isPlaying) this.shoeAudio.setPlaybackRate(newRate);
    if (this.splat1Audio.isPlaying) this.splat1Audio.setPlaybackRate(newRate);
    if (this.splat2Audio.isPlaying) this.splat2Audio.setPlaybackRate(newRate);
    */
  }
}
