/* =========================================================================
   config.js — Nike Biomes 3D
   Stripped from WorldDeTester: just the chrome sphere, avatar, and particles.
   ========================================================================= */

export const IS_TOUCH =
  (typeof window !== 'undefined') &&
  (('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) &&
  window.matchMedia('(pointer: coarse)').matches;

export const config = {
  color: {
    fog:        0x020205,
    sky:        0x020210,
    horizon:    0x050510,
    sun:        0x4466cc,
    keyLight:   0x4466cc,
    fillLight:  0x220044,
    ground:     0x111118,
    cyan:       0x00ffd5,
  },

  zones: {
    spawn: { center: [0, 0, 0], accent: 0x00ffd5 },
    zen:   { center: [0, 0, -9999], scale: 0 },  // disabled
    vp:    { center: [9999, 0, 0],  scale: 0 },   // disabled
    dev:   { center: [-9999, 0, 0], scale: 0 },   // disabled
  },

  fogDensity: 0.003,
  exposure:   1.1,
  curvature:  0,  // globe mode — no curved-world shader needed

  globe:  true,
  planet: { radius: 40 },

  player: {
    radius:    1.0,    // Scaled up for giant avatar
    height:    5.83,   // 10% smaller than previous 6.48
    walkSpeed: 7.0,    // Sped up slightly from 5.0
    runSpeed:  22.0,   // Faster strides
    accel:     14,
    jump:      12.0,
    gravity:   25,
    turnRate:  12,
    modelYaw:  0,
    animClip:  'skip-walk-loop-c2.002',
  },

  vehicle: {
    accel:     26,
    maxSpeed:  22,
    boost:     1.95,
    turn:      2.0,
    drag:      2.2,
    climb:     18,
    sink:      9,
    maxVY:     15,
    maxAlt:    72,
    hoverMin:  1.5,
  },

  camera: {
    fov:        58,
    distance:   16,       // Pushed back for giant avatar
    minDist:    8.0,
    maxDist:    25,
    height:     3.0,      // Raised camera height
    pitchMin:  -0.32,
    pitchMax:   0.95,
    yawSpeed:   0.0042,
    pitchSpeed: 0.0042,
    damping:    0.12,
    vehicleDistance: 10,
  },

  quality: {
    // Dropped floorRes to 256 (from 512) to quarter the vertex processing load!
    desktop: { pixelRatioMax: 1.5, shadowMapSize: 2048, bloom: true, particles: 600, floorRes: 256 },
    mobile:  { pixelRatioMax: 1.25, shadowMapSize: 1024, bloom: false, particles: 350, floorRes: 128 },
  },

  world: {
    groundSize: 360,
    wrap: 240,
    treeCount: 0,
  },
};

export const quality = IS_TOUCH ? config.quality.mobile : config.quality.desktop;
