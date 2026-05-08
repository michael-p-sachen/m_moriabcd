import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Document as PdfDocument, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { useExplorerPdfFreeze } from '../../hooks';
import type { SingleDocument } from '../../data';
import './Explorer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export type ExplorerProps = Pick<SingleDocument, 'documentSrc' | 'layout' | 'firstPageSrc' | 'bgColor'> & {
  pdfPage?: number;
  onPdfLoaded?: (numPages: number) => void;
};

export const Explorer = ({ documentSrc, layout, firstPageSrc, bgColor, pdfPage = 1, onPdfLoaded }: ExplorerProps) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const isLandscape = layout === 'horizontal';

  const [pdfReady, setPdfReady] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [enablePageAnim, setEnablePageAnim] = useState(false);

  useLayoutEffect(() => {
    setEnablePageAnim(false);
  }, [documentSrc]);

  useEffect(() => {
    if (pdfReady) {
      setEnablePageAnim(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfPage]);

  const { frozenPdf, fitScale } = useExplorerPdfFreeze({
    frameRef,
    documentSrc,
    layout,
    enabled: !isLandscape,
  });

  useLayoutEffect(() => {
    setPdfReady(false);
    setIsVisible(false);

    const raf = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [documentSrc, layout]);

  const explorerVariant =
    {
      horizontal: 'explorer--landscape',
      square: 'explorer--square',
      vertical: 'explorer--portrait',
    }[layout] || 'explorer--portrait';

  return (
    <div
      className={`explorer ${explorerVariant} ${isVisible ? 'is-visible' : ''}`}
      role='region'
      aria-label='Explorer'>
      <div className='explorer-media'>
        <div
          className='explorer-frame'
          style={{ backgroundColor: pdfReady && bgColor ? bgColor : 'transparent' }}
          ref={frameRef}>
          {isLandscape ?
            <video
              className='explorer-video'
              src={documentSrc}
              controls
              playsInline
            />
          : <div className='explorer-pdf-stack'>
              {firstPageSrc && (
                <img
                  src={firstPageSrc}
                  className={`explorer-pdf-layer ${pdfReady ? 'is-hidden' : ''}`}
                  alt=''
                  aria-hidden='true'
                />
              )}
              <PdfDocument
                file={documentSrc}
                className={`explorer-pdf-doc explorer-pdf-layer ${enablePageAnim ? 'enable-page-transitions' : ''}`}
                loading={null}
                onLoadSuccess={(pdf) => {
                  setPdfReady(true);
                  onPdfLoaded?.(pdf.numPages);
                }}>
                {frozenPdf && (
                  <div className='explorer-pdf-scale-clip'>
                    <div
                      className='explorer-pdf-scale-inner'
                      style={{
                        width: frozenPdf.pageWidth,
                        transform: `scale(${fitScale})`,
                        transformOrigin: 'bottom right',
                      }}>
                      <Page
                        className='explorer-pdf-page'
                        pageNumber={pdfPage}
                        width={frozenPdf.pageWidth}
                        devicePixelRatio={frozenPdf.devicePixelRatio}
                        canvasBackground={'transparent'}
                        loading={null}
                      />
                    </div>
                  </div>
                )}
              </PdfDocument>
            </div>
          }
        </div>
      </div>
    </div>
  );
};
