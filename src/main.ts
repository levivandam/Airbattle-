import * as THREE from 'three';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0b12);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
camera.position.set(0, 4, 1.2);
camera.lookAt(0, 0, 0);
scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 1.2));
const box = new THREE.Mesh(
  new THREE.BoxGeometry(1, 0.12, 2),
  new THREE.MeshStandardMaterial({ color: 0xf2f0ea }),
);
scene.add(box);

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
document.body.style.margin = '0';
renderer.setAnimationLoop((t) => {
  box.rotation.y = t / 1500;
  renderer.render(scene, camera);
});
