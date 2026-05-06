import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import { planeUnit, type PlaneCoordinates } from '../data';

type NovepvntiTilePlacementInput = {
  centerPlacement: PlaneCoordinates;
  size: number;
};

type NovepvntiTilePlacementStyle = Pick<CSSProperties, 'position' | 'left' | 'top' | 'width' | 'height'>;

export const useNovepvntiTilePlacement = ({
  centerPlacement,
  size,
}: NovepvntiTilePlacementInput): NovepvntiTilePlacementStyle =>
  useMemo(() => {
    const half = size / 2;

    return {
      position: 'absolute',
      left: planeUnit(centerPlacement.x - half),
      top: planeUnit(centerPlacement.y - half),
      width: planeUnit(size),
      height: planeUnit(size),
    };
  }, [centerPlacement.x, centerPlacement.y, size]);
