/// <reference lib="webworker" />

type StartMessage = {
  type: "start";
  challenge: string;
  workerIndex: number;
  workerCount: number;
  difficultyHexZeros: number;
};

type StopMessage = {
  type: "stop";
};

type WorkerMessage = StartMessage | StopMessage;

let running = false;

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  if (message.type === "stop") {
    running = false;
    return;
  }

  running = true;

  const { challenge, workerIndex, workerCount, difficultyHexZeros } = message;
  const prefix = "0".repeat(Math.max(0, difficultyHexZeros));
  const encoder = new TextEncoder();

  let nonce = workerIndex;
  let hashes = 0;
  let lastReport = performance.now();
  let lastHashes = 0;

  while (running) {
    const input = encoder.encode(`${challenge}:${nonce}`);
    const digest = await crypto.subtle.digest("SHA-256", input);
    const hash = toHex(digest);
    hashes += 1;

    if (hash.startsWith(prefix)) {
      running = false;
      self.postMessage({
        type: "found",
        nonce,
        hash: `0x${hash}`,
        blockId: `0x${hash}`,
        hashes,
      });
      break;
    }

    nonce += workerCount;

    const now = performance.now();
    if (now - lastReport >= 250) {
      const intervalHashes = hashes - lastHashes;
      const seconds = (now - lastReport) / 1000;

      self.postMessage({
        type: "progress",
        hashes,
        hashesPerSecond: Math.round(intervalHashes / seconds),
      });

      lastReport = now;
      lastHashes = hashes;
    }
  }
};

export {};
