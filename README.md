# Visual Evidence Receipts

A local CLI that creates signed, tamper-evident receipts for an **observed public visual-correspondence workflow**.

## What it does

```text
authorized image → local validation → live Google Vision face/discovery calls
→ bounded public candidate checks → signed canonical receipt → optional Sepolia anchor
→ fresh tamper verification
```

## Claim boundary

It **does not identify people**, prove social-account ownership, prove a post is true, or prove exhaustive internet coverage. A no-result means only that the configured provider found no qualifying public candidate during that run.

## Quick start

```bash
npm ci
npm test
npm run lint
npm run typecheck
npm run format
npm run build
node dist/cli.js preflight
```

No credentials are needed for deterministic receipt and tamper tests. A live run needs Google Application Default Credentials:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/outside/the/repository/service-account.json
node dist/cli.js scan ./authorized-image.jpg --consent authorized --face-index 0
node dist/cli.js issue ./authorized-image.jpg --consent authorized --face-index 0 --out ./receipt.json
node dist/cli.js verify ./receipt.json
```

`--consent authorized` is required. Multiple faces require `--face-index`; the tool never selects one silently.

## Chain anchor

`contracts/EvidenceRegistry.sol` is a minimal immutable Solidity registry. It emits only a receipt hash, collector key ID, schema version, policy version, and issuer—never an image, face crop, embedding, URL, or secret.

Anchoring is intentionally disabled unless all are configured outside Git:

```bash
export SEPOLIA_RPC_URL=https://...
export EVIDENCE_ISSUER_PRIVATE_KEY=0x...
export EVIDENCE_REGISTRY_ADDRESS=0x...
node dist/cli.js anchor ./receipt.json
```

Only a future, independently calibrated `verified_image_correspondence` receipt may be anchored. The current safe pipeline produces review/no-match receipts rather than fabricating a positive identity decision.

## No server is required

No server is required: this is a local CLI. It has no database, hosted site, social scraper, or biometric database.

## Privacy and cost

- Original images, temporary crops, provider credentials, and wallet keys remain local. Temporary crops are deleted after processing unless `--retain-evidence` is explicitly supplied.
- Google Cloud Vision requires a project, enabled API, and billing account; consult Google's current pricing before a demo.
- Sepolia uses test ETH only. Faucet/RPC availability varies.

## Demo and limitations

- [Live demo runbook](docs/DEMO.md)
- [Limitations](docs/LIMITATIONS.md)
- [Full plan and acceptance contract](docs/PLAN.md)
- [Contributor gates](CONTRIBUTING.md)

## Current status

The signed canonical receipt, image validation, command surface, provider preflight, candidate safety checks, receipt verifier, and minimal registry source are implemented. A real positive demo remains blocked until Google credentials, an authorized public candidate, a calibrated 1:1 comparison adapter, and Sepolia deployment credentials are supplied. This is deliberate: the CLI will not invent a face-match or chain transaction.
