export interface StudioTunerParams {
  // CRT Shader Pass
  crtEnabled: boolean;

  // Lights
  ambientIntensity: number;
  dirLightX: number;
  dirLightY: number;
  dirLightZ: number;
  dirLightIntensity: number;
  consoleLightX: number;
  consoleLightY: number;
  consoleLightZ: number;
  consoleLightIntensity: number;

  // TV Object
  tvX: number;
  tvY: number;
  tvZ: number;

  // Console Object
  consoleX: number;
  consoleY: number;
  consoleZ: number;
  consoleRotX: number;
  consoleRotY: number;
  consoleRotZ: number;

  // Game Case Object
  caseX: number;
  caseY: number;
  caseZ: number;
}

export const DEFAULT_STUDIO_TUNER_PARAMS: StudioTunerParams = {
  // CRT
  crtEnabled: true,

  // Lights (Parâmetros extraídos da sua cena 3D)
  ambientIntensity: 1.8,
  dirLightX: -0.69,
  dirLightY: 5.68,
  dirLightZ: 0.79,
  dirLightIntensity: 3.52,
  consoleLightX: 2.24,
  consoleLightY: 4.96,
  consoleLightZ: 5.18,
  consoleLightIntensity: 5.0,

  // TV (old_jvc_tv / PVM)
  tvX: 0.38,
  tvY: 0.65,
  tvZ: -0.2,

  // Console PS2 (sony_playstation_2.glb)
  consoleX: 1.45,
  consoleY: -0.16,
  consoleZ: 2.2,
  consoleRotX: 0.38,
  consoleRotY: -0.32,
  consoleRotZ: 0.0,

  // Case
  caseX: 2.12,
  caseY: -0.16,
  caseZ: 0.12,
};
