import * as THREE from 'three';
import { config, quality, IS_TOUCH } from './config.js';
import { Sizes } from './utils/Sizes.js';
import { Time } from './utils/Time.js';
import { Renderer } from './core/Renderer.js';
import { Camera } from './core/Camera.js';
import { PostFX } from './core/PostFX.js';
import { Physics } from './physics/Physics.js';
import { UI } from './ui/UI.js';
import { Input } from './controls/Input.js';
import { Audio } from './audio/Audio.js';
import { World } from './world/World.js';
import { AssetLoader } from './world/AssetLoader.js';
import { Animator } from './world/Animator.js';

/* Orchestrator for the stripped NikeBiomes3D fork.
   Drives the game loop, sphere-walking, and camera logic. */
export class Experience {
  constructor(canvas) {
    this.canvas = canvas;
    this.config = config;
    this.quality = quality;
    this.isTouch = IS_TOUCH;
    this.ready = false;

    this.controlTarget = new THREE.Vector3(0, 1, 7);

    this.sizes = new Sizes();
    this.time = new Time();
    this.scene = new THREE.Scene();
    this.camera = new Camera(this);
    this.renderer = new Renderer(this);
    this.postfx = new PostFX(this);
    this.audio = new Audio(this);
    this.ui = new UI(this);
    this.input = new Input(this);
    this.physics = new Physics(this);
    
    this.animator = new Animator();

    this.time.on('tick', ({ delta, elapsed }) => this._loop(delta, elapsed));
  }

  async init() {
    this.ui.setLoading(0.2, 'WAKING THE ENGINE…');
    this.assets = new AssetLoader();
    
    // Load all core assets and engines in parallel to cut load times in half
    await Promise.all([
      this.physics.init(),
      this.assets.preload(),
      this.audio.loadStems()
    ]);

    Object.entries(this.assets.cache).forEach(([key, asset]) => {
      if (asset && asset.animations && this.animator) {
        this.animator.extractAnimations(asset, key);
      }
    });

    this.ui.setLoading(0.75, 'BUILDING THE PLANET…');
    this.world = new World(this);
    
    if (this.world.splat) {
      // Volumetrics are now lazy-loaded, so we do not await them here.
      // They will pop in smoothly in the background.
    }
    
    // Attach audio to meshes
    if (this.world.podium && this.world.splat) {
      this.audio.attachStems(
        this.world.podium.group,
        this.world.splat.meshLeft,
        this.world.splat.meshRight
      );
    }
    
    // Attach listener to camera, but offset it forward so it physically sits at the avatar's location.
    // This makes stereo panning match the camera's rotation while preserving distance falloff!
    const listenerOffset = new THREE.Group();
    listenerOffset.position.z = -this.config.camera.distance; // Push it forward 16 units
    this.camera.instance.add(listenerOffset);
    this.audio.attachListener(listenerOffset);

    // Start ON FOOT in the showroom
    const p = this.world.player;
    p.surfaceUp.set(0, 1, 0);
    p.camForward.set(0, 0, -1);
    p.teleport(-35.99, 46.28); // Match the Player.js spawn
    p.flying = false;
    this.controlTarget.copy(p.chest);
    this.camera.setTarget(this.controlTarget);
    this.camera.snap();
    
    this.ui.setLoading(0.95, 'CATCHING THE LIGHT…');
    this.postfx.render(0);

    this.ready = true;
    this.ui.hideLoading();

    console.log("=== AVAILABLE ANIMATIONS ===");
    console.log(this.animator.getAvailableClips());
    console.log("============================");
  }

  toggleControl() {
    const p = this.world.player;
    p.flying = !p.flying;
  }

  goHome() {
    const p = this.world.player;
    p.teleport(0, 40);
    p.flying = false;
    this.controlTarget.copy(p.chest);
    this.camera.snap();
    this.ui.flash('HOME');
  }

  _loop(delta, elapsed) {
    if (!this.ready) return;

    const player = this.world.player;
    this.input.update();
    
    if (this.input.toggleVehicle) this.toggleControl();
    if (this.input.toggleAvatar && this.world.player) this.world.player.toggleAvatar();
    
    player.update(delta, this.input);
    
    // Step the physics world so kinematic translations actually apply!
    this.physics.step(delta);
    
    player.sync(delta, elapsed);
    
    // Tech Impact Collision Check with Constellation Swarm 
    // (Swarm sits at Y=20 with radius 30-250)
    if (this.world.orbs && this.audio) {
      const p = this.world.player;
      
      if (Math.hypot(p.position.x, p.position.y - 20, p.position.z) < 15) {
        if (!this._inSwarm) {
          this._inSwarm = true;
          // this.audio.playTechImpact(); // Disabled per user request
        }
      } else {
        this._inSwarm = false;
      }
    }
    if (this.world.env && this.world.env.moon) {
      const moon = this.world.env.moon;
      // Follow the player with the directional light to keep them inside the shadow map
      moon.position.set(player.position.x - 150, 50, player.position.z - 80);
      moon.target.position.copy(player.position);
      moon.target.updateMatrixWorld();
    }
    
    this.controlTarget.copy(player.chest);
    this.world.updateScenery(delta, elapsed);
    
    this.input.endFrame();
    
    this.camera.setTarget(this.controlTarget);
    this.camera.update(delta);
    
    this.audio.update(delta, !player.flying && player.speed > 0.6, player.grounded, player.speed);

    // Render using PostFX (handles its own internal mobile scaling via IS_TOUCH)
    let blurAmt = 0;
    if (player && player.flying) {
      blurAmt = Math.max(0, (player.speed - 15.0) / 50.0);
    }
    this.postfx.stylize.uniforms.uSpeed.value = blurAmt;
    this.postfx.render(elapsed);
    
    this.ui.updatePerf(delta);
  }
}
