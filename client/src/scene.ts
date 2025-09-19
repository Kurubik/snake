// Three.js scene setup and rendering

import * as THREE from 'three';
import { currentState } from './main';
import { getInterpolatedState } from './net';
import { CELL_SIZE, DEFAULT_SETTINGS } from './shared/constants';
import { GameState } from './shared/types';

let scene: THREE.Scene;
let camera: THREE.OrthographicCamera;
let renderer: THREE.WebGLRenderer;
let gridWidth = DEFAULT_SETTINGS.gridWidth;
let gridHeight = DEFAULT_SETTINGS.gridHeight;

// Meshes for rendering
let snakeMeshes = new Map<string, THREE.InstancedMesh>();
let foodMeshes: THREE.InstancedMesh;
let gridLines: THREE.LineSegments;

// Materials
let snakeMaterials = new Map<string, THREE.MeshBasicMaterial>();
let foodMaterial: THREE.MeshBasicMaterial;
let gridMaterial: THREE.LineBasicMaterial;

export function initScene(canvas: HTMLCanvasElement) {
  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);
  
  // Setup orthographic camera to show entire field
  const aspect = window.innerWidth / window.innerHeight;
  
  // Calculate frustum size to fit the entire grid
  let frustumWidth = gridWidth + 2; // Add padding
  let frustumHeight = gridHeight + 2;
  
  // Adjust for aspect ratio
  if (aspect > frustumWidth / frustumHeight) {
    frustumWidth = frustumHeight * aspect;
  } else {
    frustumHeight = frustumWidth / aspect;
  }
  
  camera = new THREE.OrthographicCamera(
    -frustumWidth / 2,
    frustumWidth / 2,
    frustumHeight / 2,
    -frustumHeight / 2,
    0.1,
    1000
  );
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  
  // Setup renderer
  renderer = new THREE.WebGLRenderer({ 
    canvas,
    antialias: true,
    alpha: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  
  // Create materials
  gridMaterial = new THREE.LineBasicMaterial({ 
    color: 0x1a3a3a,
    transparent: true,
    opacity: 0.3
  });
  
  foodMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x00ffff,
    transparent: true,
    opacity: 0.9
  });
  
  // Create grid
  createGrid();
  
  // Create food mesh pool
  const foodGeometry = new THREE.PlaneGeometry(CELL_SIZE * 0.35, CELL_SIZE * 0.35);
  foodMeshes = new THREE.InstancedMesh(foodGeometry, foodMaterial, 100);
  foodMeshes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(foodMeshes);
  
  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  
  // Handle resize
  window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    
    // Recalculate frustum to maintain grid view
    let frustumWidth = gridWidth + 2;
    let frustumHeight = gridHeight + 2;
    
    if (aspect > frustumWidth / frustumHeight) {
      frustumWidth = frustumHeight * aspect;
    } else {
      frustumHeight = frustumWidth / aspect;
    }
    
    camera.left = -frustumWidth / 2;
    camera.right = frustumWidth / 2;
    camera.top = frustumHeight / 2;
    camera.bottom = -frustumHeight / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function createGrid() {
  const geometry = new THREE.BufferGeometry();
  const vertices = [];
  
  // Horizontal lines (inverted Y)
  for (let i = 0; i <= gridHeight; i++) {
    vertices.push(-gridWidth / 2, -(i - gridHeight / 2), 0);
    vertices.push(gridWidth / 2, -(i - gridHeight / 2), 0);
  }
  
  // Vertical lines
  for (let i = 0; i <= gridWidth; i++) {
    vertices.push(i - gridWidth / 2, gridHeight / 2, 0);
    vertices.push(i - gridWidth / 2, -gridHeight / 2, 0);
  }
  
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  
  if (gridLines) {
    scene.remove(gridLines);
  }
  
  gridLines = new THREE.LineSegments(geometry, gridMaterial);
  scene.add(gridLines);
  
  // Add border around the field
  const borderGeometry = new THREE.BufferGeometry();
  const borderVertices = [
    // Top
    -gridWidth / 2, gridHeight / 2, 0.01,
    gridWidth / 2, gridHeight / 2, 0.01,
    // Right
    gridWidth / 2, gridHeight / 2, 0.01,
    gridWidth / 2, -gridHeight / 2, 0.01,
    // Bottom
    gridWidth / 2, -gridHeight / 2, 0.01,
    -gridWidth / 2, -gridHeight / 2, 0.01,
    // Left
    -gridWidth / 2, -gridHeight / 2, 0.01,
    -gridWidth / 2, gridHeight / 2, 0.01,
  ];
  
  borderGeometry.setAttribute('position', new THREE.Float32BufferAttribute(borderVertices, 3));
  
  const borderMaterial = new THREE.LineBasicMaterial({ 
    color: 0x00ffff,
    linewidth: 2,
    transparent: true,
    opacity: 0.6
  });
  
  const borderLines = new THREE.LineSegments(borderGeometry, borderMaterial);
  scene.add(borderLines);
}

