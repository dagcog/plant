import * as T from 'three';
import { OrbitControls } from 'orbit-controls';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SPECIES } from '@game/content.js';
import { makePlant } from './plants.js';
import { dispose } from './geometry.js';
import { stageIndex } from '@game/simulation.js';

export function inspectPlant(host, specimen) {
  let renderer;
  try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); }
  catch { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);
  host.classList.add('has-3d');
  const scene = new T.Scene();
  let environment;
  if (SPECIES[specimen.species].modelSet) {
    // The leaf windows need a bright background to refract and broad reflections.
    const studio = new RoomEnvironment();
    const pmrem = new T.PMREMGenerator(renderer);
    environment = pmrem.fromScene(studio, 0.06, 0.1, 60, { size: 128 });
    pmrem.dispose();
    studio.dispose();
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.8;
    scene.background = new T.Color('#e7e8d1');
  }
  const camera = new T.PerspectiveCamera(40, 1, 0.05, 15);
  const draw = () => renderer.render(scene, camera);
  const model = makePlant(specimen, stageIndex(specimen), draw);
  const bounds = new T.Box3().setFromObject(model).getBoundingSphere(new T.Sphere());
  const distance = bounds.radius / Math.sin(T.MathUtils.degToRad(camera.fov / 2)) * 1.10;
  camera.position.copy(new T.Vector3(0.39, 0.24, 1).setLength(distance).add(bounds.center));
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(bounds.center);
  controls.enablePan = false;
  controls.minDistance = distance * 0.46;
  controls.maxDistance = distance * 1.7;
  controls.maxPolarAngle = Math.PI * 0.68;
  controls.update();
  controls.saveState();
  scene.add(model, new T.HemisphereLight('#fff5d8', '#7c8065', 2.3));
  const sun = new T.DirectionalLight('#ffdfb5', 2.3);
  sun.position.set(-1.6, 3, 2);
  scene.add(sun);

  controls.addEventListener('change', draw);
  const observer = new ResizeObserver(() => {
    if (!host.clientWidth || !host.clientHeight) return;
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    draw();
  });
  observer.observe(host);
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    host.classList.remove('has-3d');
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => { host.classList.add('has-3d'); draw(); });

  function dolly(ratio) {
    const delta = camera.position.clone().sub(controls.target);
    delta.setLength(T.MathUtils.clamp(delta.length() * ratio, controls.minDistance, controls.maxDistance));
    camera.position.copy(controls.target).add(delta);
    controls.update();
    draw();
  }

  return {
    command(action) {
      if (action === 'zoom-in') dolly(0.83);
      if (action === 'zoom-out') dolly(1.2);
      if (action === 'reset-camera') { controls.reset(); draw(); }
      if (action === 'turn-left' || action === 'turn-right') {
        const offset = camera.position.clone().sub(controls.target);
        offset.applyAxisAngle(new T.Vector3(0, 1, 0), action === 'turn-left' ? -Math.PI / 5 : Math.PI / 5);
        camera.position.copy(controls.target).add(offset);
        controls.update();
        draw();
      }
    },
    close() {
      observer.disconnect();
      controls.dispose();
      dispose(model);
      environment?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
