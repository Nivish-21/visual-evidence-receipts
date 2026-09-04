# Changelog

## 2026-09-04 — Core CLI and evidence contract

- Added strict receipt schema, deterministic canonical JSON, SHA-256 digests, locally generated Ed25519 collector signatures, and tamper verification.
- Added signature-based image validation for JPEG/PNG/WebP using bounded Sharp decoding.
- Added `preflight`, `scan`, `issue`, `verify`, and guarded `anchor` CLI commands.
- Added Google Vision live provider integration, HTTPS candidate safety checks, and a minimal Solidity registry source.
- Added demo runbook and limitations. Live positive matching/anchoring is intentionally blocked until external credentials, a calibrated comparator, and a deployed Sepolia registry exist.

## 2026-09-04 — Task 1: bootstrap

- Added TypeScript ESM CLI tooling, CI, repository safety files, and contributor guidance.
- Documented the bounded claim, authorized-use policy, local deletion policy, no-server scope, expected credentials, and submission artifacts.
