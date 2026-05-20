import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GUI } from 'lil-gui';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { AsciiEffect } from 'three/examples/jsm/effects/AsciiEffect.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color('white');

const rgbeLoader = new RGBELoader();
rgbeLoader.load('/hdr/background.hdr', function (texture) {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = texture;
  scene.background = texture;
});

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);

let useAscii = false;
let effect = createAsciiEffect(false);
document.body.appendChild(effect.domElement);
renderer.domElement.style.display = '';      // Show default renderer by default
effect.domElement.style.display = 'none';    // Hide ASCII renderer initially

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

function createAsciiEffect(useColor) {
  const asciiEffect = new AsciiEffect(renderer, ' .:-+*=%@#', { invert: true, color: useColor });
  asciiEffect.setSize(window.innerWidth, window.innerHeight);
  asciiEffect.domElement.style.color = 'white';
  asciiEffect.domElement.style.backgroundColor = 'black';
  asciiEffect.domElement.style.fontSize = (10 / 1) + 'px';
  asciiEffect.domElement.style.position = 'absolute';
  asciiEffect.domElement.style.top = '50%';
  asciiEffect.domElement.style.left = '50%';
  asciiEffect.domElement.style.transform = 'translate(-50%, -50%)';
  asciiEffect.domElement.style.display = useAscii ? '' : 'none';
  return asciiEffect;
}

const loaderDiv = document.createElement('div');
loaderDiv.id = 'loader';
loaderDiv.textContent = '';
loaderDiv.style.position = 'fixed';
loaderDiv.style.top = '50%';
loaderDiv.style.left = '50%';
loaderDiv.style.transform = 'translate(-50%, -50%)';
loaderDiv.style.width = '50px';
loaderDiv.style.height = '50px';
loaderDiv.style.border = '5px solid rgba(0, 0, 0, 0.1)';
loaderDiv.style.borderTop = '5px solid black';
loaderDiv.style.borderRadius = '50%';
loaderDiv.style.animation = 'spin 1s linear infinite';
document.body.appendChild(loaderDiv);

const downloadCallout = document.createElement('div');
downloadCallout.textContent = '';
downloadCallout.style.position = 'fixed';
downloadCallout.style.top = '12px';
downloadCallout.style.left = '12px';
downloadCallout.style.zIndex = '20';
downloadCallout.style.fontFamily = 'monospace';
downloadCallout.style.fontSize = '14px';
downloadCallout.style.color = 'white';
downloadCallout.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.9)';
downloadCallout.style.pointerEvents = 'none';
document.body.appendChild(downloadCallout);

// Add spinner animation style
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight('white', 1);
light.position.set(5, 5, 5);
scene.add(light);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // soft white ambient light
scene.add(ambientLight);

// Point light and visible mesh representation
const pointLight = new THREE.PointLight(0xffaa55, 1, 100);
pointLight.position.set(2, 2, 2);
scene.add(pointLight);

const defaultSceneBackground = scene.background;
const darkVideoSceneBackground = new THREE.Color('black');
const lightVideoSceneBackground = new THREE.Color('white');
const videoPlaneDistance = 1;
const videoFillMode = 'cover';
let previousSceneBackground = defaultSceneBackground;

let object;
let animationStarted = false;

const objLoader = new OBJLoader();

objLoader.load('/models/model.obj', (obj) => {
  setTimeout(() => {
    onObjLoad(obj);
  }, 2000); // 2 second delay to simulate loading
}, undefined, (err) => {
  console.error("Error loading .obj file:", err);
  removeLoader();
  startAnimation();
});

function onObjLoad(obj) {
  removeLoader();

  object = obj;
  object.position.set(0, 0, 0);
  object.scale.set(1, 1, 1);
  object.traverse((child) => {
    if (child.isMesh && child.material) {
      // Removed line that replaced material with red MeshStandardMaterial
    }
  });

  centerObject(object);

  if (!activeVideoElement) {
    frameObject(object);
    scene.add(object);
  }

  startAnimation();
}

function centerObject(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  obj.position.sub(center);
}

function frameObject(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());

  camera.position.set(0, 0, size.length()); // move camera back based on size
  controls.target.set(0, 0, 0);
  controls.minDistance = size.length() * 0.5;
  controls.maxDistance = size.length() * 3;
  controls.enabled = true;
  camera.lookAt(controls.target);
  controls.update();
}

const gui = new GUI();


