import { useCallback } from 'react';
import type { CSSProperties } from 'react';
import { Footer, Plane, DocumentTile, NovepvntiTile, Explorer } from './components';
import {
  allDocuments,
  documentTilesProps,
  matrixTileProps,
  OGGETTO_NAME,
  PLANE_SIZE,
  PLANE_X_OVERFLOW,
  projectTileProps,
} from './data';
import './App.css';
import { useExplorer, useDocumentsNavigation } from './hooks';
import { collectPdfSrcs, prefetchPdfsSequentially } from './utils/pdfPrefetch';

export const App = () => {
  const {
    documents,
    indicesPath,
    committedDocuments,
    committedIndicesPath,
    transitionIdle,
    rootOpacityForIndex,
    explorerShellStyle,
    explorerDocument,
    dispatch,
    appTilesStyle,
  } = useDocumentsNavigation();
  const explorer = useExplorer(committedDocuments, committedIndicesPath, explorerDocument);

  const onCollectionTileClick = useCallback(
    (clickedIndex: number) => {
      if (!transitionIdle) {
        return;
      }
      // First nav interaction (matrix tile, slot 0) warms the cache for every
      // downstream PDF, sequentially so we don't stampede the network.
      if (clickedIndex === 0) {
        prefetchPdfsSequentially(collectPdfSrcs(allDocuments));
      }
      dispatch({ type: 'click', clickedIndex });
    },
    [dispatch, transitionIdle],
  );

  const renderDocumentTiles = () =>
    documentTilesProps.map((props, index) => {
      const doc = documents[index];
      if (!doc) return null;

      const inPath = indicesPath.includes(index);
      const latestIndex = indicesPath.at(-1);

      return (
        <DocumentTile
          key={`${index}-${doc.name}`}
          {...props}
          document={doc}
          labelPinned={inPath || index === 0}
          labelClickable={transitionIdle && inPath && latestIndex !== index}
          onClick={transitionIdle && ![0, latestIndex].includes(index) ? () => onCollectionTileClick(index) : undefined}
          rootOpacity={rootOpacityForIndex(index)}
        />
      );
    });

  const renderFooter = () =>
    explorer.showNav ?
      <Footer
        mode='navigation'
        pdfPage={explorer.pdfPage}
        pdfPagesNum={explorer.pdfNumPages!}
        onPrevious={explorer.prevPage}
        onNext={explorer.nextPage}
        downloadVisible={explorer.isDownloadable}
      />
    : <Footer
        mode='text'
        prefixed={committedIndicesPath.some((i) => committedDocuments[i]?.name === OGGETTO_NAME)}
      />;

  return (
    <main>
      <div className='app-body'>
        <div
          className='app-plane-hub'
          style={{ '--plane-hub-overflow-x': PLANE_X_OVERFLOW, '--plane-size': PLANE_SIZE } as CSSProperties}>
          <Plane className='app-plane'>
            <NovepvntiTile
              {...matrixTileProps}
              onClick={transitionIdle && indicesPath.length === 0 ? () => onCollectionTileClick(0) : undefined}
              opacity={indicesPath.length > 0 ? 0.1 : matrixTileProps.opacity}
            />
            <div
              className='app-tiles'
              style={appTilesStyle}>
              {renderDocumentTiles()}
            </div>
            <NovepvntiTile
              {...projectTileProps}
              onClick={transitionIdle ? () => dispatch({ type: 'reset' }) : undefined}
            />
          </Plane>
        </div>
        <div
          className='app-explorer-shell'
          style={explorerShellStyle}>
          {explorerDocument ?
            <Explorer
              layout={explorerDocument.layout}
              documentSrc={explorerDocument.documentSrc}
              firstPageSrc={explorerDocument.firstPageSrc}
              bgColor={explorerDocument.bgColor}
              pdfPage={explorer.activeDoc ? explorer.pdfPage : 1}
              onPdfLoaded={explorer.setPdfNumPages}
            />
          : <div
              className='app-explorer-placeholder'
              aria-hidden
            />
          }
        </div>
      </div>
      {renderFooter()}
    </main>
  );
};
