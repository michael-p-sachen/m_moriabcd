import type { HTMLAttributes } from 'react';
import './Plane.css';

type PlaneProps = HTMLAttributes<HTMLDivElement>;

export const Plane = ({ children, className, ...rest }: PlaneProps) => (
  <div
    className={['plane', className].filter(Boolean).join(' ')}
    {...rest}>
    {children}
  </div>
);
