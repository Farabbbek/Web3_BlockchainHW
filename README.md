# Web3 Voting DApp

A simple Sepolia voting DApp. Frontend uses React + ethers, smart contract is Solidity.

## What’s inside
- Smart contract: [contracts/Voting.sol](contracts/Voting.sol)
- Frontend (Vite + React): [react-frontend](react-frontend)

## Requirements
- Node.js 18+
- MetaMask
- Sepolia test ETH

## Deploy the contract (Remix)
1. Open Remix and create `Voting.sol`.
2. Paste the code from [contracts/Voting.sol](contracts/Voting.sol).
3. Select Solidity ^0.8.20 and compile.
4. In Deploy & Run:
   - Environment: `Injected Provider - MetaMask`
   - Network: Sepolia
5. Provide constructor args:
   - `_title`: question string (e.g. `"Should we launch ?"`)
   - `_options`: array of options (e.g. `["Yes","No","Abstain"]`)
6. Click Deploy and copy the contract address.

## Frontend setup
1. Open [react-frontend/src/App.jsx](react-frontend/src/App.jsx).
2. Replace `CONTRACT_ADDRESS` with your deployed address.

## Run the frontend
1. Go to the frontend folder:
   - `cd react-frontend`
2. Install dependencies:
   - `npm install`
3. Start dev server:
   - `npm run dev`
4. Open the URL from the console (usually `http://localhost:5173`).

## How to use
1. Open the site and click **Connect MetaMask**.
2. Switch MetaMask to Sepolia.
3. Pick an option and click **Vote**.
4. Results and history update automatically.

## Notes
- After every new deploy, update `CONTRACT_ADDRESS`.
- One wallet can vote only once.

If you want Hardhat or Foundry deployment steps, tell me and I’ll add them.
