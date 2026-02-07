# ERC-20 Token DApp (Assignment 4)

A Sepolia ERC-20 token DApp with mint/burn, access control, and a React + ethers frontend for transfers and approvals.

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
   - `name_`: token name (e.g. `"FaraToken"`)
   - `symbol_`: token symbol (e.g. `"FARA"`)
   - `initialSupply`: smallest units (for 1,000 EDU with 18 decimals use `1000 * 10**18`)
   - `cap_`: max supply in smallest units (must be >= `initialSupply`)
6. Click Deploy and copy the contract address.

## Frontend setup
1. Open [react-frontend/src/App.jsx](react-frontend/src/App.jsx).
2. Replace `CONTRACT_ADDRESS` with your deployed address.

## Run the frontend
1. Go to the frontend folder:
2. Install dependencies.
3. Start dev server.
4. Open the URL from the console (usually `http://localhost:5173`).

## How to use
1. Open the site and click **Connect MetaMask**.
2. Switch MetaMask to Sepolia.
3. Check wallet balance.
4. Use **Transfer tokens** to send tokens.
5. Use **Approve spending** to set an allowance for a spender.

## Notes
- After every new deploy, update `CONTRACT_ADDRESS`.
- Only the owner can mint.
- Transfers can be paused/unpaused by the owner.
- Total supply is capped.