const asciiSettings = {
  asciiRender: false,
  asciiColor: false,
  resolutionScale: 1,
  webcam: false,
  videoWhiteBackground: false,
  videoSpeed: 1,
  widthScale: 1,
  heightScale: 1,
  exportDuration: 10,
  youtubeUrl: '',
  loadYouTube: () => loadYouTubeUrl(asciiSettings.youtubeUrl),
  uploadMp4: () => videoFileInput.click(),
  downloadRenderedVideo: () => downloadRenderedVideo(),
  clearVideo: () => clearVideoSource()
};

gui.add(asciiSettings, 'asciiRender').name('ASCII Render').onChange(val => {
  useAscii = val;
  updateRenderVisibility();

  if (!val) {
    renderer.setSize(window.innerWidth, window.innerHeight); // Restore main render resolution
  }
});
gui.add(asciiSettings, 'asciiColor').name('ASCII Color').onChange(updateAsciiColorMode);
gui.add(asciiSettings, 'resolutionScale', 0.1, 2).step(0.1).name('ASCII Resolution').onChange(updateAsciiDisplaySize);
gui.add(asciiSettings, 'widthScale', 0.5, 2).step(0.1).name('Width Scale').onChange(updateAsciiDisplaySize);
gui.add(asciiSettings, 'heightScale', 0.5, 2).step(0.1).name('Height Scale').onChange(updateAsciiDisplaySize);
gui.add(asciiSettings, 'webcam').name('Use Webcam for ASCII').onChange(toggleWebcamAscii);
gui.add(asciiSettings, 'videoWhiteBackground').name('White Video Background').onChange(updateVideoPresentation);
gui.add(asciiSettings, 'videoSpeed', 0.25, 3).step(0.05).name('Video Speed').onChange(updateVideoPlaybackRate);
gui.add(asciiSettings, 'exportDuration', 1, 120).step(1).name('Export Duration (s)');
gui.add(asciiSettings, 'uploadMp4').name('Upload MP4 Video');
gui.add(asciiSettings, 'downloadRenderedVideo').name('Download Rendered Video');
gui.add(asciiSettings, 'youtubeUrl').name('YouTube URL');
gui.add(asciiSettings, 'loadYouTube').name('Load YouTube');
gui.add(asciiSettings, 'clearVideo').name('Clear Video');

function updateAsciiDisplaySize() {
  const width = window.innerWidth * asciiSettings.widthScale;
  const height = window.innerHeight * asciiSettings.heightScale;
  effect.setSize(width * asciiSettings.resolutionScale, height * asciiSettings.resolutionScale);
  effect.domElement.style.fontSize = (10 / asciiSettings.resolutionScale) + 'px';
  effect.domElement.style.position = 'absolute';
  effect.domElement.style.top = '50%';
  effect.domElement.style.left = '50%';
  effect.domElement.style.transform = 'translate(-50%, -50%)';
}

function updateAsciiColorMode(useColor) {
  const previousEffect = effect;
  effect = createAsciiEffect(useColor);
  previousEffect.domElement.replaceWith(effect.domElement);
  updateAsciiDisplaySize();
  updateVideoPresentation();

  updateRenderVisibility();
}

function updateVideoPlaybackRate() {
  if (!activeVideoElement) return;
  activeVideoElement.playbackRate = asciiSettings.videoSpeed;
  activeVideoElement.defaultPlaybackRate = asciiSettings.videoSpeed;
}

let videoStream = null;
let videoTexture = null;
let videoPlane = null;
let activeVideoElement = null;
let uploadedVideoUrl = null;
let youtubeFrame = null;
let isRecording = false;

const videoFileInput = document.createElement('input');
videoFileInput.type = 'file';
videoFileInput.accept = 'video/mp4,.mp4,video/*';
videoFileInput.style.display = 'none';
document.body.appendChild(videoFileInput);

videoFileInput.addEventListener('change', () => {
  const [file] = videoFileInput.files;
  if (file) loadVideoFile(file);
  videoFileInput.value = '';
});

async function toggleWebcamAscii(useWebcam) {
  if (useWebcam) {
    try {
      clearVideoSource({ restoreObject: false, keepWebcamToggle: true });
      videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = videoStream;
      video.muted = true;
      video.playsInline = true;
      await video.play();

      setVideoSource(video);
    } catch (err) {
      console.error('Webcam access failed:', err);
      asciiSettings.webcam = false;
      updateGuiDisplay();
    }
  } else {
    clearVideoSource();
  }
}

