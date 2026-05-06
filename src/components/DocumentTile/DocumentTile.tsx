import { useDocumentTilePlacement } from '../../hooks';
import { planePx } from '../../data';
import { type DocumentTileProps, isDocumentTrailer } from '../../data';
import './DocumentTile.css';
import type { CSSProperties, MouseEventHandler } from 'react';

export const LABEL_PLANE_SIZE = 96;
export const LABEL_UNDERLINE_THICKNESS_PLANE = 6;

export const DocumentTile = ({
  centerPlacement,
  width,
  document,
  labelPinned = false,
  labelClickable = false,
  onClick,
  rootOpacity = 1,
}: DocumentTileProps) => {
  const placementStyle = useDocumentTilePlacement({ centerPlacement, width: width });
  const tileClickable = onClick && !isDocumentTrailer(document);

  const documentStyle: CSSProperties = {
    ...placementStyle,
    opacity: rootOpacity,
    cursor: tileClickable ? 'pointer' : 'default',
  };

  const documentOnClick = tileClickable ? onClick : undefined;

  const coverStyle: CSSProperties = {
    opacity:
      !isDocumentTrailer(document) ?
        labelPinned ? 0.1
        : 1
      : 0.6,
  };

  const labelStyle: CSSProperties = {
    fontSize: planePx(LABEL_PLANE_SIZE),
    marginTop: planePx(Math.round(LABEL_PLANE_SIZE / 1.2)),
    marginRight: planePx(Math.round(LABEL_PLANE_SIZE / 3)),
    ...(labelClickable && {
      pointerEvents: 'auto',
      cursor: 'pointer',
      textDecorationLine: 'underline',
      textDecorationColor: 'currentColor',
      textDecorationThickness: planePx(LABEL_UNDERLINE_THICKNESS_PLANE),
      textUnderlineOffset: planePx(Math.round(LABEL_PLANE_SIZE / 10)),
    }),
    ...(labelPinned && { opacity: 1 }),
  };

  const labelOnClick: MouseEventHandler<HTMLDivElement> | undefined =
    labelClickable ?
      (e) => {
        e.stopPropagation();
        onClick?.();
      }
    : undefined;

  return (
    <div
      className={'document-tile-root'}
      onClick={documentOnClick}
      style={documentStyle}>
      {document.coverSrc && (
        <div
          className='document-tile-media'
          style={coverStyle}>
          <img
            src={document.coverSrc}
            decoding='async'
            alt={document.name}
          />
        </div>
      )}
      <div
        className={'document-tile-label'}
        style={labelStyle}
        onClick={labelOnClick}>
        {document.name}
      </div>
    </div>
  );
};
