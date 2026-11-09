import * as T from 'three';

const up = new T.Vector3(0, 1, 0);
export const material = (color, extra = {}) => new T.MeshStandardMaterial({ color, roughness: 0.78, ...extra });

export function mesh(group, geometry, surface, position = [0, 0, 0], shadow = true) {
  const object = new T.Mesh(geometry, surface);
  object.position.set(...position);
  object.castShadow = shadow;
  object.receiveShadow = true;
  group.add(object);
  return object;
}

export function dispose(group) {
  group.userData.disposed = true;
  const geometries = new Set();
  const materials = new Set();
  group.traverse((object) => {
    if (!object.isMesh) return;
    if (object.isInstancedMesh) object.dispose();
    if (!object.userData.sharedGeometry) geometries.add(object.geometry);
    for (const surface of [object.material].flat()) materials.add(surface);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const surface of materials) surface.dispose();
  group.removeFromParent();
}

export function segment(group, from, to, radius, surface, tip = radius) {
  const direction = to.clone().sub(from);
  const middle = from.clone().lerp(to, 0.5);
  const object = mesh(group, new T.CylinderGeometry(tip, radius, direction.length(), 7), surface, middle.toArray());
  object.quaternion.setFromUnitVectors(up, direction.normalize());
  return object;
}
