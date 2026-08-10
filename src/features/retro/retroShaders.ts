export const retroCrtVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const retroCrtFragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform sampler2D tDiffuse;
  uniform vec2 resolution;
  uniform float time;
  uniform float exposure;
  uniform float blackLift;
  uniform float curvature;
  uniform float chromaticAberration;
  uniform float scanlineStrength;
  uniform float phosphorStrength;
  uniform float bloomStrength;
  uniform float noiseStrength;
  uniform float vignetteStrength;
  uniform float flickerStrength;
  uniform float syncTearStrength;
  uniform float transitionSignal;

  float random(vec2 point) {
    return fract(sin(dot(point, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  vec2 curveUv(vec2 uv) {
    vec2 centered = uv * 2.0 - 1.0;
    float radius = dot(centered, centered);
    float overscan = 1.0 + curvature * 2.05;
    centered *= (1.0 + curvature * radius) / overscan;
    return clamp(centered * 0.5 + 0.5, vec2(0.001), vec2(0.999));
  }

  vec3 sampleChromatic(vec2 uv) {
    vec2 fromCenter = uv - 0.5;
    float edgeAmount = smoothstep(0.08, 0.72, length(fromCenter));
    vec2 offset = normalize(fromCenter + vec2(0.00001)) *
      chromaticAberration * (0.35 + edgeAmount * 1.65);

    return vec3(
      texture2D(tDiffuse, clamp(uv + offset, vec2(0.001), vec2(0.999))).r,
      texture2D(tDiffuse, uv).g,
      texture2D(tDiffuse, clamp(uv - offset, vec2(0.001), vec2(0.999))).b
    );
  }

  vec3 softBloom(vec2 uv) {
    vec2 texel = 1.5 / max(resolution, vec2(1.0));
    vec3 glow = vec3(0.0);
    glow += texture2D(tDiffuse, uv + texel * vec2(-1.0, -1.0)).rgb;
    glow += texture2D(tDiffuse, uv + texel * vec2( 0.0, -1.0)).rgb * 2.0;
    glow += texture2D(tDiffuse, uv + texel * vec2( 1.0, -1.0)).rgb;
    glow += texture2D(tDiffuse, uv + texel * vec2(-1.0,  0.0)).rgb * 2.0;
    glow += texture2D(tDiffuse, uv + texel * vec2( 0.0,  0.0)).rgb * 4.0;
    glow += texture2D(tDiffuse, uv + texel * vec2( 1.0,  0.0)).rgb * 2.0;
    glow += texture2D(tDiffuse, uv + texel * vec2(-1.0,  1.0)).rgb;
    glow += texture2D(tDiffuse, uv + texel * vec2( 0.0,  1.0)).rgb * 2.0;
    glow += texture2D(tDiffuse, uv + texel * vec2( 1.0,  1.0)).rgb;
    glow /= 16.0;
    return max(glow - vec3(0.32), vec3(0.0));
  }

  void main() {
    vec2 uv = curveUv(vUv);

    float tearCenter = fract(time * 0.78 + 0.13);
    float tearBand = exp(-pow((uv.y - tearCenter) * 32.0, 2.0));
    uv.x += tearBand * transitionSignal * syncTearStrength * 0.085;
    uv.y = fract(uv.y + transitionSignal * syncTearStrength * 0.022);

    vec3 color = sampleChromatic(uv);
    color += softBloom(uv) * bloomStrength;
    color *= exposure;

    float scanline = 0.5 + 0.5 * sin(uv.y * resolution.y * 3.14159265);
    color *= 1.0 - scanlineStrength * (0.34 + scanline * 0.66);

    float phosphor = 0.5 + 0.5 * sin(uv.x * resolution.x * 2.0943951);
    vec3 triad = vec3(
      0.94 + 0.06 * phosphor,
      0.94 + 0.06 * sin(uv.x * resolution.x * 2.0943951 + 2.0943951),
      0.94 + 0.06 * sin(uv.x * resolution.x * 2.0943951 + 4.1887902)
    );
    color *= mix(vec3(1.0), triad, phosphorStrength);

    float grain = random(uv * resolution + vec2(time * 73.0, time * 31.0)) - 0.5;
    color += grain * noiseStrength;

    vec2 centered = uv * 2.0 - 1.0;
    float vignette = 1.0 - smoothstep(0.18, 1.18, dot(centered, centered));
    color *= mix(1.0 - vignetteStrength, 1.0, vignette);
    color += vec3(blackLift) * (1.0 - max(max(color.r, color.g), color.b));

    float flicker = sin(time * 103.0) * flickerStrength;
    color *= 1.0 + flicker + transitionSignal * 0.075 * sin(time * 47.0);

    color = max(color, vec3(0.009));
    color *= vec3(1.035, 0.99, 0.94);
    color = pow(color, vec3(0.94));

    gl_FragColor = vec4(color, 1.0);
  }
`;
