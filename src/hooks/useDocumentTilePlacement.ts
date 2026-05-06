import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import { planeUnit, type PlaneCoordinates } from '../data';

type DocumentTilePlacementInput = {
  centerPlacement: PlaneCoordinates;
  width: number;
};

type DocumentTilePlacementStyle = Pick<CSSProperties, 'position' | 'left' | 'top' | 'width' | 'height'>;

export const useDocumentTilePlacement = ({
  centerPlacement,
  width,
}: DocumentTilePlacementInput): DocumentTilePlacementStyle =>
  useMemo(() => {
    const height = width * (16 / 9);

    return {
      position: 'absolute',
      left: planeUnit(centerPlacement.x - width / 2),
      top: planeUnit(centerPlacement.y - height / 2),
      width: planeUnit(width),
      height: planeUnit(height),
    };
  }, [centerPlacement.x, centerPlacement.y, width]);
