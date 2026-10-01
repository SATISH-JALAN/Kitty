/**
 * The lantern sky (brief 15.4) — the only three.js file.
 * An orthographic camera and one InstancedMesh of quads (40 desktop / 22 mobile). Each
 * lantern's drift (4–12 px/s upward, a sideways curl, ±4° sway) is computed in the vertex
 * shader from time, so a frame costs one uniform update. Depth sets scale, speed and
 * softness (three pre-softened levels of one procedural sprite). The field parallaxes
 * ±10 px with the pointer; `boost` adds upward velocity during Act 1's dolly.
 * DPR ≤ 1.5; rendering pauses when offscreen or the tab is hidden.
 */
import {
  CanvasTexture,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
  AdditiveBlending,
  SRGBColorSpace,
} from "three";

export { skySupported } from "./support";

/** A 3-variant × 3-softness atlas of paper lanterns, drawn once on a canvas. */
function makeAtlas(): CanvasTexture {
  const cell = 128;
  const c = document.createElement("canvas");
  c.width = cell * 3;
  c.height = cell * 3;
  const g = c.getContext("2d")!;
  for (let blur = 0; blur < 3; blur++) {
    for (let v = 0; v < 3; v++) {
      const cx = v * cell + cell / 2;
      const cy = blur * cell + cell / 2;
      g.save();
      g.filter = `blur(${blur * 2.5}px)`;
      // Glow.
      const glow = g.createRadialGradient(cx, cy, 2, cx, cy, cell * 0.48);
      glow.addColorStop(0, "rgba(255,214,140,0.55)");
      glow.addColorStop(0.45, "rgba(255,170,80,0.18)");
      glow.addColorStop(1, "rgba(255,150,60,0)");
      g.fillStyle = glow;
      g.fillRect(v * cell, blur * cell, cell, cell);
      // Body: three silhouettes (round, tall, drum).
      const w = [26, 20, 28][v];
      const h = [30, 38, 26][v];
      const body = g.createLinearGradient(cx, cy - h, cx, cy + h);
      body.addColorStop(0, "#FFE6A8");
      body.addColorStop(0.6, "#FFC061");
      body.addColorStop(1, "#E9812E");
      g.fillStyle = body;
      g.beginPath();
      g.ellipse(cx, cy, w, h, 0, 0, Math.PI * 2);
      g.fill();
      // Ribs and cap.
      g.strokeStyle = "rgba(160,60,30,0.45)";
      g.lineWidth = 1.2;
      for (const k of [-0.5, 0, 0.5]) {
        g.beginPath();
        g.ellipse(cx, cy, Math.abs(w * k) + 0.01, h, 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.fillStyle = "#6B2A3A";
      g.fillRect(cx - w * 0.45, cy - h - 3, w * 0.9, 5);
      g.fillRect(cx - w * 0.4, cy + h - 2, w * 0.8, 4);
      g.restore();
    }
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

const VERT = /* glsl */ `
  attribute vec4 aSeed; // x, y (0–1 of field), depth (0–1), variant
  uniform float uTime;
  uniform float uBoost;
  uniform vec2 uView;
  uniform vec2 uPointer;
  varying vec2 vUv;
  varying float vDepth;
  varying float vVariant;
  varying float vFlicker;

  void main() {
    float depth = aSeed.z;
    float speed = mix(4.0, 12.0, depth) + uBoost * mix(20.0, 90.0, depth);
    float h = uView.y + 160.0;
    float y = mod(aSeed.y * h + uTime * speed, h) - 80.0;
    float x = aSeed.x * uView.x
      + sin(uTime * (0.12 + depth * 0.1) + aSeed.x * 31.0) * mix(8.0, 26.0, depth)
      + sin(uTime * 0.37 + aSeed.y * 17.0) * 4.0;
    x += uPointer.x * mix(3.0, 10.0, depth);
    y += uPointer.y * mix(2.0, 8.0, depth);
    float scale = mix(14.0, 46.0, depth * depth);
    float rot = sin(uTime * 0.6 + aSeed.x * 9.0) * 0.07;
    vec2 p = position.xy * scale;
    p = vec2(p.x * cos(rot) - p.y * sin(rot), p.x * sin(rot) + p.y * cos(rot));
    vec2 pos = vec2(x, y) + p;
    gl_Position = projectionMatrix * vec4(pos, 0.0, 1.0);
    vUv = uv;
    vDepth = depth;
    vVariant = aSeed.w;
    vFlicker = 0.9 + 0.1 * sin(uTime * (13.0 + aSeed.x * 7.0) + aSeed.y * 40.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uAtlas;
  varying vec2 vUv;
  varying float vDepth;
  varying float vVariant;
  varying float vFlicker;
  void main() {
    // Far lanterns are softer: blur row 2 (far) … 0 (near).
    float row = floor((1.0 - vDepth) * 2.99);
    vec2 uv = (vUv + vec2(vVariant, 2.0 - row)) / 3.0;
    vec4 c = texture2D(uAtlas, uv);
    float a = c.a * mix(0.35, 0.95, vDepth) * vFlicker;
    gl_FragColor = vec4(c.rgb * a, a);
  }
`;

export interface LanternSkyHandle {
  setBoost: (v: number) => void;
  destroy: () => void;
}

export function mountLanternSky(canvas: HTMLCanvasElement, opts: { count?: number } = {}): LanternSkyHandle | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "low-power" });
  } catch {
    return null;
  }
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  renderer.setPixelRatio(dpr);
  const count = opts.count ?? (window.innerWidth < 768 ? 22 : 40);
  const scene = new Scene();
  const camera = new OrthographicCamera(0, 1, 1, 0, -10, 10);
  const geo = new PlaneGeometry(1, 1.3);
  const seeds = new Float32Array(count * 4);
  let s = 1234567;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    seeds[i * 4] = rnd();
    seeds[i * 4 + 1] = rnd();
    seeds[i * 4 + 2] = Math.pow(rnd(), 1.6);
    seeds[i * 4 + 3] = Math.floor(rnd() * 3);
  }
  geo.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 4));
  const atlas = makeAtlas();
  const mat = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uBoost: { value: 0 }, uView: { value: [1, 1] }, uPointer: { value: [0, 0] }, uAtlas: { value: atlas } },
  });
  const mesh = new InstancedMesh(geo, mat, count);
  const id = new Matrix4();
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, id);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    camera.right = w;
    camera.top = h;
    camera.updateProjectionMatrix();
    mat.uniforms.uView.value = [w, h];
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (e: PointerEvent) => {
    ptr.tx = e.clientX / window.innerWidth - 0.5;
    ptr.ty = e.clientY / window.innerHeight - 0.5;
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  let visible = true;
  let raf = 0;
  let last = performance.now();
  let t = 0;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (!visible || document.hidden) {
      last = now;
      return;
    }
    t += Math.min(0.05, (now - last) / 1000);
    last = now;
    ptr.x += (ptr.tx - ptr.x) * 0.05;
    ptr.y += (ptr.ty - ptr.y) * 0.05;
    mat.uniforms.uTime.value = t;
    mat.uniforms.uPointer.value = [-ptr.x * 2, ptr.y * 2];
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(loop);
  const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
  io.observe(canvas);

  return {
    setBoost: (v) => (mat.uniforms.uBoost.value = v),
    destroy: () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      geo.dispose();
      mat.dispose();
      atlas.dispose();
      renderer.dispose();
    },
  };
}
