import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  createInitialDocumentsState,
  documentsReducer,
  type DocumentsAction,
  type DocumentsState,
} from '../reducers/documentsReducer';
import { documentTilesProps } from '../data';
import { isSingleDocument, type SingleDocument } from '../data/Document';

const slotCount = documentTilesProps.length;

/** Matches reset landing grid; used with `to` for first-load enter animation. */
const createEmptyDocumentsState = (): DocumentsState => ({
  documents: Array.from({ length: slotCount }, () => undefined),
  indicesPath: [],
});

const OUT_MS = 420;
const IN_MS = 440;

type AnimIdle = { kind: 'idle' };

type AnimIntent =
  | { type: 'click'; clickedIndex: number }
  | { type: 'reset' };

type AnimOut = {
  kind: 'out';
  token: number;
  from: DocumentsState;
  to: DocumentsState;
  armed: boolean;
  intent: AnimIntent;
};

type AnimIn = {
  kind: 'in';
  token: number;
  from: DocumentsState;
  to: DocumentsState;
  entered: boolean;
};

type AnimState = AnimIdle | AnimOut | AnimIn;

const statesEqual = (a: DocumentsState, b: DocumentsState): boolean => {
  if (a.indicesPath.length !== b.indicesPath.length) return false;
  for (let i = 0; i < a.indicesPath.length; i += 1) {
    if (a.indicesPath[i] !== b.indicesPath[i]) return false;
  }
  for (let k = 0; k < slotCount; k += 1) {
    if (a.documents[k] !== b.documents[k]) return false;
  }
  return true;
};

const slotContentChanges = (from: DocumentsState, to: DocumentsState, k: number): boolean =>
  from.documents[k] !== to.documents[k];

const isEnteringSlot = (from: DocumentsState, to: DocumentsState, k: number): boolean =>
  Boolean(to.documents[k]) && slotContentChanges(from, to, k);

const activeSingleAtPathEnd = (s: DocumentsState) => {
  const i = s.indicesPath.at(-1);
  if (i === undefined) return null;
  const d = s.documents[i];
  return d && isSingleDocument(d) ? d : null;
};

const TILES_ENTRY_DELAY_MS = 500;
/** Keep in sync with `.app-tiles { transition: opacity … }` in App.css */
const TILES_OPACITY_TRANSITION_MS = 2000;

