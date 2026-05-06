export { PLANE_SIZE, planePx, planeUnit } from './plane';
export type { PlaneCoordinates } from './plane';
export { documentTilesProps, matrixTileProps, PLANE_X_OVERFLOW, projectTileProps } from './tiles';
export type { DocumentTileProps, NovepvntiTileProps } from './tiles';
export {
  allDocuments,
  matrixTileDocument,
  OGGETTO_NAME,
  EDIZIONE_NAME,
  EDIZIONE_DOWNLOAD_FILE,
  EDIZIONE_DOWNLOAD_PATH,
} from './documents';
export type { Document, SingleDocument, Collection, Layout, DocumentTrailer } from './Document';
export { isCollection, isSingleDocument, isDocumentTrailer } from './Document';
