# Visual Evidence Receipts — Hackathon Build Plan

## 1. Purpose and bounded claim

Build a local, command-line pipeline for the HH Goa 2026 shortlisting task:

```text
input image → live public-web discovery → public-post candidate validation
→ privacy-minimized evidence receipt → public testnet anchor → later verification
```

The product does **not** identify a person, establish social-account ownership, prove a post is true, or prove a post remains available. Its claim is:

> At a recorded time, this version of the tool searched an authorized input image using a named provider, observed and evaluated public candidate material under a versioned policy, and anchored the resulting canonical evidence receipt on a public testnet.

A face is an optional local region-of-interest and 1:1 candidate-comparison signal. It is never a searchable face database and never an identity conclusion.

## 2. Scope

### Ship for the hackathon

- TypeScript/Node CLI in this repository only.
- Strict local input validation and explicit consent acknowledgement.
- Live discovery through Google Cloud Vision `WEB_DETECTION`.
- Candidate filtering to public HTTP(S) pages and a small configured demo-domain allowlist.
- Candidate-media fetch with URL, content-type, redirect, byte-size, and image-decode checks.
- Local face selection and one 1:1 candidate-comparison adapter.
- RFC 8785 JSON Canonicalization Scheme (JCS) receipt, SHA-256 digest, Ed25519 local collector signature, and a minimal Sepolia registry event.
- Independent verifier, tamper test, deterministic fixtures, README, CI, and screen-recording runbook.

### Explicitly defer

- Hosted site, accounts, database, subscriptions, batch scanning, crawling, a face collection/vector database, social-network scraping, liveness/deepfake claims, C2PA signing, IPFS/object storage, EAS, and automated identity decisions.
- Future site work wraps the same receipt schemas and CLI services. It does not replace them.

## 3. Runtime and dependency choices

- Node 22+, TypeScript ESM, npm, Vitest, ESLint, Prettier.
- Native Node `crypto` for SHA-256 and Ed25519; no cryptography package.
- `@google-cloud/vision` only for managed live web discovery.
- `sharp` only for safe decode, orientation normalization, metadata stripping, format conversion, and bounded crop extraction.
- `@aws-sdk/client-rekognition` only if the preflight proves it is available; otherwise use one locally packaged 1:1 adapter that has an explicitly verified model license. The public interface is provider-neutral.
- `viem` for Sepolia RPC, deployment, event decode, and testnet signing.
- No browser automation or scraping dependency.

## 4. Input and output contracts

### Accepted input

The CLI accepts one local file at a time:

- JPEG, PNG, or WebP only, validated by magic bytes and decoder—not extension.
- Maximum 7 MiB input and 20 megapixels after decode.
- Minimum 640×480 pixels; source face must meet a separately pinned minimum crop size.
- SVG, PDF, GIF, TIFF, BMP, RAW, ICO, HEIC/HEIF, animated content, malformed inputs, decompression bombs, and unsupported color modes are rejected with a typed reason.
- EXIF is stripped from derived data before any external request. The original-file hash remains local evidence only.

### Input state machine

```text
accepted
  → no_face | multiple_faces_needs_selection | face_too_small | image_unusable
  → ready_for_discovery
```

The command must require `--consent authorized` and must require `--face-index N` if more than one eligible face is present. It never silently chooses the largest face.

### Result taxonomy

```text
verified_image_correspondence
candidate_requires_review
no_public_match_found
candidate_unavailable
unsupported_or_private_source
provider_unavailable
invalid_input
chain_unavailable
attested
```

`no_public_match_found` means only that this provider returned no candidate satisfying this receipt policy at this time. It is never an assertion about whether a person has images elsewhere online.

Only `verified_image_correspondence` may create an on-chain anchor. Every other terminal state creates a local diagnostic receipt but no chain write.

## 5. Evidence policy and trust boundaries

### Local-only sensitive material

