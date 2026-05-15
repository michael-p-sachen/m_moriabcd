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

export const prefetchPdfsSequentially = (urls: string[]): void => {
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
// keeps the pipe sequential while still prioritizing what the user wants.
export const prefetchPdfNext = (url: string): void => {
  if (!url || completed.has(url) || url === currentUrl) return;
  queue = queue.filter((u) => u !== url);
  queue.unshift(url);
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
