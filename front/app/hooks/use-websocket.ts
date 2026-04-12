import { useEffect, useRef } from "react";
import { useAuthStore } from "~/stores/auth";
import { TaskWebSocket } from "~/lib/websocket";

export function useWebSocket() {
  const token = useAuthStore((s) => s.token);
  const wsRef = useRef<TaskWebSocket | null>(null);

  useEffect(() => {
    if (token) {
      wsRef.current = new TaskWebSocket();
      wsRef.current.connect(token);
    }
    return () => {
      wsRef.current?.disconnect();
      wsRef.current = null;
    };
  }, [token]);
}