- Original input image, normalized crops, face descriptors, provider credentials, wallet private key, raw provider response, raw downloaded candidate bytes, and screenshots.
- Delete by default after the run; `--retain-evidence` makes a local-only evidence folder for the demo.

### Public receipt fields

- Schema/policy version, timestamps, SHA-256 digests, selected box geometry, provider name/run correlation ID or response digest, public candidate URL hash, candidate image byte digest, decision/method/score/threshold, collector key ID, and chain reference.
- Never raw images, embeddings, names, handles, post body, API token, or private key.

### Untrusted boundaries

- User file, external discovery result, URL redirect, fetched page/media, provider response, RPC response, and receipt passed to verifier are hostile input.
- All are schema-validated, bounded, and fail closed.

## 6. Pipeline architecture

```text
validate input
  → detect/select face locally
  → discovery provider (live Google Vision Web Detection)
  → normalize/filter candidate records
  → public candidate fetch + candidate image extraction
  → 1:1 comparison + policy decision
  → canonical receipt + collector signature
  → Sepolia event
  → later verifier
```

### Modules and interfaces

1. `input`: magic-byte validation, dimensions, normalization, input SHA-256.
2. `face`: local face detection, boxes, quality gate, explicit selection, crop metadata.
3. `discovery`: `DiscoveryProvider.discover(image)` returning raw-proof digest, request ID, timestamp, and normalized candidate records.
4. `candidate`: public-page/media fetch, SSRF controls, redirect policy, allowlist, content verification, byte hashes.
5. `comparison`: `FaceComparisonProvider.compare(sourceCrop, candidateCrop)` returning score, quality metadata, model/policy version, and no identity label.
6. `decision`: maps candidate evidence and comparison output to the outcome taxonomy with pinned threshold and ambiguity margin.
7. `receipt`: validates receipt schema, JCS canonicalizes `unsignedReceipt`, hashes it, signs it, and writes `receipt.json`.
8. `anchor`: submits only `receiptHash`, `schemaVersion`, `policyVersion`, and collector key ID to Sepolia.
9. `verify`: separately verifies receipt structure/signature, local artifact hashes when retained, and chain event/confirmations. It reports each proof layer independently.

## 7. Discovery and candidate policy

- Primary provider: Google Cloud Vision Web Detection with `WEB_DETECTION`; one request per CLI run and a maximum of 10 returned candidates.
- The provider is live every production run. Fixtures are permitted only in tests and can never be selected by production configuration.
- Select a candidate only when it originates from the live normalized response, resolves to HTTPS, passes DNS/IP SSRF controls, has an allowlisted public page host, and has an accessible image resource.
- A result page or thumbnail alone is not evidence. The pipeline hashes exact candidate-media bytes fetched during the run and stores its final URL, media type, byte length, fetch timestamp, and response digest.
- No social-media account login, CAPTCHA circumvention, browser automation, or platform scraping. Login-walled/deleted/private pages are `unsupported_or_private_source` or `candidate_unavailable`.

## 8. Comparison policy

- Discovery finds image/page candidates; it does not prove identity.
- Source input: exactly one explicitly selected, quality-eligible face.
- Candidate media: detect all faces, present every eligible box in terminal output, and require `--candidate-face-index N` if more than one can meet the policy. The convenience `issue` command cannot make a match from an ambiguous candidate.
- `comparison` output includes score, source/candidate boxes, detector/comparator model/version, quality flags, threshold and ambiguity margin.
- Threshold and margin are frozen in `policy/v1.json` after a small consented positive/negative test set is evaluated. The README calls them a hackathon demonstration policy, not an identity-grade calibration.
- High-consequence outcomes are out of scope. Results say “candidate image correspondence” or “review required,” never identity/account ownership.

## 9. Receipt and chain design

### Receipt

`EvidenceReceipt v1` contains `unsignedReceipt` plus `signature`. `unsignedReceipt` has:

