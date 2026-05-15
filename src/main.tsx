import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App.tsx';
import { BrowserRouter } from 'react-router-dom';
import { allDocuments } from './data';
import { collectCoverSrcs, collectFirstPageSrcs, collectPdfSrcs, prefetchSequentially } from './utils/pdfPrefetch';

// Warm the cache as soon as the JS module loads — before React renders — in
// strict priority tiers through one sequential pipe: on-screen covers first,
// then first-page placeholders, then the large remote PDFs. Navigating to a
// doc bumps that PDF to the front (see prefetchPdfNext) without interrupting
// whatever is mid-download.
prefetchSequentially([
  ...collectCoverSrcs(allDocuments),
  ...collectFirstPageSrcs(allDocuments),
  ...collectPdfSrcs(allDocuments),
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
