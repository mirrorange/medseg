import { useEffect, useRef } from "react";
import { useAuthStore } from "~/stores/auth";
import { TaskWebSocket } from "~/lib/websocket";

const DISCONNECT_GRACE_MS = 150;

let sharedWebSocket: TaskWebSocket | null = null;
let sharedSubscribers = 0;
let pendingDisconnect: ReturnType<typeof setTimeout> | null = null;

function acquireWebSocket(token: string): TaskWebSocket {
  if (pendingDisconnect) {
    clearTimeout(pendingDisconnect);
    pendingDisconnect = null;
  }

  if (!sharedWebSocket) {
    sharedWebSocket = new TaskWebSocket();
  }

  sharedSubscribers += 1;
  sharedWebSocket.connect(token);
  return sharedWebSocket;
}

function releaseWebSocket(socket: TaskWebSocket | null) {
  if (!socket) {
    return;
  }

  sharedSubscribers = Math.max(0, sharedSubscribers - 1);

  if (sharedSubscribers > 0) {
    return;
  }

  pendingDisconnect = setTimeout(() => {
    pendingDisconnect = null;

    if (sharedSubscribers === 0 && sharedWebSocket === socket) {
      sharedWebSocket.disconnect();
      sharedWebSocket = null;
    }
  }, DISCONNECT_GRACE_MS);
}

export function useWebSocket() {
  const token = useAuthStore((s) => s.token);
  const wsRef = useRef<TaskWebSocket | null>(null);

  useEffect(() => {
    if (!token) {
      if (pendingDisconnect) {
        clearTimeout(pendingDisconnect);
        pendingDisconnect = null;
      }

      sharedWebSocket?.disconnect();
      sharedWebSocket = null;
      sharedSubscribers = 0;
      wsRef.current = null;
      return;
    }

    wsRef.current = acquireWebSocket(token);

    return () => {
      releaseWebSocket(wsRef.current);
      wsRef.current = null;
    };
  }, [token]);
}
