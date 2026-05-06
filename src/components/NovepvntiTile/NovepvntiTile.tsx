import { useNovepvntiTilePlacement } from '../../hooks';
import type { NovepvntiTileProps } from '../../data';
import { MatrixTile } from '../../assets';
import './NovepvntiTile.css';

export const NovepvntiTile = ({ centerPlacement, color, size, filter, opacity = 1, onClick }: NovepvntiTileProps) => {
  const placementStyle = useNovepvntiTilePlacement({ centerPlacement, size });

  return (
    <div
      className={'novepvnti-tile'}
      onClick={onClick}
      style={{
        ...placementStyle,
        ...(onClick && { cursor: 'pointer' }),
        opacity,
        filter,
      }}>
      <MatrixTile color={color} />
    </div>
  );
};
