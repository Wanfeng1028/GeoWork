// GeoWork Frontend - SSE Client
// Unified SSE event subscription for task streams

type SSEEventHandler = (data: any) => void;

export interface SSESubscription {
  unsubscribe: () => void;
  isConnected: boolean;
}

class SSEClient {
  private subscriptions: Map<string, SSESubscription> = new Map();

  /**
   * Subscribe to SSE events from a URL.
   * Returns an unsubscribe function.
   */
  subscribe(url: string, onMessage: SSEEventHandler, onError?: (err: Event) => void): SSESubscription {
    let eventSource: EventSource | null = null;
    let isConnected = false;

    const cleanup = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      isConnected = false;
    };

    try {
      eventSource = new EventSource(url);
      isConnected = true;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch {
          onMessage({ raw: event.data });
        }
      };

      if (onError) {
        eventSource.onerror = onError;
      }

      // Custom event for stream completion
      eventSource.addEventListener('done', () => {
        cleanup();
      });
    } catch (err) {
      if (onError) {
        onError(err as Event);
      }
    }

    const subscription: SSESubscription = {
      unsubscribe: cleanup,
      get isConnected() { return isConnected; },
    };

    return subscription;
  }

  /**
   * Subscribe to task events by task ID.
   */
  subscribeTask(taskId: string, onMessage: SSEEventHandler, onError?: (err: Event) => void): SSESubscription {
    const url = `http://127.0.0.1:8765/api/tasks/${taskId}/events`;
    return this.subscribe(url, onMessage, onError);
  }

  /**
   * Unsubscribe all subscriptions.
   */
  unsubscribeAll(): void {
    for (const sub of this.subscriptions.values()) {
      sub.unsubscribe();
    }
    this.subscriptions.clear();
  }
}

export const sseClient = new SSEClient();
export default sseClient;
