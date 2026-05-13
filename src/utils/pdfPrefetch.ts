import { type Document, isCollection, isSingleDocument } from '../data';

const completed = new Set<string>();
let queue: string[] = [];
let currentUrl: string | null = null;
let currentAbort: AbortController | null = null;
let pumping = false;

const pump = async (): Promise<void> => {
  if (pumping) return;
  pumping = true;
  try {
    while (queue.length > 0) {
      const url = queue.shift()!;
      if (completed.has(url)) continue;
      currentUrl = url;
      currentAbort = new AbortController();
      try {
        const res = await fetch(url, { credentials: 'omit', mode: 'cors', signal: currentAbort.signal });
        if (res.ok) completed.add(url);
      } catch {
        // aborted or network error — leave uncompleted so a future call can retry
      }
      currentUrl = null;
      currentAbort = null;
    }
  } finally {
    pumping = false;
  }
};

const enqueueBack = (url: string): void => {
  if (!url || completed.has(url) || url === currentUrl || queue.includes(url)) return;
  queue.push(url);
};

export const prefetchPdfsSequentially = (urls: string[]): void => {
  for (const url of urls) enqueueBack(url);
  void pump();
};

export const prefetchPdf = (url: string): void => {
  enqueueBack(url);
  void pump();
};

// User explicitly opened a doc: jump it to the front of the queue and abort
// whatever sequential fetch is currently in flight so it doesn't compete
// with pdfjs for bandwidth. The aborted URL is re-queued right behind it.
export const prefetchPdfPriority = (url: string): void => {
  if (!url || completed.has(url) || url === currentUrl) return;
  queue = queue.filter((u) => u !== url);
  queue.unshift(url);
  if (currentUrl && currentAbort) {
    const aborted = currentUrl;
    currentAbort.abort();
    queue.splice(1, 0, aborted);
  }
  void pump();
};

export const collectPdfSrcs = (docs: Array<Document>): string[] => {
  const out: string[] = [];
  for (const d of docs) {
    if (isSingleDocument(d)) {
      if (d.documentSrc.endsWith('.pdf')) out.push(d.documentSrc);
    } else if (isCollection(d)) {
      out.push(...collectPdfSrcs(d.children));
    }
  }
  return out;
};
