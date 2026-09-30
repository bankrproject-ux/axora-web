import { useCallback, useRef, useState } from "react";
import {
  mineWithGpu,
  type GpuMiningResult,
} from "./gpuMiner";

export function useGpuMiner() {
  const controllerRef = useRef<AbortController | null>(null);

  const [isMining, setIsMining] = useState(false);
  const [hashes, setHashes] = useState(0);
  const [hashrate, setHashrate] = useState(0);
  const [result, setResult] = useState<GpuMiningResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setIsMining(false);
    setHashrate(0);
  }, []);

  const start = useCallback(async () => {
    stop();
    setHashes(0);
    setHashrate(0);
    setResult(null);
    setError(null);

    const controller = new AbortController();
    controllerRef.current = controller;
    setIsMining(true);

    try {
      const found = await mineWithGpu((progress) => {
        setHashes(progress.hashes);
        setHashrate(progress.hashesPerSecond);
      }, controller.signal);

      setResult(found);
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) {
        setError(
          cause instanceof Error
            ? cause.message
            : "GPU mining could not start.",
        );
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setIsMining(false);
        setHashrate(0);
      }
    }
  }, [stop]);

  return { isMining, hashes, hashrate, result, error, start, stop };
}