function loadVideoFile(file) {
  if (!file.type.startsWith('video/') && !file.name.toLowerCase().endsWith('.mp4')) return;

  clearVideoSource({ restoreObject: false });
  uploadedVideoUrl = URL.createObjectURL(file);

  const video = document.createElement('video');
  video.src = uploadedVideoUrl;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.autoplay = true;

  video.addEventListener('loadedmetadata', () => {
    video.play().then(() => {
      setVideoSource(video);
      asciiSettings.webcam = false;
      updateGuiDisplay();
    }).catch((err) => {
      console.error('Video playback failed:', err);
      clearVideoSource();
    });
  }, { once: true });
}

function setVideoSource(video) {
  removeLoader();
  removeYouTubeFrame();
  removeVideoPlane();
  activeVideoElement = video;
  updateVideoPlaybackRate();

  videoTexture = new THREE.VideoTexture(video);
  videoTexture.colorSpace = THREE.SRGBColorSpace;

  enterVideoScene();

  const geometry = createVideoGeometry(video);
  const material = new THREE.MeshBasicMaterial({ map: videoTexture });
  videoPlane = new THREE.Mesh(geometry, material);
  videoPlane.position.set(0, 0, -videoPlaneDistance);
  camera.add(videoPlane);

  updateVideoPresentation();
  startAnimation();
}

function loadYouTubeUrl(url) {
  const videoId = getYouTubeVideoId(url);

  if (!videoId) {
    console.warn('Invalid YouTube URL:', url);
    return;
  }

  clearVideoSource({ restoreObject: false });
  removeLoader();

  const video = document.createElement('video');
  video.src = getYouTubeStreamEndpoint(url);
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.autoplay = true;

  video.addEventListener('loadedmetadata', () => {
    video.play().then(() => {
      setVideoSource(video);
      asciiSettings.webcam = false;
      updateGuiDisplay();
    }).catch((err) => {
      console.error('YouTube playback failed:', err);
      clearVideoSource();
    });
  }, { once: true });

  video.addEventListener('error', async () => {
    await reportYouTubeStreamError(url);
    clearVideoSource();
  }, { once: true });
}

function getYouTubeStreamEndpoint(url) {
  return `/api/youtube-stream?url=${encodeURIComponent(url)}`;
}

async function reportYouTubeStreamError(url) {
  try {
    const response = await fetch(getYouTubeStreamEndpoint(url));
    const contentType = response.headers.get('content-type') || '';

    if (!response.ok && contentType.includes('application/json')) {
      const data = await response.json();
      console.error('YouTube stream failed to load:', data.error || `Request failed with status ${response.status}`);
      return;
    }
  } catch (err) {
    console.error('YouTube stream failed to load:', err);
    return;
  }

  console.error('YouTube stream failed to load.');
}

function getYouTubeVideoId(url) {
  try {
    const parsedUrl = new URL(url.trim());
    const host = parsedUrl.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      return parsedUrl.pathname.split('/').filter(Boolean)[0] || null;
    }

    if (host.endsWith('youtube.com')) {
      if (parsedUrl.pathname === '/watch') return parsedUrl.searchParams.get('v');

      const [, route, id] = parsedUrl.pathname.split('/');
      if (['embed', 'shorts', 'live'].includes(route)) return id || null;
    }
  } catch (err) {
    console.warn('YouTube URL parsing failed:', err);
  }

  return null;
}

function createVideoGeometry(video) {
  const viewportAspect = window.innerWidth / window.innerHeight;
  const videoAspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : viewportAspect;
  const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * videoPlaneDistance;
  const visibleWidth = visibleHeight * viewportAspect;

  let width = visibleWidth;
  let height = width / videoAspect;

  if ((videoFillMode === 'contain' && height > visibleHeight) || (videoFillMode === 'cover' && height < visibleHeight)) {
    height = visibleHeight;
    width = height * videoAspect;
  }

  return new THREE.PlaneGeometry(width, height);
}

function enterVideoScene() {
  if (object) scene.remove(object);

  previousSceneBackground = scene.background;
  scene.background = getVideoSceneBackground();
  controls.enabled = false;
  controls.target.set(0, 0, 0);
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -1);
  camera.updateProjectionMatrix();
}

