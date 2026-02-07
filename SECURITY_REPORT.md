# Security Analysis Report (Assignment 4)

## Potential Vulnerabilities

1. **Reentrancy**
   - ERC-20 transfers in this contract do not call external user-controlled contracts, so the typical reentrancy surface is minimal.
   - `transfer` and `transferFrom` only update balances and emit events.

2. **Integer overflow / underflow**
   - Solidity ^0.8.x has built-in overflow/underflow checks, so arithmetic errors revert automatically.

3. **Access control vulnerabilities**
   - Minting and pause/unpause are restricted to the owner via `onlyOwner`.
   - Without access control, anyone could mint unlimited tokens or pause transfers.

4. **Front-running**
   - ERC-20 `approve` can be front-run if a spender uses the old allowance before it is changed.
   - Users should set allowance to 0 before changing it to a new value to mitigate this risk.

## Mitigations Used

- **OpenZeppelin libraries** provide audited implementations of ERC-20 and access control.
- **`onlyOwner`** on minting and pause/unpause prevents unauthorized inflation or denial of service.
- **`require()` validations** ensure non-zero amounts and valid recipients.
- **Supply cap** (`ERC20Capped`) prevents unlimited token issuance.
- **Pausable transfers** allow the owner to stop transfers in emergencies.

## What If `onlyOwner` or `require()` Were Removed?

- **Without `onlyOwner`**:
  - Anyone could mint tokens, destroying supply integrity and token value.
  - Anyone could pause/unpause transfers, resulting in denial-of-service or manipulation.

- **Without `require()` checks**:
  - Zero-amount transfers could be spammed.
  - Invalid recipient addresses could lead to mistakes or loss of funds.
  - Error messages would be less clear, making audits and user experience worse.

## Additional Notes

- The frontend uses MetaMask + ethers for signing and sending transactions.
- Transactions and hashes are shown to the user for transparency and verification on Sepolia.
