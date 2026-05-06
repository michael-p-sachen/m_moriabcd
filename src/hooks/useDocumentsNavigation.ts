import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  createInitialDocumentsState,
  documentsReducer,
  type DocumentsAction,
  type DocumentsState,
} from '../reducers';
import { documentTilesProps, isSingleDocument, type SingleDocument } from '../data';

const SLOT_COUNT = documentTilesProps.length;

const OUT_MS = 420;
const IN_MS = 440;
const TILES_ENTRY_DELAY_MS = 500;
const TILES_OPACITY_TRANSITION_MS = 2000;

type AnimIntent = { type: 'click'; clickedIndex: number } | { type: 'reset' };

type AnimIdle = { kind: 'idle' };
type AnimOut = { kind: 'out'; token: number; from: DocumentsState; to: DocumentsState; armed: boolean; intent: AnimIntent };
type AnimIn  = { kind: 'in';  token: number; from: DocumentsState; to: DocumentsState; entered: boolean };
type AnimState = AnimIdle | AnimOut | AnimIn;

const createEmptyDocumentsState = (): DocumentsState => ({
  documents: Array.from({ length: SLOT_COUNT }, () => undefined),
  indicesPath: [],
});

const statesEqual = (a: DocumentsState, b: DocumentsState): boolean => {
  if (a.indicesPath.length !== b.indicesPath.length) return false;
  for (let i = 0; i < a.indicesPath.length; i += 1) {
    if (a.indicesPath[i] !== b.indicesPath[i]) return false;
  }
  for (let k = 0; k < SLOT_COUNT; k += 1) {
    if (a.documents[k] !== b.documents[k]) return false;
  }
  return true;
};

const slotContentChanges = (from: DocumentsState, to: DocumentsState, k: number): boolean =>
  from.documents[k] !== to.documents[k];

const isEnteringSlot = (from: DocumentsState, to: DocumentsState, k: number): boolean =>
  Boolean(to.documents[k]) && slotContentChanges(from, to, k);

const activeSingleAtPathEnd = (s: DocumentsState): SingleDocument | null => {
  const i = s.indicesPath.at(-1);
  if (i === undefined) return null;
  const d = s.documents[i];
  return d && isSingleDocument(d) ? d : null;
};

const deriveRootOpacity = (anim: AnimState, index: number): number => {
  if (anim.kind === 'idle') return 1;
  if (anim.kind === 'out') {
    if (!anim.armed || !anim.from.documents[index]) return 1;
    return slotContentChanges(anim.from, anim.to, index) ? 0 : 1;
  }
  return !anim.entered && isEnteringSlot(anim.from, anim.to, index) ? 0 : 1;
};

const deriveExplorerShellStyle = (anim: AnimState): CSSProperties => {
  if (anim.kind !== 'out') return {};
  const fromEx = activeSingleAtPathEnd(anim.from);
  const toEx   = activeSingleAtPathEnd(anim.to);
  const isExiting  = Boolean(fromEx && !toEx);
  const isEntering = Boolean(!fromEx && toEx);
  if (!isExiting && !isEntering) return {};
  return {
    opacity:      isExiting ? (anim.armed ? 0 : 1) : (anim.armed ? 1 : 0),
    transition:   `opacity ${OUT_MS / 1000}s ease`,
    pointerEvents: 'none',
  };
};

const deriveExplorerDocument = (anim: AnimState, state: DocumentsState): SingleDocument | null => {
  if (anim.kind !== 'out') return activeSingleAtPathEnd(state);
  return activeSingleAtPathEnd(anim.from) ?? activeSingleAtPathEnd(anim.to);
};

