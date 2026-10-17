export type Vec3 = [number, number, number];

export interface Block {
  x: number;
  y: number;
  z: number;
  /** chave de textura: `grass`, `stone`, `solid:#rrggbb`, `ore:#rrggbb`, `glow:#rrggbb`, `face:#rrggbb`… */
  type: string;
  scale?: number;
  rotY?: number;
}

export interface CameraPose {
  position: Vec3;
  target: Vec3;
  fov: number;
}
