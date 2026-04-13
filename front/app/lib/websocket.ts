import { useTaskStore } from "~/stores/task";

export class TaskWebSocket {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private token: string | null = null;

  connect(token: string) {
    if (
      this.ws &&
      this.token === token &&
      (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }

    this.token = token;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/api/ws/tasks?token=${encodeURIComponent(token)}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "task_status_update") {
          useTaskStore.getState().updateTask(message.data.task_id, {
            status: message.data.status,
            queue_position: message.data.queue_position,
            estimated_wait_ms: message.data.estimated_wait_ms,
          });
        }
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = (event) => {
      if (
        this.token &&
        event.code !== 4001 &&
        this.reconnectAttempts < this.maxReconnectAttempts
      ) {
        this.scheduleReconnect(this.token);
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private scheduleReconnect(token: string) {
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect(token);
    }, delay);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.token = null;

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
    }

    this.ws = null;
    this.reconnectAttempts = 0;
  }
}
