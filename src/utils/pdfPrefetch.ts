import { type Document, isCollection, isSingleDocument } from '../data';

const completed = new Set<string>();
let queue: string[] = [];
let currentUrl: string | null = null;
let pumping = false;

const pump = async (): Promise<void> => {
  if (pumping) return;
  pumping = true;
  try {
    while (queue.length > 0) {
      const url = queue.shift()!;
      if (completed.has(url)) continue;
      currentUrl = url;
      try {
        const res = await fetch(url, { credentials: 'omit', mode: 'cors' });
        if (res.ok) completed.add(url);
      } catch {
        // network error — leave uncompleted so a future call can retry
      }
      currentUrl = null;
    }
  } finally {
    pumping = false;
  }
};

const enqueueBack = (url: string): void => {
  if (!url || completed.has(url) || url === currentUrl || queue.includes(url)) return;
  queue.push(url);
};

// Feed the single sequential pipe in priority order. Because there's one
// worker draining the queue front-to-back, the order URLs are passed in IS
// the load order: covers, then first-page placeholders, then large PDFs.
export const prefetchSequentially = (urls: string[]): void => {
  for (const url of urls) enqueueBack(url);
  void pump();
};

export const prefetchPdf = (url: string): void => {
  enqueueBack(url);
  void pump();
};

// User opened a doc: pull it to the front of the queue so it's fetched next.
// We deliberately do NOT abort the fetch in flight — interrupting a large PDF
// mid-stream throws away the bytes already on the wire and makes the browser
// re-request it (often as a 206 Range retry), which is the churn we're trying
// to avoid. Letting the current fetch finish and taking the clicked URL next
// gets the doc as soon as possible without disrupting the pipe.
export const prefetchPdfNext = (url: string): void => {
  if (!url || completed.has(url) || url === currentUrl) return;
  queue = queue.filter((u) => u !== url);
  queue.unshift(url);
  void pump();
};

const walk = (docs: Array<Document>, visit: (d: Document) => void): void => {
  for (const d of docs) {
    visit(d);
    if (isCollection(d)) walk(d.children, visit);
  }
};

// coverSrc lives on the shared trailer type, so collections and bare trailers
// have one too. Pre-order traversal puts the top-level grid covers first.
export const collectCoverSrcs = (docs: Array<Document>): string[] => {
  const out: string[] = [];
  walk(docs, (d) => {
    if (d.coverSrc) out.push(d.coverSrc);
  });
  return out;
};

export const collectFirstPageSrcs = (docs: Array<Document>): string[] => {
  const out: string[] = [];
  walk(docs, (d) => {
    if (isSingleDocument(d) && d.firstPageSrc) out.push(d.firstPageSrc);
  });
  return out;
};

export const collectPdfSrcs = (docs: Array<Document>): string[] => {
  const out: string[] = [];
  walk(docs, (d) => {
    if (isSingleDocument(d) && d.documentSrc.endsWith('.pdf')) out.push(d.documentSrc);
  });
  return out;
};
