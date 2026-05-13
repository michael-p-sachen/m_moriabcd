import { type Document, isCollection, isSingleDocument } from '../data';

const inflight = new Set<string>();
let chain: Promise<unknown> = Promise.resolve();

const fetchOnce = (url: string): Promise<unknown> => {
  if (!url || inflight.has(url)) return Promise.resolve();
  inflight.add(url);
  return fetch(url, { credentials: 'omit', mode: 'cors' }).catch(() => {
    inflight.delete(url);
  });
};

export const prefetchPdf = (url: string): void => {
  void fetchOnce(url);
};

export const prefetchPdfsSequentially = (urls: string[]): void => {
  for (const url of urls) {
    chain = chain.then(() => fetchOnce(url));
  }
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
