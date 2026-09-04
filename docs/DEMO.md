# Live demo runbook

## Prerequisites

- An authorized test image and a public post/image that the participant owns or is authorized to use.
- Google Cloud Vision credentials: `GOOGLE_APPLICATION_CREDENTIALS` pointing outside this repository.
- For anchoring: a disposable Sepolia wallet, `SEPOLIA_RPC_URL`, `EVIDENCE_ISSUER_PRIVATE_KEY`, deployed `EVIDENCE_REGISTRY_ADDRESS`, and test ETH.

## Do not record

Credentials, wallet private keys, original unredacted images beyond the authorized demo input, crops, provider response bodies, or local evidence folders.

## Continuous recording sequence

```bash
npm ci
npm test && npm run lint && npm run typecheck && npm run format && npm run build
node dist/cli.js preflight
node dist/cli.js scan ./authorized-demo.jpg --consent authorized --face-index 0
node dist/cli.js issue ./authorized-demo.jpg --consent authorized --face-index 0 --out ./demo-receipt.json
node dist/cli.js verify ./demo-receipt.json
cp ./demo-receipt.json ./tampered.json
# Change one non-signature field in tampered.json.
node dist/cli.js verify ./tampered.json # must report TAMPERED
```

`issue` deliberately stops at `candidate_requires_review` unless a separately approved 1:1 comparison adapter produces a unique qualified candidate. Do not present a candidate listing as a verified identity or social-account match.

## Current external gate

This machine has no Google Application Default Credentials and no Sepolia RPC/wallet configuration. The deterministic receipt and tamper checks run locally; the live provider and chain demonstration must be performed after the required credentials are configured.
