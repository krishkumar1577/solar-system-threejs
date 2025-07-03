// Building a solar system in the browser - let's see how this goes!

// Basic Three.js setup
const scene = new THREE.Scene();

// Camera settings - tried different FOVs, 55 looks best
const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 90, 200); // Start with a nice overview angle
let defaultCameraPos = camera.position.clone();
let defaultCameraLook = new THREE.Vector3(0, 0, 0);

// Camera control system - took forever to get this smooth!
let cameraControls = {
  isUserControlling: false,
  mouseDown: false,
  mouseX: 0,
  mouseY: 0,
  targetRotationX: 0,
  targetRotationY: 0,
  currentRotationX: 0,
  currentRotationY: 0,
  targetZoom: 200, // sweet spot for viewing everything
  currentZoom: 200,
  smoothness: 0.1 // lower = smoother but slower
};

// WebGL renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x111122); // nice dark space color
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Custom shaders for the sun - this was tricky to get right
function createSunRimMaterial() {
  // Vertex shader calculates fresnel lighting effect
  const vertexShader = `
    uniform float fresnelBias;
    uniform float fresnelScale;
    uniform float fresnelPower;
    
    varying float vReflectionFactor;
    
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
      vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
      
      vec3 worldNormal = normalize( mat3( modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz ) * normal );
      
      vec3 I = worldPosition.xyz - cameraPosition;
      
      vReflectionFactor = fresnelBias + fresnelScale * pow( 1.0 + dot( normalize( I ), worldNormal ), fresnelPower );
      
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    uniform vec3 color1;
    uniform vec3 color2;
    
    varying float vReflectionFactor;
    
    void main() {
      float f = clamp( vReflectionFactor, 0.0, 1.0 );
      gl_FragColor = vec4(mix(color2, color1, vec3(f)), f);
    }
  `;

  return new THREE.ShaderMaterial({
    uniforms: {
      color1: { value: new THREE.Color(0xffff99) },
      color2: { value: new THREE.Color(0x000000) },
      fresnelBias: { value: 0.2 },
      fresnelScale: { value: 1.5 },
      fresnelPower: { value: 4.0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
  });
}

function createSunGlowMaterial() {
  const vertexShader = `
    uniform float fresnelBias;
    uniform float fresnelScale;
    uniform float fresnelPower;
    
    varying float vReflectionFactor;
    
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
      vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
      
      vec3 worldNormal = normalize( mat3( modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz ) * normal );
      
      vec3 I = worldPosition.xyz - cameraPosition;
      
      vReflectionFactor = fresnelBias + fresnelScale * pow( 1.0 + dot( normalize( I ), worldNormal ), fresnelPower );
      
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    uniform vec3 color1;
    uniform vec3 color2;
    
    varying float vReflectionFactor;
    
    void main() {
      float f = clamp( vReflectionFactor, 0.0, 1.0 );
      gl_FragColor = vec4(mix(color2, color1, vec3(f)), f * 0.8);
    }
  `;

  return new THREE.ShaderMaterial({
    uniforms: {
      color1: { value: new THREE.Color(0x000000) },
      color2: { value: new THREE.Color(0xff4400) },
      fresnelBias: { value: 0.2 },
      fresnelScale: { value: 1.5 },
      fresnelPower: { value: 4.0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
  });
}

// Quick and dirty noise function - works better than I expected
function noise(x, y, z) {
  // Using sin waves to create pseudo-random values
  const a = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return (a - Math.floor(a)) * 2 - 1;
}

// This makes the sun's corona move like it's alive
function updateSunCorona(time) {
  const corona = sunGroup.userData.corona;
  const pos = corona.geometry.attributes.position;
  const originalPositions = sunGroup.userData.originalPositions;
  
  for (let i = 0; i < pos.count; i++) {
    const i3 = i * 3; // each vertex has x,y,z so multiply by 3
    const x = originalPositions[i3];
    const y = originalPositions[i3 + 1];
    const z = originalPositions[i3 + 2];
    
    // Get the direction vector from center
    const length = Math.sqrt(x * x + y * y + z * z);
    const nx = x / length;
    const ny = y / length;
    const nz = z / length;
    
    // Mix in some time-based movement to make it look alive
    const noiseValue = noise(
      nx * 3 + Math.cos(time * 0.5), 
      ny * 3 + Math.sin(time * 0.3), 
      nz * 3 + time * 0.2
    );
    
    const displacement = noiseValue * 0.4; // keep it subtle
    const newLength = 11.8 + displacement;
    
    pos.setXYZ(i, nx * newLength, ny * newLength, nz * newLength);
  }
  
  pos.needsUpdate = true; // tell three.js to update the geometry
}

// Basic lighting setup
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

// Building the sun with multiple layers for that epic look
const sunGroup = new THREE.Group();

// Main sun body - went with icosahedron for better surface detail
const sunGeometry = new THREE.IcosahedronGeometry(12, 12);
const sunMaterial = new THREE.MeshBasicMaterial({ 
  color: 0xFDB813,
  emissive: 0xffff99,
  emissiveIntensity: 1.2 // make it glow!
});
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
sun.name = 'Sun';
sunGroup.add(sun);

// The sun needs to light up everything else
const sunLight = new THREE.PointLight(0xffff99, 2.5, 0, 1.8);
sunLight.position.set(0, 0, 0);
sunGroup.add(sunLight);

// Corona layer - this creates the animated surface effect
const coronaGeometry = new THREE.IcosahedronGeometry(11.8, 12);
const coronaMaterial = new THREE.MeshBasicMaterial({
  color: 0xff4400, // hot orange-red
  side: THREE.BackSide, // render from inside
  transparent: true,
  opacity: 0.8
});
const corona = new THREE.Mesh(coronaGeometry, coronaMaterial);
sunGroup.add(corona);

// Rim glow effect - adds that solar atmosphere look
const sunRimGeometry = new THREE.IcosahedronGeometry(12, 12);
const sunRimMaterial = createSunRimMaterial();
const sunRim = new THREE.Mesh(sunRimGeometry, sunRimMaterial);
sunRim.scale.setScalar(1.02); // slightly bigger than main sun
sunGroup.add(sunRim);

// Outer glow layer - makes it feel like a real star
const sunGlowGeometry = new THREE.IcosahedronGeometry(12, 12);
const sunGlowMaterial = createSunGlowMaterial();
const sunGlow = new THREE.Mesh(sunGlowGeometry, sunGlowMaterial);
sunGlow.scale.setScalar(1.3); // much bigger for distant glow
sunGroup.add(sunGlow);

// Store references for animation - learned this trick the hard way
sunGroup.userData = {
  corona: corona,
  coronaTime: 0,
  originalPositions: [...coronaGeometry.attributes.position.array]
};

scene.add(sunGroup);

// Planet data - tweaked these values until they looked right
const planetData = [
  { name: 'Mercury', radius: 2.2, distance: 20, color: 0xb1b1b1, speed: 0.02 },
  { name: 'Venus',   radius: 3.5, distance: 28, color: 0xeccc9a, speed: 0.015 },
  { name: 'Earth',   radius: 3.8, distance: 38, color: 0x3399ff, speed: 0.01 },
  { name: 'Mars',    radius: 3.0, distance: 48, color: 0xff5533, speed: 0.008 },
  { name: 'Jupiter', radius: 8.5, distance: 62, color: 0xf4e2d8, speed: 0.005 },
  { name: 'Saturn',  radius: 7.5, distance: 78, color: 0xf7e7b6, speed: 0.003 },
  { name: 'Uranus',  radius: 5.2, distance: 94, color: 0x7de2fc, speed: 0.002 },
  { name: 'Neptune', radius: 5.0, distance: 108, color: 0x4062bb, speed: 0.0015 },
];

const planets = [];

// Creating each planet - this is where the magic happens
planetData.forEach((data, i) => {
  // Each planet needs its own pivot point for orbiting
  const pivot = new THREE.Object3D();
  scene.add(pivot);

  // Those thin orbit rings - makes it look more educational
  const orbitGeometry = new THREE.TorusGeometry(data.distance, 0.05, 8, 64);
  const orbitMaterial = new THREE.MeshBasicMaterial({
    color: 0x444444,
    opacity: 0.3, // barely visible, just a hint
    transparent: true,
    side: THREE.DoubleSide,
  });
  const orbitRing = new THREE.Mesh(orbitGeometry, orbitMaterial);
  orbitRing.rotation.x = Math.PI / 2; // lay it flat
  scene.add(orbitRing);

  // Group all planet effects together
  const planetGroup = new THREE.Group();
  
  // Main planet body - icosahedron looks more detailed than sphere
  const geometry = new THREE.IcosahedronGeometry(data.radius, 2);
  const material = new THREE.MeshStandardMaterial({ 
    color: data.color,
    roughness: 0.7, // not too shiny, not too dull
    metalness: 0.1,
    emissive: data.color,
    emissiveIntensity: 0.05 // just a tiny bit of self-illumination
  });
  const mesh = new THREE.Mesh(geometry, material);
  planetGroup.add(mesh);

  // Atmospheric glow - every planet gets one
  const glowGeometry = new THREE.IcosahedronGeometry(data.radius, 2);
  const glowMaterial = createGlowMaterial(data.color);
  const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
  glowMesh.scale.setScalar(1.15); // slightly bigger than the planet
  planetGroup.add(glowMesh);

  // Saturn gets special treatment - it needs rings!
  if (data.name === 'Saturn') {
    const innerRadius = data.radius + 0.5;
    const outerRadius = innerRadius + 3;
    const ringsGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 32);
    const ringsMaterial = new THREE.MeshBasicMaterial({
      color: 0xfaf0e6, // cream colored like real Saturn rings
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const ringsMesh = new THREE.Mesh(ringsGeometry, ringsMaterial);
    ringsMesh.rotation.x = Math.PI / 2; // make them horizontal
    planetGroup.add(ringsMesh);
  }

  // Earth gets a special atmosphere layer - makes it look more alive
  if (data.name === 'Earth') {
    const atmosphereGeometry = new THREE.IcosahedronGeometry(data.radius, 2);
    const atmosphereMaterial = new THREE.MeshStandardMaterial({
      color: 0x87CEEB, // sky blue
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    atmosphereMesh.scale.setScalar(1.05); // just outside the surface
    planetGroup.add(atmosphereMesh);
  }

  // Put the planet at the right distance from center
  planetGroup.position.x = data.distance;
  pivot.add(planetGroup);
  
  mesh.name = data.name; // for raycasting clicks later

  // Keep track of everything - we'll need this for animations
  planets.push({
    name: data.name,
    mesh,
    pivot,
    planetGroup,
    orbitRing,
    speed: data.speed,
    baseSpeed: data.speed,
    angle: Math.random() * Math.PI * 2, // start at random positions
    radius: data.radius,
    distance: data.distance,
  });
});

// Shader function for planet atmospheric glow
function createGlowMaterial(planetColor) {
  const color = new THREE.Color(planetColor);
  
  // Same fresnel effect as the sun but tweaked for planets
  const vertexShader = `
    uniform float fresnelBias;
    uniform float fresnelScale;
    uniform float fresnelPower;
    
    varying float vReflectionFactor;
    
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
      vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
      
      vec3 worldNormal = normalize( mat3( modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz ) * normal );
      
      vec3 I = worldPosition.xyz - cameraPosition;
      
      vReflectionFactor = fresnelBias + fresnelScale * pow( 1.0 + dot( normalize( I ), worldNormal ), fresnelPower );
      
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    uniform vec3 color1;
    uniform vec3 color2;
    
    varying float vReflectionFactor;
    
    void main() {
      float f = clamp( vReflectionFactor, 0.0, 1.0 );
      gl_FragColor = vec4(mix(color2, color1, vec3(f)), f * 0.8);
    }
  `;

  return new THREE.ShaderMaterial({
    uniforms: {
      color1: { value: color },
      color2: { value: new THREE.Color(0x000000) },
      fresnelBias: { value: 0.1 },
      fresnelScale: { value: 1.2 },
      fresnelPower: { value: 2.0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
  });
}

// --- Animation State ---
let paused = false;
const clock = new THREE.Clock();

// Hook up all the speed sliders to actually control the planets
function setupSpeedControls() {
  planets.forEach((planet) => {
    const slider = document.getElementById(`speed-${planet.name.toLowerCase()}`);
    if (slider) {
      slider.value = planet.baseSpeed;
      slider.addEventListener('input', (e) => {
        planet.speed = parseFloat(e.target.value); // real-time speed changes!
      });
    }
  });
}
setupSpeedControls();

// Simple pause/resume functionality
document.getElementById('pause-btn').addEventListener('click', () => {
  paused = !paused;
  document.getElementById('pause-btn').textContent = paused ? 'Resume' : 'Pause';
});

// Theme switcher - because who doesn't like options?
let isDarkMode = true;
document.getElementById('theme-toggle').addEventListener('click', () => {
  isDarkMode = !isDarkMode;
  document.body.classList.toggle('light-mode', !isDarkMode);
  document.getElementById('theme-toggle').textContent = isDarkMode ? '🌙 Dark' : '☀️ Light';
  
  // Change the space background too
  renderer.setClearColor(isDarkMode ? 0x111122 : 0xe6e6f0);
});

// Toggle those orbit rings on/off
let showOrbits = true;
document.getElementById('orbit-toggle').addEventListener('click', () => {
  showOrbits = !showOrbits;
  document.getElementById('orbit-toggle').textContent = showOrbits ? '🔄 Hide Orbits' : '🔄 Show Orbits';
  
  planets.forEach(planet => {
    if (planet.orbitRing) {
      planet.orbitRing.visible = showOrbits; // simple visibility toggle
    }
  });
});

// Tooltip system - shows planet names when you hover
const tooltip = document.createElement('div');
tooltip.style.position = 'fixed';
tooltip.style.pointerEvents = 'none'; // don't block mouse events
tooltip.style.background = 'rgba(30,30,40,0.95)';
tooltip.style.color = '#fff';
tooltip.style.padding = '4px 10px';
tooltip.style.borderRadius = '6px';
tooltip.style.fontSize = '1rem';
tooltip.style.zIndex = '10';
tooltip.style.display = 'none';
tooltip.style.transition = 'opacity 0.15s';
document.body.appendChild(tooltip);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredPlanet = null;
let focusedPlanet = null;
let cameraAnim = null;

function onPointerMove(event) {
  // Normalize mouse coordinates
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const planetMeshes = planets.map(p => p.mesh);
  const intersects = raycaster.intersectObjects([sun, ...planetMeshes]);

  if (intersects.length > 0) {
    const obj = intersects[0].object;
    if (obj !== hoveredPlanet) {
      hoveredPlanet = obj;
      tooltip.textContent = obj.name || 'Sun';
      tooltip.style.display = 'block';
    }
    tooltip.style.left = event.clientX + 12 + 'px';
    tooltip.style.top = event.clientY - 8 + 'px';
    tooltip.style.opacity = '1';
  } else {
    hoveredPlanet = null;
    tooltip.style.opacity = '0';
    tooltip.style.display = 'none';
  }
}

renderer.domElement.addEventListener('pointermove', onPointerMove);

// --- Smooth Camera Controls ---
// Mouse controls for camera rotation
renderer.domElement.addEventListener('mousedown', (event) => {
  if (event.button === 0) { // Left mouse button
    cameraControls.mouseDown = true;
    cameraControls.mouseX = event.clientX;
    cameraControls.mouseY = event.clientY;
    cameraControls.isUserControlling = true;
  }
});

renderer.domElement.addEventListener('mousemove', (event) => {
  if (cameraControls.mouseDown && !cameraAnim) {
    const deltaX = event.clientX - cameraControls.mouseX;
    const deltaY = event.clientY - cameraControls.mouseY;
    
    cameraControls.targetRotationY += deltaX * 0.005;
    cameraControls.targetRotationX += deltaY * 0.005;
    
    // Limit vertical rotation
    cameraControls.targetRotationX = Math.max(-Math.PI/3, Math.min(Math.PI/3, cameraControls.targetRotationX));
    
    cameraControls.mouseX = event.clientX;
    cameraControls.mouseY = event.clientY;
  }
});

renderer.domElement.addEventListener('mouseup', () => {
  cameraControls.mouseDown = false;
  setTimeout(() => {
    cameraControls.isUserControlling = false;
  }, 1000); // Allow user control to fade out
});

// Zoom controls with mouse wheel
renderer.domElement.addEventListener('wheel', (event) => {
  event.preventDefault();
  const zoomSpeed = 10;
  cameraControls.targetZoom += event.deltaY * zoomSpeed * 0.01;
  cameraControls.targetZoom = Math.max(50, Math.min(500, cameraControls.targetZoom));
  cameraControls.isUserControlling = true;
  
  setTimeout(() => {
    cameraControls.isUserControlling = false;
  }, 1000);
});

// Touch controls for mobile
let touchStart = { x: 0, y: 0 };
let touchDistance = 0;

renderer.domElement.addEventListener('touchstart', (event) => {
  event.preventDefault();
  if (event.touches.length === 1) {
    // Single touch - rotation
    touchStart.x = event.touches[0].clientX;
    touchStart.y = event.touches[0].clientY;
    cameraControls.isUserControlling = true;
  } else if (event.touches.length === 2) {
    // Two touches - zoom
    const dx = event.touches[0].clientX - event.touches[1].clientX;
    const dy = event.touches[0].clientY - event.touches[1].clientY;
    touchDistance = Math.sqrt(dx * dx + dy * dy);
    cameraControls.isUserControlling = true;
  }
});

renderer.domElement.addEventListener('touchmove', (event) => {
  event.preventDefault();
  if (!cameraAnim) {
    if (event.touches.length === 1) {
      // Single touch - rotation
      const deltaX = event.touches[0].clientX - touchStart.x;
      const deltaY = event.touches[0].clientY - touchStart.y;
      
      cameraControls.targetRotationY += deltaX * 0.01;
      cameraControls.targetRotationX += deltaY * 0.01;
      
      // Limit vertical rotation
      cameraControls.targetRotationX = Math.max(-Math.PI/3, Math.min(Math.PI/3, cameraControls.targetRotationX));
      
      touchStart.x = event.touches[0].clientX;
      touchStart.y = event.touches[0].clientY;
    } else if (event.touches.length === 2) {
      // Two touches - zoom
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      const newDistance = Math.sqrt(dx * dx + dy * dy);
      
      const zoomDelta = (touchDistance - newDistance) * 0.5;
      cameraControls.targetZoom += zoomDelta;
      cameraControls.targetZoom = Math.max(50, Math.min(500, cameraControls.targetZoom));
      
      touchDistance = newDistance;
    }
  }
});

renderer.domElement.addEventListener('touchend', (event) => {
  event.preventDefault();
  setTimeout(() => {
    cameraControls.isUserControlling = false;
  }, 1000);
});

// Update camera position smoothly
function updateCameraControls() {
  if (!cameraAnim) {
    // Smooth interpolation
    cameraControls.currentRotationX += (cameraControls.targetRotationX - cameraControls.currentRotationX) * cameraControls.smoothness;
    cameraControls.currentRotationY += (cameraControls.targetRotationY - cameraControls.currentRotationY) * cameraControls.smoothness;
    cameraControls.currentZoom += (cameraControls.targetZoom - cameraControls.currentZoom) * cameraControls.smoothness;
    
    // Apply camera transformations
    const x = Math.sin(cameraControls.currentRotationY) * cameraControls.currentZoom;
    const z = Math.cos(cameraControls.currentRotationY) * cameraControls.currentZoom;
    const y = 90 + Math.sin(cameraControls.currentRotationX) * 50;
    
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
    
    // Update default position if user isn't actively controlling
    if (!cameraControls.isUserControlling) {
      defaultCameraPos.copy(camera.position);
    }
  }
}

// --- Camera Focus Animation ---
function animateCameraTo(targetPos, lookAt, duration = 1200) {
  if (cameraAnim) cancelAnimationFrame(cameraAnim);
  
  const startPos = camera.position.clone();
  const startLook = new THREE.Vector3();
  camera.getWorldDirection(startLook);
  startLook.multiplyScalar(-1).add(camera.position);
  
  const endPos = targetPos.clone();
  const endLook = lookAt.clone();
  let startTime = null;

  function animateStep(now) {
    if (!startTime) startTime = now;
    const elapsed = now - startTime;
    let t = elapsed / duration;
    
    // Smooth easing function (ease-in-out)
    t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    t = Math.min(1, t);
    
    camera.position.lerpVectors(startPos, endPos, t);
    const currentLook = startLook.clone().lerp(endLook, t);
    camera.lookAt(currentLook);
    
    if (t < 1) {
      cameraAnim = requestAnimationFrame(animateStep);
    } else {
      cameraAnim = null;
      // Update camera controls to match new position
      const distance = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
      cameraControls.targetZoom = distance;
      cameraControls.currentZoom = distance;
      
      // Calculate rotation angles
      const spherical = new THREE.Spherical();
      spherical.setFromVector3(camera.position);
      cameraControls.targetRotationY = spherical.theta;
      cameraControls.currentRotationY = spherical.theta;
      cameraControls.targetRotationX = Math.PI/2 - spherical.phi - Math.PI/2;
      cameraControls.currentRotationX = Math.PI/2 - spherical.phi - Math.PI/2;
    }
  }
  cameraAnim = requestAnimationFrame(animateStep);
}

// --- Click to Focus ---
renderer.domElement.addEventListener('click', (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const planetMeshes = planets.map(p => p.mesh);
  const intersects = raycaster.intersectObjects([sun, ...planetMeshes]);
  if (intersects.length > 0) {
    const obj = intersects[0].object;
    if (obj === sun || obj.name === 'Sun') {
      // Reset to default view
      animateCameraTo(defaultCameraPos, defaultCameraLook);
      focusedPlanet = null;
    } else {
      // Focus on planet
      const planet = planets.find(p => p.mesh === obj);
      if (planet) {
        const planetWorldPos = new THREE.Vector3();
        planet.planetGroup.getWorldPosition(planetWorldPos);
        // Camera offset: back and up from planet (adjusted for larger planets)
        const offset = new THREE.Vector3(0, planet.radius * 3, planet.radius * 8);
        const targetPos = planetWorldPos.clone().add(offset);
        animateCameraTo(targetPos, planetWorldPos);
        focusedPlanet = planet;
      }
    }
  } else {
    // Clicked empty space: reset
    animateCameraTo(defaultCameraPos, defaultCameraLook);
    focusedPlanet = null;
  }
});

// Main animation loop - this runs 60 times per second
function animate() {
  requestAnimationFrame(animate);
  
  // Keep camera controls smooth
  updateCameraControls();
  
  if (!paused) {
    const delta = clock.getDelta(); // time since last frame
    const time = clock.getElapsedTime(); // total time running
    
    // Make the sun rotate slowly and animate its surface
    sunGroup.rotation.y = -time * 0.1;
    updateSunCorona(time);
    
    // Move all the planets around
    planets.forEach((planet) => {
      // Each planet orbits at its own speed
      planet.angle += planet.speed;
      planet.pivot.rotation.y = planet.angle;
      
      // Planets also spin on their own axis
      planet.planetGroup.rotation.y += 0.02;
      
      // Make the orbit rings slowly rotate too - just for fun
      if (planet.orbitRing) {
        planet.orbitRing.rotation.z += 0.001;
      }
    });
  }
  renderer.render(scene, camera); // actually draw everything
}
animate(); // start the animation loop

// Handle window resizing - pretty standard stuff
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Add some stars in the background - makes it feel more spacey
function addStars() {
  const starGeometry = new THREE.BufferGeometry();
  const starCount = 1000; // that should be enough stars
  const positions = [];
  for (let i = 0; i < starCount; i++) {
    // Place stars randomly on a sphere around everything
    const r = 400 + Math.random() * 200;
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);
    positions.push(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi)
    );
  }
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 1 });
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);
}
addStars(); // actually create the stars
addStars(); 