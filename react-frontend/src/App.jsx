import { useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";

const CONTRACT_ADDRESS = "0xCFA18575d8126950DCA5960B65eCfEBdCc7041E3";
const CONTRACT_ABI = [
  {
    "inputs": [
      { "internalType": "string", "name": "_title", "type": "string" },
      { "internalType": "string[]", "name": "_options", "type": "string[]" }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "voter", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "optionIndex", "type": "uint256" }
    ],
    "name": "Voted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [{ "indexed": false, "internalType": "bool", "name": "active", "type": "bool" }],
    "name": "VotingStatusChanged",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "getOptions",
    "outputs": [{ "internalType": "string[]", "name": "", "type": "string[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getResults",
    "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "hasVoted",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "title",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "votingActive",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "optionIndex", "type": "uint256" }],
    "name": "vote",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bool", "name": "active", "type": "bool" }],
    "name": "setVotingActive",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const TARGET_CHAIN_ID = 11155111;

export default function App() {
  const [account, setAccount] = useState("Not connected");
  const [network, setNetwork] = useState("Unknown");
  const [status, setStatus] = useState("Idle");
  const [statusType, setStatusType] = useState("info");
  const [pollTitle, setPollTitle] = useState("On-chain Vote");
  const [options, setOptions] = useState([]);
  const [results, setResults] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);
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

  const handleError = (error) => {
    const message =
      error?.shortMessage ||
      error?.reason ||
      error?.message ||
      "Unknown error";
    setStatusState(message, "error");
  };

  const connectWallet = async () => {
    if (!hasProvider) {
      setStatusState("MetaMask not found. Please install it.", "error");
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

      contractRef.current.removeAllListeners("Voted");
      contractRef.current.on("Voted", async () => {
        await loadData();
      });

      setAccount(address);
      setNetwork(`${networkInfo.name} (${networkInfo.chainId})`);
      setStatusState("Connected", "success");

      await loadData();
    } catch (error) {
      handleError(error);
    }
  };

  const loadData = async () => {
    if (!contractRef.current) return;
    try {
      setStatusState("Loading data...", "info");
      const [titleValue, opts, res] = await Promise.all([
        contractRef.current.title(),
        contractRef.current.getOptions(),
        contractRef.current.getResults()
      ]);
      setPollTitle(titleValue || "On-chain Vote");
      setOptions(opts);
      setResults(res.map((value) => Number(value)));
      await loadHistory(opts);
      setStatusState("Data loaded", "success");
    } catch (error) {
      handleError(error);
    }
  };

  const loadHistory = async (opts = options) => {
    if (!contractRef.current) return;
    const events = await contractRef.current.queryFilter("Voted");
    const mapped = events
      .slice(-8)
      .reverse()
      .map((event) => {
        const voter = event.args?.voter ?? event.args?.[0];
        const optionIndex = Number(event.args?.optionIndex ?? event.args?.[1] ?? 0);
        return {
          voter,
          optionIndex,
          optionLabel: opts[optionIndex] ?? `Option ${optionIndex}`,
          txHash: event.transactionHash
        };
      });
    setHistory(mapped);
  };

  const submitVote = async () => {
    if (!contractRef.current) {
      setStatusState("Connect wallet first.", "error");
      return;
    }

    if (selectedOption === null) {
      setStatusState("Select an option to vote.", "error");
      return;
    }

    try {
      setStatusState("Submitting transaction...", "info");
      const tx = await contractRef.current.vote(selectedOption);
      setStatusState(`Transaction sent: ${tx.hash}`, "info");
      await tx.wait();
      setStatusState("Vote confirmed!", "success");
      await loadData();
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
          <div className="brand">VoteWeb3</div>
          <div className="nav-links">
            <a href="#vote">Vote</a>
            <a href="#results">Results</a>
            <a href="#history">History</a>
          </div>
          <button className="btn ghost" onClick={connectWallet}>Connect</button>
        </nav>

        <header className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Web3 Voting DApp</p>
            <h1 className="hero-title">{pollTitle}</h1>
            <p className="subtitle">
              Connect MetaMask, cast your vote once, and watch results update live on Sepolia.
            </p>
            <div className="hero-actions">
              <button className="btn primary" onClick={connectWallet}>Connect MetaMask</button>
            </div>
            <div className="stats">
              <div className="stat-card">
                <span className="stat-value">1</span>
                <span className="stat-label">Vote per wallet</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">Sepolia</span>
                <span className="stat-label">Testnet</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">Live</span>
                <span className="stat-label">On‑chain results</span>
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
            <div className={`status-pill ${statusType}`}>{status}</div>
            <button className="btn primary" onClick={connectWallet}>Connect MetaMask</button>
          </div>
        </header>

        <section className="section" id="vote">
          <div className="section-head">
            <h2>{pollTitle}</h2>
            <p className="muted">Choose one option and submit a single on‑chain transaction.</p>
          </div>

          <div className="vote-grid">
            <div className="card">
              <div className="panel-header">
                <h3>Options</h3>
                <span className="pill">Select one</span>
              </div>
              <div className="options">
                {options.map((option, index) => (
                  <label key={option} className="option">
                    <input
                      type="radio"
                      name="option"
                      value={index}
                      checked={selectedOption === index}
                      onChange={() => setSelectedOption(index)}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
              <button className="btn primary" onClick={submitVote} disabled={!options.length}>
                Vote
              </button>
            </div>

            <div className="card" id="results">
              <div className="panel-header">
                <h3>Results</h3>
                <button className="btn ghost" onClick={loadData}>Refresh</button>
              </div>
              <div className="results">
                {options.map((option, index) => (
                  <div key={option} className="result-row">
                    <span>{option}</span>
                    <span>{results[index] ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="card history" id="history">
          <div className="history-header">
            <h3>Vote history</h3>
            <button className="btn ghost" onClick={loadData}>Update</button>
          </div>
          <div className="history-list">
            {history.length === 0 ? (
              <p className="muted">No votes yet.</p>
            ) : (
              history.map((item) => (
                <div key={item.txHash} className="history-row">
                  <span className="badge">{item.optionLabel}</span>
                  <span className="voter">{formatAddress(item.voter)}</span>
                  <a
                    className="tx"
                    href={`https://sepolia.etherscan.io/tx/${item.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Tx
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
      ctx.fillStyle = "rgba(255,255,255,0.75)";

      flakes.forEach((flake) => {
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
        ctx.fill();

        flake.y += flake.d;
        flake.x += Math.sin(flake.y * 0.01) * flake.sway;

        if (flake.y > canvas.height + 6) {
          flake.y = -10;
          flake.x = Math.random() * canvas.width;
        }
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="snowfall" />;
}