function clearVideoSource(options = {}) {
  const { restoreObject = true, keepWebcamToggle = false } = options;

  removeYouTubeFrame();
  removeVideoPlane();

  if (activeVideoElement) {
    activeVideoElement.pause();
    activeVideoElement.srcObject = null;
    activeVideoElement.removeAttribute('src');
    activeVideoElement.load();
    activeVideoElement = null;
  }

  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }

  if (uploadedVideoUrl) {
    URL.revokeObjectURL(uploadedVideoUrl);
    uploadedVideoUrl = null;
  }

  if (!keepWebcamToggle) {
    asciiSettings.webcam = false;
    updateGuiDisplay();
  }

  controls.enabled = true;
  scene.background = previousSceneBackground;

  if (restoreObject && object) {
    frameObject(object);
    scene.add(object);
  }

  updateVideoPresentation();
  updateRenderVisibility();
}

function removeYouTubeFrame() {
  if (!youtubeFrame) return;

  youtubeFrame.remove();
  youtubeFrame = null;
}

function removeVideoPlane() {
  if (!videoPlane) return;

  videoPlane.parent?.remove(videoPlane);
  videoPlane.geometry.dispose();
  videoPlane.material.dispose();
  videoPlane = null;

  if (videoTexture) {
    videoTexture.dispose();
    videoTexture = null;
  }
}

function updateGuiDisplay() {
  gui.controllersRecursive().forEach(controller => controller.updateDisplay());
}

function updateRenderVisibility() {
  renderer.domElement.style.display = useAscii ? 'none' : '';
  effect.domElement.style.display = useAscii ? '' : 'none';
  controls.domElement = useAscii ? effect.domElement : renderer.domElement;
}

function getVideoSceneBackground() {
  return asciiSettings.videoWhiteBackground ? lightVideoSceneBackground : darkVideoSceneBackground;
}

function updateVideoPresentation() {
  const useLightVideoBackground = Boolean(activeVideoElement) && asciiSettings.videoWhiteBackground;

  effect.domElement.style.backgroundColor = useLightVideoBackground ? 'white' : 'black';
  effect.domElement.style.color = useLightVideoBackground ? 'black' : 'white';

  if (activeVideoElement) {
    scene.background = getVideoSceneBackground();
  }
}

function setDownloadCallout(message = '') {
  downloadCallout.textContent = message;
}

async function downloadRenderedVideo() {
  if (isRecording) return;

  const recorderOptions = getSupportedRecorderOptions();
  if (!recorderOptions) {
    console.error('No supported video recorder format is available in this browser.');
    return;
  }

  const stream = useAscii ? createAsciiRecordingStream() : renderer.domElement.captureStream(30);
  const recorder = new MediaRecorder(stream, recorderOptions);
  const chunks = [];
  const duration = getRecordingDuration();
  const previousLoop = activeVideoElement?.loop;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  isRecording = true;
  setDownloadCallout('Recording video...');

  const recordingStopped = new Promise((resolve, reject) => {
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });

    recorder.addEventListener('error', (event) => {
      reject(event.error || new Error('Recording failed.'));
    });

    recorder.addEventListener('stop', () => {
      resolve(new Blob(chunks, { type: recorder.mimeType }));
    });
  });

  try {
    if (activeVideoElement) {
      activeVideoElement.loop = false;
      await restartVideoForRecording(activeVideoElement);
    }

    recorder.start();

    window.setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
      stream.getTracks().forEach(track => track.stop());
    }, duration * 1000);

    const recordedBlob = await recordingStopped;
    setDownloadCallout('Converting to mp4...');

    const mp4Blob = await convertRecordingToMp4(recordedBlob);
    downloadBlob(mp4Blob, `ascii-render-${timestamp}.mp4`);
  } catch (err) {
    console.error('Video export failed:', err);
    stream.getTracks().forEach(track => track.stop());
  } finally {
    isRecording = false;
    setDownloadCallout('');

    if (activeVideoElement && previousLoop !== undefined) {
      activeVideoElement.loop = previousLoop;
    }
  }
}

async function convertRecordingToMp4(recordedBlob) {
  let response;

  try {
    response = await fetch('/api/export-mp4', {
      method: 'POST',
      headers: {
        'Content-Type': recordedBlob.type || 'video/webm'
      },
      body: recordedBlob
    });
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error('Could not reach the local export server. Restart `npm run dev` and try the download again.');
    }

    throw err;
  }

  if (!response.ok) {
    let message = `MP4 conversion failed with status ${response.status}`;

    try {
      const data = await response.json();
      if (data?.error) message = data.error;
    } catch {
      // Fall back to the default error message when the response is not JSON.
    }

    throw new Error(message);
  }

  return response.blob();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getSupportedRecorderOptions() {
  if (!window.MediaRecorder) return null;

  const mimeTypes = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ];

  const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
  return mimeType ? { mimeType } : null;
}

