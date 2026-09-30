import { useCallback, useEffect, useRef, useState } from "react";

export type MiningResult = {
  nonce: number;
  hash: `0x${string}`;
  blockId: `0x${string}`;
};

type ProgressMessage = {
  type: "progress";
  hashes: number;
  hashesPerSecond: number;
};

type FoundMessage = {
  type: "found";
  nonce: number;
  hash: `0x${string}`;
  blockId: `0x${string}`;
  hashes: number;
};

type WorkerResponse = ProgressMessage | FoundMessage;

const DIFFICULTY_HEX_ZEROS = 2;

export function useCpuMiner() {
  const workersRef = useRef<Worker[]>([]);
  const workerHashesRef = useRef<number[]>([]);
  const workerRatesRef = useRef<number[]>([]);

  const [isMining, setIsMining] = useState(false);
  const [hashes, setHashes] = useState(0);
  const [hashrate, setHashrate] = useState(0);
  const [result, setResult] = useState<MiningResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    for (const worker of workersRef.current) {
      worker.postMessage({ type: "stop" });
      worker.terminate();
    }

    workersRef.current = [];
    setIsMining(false);
    setHashrate(0);
  }, []);

  const start = useCallback(() => {
    stop();
    setHashes(0);
    setResult(null);
    setError(null);

    const challenge = crypto.randomUUID();
    const availableCores = navigator.hardwareConcurrency || 2;
    const workerCount = Math.max(1, Math.min(availableCores - 1, 8));

    workerHashesRef.current = Array(workerCount).fill(0);
    workerRatesRef.current = Array(workerCount).fill(0);

    for (let index = 0; index < workerCount; index += 1) {
      const worker = new Worker(
        new URL("./cpuMiner.worker.ts", import.meta.url),
        { type: "module" },
      );

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;

        if (message.type === "progress") {
          workerHashesRef.current[index] = message.hashes;
          workerRatesRef.current[index] = message.hashesPerSecond;

          setHashes(
            workerHashesRef.current.reduce((total, count) => total + count, 0),
          );
          setHashrate(
            workerRatesRef.current.reduce((total, rate) => total + rate, 0),
          );
          return;
        }

        workerHashesRef.current[index] = message.hashes;
        setHashes(
          workerHashesRef.current.reduce((total, count) => total + count, 0),
        );
        setResult({
          nonce: message.nonce,
          hash: message.hash,
          blockId: message.blockId,
        });

        for (const activeWorker of workersRef.current) {
          activeWorker.postMessage({ type: "stop" });
          activeWorker.terminate();
        }

        workersRef.current = [];
        setIsMining(false);
        setHashrate(0);
      };

      worker.onerror = () => {
        setError("A CPU mining worker stopped unexpectedly.");
        worker.terminate();
        workersRef.current = workersRef.current.filter(
          (item) => item !== worker,
        );

        if (workersRef.current.length === 0) {
          setIsMining(false);
          setHashrate(0);
        }
      };

      worker.postMessage({
        type: "start",
        challenge,
        workerIndex: index,
        workerCount,
        difficultyHexZeros: DIFFICULTY_HEX_ZEROS,
      });

      workersRef.current.push(worker);
    }

    setIsMining(true);
  }, [stop]);

  useEffect(() => {
    return () => {
      for (const worker of workersRef.current) {
        worker.terminate();
      }
    };
  }, []);

  return { isMining, hashes, hashrate, result, error, start, stop };
}
