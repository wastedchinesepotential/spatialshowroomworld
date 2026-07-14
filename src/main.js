import { Experience } from './Experience.js';

const canvas = document.getElementById('scene');

async function boot() {
  try {
    const experience = new Experience(canvas);
    await experience.init();
    // expose for tinkering from the console while prototyping
    window.WORLD = experience;
  } catch (err) {
    console.error('[WORLD] failed to start:', err);
    const status = document.getElementById('loading-status');
    if (status) {
      status.textContent = 'FAILED TO START — see console';
      status.style.color = '#d8607a';
    }
  }
}

boot();
