import * as THREE from 'three';

function makeGradient(levels) {
  const data = new Uint8Array(levels.length * 4);
  levels.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  const tex = new THREE.DataTexture(data, levels.length, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

const gradient = makeGradient([110, 190, 255]);

export const toon = (color, extra = {}) =>
  new THREE.MeshToonMaterial({ color, gradientMap: gradient, ...extra });

/** ShaderMaterial 용: hex를 변환 없이 그대로 (화면 색 그대로 쓰기) */
export const raw = (hex) => new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace);

export const INK = 0x2a1233;

// 법선 방향으로 부풀린 뒷면 = 두께가 일정한 만화 외곽선
const outlineCache = new Map();
function outlineMaterial(thickness) {
  if (!outlineCache.has(thickness)) {
    outlineCache.set(
      thickness,
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: raw(INK) }, uThick: { value: thickness } },
        vertexShader: /* glsl */ `
          uniform float uThick;
          void main() {
            vec3 p = position + normal * uThick;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          void main() { gl_FragColor = vec4(uColor, 1.0); }
        `,
        side: THREE.BackSide,
      }),
    );
  }
  return outlineCache.get(thickness);
}

export function withOutline(mesh, thickness = 0.03) {
  const o = new THREE.Mesh(mesh.geometry, outlineMaterial(thickness));
  o.raycast = () => {};
  mesh.add(o);
  return mesh;
}

/** 가장자리만 은은하게 빛나는 림라이트 껍질 (배경에서 캐릭터 분리) */
export function rimShell(geometry, color, strength = 0.7, power = 2.6) {
  const m = new THREE.Mesh(
    geometry,
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: raw(color) }, uStrength: { value: strength }, uPower: { value: power } },
      vertexShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uStrength;
        uniform float uPower;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          float f = pow(1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0), uPower);
          gl_FragColor = vec4(uColor * f * uStrength, 1.0);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  m.raycast = () => {};
  return m;
}

/** 부드러운 원형 글로우 텍스처 (전구, 응원봉 빛번짐) */
export const glowTexture = (() => {
  let tex;
  return () => {
    if (tex) return tex;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.18, 'rgba(255,255,255,0.75)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.18)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
})();
