export const PLANE_SIZE = 10800 as const;

export type PlaneCoordinates = {
  x: number;
  y: number;
};

export const planeUnit = (value: number): string => `${(value / PLANE_SIZE) * 100}%`;

export const planePx = (n: number): string => `calc(100cqw * ${n} / ${PLANE_SIZE})`;