function getRecordingDuration() {
  if (activeVideoElement?.duration && Number.isFinite(activeVideoElement.duration)) {
    return Math.max(1, Math.min(activeVideoElement.duration, 120));
  }

  return asciiSettings.exportDuration;
}

function restartVideoForRecording(video) {
  return new Promise((resolve) => {
    const beginPlayback = () => video.play().finally(resolve);

    if (!Number.isFinite(video.duration) || video.currentTime < 0.05) {
      beginPlayback();
      return;
    }

    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      beginPlayback();
    };

    video.pause();
    video.addEventListener('seeked', onSeeked);
    video.currentTime = 0;
  });
}

function createAsciiRecordingStream() {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(window.innerWidth * window.devicePixelRatio);
  canvas.height = Math.round(window.innerHeight * window.devicePixelRatio);

  const context = canvas.getContext('2d');
  const stream = canvas.captureStream(30);

  function drawFrame() {
    if (stream.getVideoTracks()[0]?.readyState !== 'live') return;

    drawAsciiDomToCanvas(context, canvas);
    requestAnimationFrame(drawFrame);
  }

  drawFrame();
  return stream;
}

function drawAsciiDomToCanvas(context, canvas) {
  const table = effect.domElement.querySelector('table');
  const cell = table?.querySelector('td');
  const computed = table ? window.getComputedStyle(table) : null;
  const fontSize = computed ? parseFloat(computed.fontSize) : 12;
  const lineHeight = computed ? parseFloat(computed.lineHeight) || fontSize : fontSize;
  const fontFamily = computed?.fontFamily || 'courier new, monospace';
  const rect = effect.domElement.getBoundingClientRect();
  const scaleX = canvas.width / window.innerWidth;
  const scaleY = canvas.height / window.innerHeight;
  const startX = Math.max(0, rect.left * scaleX);
  const startY = Math.max(0, rect.top * scaleY);

  context.fillStyle = 'black';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.font = `${fontSize * scaleY}px ${fontFamily}`;
  context.textBaseline = 'top';

  if (!cell) return;

  const charWidth = context.measureText('M').width;
  const rowHeight = lineHeight * scaleY;

  if (asciiSettings.asciiColor) {
    drawColoredAscii(cell, context, startX, startY, charWidth, rowHeight);
    return;
  }

  context.fillStyle = 'white';
  cell.innerText.split('\n').forEach((line, row) => {
    context.fillText(line.replace(/\u00a0/g, ' '), startX, startY + row * rowHeight);
  });
}

function drawColoredAscii(cell, context, startX, startY, charWidth, rowHeight) {
  let x = startX;
  let y = startY;

  cell.childNodes.forEach((node) => {
    if (node.nodeName === 'BR') {
      x = startX;
      y += rowHeight;
      return;
    }

    const text = (node.textContent || ' ').replace(/\u00a0/g, ' ');
    context.fillStyle = node.nodeType === Node.ELEMENT_NODE ? node.style.color || 'white' : 'white';
    context.fillText(text, x, y);
    x += charWidth * text.length;
  });
}

function removeLoader() {
  const loader = document.getElementById('loader');
  if (loader) loader.remove();
}

function startAnimation() {
  if (animationStarted) return;
  animationStarted = true;
  animate();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  if (useAscii) {
    effect.render(scene, camera);
  } else {
    renderer.render(scene, camera);
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  updateAsciiDisplaySize();
  if (videoPlane && activeVideoElement) {
    videoPlane.geometry.dispose();
    videoPlane.geometry = createVideoGeometry(activeVideoElement);
  }
});

window.addEventListener('dragover', (event) => {
  event.preventDefault();
});

window.addEventListener('drop', (event) => {
  event.preventDefault();
  const [file] = event.dataTransfer.files;
  if (file && (file.type.startsWith('video/') || file.name.toLowerCase().endsWith('.mp4'))) {
    loadVideoFile(file);
  }
});

const footerText = document.createElement('div');
footerText.textContent = 'pee pee poo poo';
footerText.style.position = 'fixed';
footerText.style.bottom = '10px';
footerText.style.left = '50%';
footerText.style.transform = 'translateX(-50%)';
footerText.style.color = 'white';
footerText.style.fontFamily = 'Times New Roman, serif';
footerText.style.fontSize = '16px';
document.body.appendChild(footerText);
