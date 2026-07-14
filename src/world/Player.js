import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { config } from '../config.js';
import { orientTo } from './sphere.js';

const DEG = Math.PI / 180;
const PITCH_AXIS = new THREE.Vector3(1, 0, 0);

export class Player {
  constructor(experience) {
    this.experience = experience;
    const RAPIER = experience.physics.RAPIER;

    const r = config.player.radius;
    const halfH = (config.player.height - 2 * r) / 2;
    this.centerY = halfH + r;

    const spawn = { x: -35.99, y: 2.86, z: 46.28 };
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(spawn.x, spawn.y, spawn.z);
    this.body = experience.physics.world.createRigidBody(bodyDesc);
    this.collider = experience.physics.world.createCollider(
      RAPIER.ColliderDesc.capsule(halfH, r), this.body
    );

    this.controller = experience.physics.world.createCharacterController(0.02);
    this.controller.enableAutostep(0.5, 0.2, true);
    this.controller.enableSnapToGround(0.4);
    this.controller.setMaxSlopeClimbAngle(50 * DEG);
    this.controller.setMinSlopeSlideAngle(38 * DEG);
    this.controller.setApplyImpulsesToDynamicBodies(true);

    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.grounded = false;
    this.mounted = false;
    this.facing = -0.53;
    this.speed = 0;

    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._move = new THREE.Vector3();
    this.position = new THREE.Vector3().copy(spawn);
    this.chest = new THREE.Vector3();

    this.surfaceUp = new THREE.Vector3(0, 1, 0);
    this.headingV  = new THREE.Vector3(0, 0, -1);
    this.forward   = new THREE.Vector3(0, 0, -1);
    this.camForward = new THREE.Vector3(0, 0, -1);
    this._prevCamYaw = 0;
    this.sunTangent = new THREE.Vector3(0.8, 0, 0.6);
    this.altitude  = 0;
    this.flying    = false;
    this._cf = new THREE.Vector3(); this._cr = new THREE.Vector3();
    this._md = new THREE.Vector3(); this._axis = new THREE.Vector3();
    this._sq = new THREE.Quaternion();

    this._buildMesh();
  }

  _buildMesh() {
    this.mesh = new THREE.Group();
    this.experience.scene.add(this.mesh);
    this._useNewAvatar = true;
    this._loadCurrentAvatar();
  }

