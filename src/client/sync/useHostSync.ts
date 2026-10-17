import { useEffect, useRef } from 'react';
import type { BoardView, SyncMessage } from '../../game/types';

export function useHostSync(gameId: string, view: BoardView): void {
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    if (!gameId || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(`fq:${gameId}`);
    const send = () => channel.postMessage({ type: 'board', view: viewRef.current } satisfies SyncMessage);
    channel.onmessage = (event: MessageEvent<SyncMessage>) => { if (event.data.type === 'hello') send(); };
    send();
    return () => channel.close();
  }, [gameId]);
  useEffect(() => {
    if (!gameId || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(`fq:${gameId}`);
    channel.postMessage({ type: 'board', view } satisfies SyncMessage);
    channel.close();
  }, [gameId, view]);
}
