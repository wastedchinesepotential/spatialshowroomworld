import * as THREE from 'three';

const _axis = new THREE.Vector3();
const _up = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export function fromFlat(flatX, flatZ, R, altitude = 0, out = {}) {
  const d = Math.hypot(flatX, flatZ);
  out.up = out.up || new THREE.Vector3();
  out.pos = out.pos || new THREE.Vector3();
  out.quat = out.quat || new THREE.Quaternion();
  if (d < 1e-5) { out.up.set(0, 1, 0); }
  else { _axis.set(flatZ, 0, -flatX).normalize(); out.up.copy(UP).applyAxisAngle(_axis, d / R); }
  out.pos.copy(out.up).multiplyScalar(R + altitude);
  out.quat.setFromUnitVectors(UP, out.up);
  return out;
}

export function placeOnSphere(obj, flatX, flatZ, R, altitude = 0) {
  const r = fromFlat(flatX, flatZ, R, altitude);
  obj.position.copy(r.pos); obj.quaternion.copy(r.quat);
  return r;
}

export function orientTo(forward, up, quat) {
  _up.copy(up).normalize();
  const right = new THREE.Vector3().crossVectors(_up, forward).normalize();
  const f = new THREE.Vector3().crossVectors(right, _up).normalize();
  const m = new THREE.Matrix4().makeBasis(right, _up, f);
  (quat || (quat = new THREE.Quaternion())).setFromRotationMatrix(m);
  return quat;
}