  toggleAvatar() {
    this._useNewAvatar = !this._useNewAvatar;
    if (this.modelRoot) {
      this.mesh.remove(this.modelRoot);
      this.modelRoot = null;
    }
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }
    this._loadCurrentAvatar();
  }

  _loadCurrentAvatar() {
    const avatarKey = this._useNewAvatar ? 'avatarNew' : 'avatar';
    const gltf = this.experience.assets?.get(avatarKey);
    const idleGltf = this.experience.assets?.get('idleAnim');
    const wanderGltf = this.experience.assets?.get('wanderAnim');

    if (gltf && gltf.scene) {
      const anims = [];
      if (gltf.animations) anims.push(...gltf.animations);
      if (idleGltf && idleGltf.animations) anims.push(...idleGltf.animations);
      if (wanderGltf && wanderGltf.animations) anims.push(...wanderGltf.animations);
      
      if (this.experience.animator && anims.length > 0) {
        this.experience.animator.extractAnimations({ animations: anims }, null);
      }
      const box = new THREE.Box3().setFromObject(gltf.scene);
      this._useModel({ scene: SkeletonUtils.clone(gltf.scene), animations: anims, box: box });
    }
    else this._proceduralFigure();
  }

  _useModel(gltf) {
    const model = gltf.scene;
    model.traverse((o) => { 
      if (o.isMesh) { 
        o.castShadow = true; 
        o.frustumCulled = false; 
        o.renderOrder = 2; 
        
        // Brighten Avatar 2's texture inherently so it catches more light
        if (this._useNewAvatar && o.material && o.material.color) {
          // Multiply base color (1.2x for desktop, 1.08x for mobile)
          const boost = this.experience.isTouch ? 1.08 : 1.2;
          o.material.color.multiplyScalar(boost);
          // Optional: give it a very subtle emissive glow so it's never fully black in shadow
          o.material.emissive = new THREE.Color(0x1a1a1a);
        }
      } 
    });

    const box = gltf.box || new THREE.Box3().setFromObject(model);
    let minY = isFinite(box.min.y) ? box.min.y : 0;
    let height = isFinite(box.max.y) ? (box.max.y - minY) : 1.8;
    if (height <= 0.01) height = 1.8;
    
    // Scale the model to fit the physics capsule
    let s = config.player.height / height;
    
    if (this._useNewAvatar) {
      // The new Bryan model has a glitched bounding box that makes it scale massively out of control.
      // We manually lock its scale to 3.9 (30% larger than 3.0)
      s = 3.9;
    }
    
    model.scale.setScalar(s);
    
    // Center the model's feet at 0
    model.position.y = this._useNewAvatar ? 0 : -minY * s;
    
    if (this._useNewAvatar) {
      // Remove any y-offset so the feet rest naturally at 0
      // model.position.y += 0.0;
    }

    this.modelRoot = new THREE.Group();
    this.modelRoot.rotation.y = config.player.modelYaw;
    this.modelRoot.add(model);
    this.mesh.add(this.modelRoot);

    const want = config.player.animClip?.toLowerCase() || 'walk';
    this.mixer = new THREE.AnimationMixer(model);

    let walkClip = null, runClip = null, idleClip = null;

    if (gltf.animations) {
      idleClip = gltf.animations.find((c) => (c.name || '').toLowerCase().includes('idle'));
      if (!idleClip && gltf.animations.length > 0) {
        // Fallback to the appended BRYPPGIDLEGLB animation if named differently
        idleClip = gltf.animations.find(c => c.name.includes('Armature'));
      }
      
      walkClip = gltf.animations.find((c) => (c.name || '').toLowerCase().includes('wander'));
      
      // The original embedded animation will be used as the sprint/run
      const want = config.player.animClip?.toLowerCase() || 'skip';
      
      runClip = gltf.animations.find((c) => {
        const n = (c.name || '').toLowerCase();
        return n.includes(want);
      }) || gltf.animations.find((c) => {
        const n = (c.name || '').toLowerCase();
        return n.includes('run');
      }) || gltf.animations.find((c) => {
        const n = (c.name || '').toLowerCase();
        return !n.includes('idle') && !n.includes('wander') && !n.includes('armature');
      });
      // Fallback: if no clear run clip is found, just grab the first one that exists
      if (!runClip && gltf.animations.length > 0) runClip = gltf.animations[0];
    }

    // Fallback to global animator if still not found
    if (this.experience.animator) {
      if (!walkClip) walkClip = this.experience.animator.getClip(want);
      if (!idleClip) idleClip = this.experience.animator.getClip('idle');
    }

    // Sanitize clips (strip scales to prevent shrinking on foreign rigs)
    const sanitizeAnim = (clip, allowFootRot = true, stripPos = true) => {
      if (!clip) return null;
      clip.tracks = clip.tracks.filter(t => {
        const nameLower = t.name.toLowerCase();
        const isScale = t.name.endsWith('.scale');
        const isPos = t.name.endsWith('.position');
        const isRootPos = isPos && (nameLower.includes('hip') || nameLower.includes('pelvis') || nameLower.includes('armature'));
        const isFootRot = t.name.endsWith('.quaternion') && (nameLower.includes('foot') || nameLower.includes('toe'));
        const isFinger = nameLower.includes('cc_base_') && (nameLower.includes('pinky') || nameLower.includes('mid') || nameLower.includes('index') || nameLower.includes('thumb') || nameLower.includes('ring')); 
        
        if (isScale) return false;
        if (isFinger) return false;
        if (isFootRot && !allowFootRot) return false;
        
        // If stripPos is false, we ONLY keep the position track for the Root/Hips!
        // We must still strip position tracks for all other bones to prevent the skeleton from stretching.
        if (isPos) {
          if (stripPos) return false;
          if (!isRootPos) return false;
        }
        
        return true;
      });
      return clip;
    };

    idleClip = sanitizeAnim(idleClip, false, true); // fix tippy toes for idle, strip pos
    walkClip = sanitizeAnim(walkClip, true, true);  // foreign walk, strip pos
    runClip = sanitizeAnim(runClip, true, false);   // native run, KEEP position tracks so they can skip up and down!
    
    let flightIdleClip = null;
    let flightLoopClip = null;
    let flightBoostClip = null;
    let fallClip = null;
    let landClip = null;
    if (this.experience.animator) {
      flightIdleClip = sanitizeAnim(this.experience.animator.getClip('flightidle'), false, true);
      flightLoopClip = sanitizeAnim(this.experience.animator.getClip('hand-back-flight-loop'), false, true);
      flightBoostClip = sanitizeAnim(this.experience.animator.getClip('swim-dash-and-twist'), false, true);
      fallClip = sanitizeAnim(this.experience.animator.getClip('jump-idle'), false, true);
      
      landClip = sanitizeAnim(this.experience.animator.getClip('superhero-landing-3e'), true, false); 
    }

    if (walkClip) {
      this.walkAction = this.mixer.clipAction(walkClip);
      this.walkAction.play();
      this.walkAction.setEffectiveWeight(0);
      this._loco = true;
    }
    if (runClip) {
      this.runAction = this.mixer.clipAction(runClip);
      this.runAction.play();
      this.runAction.setEffectiveWeight(0);
    }
    if (idleClip) {
      this.idleAction = this.mixer.clipAction(idleClip);
      this.idleAction.play();
      this.idleAction.setEffectiveWeight(0);
    }
    if (flightIdleClip) {
      this.flightIdleAction = this.mixer.clipAction(flightIdleClip);
      this.flightIdleAction.play();
      this.flightIdleAction.setEffectiveWeight(0);
    }
    if (flightLoopClip) {
      this.flightLoopAction = this.mixer.clipAction(flightLoopClip);
      this.flightLoopAction.play();
      this.flightLoopAction.setEffectiveWeight(0);
    }
    if (flightBoostClip) {
      this.flightBoostAction = this.mixer.clipAction(flightBoostClip);
      this.flightBoostAction.play();
      this.flightBoostAction.setEffectiveWeight(0);
    }
    if (fallClip) {
      this.fallAction = this.mixer.clipAction(fallClip);
      this.fallAction.play();
      this.fallAction.setEffectiveWeight(0);
    }
    if (landClip) {
      this.landAction = this.mixer.clipAction(landClip);
      this.landAction.setLoop(THREE.LoopOnce, 1);
      this.landAction.clampWhenFinished = true;
      this.landAction.play();
      this.landAction.setEffectiveWeight(0);
    }
    this._moveW = 0;
    this._runFade = 0;
    this._flightFade = 0;
    this._flightMoveW = 0;
    this._flightBoostW = 0;
    this._fallW = 0;
    this._landW = 0;
    this.dashTimer = 0;
    this.landingTimer = 0;
    this.isFalling = false;
    this.dashDir = new THREE.Vector3();
    this._dashForward = false;
  }

  _proceduralFigure() {
    const cloth = new THREE.MeshStandardMaterial({ color: 0x20242e, roughness: 0.5, metalness: 0.3 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.78, 6, 14), cloth);
    torso.position.y = this.centerY; torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 14),
      new THREE.MeshStandardMaterial({ color: 0xd8a07a, roughness: 0.6 }));
    head.position.y = config.player.height - 0.2; head.castShadow = true;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.035, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0x00ffd5, emissive: 0x00ffd5, emissiveIntensity: 2 }));
    band.rotation.x = Math.PI / 2; band.position.y = this.centerY + 0.08;
    this.mesh.add(torso, head, band);
  }

  update(dt, input) {
    const yaw = this.experience.camera.getYaw();
    this._forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    this._right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    
    const cfgV = config.vehicle;
    
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
    }

    if (this.flying) {
      if (input.dash && this.dashTimer <= 0 && input.moveZ >= 0) {
        if (input.moveX === 0 && input.moveZ === 0) {
          // Default to forward dash
          this.dashDir.copy(this._forward);
          this.dashTimer = 0.6; // Halved from 1.2
          this._dashForward = true;
        } else {
          // Lock current direction
          this.dashDir.copy(this._forward).multiplyScalar(input.moveZ).addScaledVector(this._right, input.moveX).normalize();
          if (input.moveZ > 0) {
            this.dashTimer = 0.6; // Halved from 1.2
            this._dashForward = true;
          } else {
            this.dashTimer = 0.35; // Short sideways dash
            this._dashForward = false;
          }
        }
      }
      this._isFlyingForward = input.moveZ > 0 || (this.dashTimer > 0 && this._dashForward);
      this._lastMoveX = input.moveX;
      this._lastAscend = input.ascend;
      this._lastDescend = input.descend;
      
      // Auto-turn camera to carve flight paths
      if (this._isFlyingForward && input.moveX !== 0) {
        // Yaw the camera in the direction we are banking
        this.experience.camera.yaw -= input.moveX * 1.2 * dt; 
      }
      
      // Superman 3D Flight Physics
      let mag = 1.0;
      if (this.dashTimer > 0) {
        // Force locked dash direction
        this._move.copy(this.dashDir);
      } else {
        this._move.copy(this._forward).multiplyScalar(input.moveZ).addScaledVector(this._right, input.moveX);
        if (input.strafeX) {
          this._move.addScaledVector(this._right, input.strafeX * 0.7);
        }
        mag = this._move.length();
        if (mag > 1) this._move.multiplyScalar(1 / mag);
      }

      let spd = 10.0; // Idle/strafe/reverse flight speed
      if (this._isFlyingForward) spd = 35.0; // Fast forward flight speed
      
      if (this.dashTimer > 0) {
        spd = 45.0; // Reduced from 65.0
      }
      
      // Realistic deceleration drift
      const isStopping = mag < 0.01 && this.dashTimer <= 0;
      const drag = isStopping ? 2.0 : 6.0; // Much lower drag when stopping to simulate drift
      
      const k = Math.min(drag * dt, 1);
      this.vel.x += (this._move.x * spd - this.vel.x) * k;
      this.vel.z += (this._move.z * spd - this.vel.z) * k;

      // Vertical flight mapping
      let vyTarget = 0;
      
      // On mobile, inherently steer vertically based on camera look direction when flying forward
      if (this.experience.isTouch && this._isFlyingForward) {
        const camDir = new THREE.Vector3();
        this.experience.camera.instance.getWorldDirection(camDir);
        // Offset by roughly +0.12 (~7 degrees) so looking slightly down keeps flight horizontal
        vyTarget = (camDir.y + 0.12) * spd * 0.8; 
      }
      
      if (input.ascend) vyTarget = spd;
      if (input.descend) vyTarget = -spd;
      this.vy += (vyTarget - this.vy) * Math.min(8 * dt, 1);
      
      const t = this.body.translation();
      let newY = t.y + this.vy * dt;
      if (newY < 0.5) { newY = 0.5; if (this.vy < 0) this.vy = 0; }
      if (newY > 200.0) { newY = 200.0; if (this.vy > 0) this.vy = 0; }

      const desired = { x: this.vel.x * dt, y: newY - t.y, z: this.vel.z * dt };
      this.controller.computeColliderMovement(this.collider, desired);
      const corr = this.controller.computedMovement();
      this.body.setNextKinematicTranslation({ x: t.x + corr.x, y: t.y + corr.y, z: t.z + corr.z });
      this.speed = Math.hypot(this.vel.x, this.vel.z);
      
      // Face away from camera only when moving (allows orbiting camera to see front when idle)
      if (this.speed > 0.1 || input.ascend || input.descend) {
        let tgt = yaw + Math.PI;
        let diff = tgt - this.facing;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.facing += diff * Math.min(15 * dt, 1);
      }
    } else {
      // Normal Walking Plane Physics
      
      let mag = 0;
      if (this.landingTimer > 0) {
        this.landingTimer -= dt;
        this._move.set(0, 0, 0); // Lock movement during landing impact
      } else {
        this._move.copy(this._forward).multiplyScalar(input.moveZ).addScaledVector(this._right, input.moveX);
        mag = this._move.length();
        if (mag > 1) this._move.multiplyScalar(1 / mag);
      }

      const spd = input.run ? config.player.runSpeed : config.player.walkSpeed;
      const k = Math.min(config.player.accel * dt, 1);
      this.vel.x += (this._move.x * spd - this.vel.x) * k;
      this.vel.z += (this._move.z * spd - this.vel.z) * k;

      this.vy -= config.player.gravity * dt;
      if (input.jump && this.grounded && this.landingTimer <= 0) { this.vy = config.player.jump; this.grounded = false; }
      
      // Falling & Landing Detection
      if (!this.grounded) {
        this.isFalling = true;
        
        // Raycast down from slightly below the player's feet to avoid hitting their own collider
        const RAPIER = this.experience.physics.RAPIER;
        const t = this.body.translation();
        const ray = new RAPIER.Ray({ x: t.x, y: t.y - 1.0, z: t.z }, { x: 0, y: -1, z: 0 });
        const hit = this.experience.physics.world.castRay(ray, 50, true);
        const dist = hit ? hit.toi : 50;
        
        // Trigger superhero landing just before hitting the ground (Must be falling fast enough so normal jumps/sprints don't trigger it)
        if (dist < 3.5 && this.vy < -8.0 && this.landingTimer <= 0) {
          this.landingTimer = 0.8; 
          if (this.landAction) {
            this.landAction.reset();
            this.landAction.time = 0.6; 
            this.landAction.play();
          } else {
            console.warn("[Player] landAction is null. Did superhero-landing-3e fail to load?");
          }
        }
      } else if (this.grounded) {
        this.isFalling = false;
      }

      const desired = { x: this.vel.x * dt, y: this.vy * dt, z: this.vel.z * dt };
      this.controller.computeColliderMovement(this.collider, desired);
      const corr = this.controller.computedMovement();
      
      const prevGrounded = this.grounded;
      this.grounded = this.controller.computedGrounded();
      
      // True physical impact trigger (bypasses raycast if raycast failed, only for fast falls)
      if (this.grounded && !prevGrounded && this.vy < -10.0 && this.landingTimer <= 0) {
        this.landingTimer = 0.8;
        if (this.landAction) {
          this.landAction.reset();
          this.landAction.time = 0.6; 
          this.landAction.play();
        }
      }
      
      if (this.grounded && this.vy < 0) this.vy = 0;

      const t = this.body.translation();
      this.body.setNextKinematicTranslation({ x: t.x + corr.x, y: t.y + corr.y, z: t.z + corr.z });

      if (mag > 0.05) {
        const want = Math.atan2(this._move.x, this._move.z);
        let diff = want - this.facing;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.facing += diff * Math.min(config.player.turnRate * dt, 1);
      }
      this.speed = Math.hypot(this.vel.x, this.vel.z);
    }
    
    // Maintain global forward vectors for cameras
    this.headingV.set(Math.sin(this.facing), 0, Math.cos(this.facing)).normalize();
    this.camForward.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
    this.surfaceUp.set(0, 1, 0);
  }

  mount(seat) {
    this.mounted = true; this.speed = 0; this.vel.set(0, 0, 0);
    this.collider.setEnabled(false); seat.add(this.mesh);
    this.mesh.position.set(0, 0, 0); this.mesh.rotation.set(0, 0, 0); this.mesh.scale.setScalar(0.92);
  }
  dismount() {
    this.mounted = false; this.collider.setEnabled(true);
    this.experience.scene.add(this.mesh); this.mesh.scale.setScalar(1);
  }
  teleport(x, z) {
    this.body.setTranslation({ x, y: this.centerY, z }, true);
    this.vel.set(0, 0, 0); this.vy = 0;
  }

  sync(delta = 0.016, elapsed = 0, pos = null) {
    if (!this.mounted) {
      const t = pos || this.body.translation();
      this.position.set(t.x, t.y, t.z);
      
      let bob = 0;
      if (this.flying) {
        if (this._isFlyingForward) {
          // Increased, randomized up and down bob, slower frequency
          bob = Math.sin(elapsed * 2.0) * 0.3 + Math.sin(elapsed * 3.2) * 0.15;
        } else {
          // Increased normal hover bob
          bob = Math.sin(elapsed * 2.0) * 0.3;
        }
      }
      
      let landingOffset = 0;
      if (this._landW > 0.01) {
        const targetOffset = this._useNewAvatar ? -1.65 : -3.35; 
        landingOffset = targetOffset * this._landW;
      }
      
      this.mesh.position.set(t.x, t.y - this.centerY + bob + landingOffset, t.z);
      this.mesh.rotation.y = this.facing;
      
      this.chest.set(t.x, t.y, t.z);
      
      if (t.y < -25) this.teleport(0, 7);
      
      // Superman flight - keep upright
      this.mesh.rotation.x = 0;
    }
    this._animate(delta, elapsed);
  }

  _animate(delta, elapsed) {
    if (this.mixer) {
      const moving = !this.flying && this.speed > 0.3;
      
      // Footstep Particle Logic
      if (moving && this.grounded && this.altitude < 0.1) {
        if (!this._stepDist) this._stepDist = 0;
        this._stepDist += this.speed * delta;
        
        // Because the walk speed is ~7m/s, a real human stride covers ~3.2 meters per footfall!
        if (this._stepDist > 3.2) { 
          this._stepDist = 0;
          const footsteps = this.experience.world?.footsteps;
          if (footsteps && footsteps.emit) {
            footsteps.emit(this.position, this.facing);
          }
        }
      } else {
        this._stepDist = 0;
      }

      if (this.idleAction) {
        const targetMove = moving ? 1 : 0;
        const targetFlight = this.flying ? 1 : 0;
        const targetFlightMove = (this.flying && this._isFlyingForward && this.speed > 0.3) ? 1 : 0;
        const targetFlightBoost = (this.dashTimer > 0 && this._isFlyingForward) ? 1 : 0; // Only twirl if moving forward
        const targetFall = (this.isFalling && !this.flying && this.landingTimer <= 0) ? 1 : 0;
        const targetLand = (this.landingTimer > 0) ? 1 : 0;
        
        this._moveW += (targetMove - this._moveW) * Math.min(delta * 6, 1);
        this._flightFade += (targetFlight - this._flightFade) * Math.min(delta * 6, 1);
        
        // Slower blend for the flight forward animation so it looks more natural
        this._flightMoveW += (targetFlightMove - this._flightMoveW) * Math.min(delta * 4, 1);
        this._flightBoostW += (targetFlightBoost - this._flightBoostW) * Math.min(delta * 4, 1);
        
        this._fallW += (targetFall - this._fallW) * Math.min(delta * 8, 1);
        
        // Fast blend IN for impact (15), smooth blend OUT for stand-up (8)
        const landBlendSpeed = (targetLand === 1) ? 15 : 8;
        this._landW += (targetLand - this._landW) * Math.min(delta * landBlendSpeed, 1);
        
        const walkSpd = config.player.walkSpeed || 6;
        const runSpd = config.player.runSpeed || 16;
        let runFactor = (this.speed - walkSpd) / (runSpd - walkSpd);
        runFactor = Math.max(0, Math.min(1, runFactor));
        this._runFade += (runFactor - this._runFade) * Math.min(delta * 6, 1);
        
        // Ground locomotion weights
        let locoWeight = this._moveW * (1 - this._flightFade);
        let idleWeight = (1 - this._moveW) * (1 - this._flightFade);
        let runWeight = locoWeight * this._runFade;
        let walkWeight = locoWeight * (1 - this._runFade);
        
        // If falling or landing, override walking weights
        if (this._fallW > 0.01 || this._landW > 0.01) {
          const override = Math.max(this._fallW, this._landW);
          locoWeight *= (1 - override);
          idleWeight *= (1 - override);
          runWeight *= (1 - override);
          walkWeight *= (1 - override);
        }
        
        // Flight locomotion weights
        const flightBoostWeight = this._flightBoostW * this._flightFade;
        const flightLoopWeight = this._flightMoveW * this._flightFade * (1 - this._flightBoostW);
        const flightIdleWeight = (1 - this._flightMoveW) * this._flightFade * (1 - this._flightBoostW);
        
        if (this.walkAction) this.walkAction.setEffectiveWeight(walkWeight);
        if (this.runAction) this.runAction.setEffectiveWeight(runWeight);
        this.idleAction.setEffectiveWeight(idleWeight);
        
        if (this.flightIdleAction) this.flightIdleAction.setEffectiveWeight(flightIdleWeight);
        if (this.flightLoopAction) this.flightLoopAction.setEffectiveWeight(flightLoopWeight);
        if (this.flightBoostAction) this.flightBoostAction.setEffectiveWeight(flightBoostWeight);
        
        if (this.fallAction) this.fallAction.setEffectiveWeight(this._fallW * (1 - this._flightFade) * (1 - this._landW));
        if (this.landAction) this.landAction.setEffectiveWeight(this._landW * (1 - this._flightFade));
        
        if (this._loco) {
          if (this.walkAction) this.walkAction.timeScale = Math.min(Math.max(this.speed / 6.0, 0.6), 2.2);
          if (this.runAction) this.runAction.timeScale = Math.min(Math.max(this.speed / 20.0, 0.6), 1.5);
        }
      } else if (this._loco) {
        if (this.walkAction) this.walkAction.timeScale = (!this.flying && this.speed > 0.15) ? Math.min(Math.max(this.speed / 8.0, 0.6), 2.2) : 0;
      }
      this.mixer.update(delta);
      if (this.modelRoot) {
        let targetPitch = moving ? 0.06 : 0;
        let targetRoll = 0;
        
        if (this.flying) {
          if (this._isFlyingForward) {
            // Bank left/right based on A/D keys directly so it stays banked while curving
            targetRoll = (this._lastMoveX || 0) * 0.55; 
          } else {
            targetRoll = 0; // No banking when idle or reversing
          }
          targetPitch = 0;
          
          // Apply dynamic sway on top of base orientation
          if (this._isFlyingForward) {
            // Exaggerated forward flight sway with slower frequency
            targetRoll += Math.sin(elapsed * 2.5) * 0.06 + Math.cos(elapsed * 3.1) * 0.03;
            targetPitch += Math.cos(elapsed * 2.1) * 0.08 + Math.sin(elapsed * 2.8) * 0.04;
            
            // Ascend/descend pitch adjustment
            if (this._lastAscend) targetPitch -= 0.5; // Pitch up to climb
            if (this._lastDescend) targetPitch += 0.5; // Dive down
          } else {
            // Reverted subtle hover sway
            targetRoll += Math.sin(elapsed * 2.0) * 0.02;
            targetPitch += Math.cos(elapsed * 1.5) * 0.02;
          }
        }
        
        this.modelRoot.rotation.x += (targetPitch - this.modelRoot.rotation.x) * (delta * 8);
        this.modelRoot.rotation.z += (targetRoll - this.modelRoot.rotation.z) * (delta * 8);
      }
    }
  }

  /* ============================ SPHERE walking ============================ */
  spawnSphere() {
    this.surfaceUp.set(0, 1, 0);
    this.headingV.set(0, 0, -1);
    this.camForward.set(0, 0, -1);
    this.sunTangent.set(0.8, 0, 0.6).normalize();
    this._prevCamYaw = this.experience.camera.yaw;
    this.boardPitch = 0;
    this.altitude = 0; this.vy = 0; this.speed = 0; this.grounded = true;
    if (this.collider) this.collider.setEnabled(false);
    this.syncSphere(0.016, 0);
  }

  updateSphere(dt, input) {
    const R = config.planet.radius;
    const cam = this.experience.camera;
    const cfgV = config.vehicle;

    const dyaw = cam.yaw - this._prevCamYaw; this._prevCamYaw = cam.yaw;
    if (dyaw) this.camForward.applyAxisAngle(this.surfaceUp, dyaw);
    this.camForward.addScaledVector(this.surfaceUp, -this.camForward.dot(this.surfaceUp)).normalize();

    if (this.flying) {
      const turnRate = cfgV.turn * 1.3;
      const rev = this.speed < -0.02 ? -1 : 1;
      if (input.moveX) {
        this.headingV.applyAxisAngle(this.surfaceUp, -input.moveX * rev * turnRate * dt);
        this.headingV.addScaledVector(this.surfaceUp, -this.headingV.dot(this.surfaceUp)).normalize();
      }
      
      // Strafe sideways with Q and E
      if (input.strafeX) {
        const strafeSpeed = cfgV.maxSpeed * 0.7;
        const sAngle = (input.strafeX * strafeSpeed * dt) / R;
        this.surfaceUp.applyAxisAngle(this.headingV, sAngle).normalize();
        this.headingV.addScaledVector(this.surfaceUp, -this.headingV.dot(this.surfaceUp)).normalize();
        this.camForward.applyAxisAngle(this.headingV, sAngle);
        this.camForward.addScaledVector(this.surfaceUp, -this.camForward.dot(this.surfaceUp)).normalize();
      }

      const targetSpeed = input.moveZ * cfgV.maxSpeed * (input.run ? cfgV.boost : 1);
      this.speed += (targetSpeed - this.speed) * Math.min(6 * dt, 1);
      if (Math.abs(this.speed) > 0.02) {
        this._axis.crossVectors(this.surfaceUp, this.headingV).normalize();
        const angle = (this.speed * dt) / R;
        this.surfaceUp.applyAxisAngle(this._axis, angle).normalize();
        this.headingV.applyAxisAngle(this._axis, angle);
        this.headingV.addScaledVector(this.surfaceUp, -this.headingV.dot(this.surfaceUp)).normalize();
        this.camForward.applyAxisAngle(this._axis, angle);
        this.camForward.addScaledVector(this.surfaceUp, -this.camForward.dot(this.surfaceUp)).normalize();
        this.sunTangent.applyAxisAngle(this._axis, angle);
        this.sunTangent.addScaledVector(this.surfaceUp, -this.sunTangent.dot(this.surfaceUp)).normalize();
      }
      const targetPitch = input.ascend ? 0.42 : (this.vy < -0.4 ? -0.16 : 0);
      this.boardPitch += (targetPitch - this.boardPitch) * Math.min(dt * 5, 1);
    } else {
      this._cr.crossVectors(this.camForward, this.surfaceUp).normalize();
      this._md.copy(this.camForward).multiplyScalar(input.moveZ).addScaledVector(this._cr, input.moveX);
      let mag = this._md.length();
      if (mag > 1) { this._md.multiplyScalar(1 / mag); mag = 1; }

      const targetSpeed = mag * (input.run ? config.player.runSpeed : config.player.walkSpeed);
      this.speed += (targetSpeed - this.speed) * Math.min(config.player.accel * dt, 1);

      if (mag > 0.01) {
        this._md.normalize();
        this._cf.crossVectors(this.headingV, this._md);
        const ang = Math.atan2(this._cf.dot(this.surfaceUp), this.headingV.dot(this._md));
        this.headingV.applyAxisAngle(this.surfaceUp, ang * Math.min(config.player.turnRate * dt, 1)).normalize();
        this.headingV.addScaledVector(this.surfaceUp, -this.headingV.dot(this.surfaceUp)).normalize();
      }

      if (this.speed > 0.02 && mag > 0.01) {
        this._axis.crossVectors(this.surfaceUp, this._md).normalize();
        const angle = (this.speed * dt) / R;
        this.surfaceUp.applyAxisAngle(this._axis, angle).normalize();
        this.camForward.applyAxisAngle(this._axis, angle);
        this.camForward.addScaledVector(this.surfaceUp, -this.camForward.dot(this.surfaceUp)).normalize();
        this.sunTangent.applyAxisAngle(this._axis, angle);
        this.sunTangent.addScaledVector(this.surfaceUp, -this.sunTangent.dot(this.surfaceUp)).normalize();
        this.headingV.applyAxisAngle(this._axis, angle);
        this.headingV.addScaledVector(this.surfaceUp, -this.headingV.dot(this.surfaceUp)).normalize();
      }
    }

    if (this.flying) {
      const cfgV2 = config.vehicle;
      this.vy += (input.ascend ? cfgV2.climb : -cfgV2.sink) * dt;
      this.vy = Math.max(-cfgV2.maxVY, Math.min(cfgV2.maxVY, this.vy));
      this.altitude += this.vy * dt;
      if (this.altitude <= cfgV2.hoverMin) { this.altitude = cfgV2.hoverMin; if (this.vy < 0) this.vy = 0; }
      if (this.altitude >= cfgV2.maxAlt) { this.altitude = cfgV2.maxAlt; if (this.vy > 0) this.vy = 0; }
      this.grounded = false;
    } else {
      this.vy -= config.player.gravity * dt;
      if (input.jump && this.altitude <= 0.02) this.vy = config.player.jump;
      this.altitude += this.vy * dt;
      if (this.altitude <= 0) { this.altitude = 0; this.vy = 0; this.grounded = true; }
      else this.grounded = false;
    }
  }

  syncSphere(delta = 0.016, elapsed = 0) {
    const R = config.planet.radius;
    this.position.copy(this.surfaceUp).multiplyScalar(R + this.altitude);
    this.mesh.position.copy(this.position);
    orientTo(this.headingV, this.surfaceUp, this._sq);
    this.mesh.quaternion.copy(this._sq);
    this.chest.copy(this.surfaceUp).multiplyScalar(R + this.altitude + this.centerY);
    this.forward.copy(this.headingV);

    const v = this.experience.world?.vehicle;
    if (v) {
      v.mesh.visible = this.flying;
      if (this.flying) {
        const pq = (this._pitchQ || (this._pitchQ = new THREE.Quaternion()))
          .setFromAxisAngle(PITCH_AXIS, -this.boardPitch);
        this.mesh.quaternion.copy(this._sq).multiply(pq);
        v.mesh.position.copy(this.surfaceUp).multiplyScalar(R + this.altitude - 0.1);
        v.mesh.quaternion.copy(this._sq).multiply(pq);
      }
    }
    this._animate(delta, elapsed);
  }
}
