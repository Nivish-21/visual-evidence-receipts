# Changelog

## 2026-09-04 — Node 24 LTS runtime

- Pinned Node.js 24.20.0 LTS in `.node-version`, package engines, and GitHub Actions.

## 2026-09-04 — Core CLI and evidence contract

- Added strict receipt schema, deterministic canonical JSON, SHA-256 digests, locally generated Ed25519 collector signatures, and tamper verification.
- Added signature-based image validation for JPEG/PNG/WebP using bounded Sharp decoding.
- Added `preflight`, `scan`, `issue`, `verify`, and guarded `anchor` CLI commands.
- Added Google Vision live provider integration, HTTPS candidate safety checks, and a minimal Solidity registry source.
- Added bounded retries (three attempts), provider/fetch timeouts, streamed candidate body-size enforcement, DNS resolution checks, and rejection of private, IPv6-local, credential-bearing, and non-default-port URLs.
- Added deterministic end-to-end receipt/tamper/invalid-input CLI checks and dedicated hardening tests.
- Added `docs/ACCOUNTS.md` covering the required Google Cloud, Sepolia wallet, and RPC-provider setup.

## 2026-09-04 — Task 1: bootstrap

- Added TypeScript ESM CLI tooling, CI, repository safety files, and contributor guidance.
- Documented the bounded claim, authorized-use policy, local deletion policy, no-server scope, expected credentials, and submission artifacts.
