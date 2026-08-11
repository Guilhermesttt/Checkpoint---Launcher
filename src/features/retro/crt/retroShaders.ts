export const retroCrtVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const retroCrtFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D tDiffuse;
  uniform vec2 resolution;
  uniform float time;
  uniform float exposure;
  uniform float blackLift;
  uniform float curvature;
  uniform float chromaticAberration;
  uniform float rgbSeparationStrength;
  uniform float pixelSplitStrength;
  uniform float scanlineStrength;
  uniform float phosphorStrength;
  uniform float bloomStrength;
  uniform float vignetteStrength;
  uniform float noiseStrength;
  uniform float flickerStrength;
  uniform float syncTearStrength;
  uniform float transitionSignal;

  varying vec2 vUv;

  float random(vec2 point) {
    return fract(sin(dot(point, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  vec2 curveCrtUv(vec2 uv) {
    vec2 centered = uv * 2.0 - 1.0;
    centered *= 1.0 + curvature * vec2(
      centered.y * centered.y,
      centered.x * centered.x
    );
    return centered * 0.5 + 0.5;
  }

  vec3 sampleAnalogRgb(vec2 uv, float separationPixels) {
    vec2 pixel = 1.0 / max(resolution, vec2(1.0));
    vec2 offset = vec2(separationPixels * pixel.x, 0.0);
    vec2 safeUv = clamp(uv, vec2(0.001), vec2(0.999));

    return vec3(
      texture2D(tDiffuse, clamp(safeUv + offset, vec2(0.001), vec2(0.999))).r,
      texture2D(tDiffuse, safeUv).g,
      texture2D(tDiffuse, clamp(safeUv - offset, vec2(0.001), vec2(0.999))).b
    );
  }

  void main() {
    vec2 uv = curveCrtUv(vUv);
    vec2 pixel = 1.0 / max(resolution, vec2(1.0));
    float pixelRow = floor(uv.y * resolution.y);
    float bandGate = step(0.82, fract(pixelRow / 23.0 + floor(time * 7.0) * 0.017));
    float analogSplit = (bandGate - 0.5) * pixelSplitStrength * pixel.x;
    float transitionWave = sin(uv.y * 47.0 + time * 18.0) * transitionSignal;
    uv.x += analogSplit + transitionWave * syncTearStrength * pixel.x * 8.0;

    float distanceFromCenter = distance(uv, vec2(0.5));
    float separation = rgbSeparationStrength +
      chromaticAberration * resolution.x * distanceFromCenter;
    vec3 color = sampleAnalogRgb(uv, separation);

    vec3 bloom = vec3(0.0);
    bloom += sampleAnalogRgb(uv + vec2(pixel.x * 2.0, 0.0), separation * 0.4);
    bloom += sampleAnalogRgb(uv - vec2(pixel.x * 2.0, 0.0), separation * 0.4);
    bloom += sampleAnalogRgb(uv + vec2(0.0, pixel.y * 2.0), separation * 0.4);
    bloom += sampleAnalogRgb(uv - vec2(0.0, pixel.y * 2.0), separation * 0.4);
    bloom *= 0.25;
    float bloomLuma = max(max(bloom.r, bloom.g), bloom.b);
    vec3 warmBloom = bloom * vec3(1.08, 0.94, 0.78);
    color += warmBloom * smoothstep(0.3, 0.86, bloomLuma) * bloomStrength;

    float scanWave = 0.5 + 0.5 * sin(uv.y * resolution.y * 3.14159265);
    color *= 1.0 - scanlineStrength * scanWave;

    float phosphorCell = mod(floor(vUv.x * resolution.x / 1.5), 3.0);
    vec3 rgbTriad = phosphorCell < 1.0
      ? vec3(1.14, 0.72, 0.72)
      : (phosphorCell < 2.0
        ? vec3(0.72, 1.14, 0.72)
        : vec3(0.72, 0.72, 1.14));
    color *= mix(vec3(1.0), rgbTriad, phosphorStrength);

    float vignette = 1.0 - vignetteStrength *
      smoothstep(0.32, 0.72, distanceFromCenter);
    color *= vignette;
    color = color * exposure + vec3(blackLift);
    color += (random(uv * resolution + time * 37.0) - 0.5) * noiseStrength;
    color *= 1.0 + sin(time * 15.0) * flickerStrength;

    float closestTubeEdge = min(
      min(uv.x, 1.0 - uv.x),
      min(uv.y, 1.0 - uv.y)
    );
    float tubeMask = smoothstep(-0.012, 0.018, closestTubeEdge);
    color *= tubeMask;

    gl_FragColor = vec4(color, 1.0);
  }
`;
