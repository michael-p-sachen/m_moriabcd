import { useEffect, useLayoutEffect, useState, useMemo } from 'react';
import type { RefObject } from 'react';
import type { Layout } from '../data';

const PDF_RENDER_DPR_CAP = 14;
const PDF_RENDER_OVERSAMPLE = 2;

export type ExplorerPdfFrozenLayout = {
  pageWidth: number;
  devicePixelRatio: number;
};

type UseExplorerPdfFreezeInput = {
  frameRef: RefObject<HTMLDivElement | null>;
  documentSrc: string;
  layout: Layout;
  enabled: boolean;
};

export const useExplorerPdfFreeze = ({ frameRef, documentSrc, layout, enabled }: UseExplorerPdfFreezeInput) => {
  const [frozenPdf, setFrozenPdf] = useState<ExplorerPdfFrozenLayout | null>(null);
  const [currentWidth, setCurrentWidth] = useState<number>(0);

  useLayoutEffect(() => {
    setFrozenPdf(null);
    setCurrentWidth(0);
  }, [documentSrc, layout, enabled]);

  useEffect(() => {
    const el = frameRef.current;
    if (!enabled || !el) return;

    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      if (width <= 0) return;

      setCurrentWidth(width);

      setFrozenPdf((prev) => {
        if (prev) return prev;

        const base = window.devicePixelRatio || 1;
        const pinch = window.visualViewport?.scale ?? 1;
        return {
          pageWidth: width,
          devicePixelRatio: quantizeDpr(base * pinch * PDF_RENDER_OVERSAMPLE),
        };
      });
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, documentSrc, layout, frameRef]);

  const fitScale = useMemo(() => {
    return frozenPdf && currentWidth > 0 ? currentWidth / frozenPdf.pageWidth : 1;
  }, [frozenPdf, currentWidth]);

  return { frozenPdf, fitScale };
};

const quantizeDpr = (raw: number) => Math.min(PDF_RENDER_DPR_CAP, Math.round(raw * 100) / 100);