- `schemaVersion`, `policyVersion`, `receiptId`, `capturedAt`;
- input file hash, dimensions, normalized derivative hash, selected face box;
- discovery provider/version, request correlation ID when supplied, normalized response digest, request and response timestamps;
- each candidate’s returned rank, source URL hash, normalized final URL hash, status/rejection reason, and candidate-media hash where fetched;
- selected candidate evidence and comparison decision;
- tool commit/version and configured chain target.

Canonical bytes are RFC 8785 JCS of `unsignedReceipt`. `receiptHash = SHA-256(canonical UTF-8 bytes)`. The collector signs this hash with a local Ed25519 key. The key is generated locally, excluded from Git, and its public key/key ID appears in the receipt.

### Registry contract

A minimal immutable Sepolia contract emits:

```solidity
event EvidenceAnchored(
  bytes32 indexed receiptHash,
  bytes32 indexed collectorKeyId,
  string schemaVersion,
  string policyVersion,
  address indexed issuer
);
```

No mutable result record, raw evidence, URLs, or biometric material is stored. Duplicate receipt hashes are rejected. Contract address, bytecode hash, ABI, chain ID 11155111, deployment transaction, and deployed source are committed in the repository.

### Verification layers

`evidence verify receipt.json` returns distinct results:

1. `receiptIntegrity`: JCS hash and Ed25519 signature;
2. `artifactIntegrity`: retained local artifact hashes if artifacts are available;
3. `chainAnchor`: expected chain ID, deployed bytecode hash, successful receipt, expected event, issuer, and confirmation threshold;
4. `sourceAvailability`: optional current fetch status only, never a rewrite of historical evidence;
5. `receiptStatus`: `VERIFIED`, `TAMPERED`, `CHAIN_UNAVAILABLE`, or `EVIDENCE_UNAVAILABLE`.

A changed receipt must fail before any network call. A deleted public post yields historical-chain proof plus `sourceAvailability=unavailable`.

## 10. Credentials, money, and infrastructure

### Needed for the preferred automated path

- Google Cloud project with billing enabled, Vision API enabled, and a restricted service-account credential. First 1,000 Vision units/month are free; Web Detection is billed after that. The CLI has a one-query/run cap and validates a user-configured spend/usage limit.
- A fresh AWS account/credentials only if Rekognition is selected after the spike; it is optional. If not selected, no AWS account is required.
- A fresh Sepolia-only EOA private key with no real funds and a public RPC endpoint or free developer endpoint. Test ETH comes from a faucet; faucet eligibility/rate limits are a preflight concern.

### Not needed now

- Server, domain, web hosting, database, queue, object storage, subscription, mainnet funds, wallet browser extension, social-media API, or paid search subscription.

### Fallback path

If Google Cloud setup blocks the automated demo, `evidence import-discovery` accepts a manually performed, live Google Lens search export plus the selected public candidate URL. The recording must visibly show the fresh Lens search. The CLI still validates candidate evidence, generates the receipt, anchors it, and verifies it. This mode is labeled `manual_discovery` and is never presented as automated discovery.

## 11. Repository and delivery discipline

- New isolated project folder: `/Users/nivish/development/visual-evidence-receipts`.
- New public GitHub repository: `Nivish-21/visual-evidence-receipts`.
- `main` is the integration branch. Each numbered task below is one small conventional commit pushed to `origin/main` immediately after its task acceptance checks and documentation update pass.
- CI executes tests, lint, typecheck, format, and a no-secrets check. It never requires cloud credentials, external discovery, or a blockchain key.
- README is updated in Task 1 and maintained with every command/schema change. Each task updates `docs/status.md`, `docs/changelog.md`, and `docs/decisions.md` when it changes a decision.
- Real credentials exist only in ignored `.env.local`; `.env.example` documents variable names, permissions, expected costs, and setup without values.

## 12. Task sequence

### Task 1 — repository, safety contract, and toolchain

