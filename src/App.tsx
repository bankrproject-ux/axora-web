import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import WalletBar from "./components/WalletBar";
import { useAxoraStats } from "./hooks/useAxoraStats";
import { useCpuMiner } from "./mining/useCpuMiner";
import { useGpuMiner } from "./mining/useGpuMiner";
import { useMint } from "./mining/useMint";
import { checkGpuSupport } from "./mining/gpuSupport";

type MiningMode = "CPU" | "GPU";

export default function App() {
  const stats = useAxoraStats();
  const cpu = useCpuMiner();
  const gpu = useGpuMiner();
  const minting = useMint();

  const [mode, setMode] = useState<MiningMode>("CPU");
  const [gpuAvailable, setGpuAvailable] = useState(false);
  const [gpuMessage, setGpuMessage] = useState(
    "Checking WebGPU support...",
  );
  const [deadline, setDeadline] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const miner = mode === "CPU" ? cpu : gpu;
  const soldOut =
    stats.totalMinted !== undefined && stats.totalMinted >= 900n;

  useEffect(() => {
    let cancelled = false;

    void checkGpuSupport().then((support) => {
      if (cancelled) return;
      setGpuAvailable(support.supported);
      setGpuMessage(
        support.supported
          ? "WebGPU is available."
          : support.reason ?? "This browser or device does not support WebGPU.",
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (soldOut) {
      cpu.stop();
      gpu.stop();
    }
  }, [soldOut, cpu.stop, gpu.stop]);

  useEffect(() => {
    if (!miner.result) return;

    const expiresAt = Math.floor(Date.now() / 1000) + 60;
    setDeadline(expiresAt);
    setSecondsLeft(60);
  }, [miner.result]);

  useEffect(() => {
    if (!deadline) return;

    const updateCountdown = () => {
      const remaining = Math.max(
        0,
        deadline - Math.floor(Date.now() / 1000),
      );
      setSecondsLeft(remaining);
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 250);
    return () => window.clearInterval(timer);
  }, [deadline]);

  useEffect(() => {
    if (minting.isConfirmed) void stats.refresh();
  }, [minting.isConfirmed]);

  const epoch = stats.currentEpoch?.toString().padStart(2, "0") ?? "—";
  const price =
    stats.currentPrice !== undefined
      ? `${formatUnits(stats.currentPrice, 18)} ETH`
      : "Loading...";
  const minted =
    stats.totalMinted !== undefined ? stats.totalMinted.toString() : "—";
  const remaining =
    stats.remainingSupply !== undefined
      ? stats.remainingSupply.toString()
      : "—";

  const activeResult = Boolean(miner.result && secondsLeft > 0);
  const expired = Boolean(miner.result && secondsLeft === 0);

  function startMining() {
    setDeadline(null);
    setSecondsLeft(0);
    minting.reset();

    if (mode === "CPU") {
      gpu.stop();
      cpu.start();
    } else {
      cpu.stop();
      void gpu.start();
    }
  }

  function stopMining() {
    cpu.stop();
    gpu.stop();
  }

  async function mintNft() {
    if (!miner.result || !deadline || secondsLeft <= 0) return;

    await minting.mint({
      blockId: miner.result.blockId,
      deadline,
    });
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="AXORA home">
          AXORA<span className="brand-dot">.</span>
        </a>
        <div className="topbar-right">
          <span className="network-label">ROBINHOOD CHAIN</span>
          <WalletBar />
        </div>
      </header>

      <section className="dashboard">
        <div className="section-heading">
          <div>
            <p className="eyebrow">AXORA / ON-CHAIN MINER</p>
            <h1>Mining terminal</h1>
          </div>
          <div className={`status-chip ${soldOut ? "status-sold" : ""}`}>
            <span className="status-light" />
            {soldOut ? "SOLD OUT" : "MAINNET"}
          </div>
        </div>

        <section className="stats-grid" aria-label="Collection statistics">
          <article className="panel stat-panel">
            <span className="label">CURRENT EPOCH</span>
            <strong className="stat-value">{epoch}</strong>
            <span className="subtle">EPOCH {epoch}</span>
          </article>

          <article className="panel stat-panel">
            <span className="label">TOTAL MINTED</span>
            <strong className="stat-value">
              {minted}<span className="stat-total"> / 900</span>
            </strong>
            <span className="subtle">{remaining} REMAINING</span>
          </article>

          <article className="panel stat-panel">
            <span className="label">CURRENT MINT PRICE</span>
            <strong className="stat-value price-value">{price}</strong>
            <span className="subtle">LIVE CONTRACT PRICE</span>
          </article>
        </section>

        <section className="panel miner-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">MINER CONTROL</p>
              <h2>Proof-of-work game</h2>
            </div>
            <span className={`miner-status ${miner.isMining ? "is-active" : ""}`}>
              <span className="status-light" />
              {soldOut
                ? "SOLD OUT"
                : miner.isMining
                  ? "SEARCHING FOR BLOCK..."
                  : activeResult
                    ? "BLOCK FOUND"
                    : expired
                      ? "BLOCK EXPIRED"
                      : "READY"}
            </span>
          </div>

          <div className="mode-row">
            <div>
              <span className="label">MINING MODE</span>
              <div className="mode-buttons">
                <button
                  className={`mode-button ${mode === "CPU" ? "mode-selected" : ""}`}
                  type="button"
                  disabled={cpu.isMining || gpu.isMining || activeResult}
                  onClick={() => setMode("CPU")}
                >
                  CPU
                </button>
                <button
                  className={`mode-button ${mode === "GPU" ? "mode-selected" : ""}`}
                  type="button"
                  disabled={
                    !gpuAvailable ||
                    cpu.isMining ||
                    gpu.isMining ||
                    activeResult
                  }
                  title={gpuMessage}
                  onClick={() => setMode("GPU")}
                >
                  {gpuAvailable ? "GPU" : "GPU MINING UNAVAILABLE"}
                </button>
              </div>
            </div>
            <span className="worker-note">
              {mode === "CPU"
                ? "Multi-worker SHA-256 · Browser-based"
                : "WebGPU SHA-256 · Parallel compute"}
            </span>
          </div>

          {!gpuAvailable && (
            <p className="gpu-notice" role="status">
              GPU MINING UNAVAILABLE — {gpuMessage}
            </p>
          )}

          <div className="mining-metrics">
            <div className="metric">
              <span className="label">HASHRATE</span>
              <strong>{(miner.hashrate / 1_000_000).toFixed(3)} MH/s</strong>
            </div>
            <div className="metric">
              <span className="label">HASHES</span>
              <strong>{miner.hashes.toLocaleString("en-US")}</strong>
            </div>
            <div className="metric">
              <span className="label">DIFFICULTY</span>
              <strong>00…</strong>
            </div>
          </div>

          <div className="terminal-output" aria-live="polite">
            <div className="terminal-line">
              <span className="terminal-prompt">&gt;</span>
              {!miner.isMining && !activeResult && !expired && (
                <span>Miner ready. Start {mode} mining to search for a hash.</span>
              )}
              {miner.isMining && (
                <span>Searching for a matching SHA-256 hash...</span>
              )}
              {activeResult && (
                <span>Local hash found. Mint window is open.</span>
              )}
              {expired && (
                <span>Mint window expired. Start mining again.</span>
              )}
            </div>
            {miner.result && (
              <>
                <div className="terminal-line">
                  <span className="terminal-key">NONCE</span>
                  <span>{miner.result.nonce.toLocaleString("en-US")}</span>
                </div>
                <div className="terminal-line">
                  <span className="terminal-key">HASH</span>
                  <code>{miner.result.hash}</code>
                </div>
              </>
            )}
          </div>

          {miner.error && <p className="error-banner">{miner.error}</p>}

          {activeResult && miner.result && (
            <section className="block-card">
              <div className="block-title">
                <span className="block-marker">■</span>
                <h3>BLOCK FOUND</h3>
                <span className="countdown">
                  00:{secondsLeft.toString().padStart(2, "0")}
                </span>
              </div>
              <div className="block-details">
                <span className="label">BLOCK ID</span>
                <code>{miner.result.blockId}</code>
                <span className="label">EPOCH / MINT</span>
                <strong>
                  {epoch} <span className="separator">/</span> {price}
                </strong>
              </div>
              <button
                className="button button-primary mint-button"
                type="button"
                disabled={minting.isMinting || soldOut}
                onClick={() => void mintNft()}
              >
                {minting.isMinting
                  ? "WAITING FOR CONFIRMATION..."
                  : "MINT NFT"}
              </button>
            </section>
          )}

          {expired && (
            <div className="expired-card">
              <strong>BLOCK EXPIRED</strong>
              <span>The mint deadline passed. No mint transaction was sent.</span>
            </div>
          )}

          {minting.error && <p className="error-banner">{minting.error}</p>}

          {minting.isConfirmed && minting.transactionHash && (
            <div className="success-banner">
              <strong>MINT CONFIRMED</strong>
              <a
                href={`https://robinhoodchain.blockscout.com/tx/${minting.transactionHash}`}
                target="_blank"
                rel="noreferrer"
              >
                VIEW TRANSACTION ↗
              </a>
            </div>
          )}

          <div className="action-row">
            {miner.isMining ? (
              <button
                className="button button-stop"
                type="button"
                onClick={stopMining}
              >
                STOP MINING
              </button>
            ) : (
              <button
                className="button button-primary"
                type="button"
                disabled={
                  soldOut ||
                  stats.isLoading ||
                  stats.totalMinted === undefined ||
                  (mode === "GPU" && !gpuAvailable)
                }
                onClick={startMining}
              >
                START MINING
              </button>
            )}
            <span className="subtle">
              {stats.error
                ? "Unable to read contract data"
                : stats.isLoading
                  ? "Syncing with contract..."
                  : "Contract data synced"}
            </span>
          </div>

          <p className="disclosure">
            Browser mining is a frontend game mechanic. The AXORA contract does
            not validate mining difficulty or SHA-256 proof-of-work.
          </p>
        </section>

        <footer className="footer">
          <span>AXORA NFT · AXR</span>
          <a
            href="https://robinhoodchain.blockscout.com/address/0xe1B617Ff8C71912fb79EA4adBc4CA63154a61C34"
            target="_blank"
            rel="noreferrer"
          >
            CONTRACT ↗
          </a>
          <span>CHAIN ID 4663</span>
        </footer>
      </section>
    </main>
  );
}
