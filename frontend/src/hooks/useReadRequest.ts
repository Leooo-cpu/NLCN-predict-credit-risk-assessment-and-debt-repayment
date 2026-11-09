import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../api/client";

// Latest read wins. Aborted/unmounted requests never update the screen.
export function useReadRequest<T>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const controller = useRef<AbortController>();
  useEffect(() => () => controller.current?.abort(), []);
  const run = useCallback(async (read: (signal: AbortSignal) => Promise<T>) => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    setError("");
    try {
      const result = await read(request.signal);
      if (!request.signal.aborted) setData(result);
    } catch (err) {
      if (!request.signal.aborted) setError(errorMessage(err));
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }, []);
  return { data, loading, error, run };
}

export function useMounted() {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}