- Create npm TypeScript ESM CLI repository, strict tooling, CI, `.gitignore`, `.env.example`, README, contribution notes, and project docs.
- README includes claim/non-claim, authorized-use policy, privacy/deletion policy, no-server statement, cost table, and task artifact checklist.
- Acceptance: clean install; unit test harness; lint/typecheck/format/build; CI green; no secret files tracked.

### Task 2 — typed domain schemas and canonical receipt core

- Define Zod schemas for input metadata, candidate evidence, outcome taxonomy, unsigned receipt, signature, and verifier output.
- Implement RFC 8785 JCS adapter, SHA-256 digest, Ed25519 signing/verification, and stable test vectors.
- Acceptance: same semantic receipt produces the expected canonical bytes/hash; modified field fails signature/hash verification; unknown schema fields rejected.

### Task 3 — input validation and safe normalization

- Implement magic-byte MIME detection, decoder bounds, allowed formats, dimension/size policies, EXIF stripping, SHA-256, and typed failure states.
- Acceptance: JPEG/PNG/WebP accept; unsupported/mislabeled/oversized/multi-frame/malformed fixtures reject; no derived file retains EXIF.

### Task 4 — local face detection, quality, and explicit selection

- Implement local face detector adapter and `scan` command output. Add zero/one/multiple/too-small quality states and manual `--face-index` selection.
- Acceptance: multi-face fixture cannot progress without explicit selection; selected box/crop hash is stable; no face produces no discovery request.

### Task 5 — Google Vision live discovery adapter plus preflight

- Implement credential validation, one-query limit, Web Detection call, provider-response redaction/digest, normalized candidate schema, and typed provider errors.
- Add `preflight` command for Node version, input policy, Google credential reachability, quota/billing warning, RPC chain ID, and wallet balance.
- Acceptance: contract tests use mocked HTTP; manual live smoke run is documented but excluded from CI; production config cannot use a fixture provider.

### Task 6 — public candidate fetch and candidate-evidence policy

- Implement URL parsing, HTTPS-only transport, DNS/IP SSRF blocking, redirect limits, allowed-domain policy, response size/type limits, candidate media decode, and per-candidate rejection reasons.
- Acceptance: loopback/private/redirect-to-private/HTML-as-image/oversized/login-style candidates fail closed; valid public fixture media emits a reproducible evidence record.

### Task 7 — 1:1 comparison adapter and decision policy

- Run a small spike to choose local versus Rekognition against a consented mini test set; record the choice and model/license/account implications in `docs/decisions.md`.
- Implement only the chosen adapter, a pinned `policy/v1.json`, candidate face selection, ambiguity margin, and `verified_image_correspondence` vs review/no-match outcomes.
- Acceptance: positive, negative, multi-candidate, ambiguous, and poor-quality fixtures yield the expected typed outcomes; no ambiguous/no-match result may call anchor.

### Task 8 — run folder and evidence receipt issue command

- Implement `evidence issue <image> --face-index N` orchestration through scan/discovery/candidate/decision/receipt, with one fresh output folder per run.
- Implement default artifact deletion and `--retain-evidence` local evidence path.
- Acceptance: an injected test provider produces full deterministic receipt; actual live mode requires credential but can be smoke-tested manually; no raw biometrics appear in receipt/log output.

### Task 9 — Sepolia registry and anchoring

- Write minimal Solidity registry, deploy with a disposable Sepolia wallet, pin ABI/address/bytecode hash, and implement anchor client plus confirmation policy.
- Acceptance: local Anvil tests cover event and duplicate rejection; a manually verified Sepolia deployment/transaction is recorded in docs; no network key in CI or committed output.

### Task 10 — independent verification and tamper proof

- Implement `evidence verify <receipt>` as a new-process-safe verifier. It checks canonical hash/signature before RPC, expected contract bytecode/event/issuer/confirmations, and optional local artifacts.
- Acceptance: verified fixture succeeds; one-byte and one-field receipt changes return `TAMPERED`; wrong chain/contract/event returns a specific failure; source unavailable remains historically anchored but availability-unavailable.

