import { useEffect, useRef, useCallback, useState } from "react";
import { getAuthToken } from "@/context/auth-context";
import type { WSEventType, WSMessage } from "@shared/schema";

type WSCallback = (payload: any) => void;

interface UseWebSocketReturn {
  isConnected: boolean;
  send: (type: string, payload: any) => void;
  subscribe: (eventType: WSEventType, callback: WSCallback) => () => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<string, Set<WSCallback>>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    const token = getAuthToken();
    if (!token) return;

    // Build WebSocket URL
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          const callbacks = listenersRef.current.get(msg.type);
          if (callbacks) {
            callbacks.forEach((cb) => cb(msg.payload));
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        // Exponential backoff reconnect
        const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
        reconnectAttempts.current++;
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // Connection failed, will retry
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const send = useCallback((type: string, payload: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  const subscribe = useCallback((eventType: WSEventType, callback: WSCallback) => {
    if (!listenersRef.current.has(eventType)) {
      listenersRef.current.set(eventType, new Set());
    }
    listenersRef.current.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      listenersRef.current.get(eventType)?.delete(callback);
    };
  }, []);

  return { isConnected, send, subscribe };
}
