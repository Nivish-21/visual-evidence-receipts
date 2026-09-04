# Visual Evidence Receipts

A local CLI for producing tamper-evident receipts for **public visual correspondence**.

## Claim boundary

Given an authorized input image, the tool records that a configured provider returned public candidate material, applies a versioned correspondence policy, and anchors a receipt digest on a public testnet.

It **does not identify people**, prove social-account ownership, prove a post is true, or prove exhaustive internet coverage.

## Status

Bootstrap only. The live-provider capability gate in [`docs/PLAN.md`](docs/PLAN.md) must pass before automated discovery is implemented.

## No server is required

The hackathon build is a local Node.js CLI. It needs no website, hosting, database, or subscription.

## Authorized use and privacy

Run only on an image you are authorized to process. Do not use it for surveillance, stalking, employment, housing, credit, insurance, policing, immigration, or other high-impact decisions.

Original images, crops, embeddings, provider credentials, and wallet keys stay local and are deleted by default. The public chain receives only a receipt hash and non-sensitive version metadata.

## Cost and credentials

- Node.js 22+: free.
- Google Cloud Vision Web Detection: requires a Google Cloud project and billing account; the first 1,000 monthly Vision units are free, then Web Detection is billed by Google.
- Sepolia: uses test ETH only; faucets may impose eligibility and rate limits.
- No credential is needed for local tests. See [`.env.example`](.env.example); never commit actual values.

## Commands

```bash
npm ci
npm test
npm run lint
npm run typecheck
npm run format
npm run build
```

The eventual evaluator path, receipt format, limitations, and recording checklist are in [`docs/PLAN.md`](docs/PLAN.md).

## Submission checklist

- [ ] Public GitHub repository with this README
- [ ] Real live discovery shown in recording
- [ ] Public candidate validation and receipt anchor
- [ ] Fresh receipt verification and tamper failure
- [ ] Unedited recording link
- [ ] Final form submission
