import { allDocuments, documentTilesProps, isCollection, matrixTileDocument, type Document } from '../data';

const slotCount = documentTilesProps.length;

export type DocumentsState = {
  documents: Array<Document | undefined>;
  indicesPath: number[];
};

export type DocumentsAction = { type: 'click'; clickedIndex: number } | { type: 'reset' };

export const createInitialDocumentsState = (): DocumentsState => {
  const documents: Array<Document | undefined> = [matrixTileDocument, ...allDocuments];
  while (documents.length < slotCount) {
    documents.push(undefined);
  }

  return { documents, indicesPath: [] };
};

const applyStep = (prev: DocumentsState, i: number): DocumentsState => {
  const document = prev.documents[i]!;
  const children = isCollection(document) ? document.children : [];
  const next = Array.from({ length: slotCount }, () => undefined as Document | undefined);

  const lastPathSlot = prev.indicesPath.length > 0 ? prev.indicesPath[prev.indicesPath.length - 1] : 0;
  for (let k = 0; k <= lastPathSlot; k += 1) {
    next[k] = prev.documents[k];
  }
  next[i] = document;
  for (let c = 0; c < children.length && i + 1 + c < slotCount; c += 1) {
    next[i + 1 + c] = children[c];
  }

  return {
    documents: next,
    indicesPath: prev.indicesPath.includes(i) ? prev.indicesPath : [...prev.indicesPath, i],
  };
};

export const documentsReducer = (state: DocumentsState, action: DocumentsAction): DocumentsState => {
  if (action.type === 'reset') {
    return createInitialDocumentsState();
  }
  if (state.indicesPath.includes(action.clickedIndex)) {
    const p = state.indicesPath.indexOf(action.clickedIndex);
    return state.indicesPath.slice(0, p + 1).reduce((s, j) => applyStep(s, j), createInitialDocumentsState());
  }
  return applyStep(state, action.clickedIndex);
};
