import { useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";

const CONTRACT_ADDRESS = "0xD99B731af7B3E68EC3BC4D321B0276CBEC6b8a88";
const CONTRACT_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

const TARGET_CHAIN_ID = 11155111;

export default function App() {
  const [account, setAccount] = useState("Not connected");
  const [network, setNetwork] = useState("Unknown");
  const [status, setStatus] = useState("Idle");
  const [statusType, setStatusType] = useState("info");
  const [tokenName, setTokenName] = useState("FaraToken");
  const [tokenSymbol, setTokenSymbol] = useState("FARA");
  const [decimals, setDecimals] = useState(18);
  const [balance, setBalance] = useState("0");
  const [totalSupply, setTotalSupply] = useState("0");
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [approveSpender, setApproveSpender] = useState("");
  const [approveAmount, setApproveAmount] = useState("");
  const [lastTxHash, setLastTxHash] = useState("");
  const [history, setHistory] = useState([]);

  const providerRef = useRef(null);
  const signerRef = useRef(null);
  const contractRef = useRef(null);

  const hasProvider = useMemo(() => typeof window !== "undefined" && window.ethereum, []);

  const setStatusState = (message, type = "info") => {
    setStatus(message);
    setStatusType(type);
  };

  const formatAddress = (address) =>
    address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Unknown";

  const formatTokenAmount = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return "0";
    if (num === 0) return "0";
    if (num < 0.000001) return "<0.000001";
    if (num < 1) return num.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
    if (num < 1000) return num.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(num);
  };

  const handleError = (error) => {
    const message =
      error?.shortMessage ||
      error?.reason ||
      error?.message ||
      "Unknown error";
    setStatusState(message, "error");
  };

  const addTxHistory = (entry) => {
    setHistory((prev) => {
      const next = [entry, ...prev.filter((item) => item.hash !== entry.hash)];
      return next.slice(0, 10);
    });
  };

  const connectWallet = async () => {
    if (!hasProvider) {
      setStatusState("MetaMask not found. Please install it.", "error");
      return;
    }

    if (!ethers.isAddress(CONTRACT_ADDRESS)) {
      setStatusState("Set a valid contract address in App.jsx.", "error");
      return;
    }

    try {
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      if (parseInt(chainId, 16) !== TARGET_CHAIN_ID) {
        setStatusState("Please switch to Sepolia network.", "error");
      }

      await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const networkInfo = await provider.getNetwork();

      providerRef.current = provider;
      signerRef.current = signer;
      contractRef.current = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      setAccount(address);
      setNetwork(`${networkInfo.name} (${networkInfo.chainId})`);
      setStatusState("Connected", "success");

      await loadTokenData(address);
      await loadHistory(address);
    } catch (error) {
      handleError(error);
    }
  };

  const loadTokenData = async (addressOverride) => {
    if (!contractRef.current) return;
    try {
      setStatusState("Loading token data...", "info");
      const address = addressOverride || account;
      if (!ethers.isAddress(address)) {
        setStatusState("Connect wallet first.", "error");
        return;
      }
      const [name, symbol, decimalsValue, supply, balanceValue] = await Promise.all([
        contractRef.current.name(),
        contractRef.current.symbol(),
        contractRef.current.decimals(),
        contractRef.current.totalSupply(),
        contractRef.current.balanceOf(address)
      ]);

      const decimalsNumber = Number(decimalsValue);
      setTokenName(name);
      setTokenSymbol(symbol);
      setDecimals(decimalsNumber);
      setTotalSupply(ethers.formatUnits(supply, decimalsNumber));
      setBalance(ethers.formatUnits(balanceValue, decimalsNumber));
      setStatusState("Token data loaded", "success");
    } catch (error) {
      handleError(error);
    }
  };

  const loadHistory = async (addressOverride) => {
    if (!contractRef.current || !providerRef.current) return;
    const address = addressOverride || account;
    if (!ethers.isAddress(address)) return;

    try {
      const latestBlock = await providerRef.current.getBlockNumber();
      const fromBlock = Math.max(0, latestBlock - 5000);

      const transferFilter = contractRef.current.filters.Transfer();
      const approvalFilter = contractRef.current.filters.Approval(address, null);

      const [transferEvents, approvalEvents] = await Promise.all([
        contractRef.current.queryFilter(transferFilter, fromBlock, latestBlock),
        contractRef.current.queryFilter(approvalFilter, fromBlock, latestBlock)
      ]);

      const mappedTransfers = transferEvents
        .filter((event) => {
          const from = event.args?.from ?? event.args?.[0];
          const to = event.args?.to ?? event.args?.[1];
          return from?.toLowerCase() === address.toLowerCase() || to?.toLowerCase() === address.toLowerCase();
        })
        .map((event) => {
          const from = event.args?.from ?? event.args?.[0];
          const to = event.args?.to ?? event.args?.[1];
          const value = event.args?.value ?? event.args?.[2];
          const direction = from?.toLowerCase() === address.toLowerCase() ? "Sent" : "Received";
          return {
            hash: event.transactionHash,
            type: `Transfer (${direction})`,
            amount: ethers.formatUnits(value ?? 0, decimals),
            counterparty: direction === "Sent" ? to : from,
            status: "confirmed"
          };
        });

      const mappedApprovals = approvalEvents.map((event) => {
        const spender = event.args?.spender ?? event.args?.[1];
        const value = event.args?.value ?? event.args?.[2];
        return {
          hash: event.transactionHash,
          type: "Approval",
          amount: ethers.formatUnits(value ?? 0, decimals),
          counterparty: spender,
          status: "confirmed"
        };
      });

      const merged = [...mappedTransfers, ...mappedApprovals]
        .sort((a, b) => (a.hash < b.hash ? 1 : -1))
        .slice(0, 10);

      setHistory(merged);
    } catch (error) {
      handleError(error);
    }
  };

    const submitTransfer = async () => {
      if (!contractRef.current) {
        setStatusState("Connect wallet first.", "error");
        return;
      }

      if (!ethers.isAddress(transferTo)) {
        setStatusState("Recipient address is invalid.", "error");
        return;
      }

      if (!transferAmount || Number(transferAmount) <= 0) {
        setStatusState("Enter a valid transfer amount.", "error");
        return;
      }

      try {
        setStatusState("Submitting transfer...", "info");
        const amount = ethers.parseUnits(transferAmount, decimals);
        const tx = await contractRef.current.transfer(transferTo, amount);
        setLastTxHash(tx.hash);
        addTxHistory({
          hash: tx.hash,
          type: "Transfer (Sent)",
          amount: transferAmount,
          counterparty: transferTo,
          status: "pending"
        });
        setStatusState(`Transaction sent: ${tx.hash}`, "info");
        await tx.wait();
        addTxHistory({
          hash: tx.hash,
          type: "Transfer (Sent)",
          amount: transferAmount,
          counterparty: transferTo,
          status: "confirmed"
        });
        setStatusState("Transfer confirmed!", "success");
        await loadTokenData();
      } catch (error) {
        handleError(error);
      }
    };

    const submitApprove = async () => {
      if (!contractRef.current) {
        setStatusState("Connect wallet first.", "error");
        return;
      }

      if (!ethers.isAddress(approveSpender)) {
        setStatusState("Spender address is invalid.", "error");
        return;
      }

      if (!approveAmount || Number(approveAmount) <= 0) {
        setStatusState("Enter a valid approve amount.", "error");
        return;
      }

      try {
        setStatusState("Submitting approval...", "info");
        const amount = ethers.parseUnits(approveAmount, decimals);
        const tx = await contractRef.current.approve(approveSpender, amount);
        setLastTxHash(tx.hash);
        addTxHistory({
          hash: tx.hash,
          type: "Approval",
          amount: approveAmount,
          counterparty: approveSpender,
          status: "pending"
        });
        setStatusState(`Transaction sent: ${tx.hash}`, "info");
        await tx.wait();
        addTxHistory({
          hash: tx.hash,
          type: "Approval",
          amount: approveAmount,
          counterparty: approveSpender,
          status: "confirmed"
        });
        setStatusState("Approval confirmed!", "success");
      } catch (error) {
        handleError(error);
      }
    };

    useEffect(() => {
      if (!window.ethereum) return;
      const handleAccountsChanged = () => window.location.reload();
      const handleChainChanged = () => window.location.reload();

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);

      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      };
    }, []);

    const shortContract = formatAddress(CONTRACT_ADDRESS);

    return (
      <div className="app">
        <Snowfall />
        <main className="shell">
          <nav className="navbar">
            <div className="brand">TokenDApp</div>
            <div className="nav-links">
              <a href="#transfer">Transfer</a>
              <a href="#approve">Approve</a>
              <a href="#wallet">Wallet</a>
            </div>
            <button className="btn ghost" onClick={connectWallet}>Connect</button>
          </nav>

          <header className="hero-grid" id="wallet">
            <div className="hero-copy">
              <p className="eyebrow">ERC-20 Token Dashboard</p>
              <h1 className="hero-title">{tokenName}</h1>
              <p className="subtitle">
                Connect MetaMask on Sepolia to transfer tokens and manage allowances.
              </p>
              <div className="hero-actions">
                <button className="btn primary" onClick={connectWallet}>Connect MetaMask</button>
                <button className="btn outline" onClick={() => loadTokenData()}>
                  Refresh data
                </button>
              </div>
              <div className="stats">
                <div className="stat-card">
                  <span className="stat-value">{tokenSymbol}</span>
                  <span className="stat-label">Symbol</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{formatTokenAmount(totalSupply)}</span>
                  <span className="stat-label">Total supply</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">Sepolia</span>
                  <span className="stat-label">Testnet</span>
                </div>
              </div>
            </div>
            <div className="hero-card">
              <div className="panel-row">
                <span className="label">Wallet</span>
                <span className="value">{account}</span>
              </div>
              <div className="panel-row">
                <span className="label">Network</span>
                <span className="value">{network}</span>
              </div>
              <div className="panel-row">
                <span className="label">Balance</span>
                <span className="value">{formatTokenAmount(balance)} {tokenSymbol}</span>
              </div>
              <div className={`status-pill ${statusType}`}>{status}</div>
              <button className="btn primary" onClick={connectWallet}>Connect MetaMask</button>
            </div>
          </header>

          <section className="section" id="transfer">
            <div className="section-head">
              <h2>Transfer tokens</h2>
              <p className="muted">Send tokens directly from your wallet.</p>
            </div>
            <div className="card">
              <div className="form-grid">
                <div className="form-row">
                  <label className="label">Recipient address</label>
                  <input
                    className="input"
                    placeholder="0x..."
                    value={transferTo}
                    onChange={(event) => setTransferTo(event.target.value)}
                  />
                </div>
                <div className="form-row">
                  <label className="label">Amount ({tokenSymbol})</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.0"
                    value={transferAmount}
                    onChange={(event) => setTransferAmount(event.target.value)}
                  />
                </div>
              </div>
              <button className="btn primary" onClick={submitTransfer}>
                Transfer
              </button>
            </div>
          </section>

          <section className="section" id="approve">
            <div className="section-head">
              <h2>Approve spending</h2>
              <p className="muted">Allow a spender to use your tokens via allowance.</p>
            </div>
            <div className="card">
              <div className="form-grid">
                <div className="form-row">
                  <label className="label">Spender address</label>
                  <input
                    className="input"
                    placeholder="0x..."
                    value={approveSpender}
                    onChange={(event) => setApproveSpender(event.target.value)}
                  />
                </div>
                <div className="form-row">
                  <label className="label">Allowance ({tokenSymbol})</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.0"
                    value={approveAmount}
                    onChange={(event) => setApproveAmount(event.target.value)}
                  />
                </div>
              </div>
              <button className="btn outline" onClick={submitApprove}>
                Approve
              </button>
            </div>
          </section>

          {lastTxHash && (
            <section className="card">
              <div className="panel-row">
                <span className="label">Latest transaction</span>
                <a
                  className="hash-link"
                  href={`https://sepolia.etherscan.io/tx/${lastTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {lastTxHash}
                </a>
              </div>
            </section>
          )}

          <section className="card">
            <div className="history-header">
              <h3>Transaction history</h3>
              <button className="btn ghost" onClick={() => loadHistory()}>
                Refresh
              </button>
            </div>
            <div className="history-list">
              {history.length === 0 ? (
                <p className="muted">No transactions yet.</p>
              ) : (
                history.map((item) => (
                  <div key={item.hash} className="history-row">
                    <span className="badge">{item.type}</span>
                    <span className="voter">
                      {formatTokenAmount(item.amount)} {tokenSymbol}
                    </span>
                    <span className="voter">{formatAddress(item.counterparty)}</span>
                    <a
                      className="tx"
                      href={`https://sepolia.etherscan.io/tx/${item.hash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.status}
                    </a>
                  </div>
                ))
              )}
            </div>
          </section>

          <footer className="footer">
            <span>Contract: {shortContract}</span>
            <span>Network: Sepolia</span>
          </footer>
        </main>
      </div>
    );
  }

  function Snowfall() {
    const canvasRef = useRef(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return undefined;
      const ctx = canvas.getContext("2d");
      let animationId;

      const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };

      resize();
      window.addEventListener("resize", resize);

      const flakes = Array.from({ length: 140 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 0.6,
        d: Math.random() * 0.9 + 0.4,
        sway: Math.random() * 0.8 + 0.2
      }));

      const render = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
        ctx.beginPath();
        flakes.forEach((flake) => {
          ctx.moveTo(flake.x, flake.y);
          ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
        });
        ctx.fill();

        flakes.forEach((flake) => {
          flake.y += flake.d;
          flake.x += Math.sin(flake.y * 0.01) * flake.sway;
          if (flake.y > canvas.height) {
            flake.y = -flake.r;
            flake.x = Math.random() * canvas.width;
          }
        });

        animationId = requestAnimationFrame(render);
      };

      render();

      return () => {
        window.removeEventListener("resize", resize);
        cancelAnimationFrame(animationId);
      };
    }, []);

    return <canvas ref={canvasRef} className="snowfall" />;
  }
