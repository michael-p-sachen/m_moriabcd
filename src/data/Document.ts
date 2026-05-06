export type Layout = 'square' | 'horizontal' | 'vertical';

export type DocumentTrailer = {
  name: string;
  coverSrc?: string;
};

export type Collection = DocumentTrailer & {
  children: Array<Document>;
};

export type SingleDocument = DocumentTrailer & {
  documentSrc: string;
  layout: Layout;
  firstPageSrc?: string;
  bgColor?: string;
};

export type Document = Collection | SingleDocument | DocumentTrailer;

export const isCollection = (doc: Document): doc is Collection => 'children' in doc;

export const isSingleDocument = (doc: Document): doc is SingleDocument => 'documentSrc' in doc;

export const isDocumentTrailer = (doc: Document): doc is DocumentTrailer =>
  !isCollection(doc) && !isSingleDocument(doc);
