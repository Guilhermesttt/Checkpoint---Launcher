export interface StudioTunerParams {
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
  // Lights
  ambientIntensity: 1.1,
  dirLightX: 2.0,
  dirLightY: 5.0,
  dirLightZ: 4.0,
  dirLightIntensity: 3.2,
  consoleLightX: 0.0,
  consoleLightY: 2.5,
  consoleLightZ: 3.5,
  consoleLightIntensity: 6.5,

  // TV
  tvX: 0.1,
  tvY: 0.55,
  tvZ: -0.6,

  // Console
  consoleX: 0.15,
  consoleY: -0.35,
  consoleZ: 1.2,
  consoleRotX: 0.42,
  consoleRotY: -0.32,
  consoleRotZ: 0.0,

  // Case
  caseX: 2.12,
  caseY: -0.16,
  caseZ: 0.12,
};
