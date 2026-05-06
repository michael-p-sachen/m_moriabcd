import { useState, useMemo, useLayoutEffect, useEffect } from 'react';
import { EDIZIONE_NAME, isSingleDocument } from '../data';

export const useExplorer = (documents: any[], indicesPath: number[]) => {
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);

  const latestIndex = indicesPath.at(-1);

  const activeDoc = useMemo(() => {
    const doc = latestIndex !== undefined ? documents[latestIndex] : null;
    return doc && isSingleDocument(doc) ? doc : null;
  }, [latestIndex, documents]);

  useLayoutEffect(() => {
    setPdfPage(1);
    setPdfNumPages(null);
  }, [activeDoc?.documentSrc, activeDoc?.layout, latestIndex]);

  useEffect(() => {
    if (pdfNumPages) {
      setPdfPage((p) => Math.min(Math.max(1, p), pdfNumPages));
    }
  }, [pdfNumPages]);

  const changePage = (offset: number) => {
    if (!pdfNumPages) return;
    setPdfPage((p) => Math.min(Math.max(1, p + offset), pdfNumPages));
  };

  const showNav = Boolean(activeDoc && pdfNumPages && pdfNumPages > 1);
  const isDownloadable = activeDoc?.name === EDIZIONE_NAME;

  return {
    activeDoc,
    pdfPage,
    pdfNumPages,
    setPdfNumPages,
    showNav,
    isDownloadable,
    prevPage: () => changePage(-1),
    nextPage: () => changePage(1),
  };
};
