import {planePx, PLANE_SIZE, type PlaneCoordinates} from './plane';
import type {CSSProperties} from "react";
import type {Document} from "./Document.ts";

export const DISTANCE_X = 1222;
export const PRIMARY_X = 3311;
export const MAJOR_TILE_EDGE = 727;

export type NovepvntiTileProps = {
  centerPlacement: PlaneCoordinates;
  color: string;
  size: number;
  filter?: CSSProperties['filter'];
  opacity?: CSSProperties['opacity'];
  onClick?: () => void;
};

export type DocumentTileProps = {
  centerPlacement: PlaneCoordinates;
  width: number;
  document: Document;
  labelPinned?: boolean;
  labelClickable?: boolean;
  onClick?: () => void;
  rootOpacity?: number;
};

export const matrixTileProps: NovepvntiTileProps = {
  color: '#b3baad',
  opacity: 0.66,
  size: 727,
  centerPlacement: {
    x: PRIMARY_X,
    y: 7547,
  },
  filter: `blur(${planePx(17)})`,
};

export const projectTileProps: NovepvntiTileProps = {
  color: '#cad3ca',
  size: 363,
  centerPlacement: {
    x: 3762,
    y: 7397,
  },
  filter: `blur(${planePx(6)})`,
};

export const documentTilesProps: Array<Pick<DocumentTileProps, 'width' | 'centerPlacement'>> = [...Array(8).keys()].map(
  (a) => ({
    width: MAJOR_TILE_EDGE,
    centerPlacement: {
      x: PRIMARY_X + a * DISTANCE_X,
      y: 7547,
    },
  }),
);

const maxContentX = PRIMARY_X + 7 * DISTANCE_X + MAJOR_TILE_EDGE / 1.5;
export const PLANE_X_OVERFLOW = maxContentX - PLANE_SIZE;
