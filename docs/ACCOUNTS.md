# Accounts and setup

You need only three external accounts for the live hackathon demonstration. Create them as the same project owner where possible. Do **not** put credentials in this repository, a recording, or GitHub Actions.

## 1. Google Cloud — required for live face detection and web discovery

Create a Google account if you do not already have one, then open [Google Cloud Console](https://console.cloud.google.com/).

1. Create a new project, e.g. `visual-evidence-receipts-demo`.
2. Link a billing account. Vision API calls require a billing-enabled project even if usage remains inside a free allowance; check [current Vision pricing](https://cloud.google.com/vision/pricing) before running the demo.
3. Enable Cloud Vision API:

   ```bash
   gcloud auth login
   gcloud projects create visual-evidence-receipts-demo --name="Visual Evidence Receipts Demo"
   gcloud config set project visual-evidence-receipts-demo
   gcloud services enable vision.googleapis.com
   ```

4. For this local demo, use short-lived local Application Default Credentials (ADC), not a downloaded service-account JSON key:

   ```bash
   unset GOOGLE_APPLICATION_CREDENTIALS
   gcloud auth application-default login
   gcloud auth application-default set-quota-project visual-evidence-receipts-demo
   ```

5. Verify without exposing a token:

   ```bash
   gcloud auth application-default print-access-token >/dev/null && echo ADC_OK
   ```

The application uses Google Vision's client-library ADC support. Google documents ADC and the local-development setup here: [Vision authentication](https://cloud.google.com/vision/docs/authentication) and [Vision setup](https://cloud.google.com/vision/docs/setup).

**Do not create a service-account key unless you must.** If the task later moves to a server, use workload identity or service-account impersonation rather than a long-lived JSON key.

## 2. Ethereum wallet — required to deploy and sign the Sepolia event

Install a reputable Ethereum-compatible wallet (for example, MetaMask) and create a **fresh Sepolia-only** account. Never reuse a wallet holding real funds.

1. Enable Ethereum Sepolia in the wallet.
2. Copy only the public address when requesting test ETH.
3. Obtain a small amount of SepoliaETH from a faucet. Faucets may require a login, CAPTCHA, or rate-limit users.
4. Export the test-only private key only into an ignored local file such as `.env.local`; never paste it into chat, terminal history, Git, or a recording.

Set:

```bash
export EVIDENCE_ISSUER_PRIVATE_KEY='0x[REDACTED]'
```

The required network is Ethereum Sepolia, chain ID `11155111`; transactions are observable at [Sepolia Etherscan](https://sepolia.etherscan.io/).

## 3. Sepolia RPC provider — required to deploy/query/anchor

Choose **one** provider:

- A no-key public endpoint is sufficient for a one-off rehearsal but may be rate-limited or unreliable.
- For the recording, create a free developer account with an RPC provider such as Alchemy, Infura, QuickNode, or Tenderly and create a Sepolia HTTPS endpoint. Use the provider's current dashboard/setup instructions and free-tier limits.

Store only locally:

```bash
export SEPOLIA_RPC_URL='https://[REDACTED]'
```

Verify the endpoint before deployment:

```bash
node dist/cli.js preflight
```

Expected `sepoliaRpc` is `11155111`.

## Not needed

- No AWS account: the current build does not use Rekognition.
- No hosted server, domain, database, social-media API, paid reverse-search subscription, or GitHub secret.
- No Google service-account key for the local demo if ADC is used.

## Before recording

Use a consenting participant's image and a public post/image they own or are authorized to demonstrate. Then follow [`DEMO.md`](DEMO.md). The live path is only submission-ready after it produces a real provider response, a qualified candidate under a pinned comparison policy, a Sepolia transaction, a fresh verification result, and a tamper failure.