export const useDocumentsLayoutTransition = () => {
  const [state, baseDispatch] = useReducer(documentsReducer, undefined, createInitialDocumentsState);
  const [tilesEntryVisible, setTilesEntryVisible] = useState(false);
  const [tilesOpacityIntroDone, setTilesOpacityIntroDone] = useState(false);
  const tilesInteractionReadyRef = useRef(false);
  const transitionTokenRef = useRef(0);
  const [anim, setAnim] = useState<AnimState>(() => {
    const token = (transitionTokenRef.current += 1);
    return {
      kind: 'in',
      token,
      from: createEmptyDocumentsState(),
      to: createInitialDocumentsState(),
      entered: false,
    };
  });

  const stateRef = useRef(state);
  const animRef = useRef(anim);
  stateRef.current = state;
  animRef.current = anim;

  const dispatch = useCallback((action: DocumentsAction) => {
    if (action.type === 'click' && !tilesInteractionReadyRef.current) {
      return;
    }
    if (action.type === 'reset') {
      const from = stateRef.current;
      const to = createInitialDocumentsState();
      if (statesEqual(from, to)) {
        baseDispatch({ type: 'reset' });
        setAnim({ kind: 'idle' });
        return;
      }
      const token = (transitionTokenRef.current += 1);
      setAnim({
        kind: 'out',
        token,
        armed: false,
        from,
        to,
        intent: { type: 'reset' },
      });
      return;
    }
    if (animRef.current.kind !== 'idle') return;
    const from = stateRef.current;
    const to = documentsReducer(from, action);
    if (statesEqual(from, to)) return;
    const token = (transitionTokenRef.current += 1);
    setAnim({
      kind: 'out',
      token,
      armed: false,
      from,
      to,
      intent: { type: 'click', clickedIndex: action.clickedIndex },
    });
  }, []);

  useEffect(() => {
    dispatch({ type: 'reset' });
    const showTiles = window.setTimeout(() => {
      setTilesEntryVisible(true);
    }, TILES_ENTRY_DELAY_MS);
    const introDone = window.setTimeout(() => {
      tilesInteractionReadyRef.current = true;
      setTilesOpacityIntroDone(true);
    }, TILES_ENTRY_DELAY_MS + TILES_OPACITY_TRANSITION_MS);
    return () => {
      clearTimeout(showTiles);
      clearTimeout(introDone);
    };
  }, [dispatch]);

  useEffect(() => {
    if (anim.kind !== 'out' || anim.armed) return;
    const expectedToken = anim.token;
    const id = requestAnimationFrame(() => {
      if (expectedToken !== transitionTokenRef.current) return;
      setAnim((a) =>
        a.kind === 'out' && !a.armed && a.token === expectedToken ? { ...a, armed: true } : a,
      );
    });
    return () => cancelAnimationFrame(id);
  }, [anim]);

  useEffect(() => {
    if (anim.kind !== 'out' || !anim.armed) return;
    const { token, from, to, intent } = anim;
    const t = window.setTimeout(() => {
      if (token !== transitionTokenRef.current) return;
      if (intent.type === 'click') {
        baseDispatch({ type: 'click', clickedIndex: intent.clickedIndex });
      } else {
        baseDispatch({ type: 'reset' });
      }
      if (token !== transitionTokenRef.current) return;
      setAnim({ kind: 'in', token, from, to, entered: false });
    }, OUT_MS);
    return () => clearTimeout(t);
  }, [anim, baseDispatch]);

  useEffect(() => {
    if (anim.kind !== 'in' || anim.entered) return;
    const expectedToken = anim.token;
    let id1 = 0;
    let id2 = 0;
    id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => {
        if (expectedToken !== transitionTokenRef.current) return;
        setAnim((a) =>
          a.kind === 'in' && !a.entered && a.token === expectedToken ? { ...a, entered: true } : a,
        );
      });
    });
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
    };
  }, [anim]);

  useEffect(() => {
    if (anim.kind !== 'in' || !anim.entered) return;
    const expectedToken = anim.token;
    const t = window.setTimeout(() => {
      if (expectedToken !== transitionTokenRef.current) return;
      setAnim({ kind: 'idle' });
    }, IN_MS);
    return () => clearTimeout(t);
  }, [anim]);

  const transitionIdle = anim.kind === 'idle' && tilesOpacityIntroDone;

  const displayDocuments =
    anim.kind === 'out' ? anim.from.documents : state.documents;

  const displayIndicesPath =
    anim.kind === 'out' ? anim.to.indicesPath : state.indicesPath;

  const rootOpacityForIndex = (index: number): number => {
    if (anim.kind === 'idle') return 1;
    if (anim.kind === 'out') {
      if (!anim.armed) return 1;
      const from = anim.from;
      const to = anim.to;
      if (!from.documents[index]) return 1;
      return slotContentChanges(from, to, index) ? 0 : 1;
    }
    if (!anim.entered) {
      return isEnteringSlot(anim.from, anim.to, index) ? 0 : 1;
    }
    return 1;
  };

  const explorerShellStyle: CSSProperties = {};
  if (anim.kind === 'out') {
    const fromEx = activeSingleAtPathEnd(anim.from);
    const toEx = activeSingleAtPathEnd(anim.to);
    if (fromEx && !toEx) {
      explorerShellStyle.opacity = anim.armed ? 0 : 1;
      explorerShellStyle.transition = `opacity ${OUT_MS / 1000}s ease`;
      explorerShellStyle.pointerEvents = 'none';
    } else if (!fromEx && toEx) {
      explorerShellStyle.opacity = anim.armed ? 1 : 0;
      explorerShellStyle.transition = `opacity ${OUT_MS / 1000}s ease`;
      explorerShellStyle.pointerEvents = 'none';
    }
  }

  const committedState: DocumentsState = {
    documents: state.documents,
    indicesPath: state.indicesPath,
  };
  let explorerDocument: SingleDocument | null = activeSingleAtPathEnd(committedState);
  if (anim.kind === 'out') {
    const fromEx = activeSingleAtPathEnd(anim.from);
    const toEx = activeSingleAtPathEnd(anim.to);
    if (!fromEx && toEx) {
      explorerDocument = toEx;
    } else if (fromEx && !toEx) {
      explorerDocument = fromEx;
    } else if (fromEx && toEx) {
      explorerDocument = fromEx;
    }
  }

  const appTilesStyle: CSSProperties = {
    opacity: tilesEntryVisible ? 1 : 0,
    pointerEvents: transitionIdle ? 'auto' : 'none',
  };

  return {
    documents: displayDocuments,
    indicesPath: displayIndicesPath,
    committedDocuments: state.documents,
    committedIndicesPath: state.indicesPath,
    transitionIdle,
    rootOpacityForIndex,
    explorerShellStyle,
    explorerDocument,
    dispatch,
    appTilesStyle,
  };
};
