import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App.tsx';
import { BrowserRouter } from 'react-router-dom';
import { allDocuments } from './data';
import { collectPdfSrcs, prefetchPdfsSequentially } from './utils/pdfPrefetch';

// Kick off PDF prefetch as soon as the JS module loads — before React renders.
prefetchPdfsSequentially(collectPdfSrcs(allDocuments));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
