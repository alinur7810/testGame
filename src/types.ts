export interface GameVariables {
  doubleJumpEnabled: boolean;
  jumpForce: number;
  gravityScale: number;
  dashEnabled: boolean;
  maxSpeed: number;
  collectibleValue: number;
  particlesDensity: number;
  bounceForce: number;
  playerColor: string;
  cameraShakeEnabled: boolean;
  activeScriptComponent: string;
}

export interface CSharpScript {
  code: string;
  guide: string;
  summary: string;
  gameVariables?: Partial<GameVariables>;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface Platform {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: "normal" | "moving" | "spring" | "hazard";
  vx: number;
  rangeX: [number, number];
  direction: number;
  bounced?: boolean;
}

export interface Collectible {
  id: number;
  x: number;
  y: number;
  radius: number;
  collected: boolean;
  pulsePhase: number;
  type: "essence" | "soul" | "super";
}

export interface Enemy {
  id: number;
  x: number;
  y: number;
  radius: number;
  vx: number;
  rangeX: [number, number];
  direction: number;
  angle: number;
}
