import { useCallback, useEffect, useRef, useState } from "react";

type PollingOptions<T> = {
  intervalMs?: number;
  enabled?: boolean;
  onData: (data: T) => void;
  onFailure?: (error: unknown, failures: number) => void;
};

type PollingState = {
  loading: boolean;
  refresh: () => void;
};

const MAX_BACKOFF = 30_000;

export function usePolling<T>(fetcher: (signal: AbortSignal) => Promise<T>, options: PollingOptions<T>): PollingState {
  const fetcherRef = useRef(fetcher);
  const dataRef = useRef(options.onData);
  const failureRef = useRef(options.onFailure);
  const intervalRef = useRef(options.intervalMs ?? 5_000);
  const [loading, setLoading] = useState(false);

  fetcherRef.current = fetcher;
  dataRef.current = options.onData;
  failureRef.current = options.onFailure;
  intervalRef.current = options.intervalMs ?? 5_000;

  const timer = useRef<number | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  const failuresRef = useRef(0);
  const mounted = useRef(true);
  const runRef = useRef<(manual?: boolean) => void>(() => {});

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const schedule = useCallback(
    (delay: number) => {
      clearTimer();
      if (!mounted.current) return;
      timer.current = window.setTimeout(() => {
        timer.current = null;
        if (document.hidden) return;
        runRef.current();
      }, Math.max(250, delay));
    },
    [clearTimer],
  );

  const run = useCallback(
    async (manual = false) => {
      if (!mounted.current) return;
      if (document.hidden && !manual) return;
      if (inFlight.current) {
        if (!manual) return;
        inFlight.current.abort();
      }
      clearTimer();
      const controller = new AbortController();
      inFlight.current = controller;
      if (manual) setLoading(true);
      try {
        const data = await fetcherRef.current(controller.signal);
        if (!mounted.current || controller.signal.aborted) return;
        dataRef.current(data);
        failuresRef.current = 0;
        schedule(intervalRef.current);
      } catch (error) {
        if (!mounted.current || controller.signal.aborted) return;
        failuresRef.current += 1;
        failureRef.current?.(error, failuresRef.current);
        const backoff = Math.min(MAX_BACKOFF, intervalRef.current * 2 ** (failuresRef.current - 1));
        schedule(backoff);
      } finally {
        if (inFlight.current === controller) inFlight.current = null;
        if (mounted.current && manual) setLoading(false);
      }
    },
    [clearTimer, schedule],
  );

  runRef.current = (manual = false) => {
    void run(manual);
  };

  useEffect(() => {
    mounted.current = true;
    if (options.enabled === false) {
      clearTimer();
      inFlight.current?.abort();
      setLoading(false);
      return;
    }
    void run();

    const onVisibility = () => {
      if (!document.hidden) void run(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mounted.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimer();
      inFlight.current?.abort();
    };
    // The fetcher and callbacks are kept in refs; enabled is the only lifecycle switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.enabled]);

  const refresh = useCallback(() => {
    void run(true);
  }, [run]);

  return { loading, refresh };
}
