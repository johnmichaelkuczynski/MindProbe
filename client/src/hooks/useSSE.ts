import { useEffect, useRef, useState } from 'react';

export function useSSE<T>(url: string | null, onMessage?: (data: T) => void) {
  const [data, setData] = useState<T[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) return;

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const parsedData = JSON.parse(event.data) as T;
        setData(prev => [...prev, parsedData]);
        onMessage?.(parsedData);
      } catch (err) {
        console.error('Failed to parse SSE data:', err);
        setError('Failed to parse server data');
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      setError('Connection lost');
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [url, onMessage]);

  const disconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      setIsConnected(false);
    }
  };

  return {
    data,
    isConnected,
    error,
    disconnect,
    clearData: () => setData([])
  };
}