### Task 11 — final release proof and submission assets

- Add a small deterministic demo fixture suite, manual live-demo preflight, one-command evaluator path, demo recording script, limitations, architecture diagram, threat model, package/release verification, and a final GitHub release tag.
- Acceptance: fresh clone runs all local checks and deterministic demo; live rehearsal proves the provider, public candidate, Sepolia event, fresh verify, and tamper rejection; recording matches README commands exactly.

## 13. Verification per task

Every task runs and records:

```bash
npm test
npm run lint
npm run typecheck
npm run format
npm run build
git diff --check
```

Before each push: secret scan, inspect staged files, update docs, commit one task, push `main`, then read back `origin/main` and GitHub Actions state. A live API/testnet run is never a CI prerequisite; its manual transcript or sanitized receipt is documented separately.

## 14. Recording and submission runbook

One unedited 4–5 minute recording:

1. Show the README’s bounded claim and clean run directory.
2. Run preflight; show service/token readiness without exposing values.
3. Select a consented public demo image; show local scan and explicit face selection.
4. Show fresh provider request ID/timestamp and returned public candidate list.
5. Show candidate fetch, score/policy, decision, canonical receipt hash.
6. Anchor to Sepolia; show transaction receipt/event and public explorer.
7. Start a fresh terminal process and verify the receipt.
8. Alter a copied receipt field and show `TAMPERED`.
9. Show the no-match/provider-error policy briefly; state limitations.

Submission is only after the GitHub repo, public recording link, and form fields are verified. No resubmission is assumed.

## 15. Acceptance contract from `hackathon-delivery-planning`

The task details supplied by the user on 2026-09-03 are the authoritative brief for this plan. The original Google Doc was sign-in restricted; the received task screenshots establish the following release blockers:

1. Detect and encode a face from an input image.
2. Perform a genuine web/social-media reverse-image search; no hardcoded or pre-picked search result.
3. Find at least one real matching public social-media post for the positive demo.
4. Upload the post or its hash/fingerprint to any blockchain and demonstrate later re-verification.
5. Submit GitHub source and README explaining operation, run instructions, blockchain choice, and limitations.
6. Submit an unedited end-to-end screen recording and working shared link. No hosted website is required.
7. Submit once only through the supplied form by 2026-09-07 23:59 IST.

| Brief requirement                    | Plan coverage         | Release evidence                                                     |
| ------------------------------------ | --------------------- | -------------------------------------------------------------------- |
| Face detection/encoding              | Tasks 3–4             | scan output + test fixture                                           |
| Genuine live discovery               | Tasks 5 and 8         | provider request metadata in fresh run                               |
| Public matching post                 | Tasks 6–8             | returned public candidate + decision evidence                        |
| Blockchain write and re-verification | Tasks 9–10            | public testnet event + fresh verifier                                |
| GitHub source/README                 | Tasks 1 and 11        | public repository + evaluator path                                   |
| Unedited recording                   | Section 14 / Task 11  | shared recording link                                                |
| No hardcoded result                  | Sections 7–8 / Task 5 | production rejects fixture discovery; recording shows fresh response |

## 16. Review amendments — binding over earlier wording

This section resolves all blocking and should-fix findings from review round 1. Where it conflicts with an earlier section, this section wins.

### 16.1 Production discovery must not preselect candidates

Production has no candidate/domain allowlist. Test fixtures may use an isolated fixture-host allowlist only in test configuration, which production rejects. A live candidate is eligible only when it originated in the current provider response, is HTTPS, passes transport checks below, and exposes a direct image URL. `sourcePageUrl` is optional; `mediaUrl` is mandatory for comparison. Version 1 does not parse HTML to discover images. It accepts only provider-supplied direct `mediaUrl` values.

### 16.2 Fetch and SSRF policy

