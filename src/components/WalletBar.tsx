import {
  useAccount,
  useBalance,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { robinhoodChain } from "../config/chain";

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function WalletBar() {
  const { address, chainId, isConnected } = useAccount();
  const { connectors, connect, isPending: isConnecting, error: connectError } =
    useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching, error: switchError } =
    useSwitchChain();

  const { data: balance } = useBalance({
    address,
    chainId: robinhoodChain.id,
    query: { enabled: Boolean(address) },
  });

  const wrongNetwork = isConnected && chainId !== robinhoodChain.id;
  const errorMessage = connectError?.message ?? switchError?.message;

  if (!isConnected) {
    return (
      <div className="wallet-area">
        <button
          className="button button-connect"
          type="button"
          disabled={isConnecting || connectors.length === 0}
          onClick={() => {
            const connector = connectors[0];
            if (connector) connect({ connector });
          }}
        >
          {isConnecting ? "CONNECTING..." : "CONNECT WALLET"}
        </button>
        {errorMessage && <p className="inline-error">{errorMessage}</p>}
      </div>
    );
  }

  return (
    <div className="wallet-area">
      {wrongNetwork ? (
        <button
          className="button button-warning"
          type="button"
          disabled={isSwitching}
          onClick={() => switchChain({ chainId: robinhoodChain.id })}
        >
          {isSwitching ? "SWITCHING NETWORK..." : "SWITCH TO ROBINHOOD"}
        </button>
      ) : (
        <div className="wallet-connected">
          <span className="wallet-balance">
            {balance ? `${Number(balance.formatted).toFixed(4)} ETH` : "— ETH"}
          </span>
          <span className="wallet-address">
            {address ? shortenAddress(address) : ""}
          </span>
          <button
            className="button button-small"
            type="button"
            onClick={() => disconnect()}
          >
            DISCONNECT
          </button>
        </div>
      )}
      {errorMessage && <p className="inline-error">{errorMessage}</p>}
    </div>
  );
}
