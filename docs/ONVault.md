# ONVault — Secure Token Vault

## What is ONVault?

ONVault is a **digital safe** for holding crypto tokens. It is a smart contract — a program that runs on the blockchain and enforces rules automatically, without requiring trust in any single party.

Think of it like a **bank safe deposit box** with two keyholders:

- **The Owner** (your company's multisig wallet) — can move tokens in and out during normal business
- **The User** — can reclaim all tokens if the agreement expires

Neither party can override the other's rights. The rules are enforced by code on the blockchain.

## How Does It Work?

### Step 1: Setup

When the vault is created, three things happen automatically:

- The **Owner** and **User** addresses are locked in (they must be different addresses)
- The default token is set to **ON Token** ([0x33f6...59d](https://etherscan.io/address/0x33f6BE84becfF45ea6aA2952d7eF890B44bFB59d))
- A **90-day expiration timer** starts counting down

### Step 2: Normal Operation

During normal operation, the Owner manages the tokens:

```
  Owner                          ONVault
     │                                 │
     ├── "Set token to USDT" ────────► │
     │                                 │
     ├── "Send 1,000 USDT to Bob" ───► │ ──── 1,000 USDT ──► Bob
     │                                 │
```

The User does not need to do anything during this phase.

### Step 3: Keeping the Vault Active

Before the vault expires, the User can **extend the timer** — like renewing a lease:

- Minimum extension: **1 month**
- Maximum extension: **12 months**
- Can be extended **multiple times**

As long as the User keeps extending, the vault stays active and the Owner can continue working.

### Step 4: What If Trust Breaks Down?

If the User **stops extending the timer**, the vault will eventually expire. Once expired:

- The Owner **can no longer move tokens**
- The User **can withdraw everything** to a wallet of their choice

```
  Timeline:
  ──────────────────────────────────────────────►

  [Vault Created]          [Expiry Date]
       │                        │
       │◄── Owner can ──────►│
       │    move tokens         │
       │                        │
       │                   [After Expiry]
       │                        │
       │                        ├── User can withdraw ALL tokens
       │                        ├── Owner can NO LONGER move tokens
```

## Who Can Do What?

| Action | Owner | User |
|---|:---:|:---:|
| Change which token the vault operates with | Yes | — |
| Send tokens to recipients | Yes | — |
| Extend the expiration date | — | Yes |
| Withdraw all funds (after expiry only) | — | Yes |
| View vault information | Yes | Yes |

## Safety Guarantees

### For the User

- **Your funds are protected by code, not promises.** If you stop extending the vault, you are guaranteed to get your tokens back after expiry. No one — not even the Owner — can prevent this.
- **You control the timeline.** Only you can extend the expiration. The Owner cannot extend it on your behalf or force the vault to stay active.
- **Recovery of any token.** The emergency withdrawal works for any token held in the vault, even if it was sent there by mistake.

### For the Owner

- **Full operational control.** During the vault's active period, you can freely manage which tokens the vault works with and where they are sent.
- **Multisig protection.** The Owner role is designed for a multisig wallet (a wallet that requires multiple people to approve each action), reducing the risk of unauthorized access.

### Built-in Protections

| Protection | What it means |
|---|---|
| **Two-role system** | Owner and User must be different addresses and have completely separate abilities — neither can perform the other's actions |
| **Automatic expiration** | The vault expires in 90 days by default, ensuring the User always has a recovery path |
| **Attack prevention** | Industry-standard security measures protect against common blockchain exploits |
| **No accidental deposits** | The vault only accepts approved tokens, not raw cryptocurrency like ETH or BNB |
| **All actions are recorded** | Every operation emits a public event on the blockchain for full transparency and auditability |

## Example Scenario

1. The vault is deployed. The User's tokens are deposited. Expiry is set to 90 days from now.
2. The Owner uses the vault to distribute tokens as part of business operations.
3. Every few months, the User extends the vault — confirming they are happy with the Owner's work.
4. If the User becomes unhappy or the Owner goes silent, the User simply **stops extending**.
5. Once the 90-day expiry passes, the User withdraws all remaining tokens. No negotiation needed.

## Summary

| Question | Answer |
|---|---|
| What does ONVault hold? | ERC-20 tokens (default: ON Token, changeable by Owner) |
| Who controls day-to-day operations? | The Owner (multisig wallet) |
| Who has the ultimate safety net? | The User (can withdraw after expiry) |
| How long until expiry? | 90 days from deployment (extendable by the User) |
| Can the Owner prevent withdrawal after expiry? | **No.** This is enforced by the blockchain. |
| Is the code audited and open source? | The contract uses industry-standard OpenZeppelin libraries and is licensed under Apache-2.0 |
