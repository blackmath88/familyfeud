import { useEffect, useState } from 'react';
import type { BoardView, SyncMessage } from '../../game/types';

export function useBoardSync(gameId: string): BoardView | null {
  const [snapshot, setSnapshot] = useState<{ gameId: string; view: BoardView } | null>(null);
  useEffect(() => {
    if (!gameId || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(`fq:${gameId}`);
    channel.onmessage = (event: MessageEvent<SyncMessage>) => {
      if (event.data.type === 'board') setSnapshot({ gameId, view: event.data.view });
    };
    channel.postMessage({ type: 'hello' } satisfies SyncMessage);
    return () => channel.close();
  }, [gameId]);
  return snapshot?.gameId === gameId ? snapshot.view : null;
}
