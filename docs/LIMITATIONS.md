# Limitations

- This tool does not identify people, determine account ownership, or prove a public post is truthful.
- It has no face-search index and processes only the supplied image.
- Google Vision must return usable public candidate data during the live run. A no-result means only that the configured provider returned no qualifying candidate at that time.
- Candidate retrieval is HTTPS-only and rejects private/local endpoints; login-walled, deleted, and inaccessible material cannot be verified.
- Version 0.1 produces a signed observation receipt and supports tamper detection. A live Sepolia event needs a deployed registry plus separately configured RPC and disposable wallet credentials.
- The included registry permits anchoring only a future `verified_image_correspondence` result. The current implementation intentionally does not claim that outcome without a pinned, independently evaluated 1:1 comparison adapter.