export const useDocumentsNavigation = () => {
  const [state, baseDispatch] = useReducer(documentsReducer, undefined, createInitialDocumentsState);
  const [tilesEntryVisible,    setTilesEntryVisible]    = useState(false);
  const [tilesOpacityIntroDone, setTilesOpacityIntroDone] = useState(false);
  const tilesInteractionReadyRef = useRef(false);
  const transitionTokenRef       = useRef(0);

  const [anim, setAnim] = useState<AnimState>(() => ({
    kind:    'in',
    token:   (transitionTokenRef.current += 1),
    from:    createEmptyDocumentsState(),
    to:      createInitialDocumentsState(),
    entered: false,
  }));

  const stateRef = useRef(state);
  const animRef  = useRef(anim);
  stateRef.current = state;
  animRef.current  = anim;

  const dispatch = useCallback((action: DocumentsAction) => {
    if (action.type === 'click' && !tilesInteractionReadyRef.current) return;

    if (action.type === 'reset') {
      const from = stateRef.current;
      const to   = createInitialDocumentsState();
      if (statesEqual(from, to)) {
        baseDispatch({ type: 'reset' });
        setAnim({ kind: 'idle' });
        return;
      }
      setAnim({ kind: 'out', token: (transitionTokenRef.current += 1), armed: false, from, to, intent: { type: 'reset' } });
      return;
    }

    if (animRef.current.kind !== 'idle') return;
    const from = stateRef.current;
    const to   = documentsReducer(from, action);
    if (statesEqual(from, to)) return;
    setAnim({ kind: 'out', token: (transitionTokenRef.current += 1), armed: false, from, to, intent: { type: 'click', clickedIndex: action.clickedIndex } });
  }, []);

  useEffect(() => {
    dispatch({ type: 'reset' });
    const showTiles  = window.setTimeout(() => setTilesEntryVisible(true), TILES_ENTRY_DELAY_MS);
    const introDone  = window.setTimeout(() => {
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
    const { token } = anim;
    const id = requestAnimationFrame(() => {
      if (token !== transitionTokenRef.current) return;
      setAnim((a) => (a.kind === 'out' && !a.armed && a.token === token ? { ...a, armed: true } : a));
    });
    return () => cancelAnimationFrame(id);
  }, [anim]);

  useEffect(() => {
    if (anim.kind !== 'out' || !anim.armed) return;
    const { token, from, to, intent } = anim;
    const id = window.setTimeout(() => {
      if (token !== transitionTokenRef.current) return;
      baseDispatch(intent.type === 'click' ? { type: 'click', clickedIndex: intent.clickedIndex } : { type: 'reset' });
      if (token !== transitionTokenRef.current) return;
      setAnim({ kind: 'in', token, from, to, entered: false });
    }, OUT_MS);
    return () => clearTimeout(id);
  }, [anim, baseDispatch]);

  useEffect(() => {
    if (anim.kind !== 'in' || anim.entered) return;
    const { token } = anim;
    let id1 = 0, id2 = 0;
    id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => {
        if (token !== transitionTokenRef.current) return;
        setAnim((a) => (a.kind === 'in' && !a.entered && a.token === token ? { ...a, entered: true } : a));
      });
    });
    return () => { cancelAnimationFrame(id1); cancelAnimationFrame(id2); };
  }, [anim]);

  useEffect(() => {
    if (anim.kind !== 'in' || !anim.entered) return;
    const { token } = anim;
    const id = window.setTimeout(() => {
      if (token !== transitionTokenRef.current) return;
      setAnim({ kind: 'idle' });
    }, IN_MS);
    return () => clearTimeout(id);
  }, [anim]);

  const transitionIdle = anim.kind === 'idle' && tilesOpacityIntroDone;

  return {
    documents:           anim.kind === 'out' ? anim.from.documents    : state.documents,
    indicesPath:         anim.kind === 'out' ? anim.to.indicesPath     : state.indicesPath,
    committedDocuments:  state.documents,
    committedIndicesPath: state.indicesPath,
    transitionIdle,
    rootOpacityForIndex: (index: number) => deriveRootOpacity(anim, index),
    explorerShellStyle:  deriveExplorerShellStyle(anim),
    explorerDocument:    deriveExplorerDocument(anim, state),
    dispatch,
    appTilesStyle: {
      opacity:      tilesEntryVisible ? 1 : 0,
      pointerEvents: transitionIdle ? 'auto' : 'none',
    } as CSSProperties,
  };
};