export function updateScene(_deltaTime: number) {
  if (!currentState) return;
  
  // Use interpolated state for smooth movement
  const state = getInterpolatedState() || currentState;
  
  // Update grid size if changed
  if (state.foods.length > 0) {
    // Infer grid size from game state if needed
  }
  
  // Render snakes
  renderSnakes(state);
  
  // Render food
  renderFood(state);
  
  // No camera follow - camera stays fixed to show entire field
}

function renderSnakes(state: GameState) {
  // Clear existing snake meshes
  snakeMeshes.forEach(mesh => {
    scene.remove(mesh);
    mesh.geometry.dispose();
  });
  snakeMeshes.clear();
  
  // Create mesh for each snake
  state.snakes.forEach((snake, id) => {
    if (!snake.alive || snake.body.length === 0) return;
    
    // Get or create material for this snake
    let material = snakeMaterials.get(id);
    if (!material) {
      const color = new THREE.Color(snake.color || 0x00ffff);
      // const isPlayer = id === playerId;
      material = new THREE.MeshBasicMaterial({ 
        color,
        transparent: true,
        opacity: snake.alive ? 1 : 0.3
      });
      snakeMaterials.set(id, material);
    }
    
    // Create instanced mesh for snake segments  
    const segmentGeometry = new THREE.PlaneGeometry(CELL_SIZE * 0.85, CELL_SIZE * 0.85);
    const snakeMesh = new THREE.InstancedMesh(
      segmentGeometry,
      material,
      snake.body.length
    );
    
    // Position each segment
    const matrix = new THREE.Matrix4();
    snake.body.forEach((segment, i) => {
      matrix.makeTranslation(
        segment.x - gridWidth / 2 + 0.5,
        -(segment.y - gridHeight / 2 + 0.5),  // Invert Y for display
        0.1
      );
      
      // Make head slightly larger
      if (i === 0) {
        matrix.makeScale(1.1, 1.1, 1);
        matrix.setPosition(
          segment.x - gridWidth / 2 + 0.5,
          -(segment.y - gridHeight / 2 + 0.5),  // Invert Y for display
          0.2
        );
      }
      
      snakeMesh.setMatrixAt(i, matrix);
    });
    
    snakeMesh.instanceMatrix.needsUpdate = true;
    scene.add(snakeMesh);
    snakeMeshes.set(id, snakeMesh);
  });
}

function renderFood(state: GameState) {
  if (!foodMeshes) return;
  
  const matrix = new THREE.Matrix4();
  let normalFoodCount = 0;
  let specialFoodCount = 0;
  
  // Hide all instances first
  for (let i = 0; i < foodMeshes.count; i++) {
    matrix.makeScale(0, 0, 0);
    foodMeshes.setMatrixAt(i, matrix);
  }
  
  // Position food
  state.foods.forEach((food, i) => {
    if (i >= foodMeshes.count) return;
    
    const scale = food.type === 'special' ? 1.5 : 1;
    const pulse = food.type === 'special' 
      ? 1 + Math.sin(Date.now() * 0.005) * 0.1 
      : 1;
    
    matrix.makeScale(scale * pulse, scale * pulse, 1);
    matrix.setPosition(
      food.position.x - gridWidth / 2 + 0.5,
      -(food.position.y - gridHeight / 2 + 0.5),  // Invert Y for display
      0.05
    );
    
    foodMeshes.setMatrixAt(i, matrix);
    
    // Update material color based on type
    if (food.type === 'special') {
      foodMeshes.setColorAt(i, new THREE.Color(0xffff00));
      specialFoodCount++;
    } else {
      foodMeshes.setColorAt(i, new THREE.Color(0x00ffff));
      normalFoodCount++;
    }
  });
  
  foodMeshes.instanceMatrix.needsUpdate = true;
  if (foodMeshes.instanceColor) {
    foodMeshes.instanceColor.needsUpdate = true;
  }
}

export function render() {
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

export function updateGridSize(width: number, height: number) {
  gridWidth = width;
  gridHeight = height;
  createGrid();
  
  // Update camera to fit the new grid
  const aspect = window.innerWidth / window.innerHeight;
  
  // Calculate frustum size to fit the entire grid
  let frustumWidth = gridWidth + 2;
  let frustumHeight = gridHeight + 2;
  
  // Adjust for aspect ratio
  if (aspect > frustumWidth / frustumHeight) {
    frustumWidth = frustumHeight * aspect;
  } else {
    frustumHeight = frustumWidth / aspect;
  }
  
  camera.left = -frustumWidth / 2;
  camera.right = frustumWidth / 2;
  camera.top = frustumHeight / 2;
  camera.bottom = -frustumHeight / 2;
  camera.updateProjectionMatrix();
  
  // Reset camera position to center
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
}