For every initial URL and redirect hop, the fetcher disables proxy environment variables, accepts only port 443 HTTPS with certificate validation, resolves A/AAAA/CNAME immediately before connecting, rejects literal IP URLs and any loopback, private, link-local, unique-local, multicast, unspecified, IPv4-mapped-private, reserved, or cloud-metadata address. It connects only to a validated resolved address while retaining the hostname for TLS/SNI, rejects a DNS/connection mismatch, permits at most three redirects, and caps DNS answers, headers, bytes, connect timeout, response-header timeout, and total timeout in immutable policy. It rejects unsupported MIME, absent/oversized `Content-Length`, or bodies exceeding the policy cap.

`policy/v1.json` has separate `pageHostRules` and `mediaHostRules`; its exact file hash is signed into every receipt. It also pins transport limits, provider version, detector/comparator versions, threshold, and ambiguity margin. No environment variable can override a decision-affecting policy value.

### 16.3 Privacy-minimized provider request

Before external discovery, create a temporary derivative containing only the explicitly selected face crop and the minimum padded context specified by policy. Never upload the original input or unselected faces. Keep derivatives in the run temp directory, exclude them from diagnostics, delete in `finally`, and disclose the provider’s data-processing terms in README. The input image remains locally hashed but not externally retained by this project.

### 16.4 Deterministic face and comparison decisions

Task 4 begins with a documented detector preflight. `docs/decisions.md` must pin detector package, model artifact, artifact SHA-256, license, exact install command, supported macOS/CI target, and `{left,top,width,height}` integer coordinates in the orientation-normalized image. Boxes sort by top, then left, width, height. CI uses test adapters and never downloads a model.

Task 7 runs `npm run spike:comparison` against `fixtures/consented-comparison-manifest.json`. The chosen adapter must have documented licensing, fixed score direction normalized to `[0,1]`, zero false positives and at most the recorded false-negative allowance on the fixed consented set. The committed decision pins package/model/checksum, transform, score threshold, ambiguity margin, and fixture results. No alternate comparator is accepted afterward.

The issue command evaluates provider candidates in rank order. A selected candidate face is required when that media has multiple eligible faces. It anchors only when exactly one candidate reaches `verified_image_correspondence`; zero produces the appropriate no-match/review state, and two or more qualifying candidates produce `candidate_requires_review` without an anchor. Every evaluated candidate and its rejection rationale appears in the receipt.

### 16.5 Terminal state mapping

`image_unusable → invalid_input`; `no_face` or `face_too_small → candidate_requires_review/source_face_unusable`; and unresolved `multiple_faces_needs_selection → candidate_requires_review/source_face_selection_required`. These states perform no discovery, fetch, comparison, or anchor but write a signed local diagnostic receipt. `invalid_input` is reserved for malformed or policy-rejected files.

### 16.6 Canonical receipt, collector trust, and anchor binding

Use a pinned RFC 8785 JCS implementation and reject unsupported/non-canonical values. `signature` is exactly:

```json
{
  "algorithm": "Ed25519",
  "keyId": "base64url(SHA-256(SPKI-DER public key))",
  "publicKey": "base64url(SPKI-DER)",
  "value": "base64url(Ed25519.sign(SHA-256(JCS-UTF8(unsignedReceipt))))"
}
```

Base64url is unpadded RFC 4648. The repository includes an external fixed vector for unsigned JSON, canonical UTF-8 hex, digest, public key, and signature.

`unsignedReceipt.chainTarget` contains only `chainId`, `contractAddress`, `contractBytecodeHash`, `eventName`, `expectedIssuer`, and `deploymentManifestHash`; it never contains transaction hash/block/log index. A post-anchor file may add an unsigned `anchoring` lookup hint, but the verifier independently finds the matching event.

`collectorKeyId` is the first 32 bytes of SHA-256 over the SPKI-DER public key. `deployment.sepolia.json` pins chain ID, contract address, deployment transaction, runtime bytecode hash, ABI hash, allowed collector key ID, and expected issuer. The contract constructor permanently sets that issuer/key ID and rejects all other anchors and duplicate receipt hashes. `verify` requires receipt signature key ID, receipt expected issuer, deployment manifest, event key ID, and event issuer to match. It reports whether the collector public key was merely receipt-self-authenticated or matched an explicit trusted-key allowlist.

### 16.7 Manual-discovery fallback is deliberately weaker

`import-discovery` records `provenance=user_supplied_unverified`, exact export hash, import time, and user attestation. It never fabricates a provider request ID and can produce only `candidate_requires_review`; it cannot produce `verified_image_correspondence`, `attested`, or an on-chain anchor. It is a deadline fallback for the technical pipeline, not the preferred task demo.

### 16.8 Exact CLI and contract toolchain

Commands:

```text
evidence preflight [--json]
evidence scan <image> --consent authorized [--face-index N] [--json]
evidence issue <image> --consent authorized --face-index N [--candidate-face-index N] [--retain-evidence] [--json]
evidence import-discovery <image> --consent authorized --face-index N --export <file> --candidate-url <https-url> [--json]
evidence verify <receipt.json> [--artifacts <dir>] [--json]
```

Configuration precedence is flags, then environment, then `evidence.config.json`; unknown keys fail. `--json` prints exactly one schema-validated result to stdout and diagnostics only to stderr. Exit code 0 means a completed command, including valid no-match/review results; 2 invalid input/config; 3 provider/candidate unavailable; 4 chain failure; 5 verification/tamper failure.

Contracts use Foundry with pinned Foundry and Solidity compiler versions in `foundry.toml`. `forge test`, `anvil`, and `forge script script/Deploy.s.sol:Deploy --rpc-url $SEPOLIA_RPC_URL --broadcast` are the supported contract commands. Task 9 commits source, optimizer/EVM settings, ABI, deployment script, and `contracts/deployment.sepolia.json`; the verifier reads this file rather than an arbitrary address.

## 17. Review log

| Round | Lenses                                             | Findings | Worst severity | Resolution                                                                      |
| ----- | -------------------------------------------------- | -------: | -------------- | ------------------------------------------------------------------------------- |
| 1     | Security, architecture, implementability, fidelity |       20 | blocking       | All blocking and should-fix findings incorporated in §16.                       |
| 2     | Security, architecture, implementability, fidelity |       17 | blocking       | Review cap reached; unresolved external provider capability is surfaced in §18. |

## 18. Open architecture gate — provider capability proof required

Review round 2 exposed an unresolved, external dependency: the positive task path requires a **live provider response that explicitly associates a public, login-free social-post permalink with a direct candidate media URL**. Google Cloud Vision Web Detection documentation confirms full/partial matching images and pages containing matching images, but the documentation does not guarantee a social-post permalink/media association for any image or platform. No plan prose can resolve this empirically.

Before implementation Task 5, run a one-hour, no-code provider capability spike with an authorized demo image and public post:

1. Call Google Vision Web Detection live with the demo image.
2. Save a redacted response outside the repository.
3. Confirm it includes a provider-linked `sourcePageUrl` on a public social-post host and an associated direct `mediaUrl` that is fetchable without login.
4. Confirm the post opens in a browser without login and the media contains the expected selected face.

**Go condition:** all four conditions pass. Then Task 5 pins the exact normalized candidate association contract and production can truthfully automate the positive demo.

**No-go condition:** any condition fails. Stop before build and switch the plan to the documented `manual_discovery` workflow only if the task organizer confirms a visible live Google Lens search plus CLI verification counts as a genuine search pipeline. Do not silently substitute an unrelated image host, scrape a social platform, or claim a generic web page is a social-media post.

This gate also resolves the provider, output-format, and cost uncertainty more honestly than adding speculative adapters. It has no server, paid subscription, or code commitment.
