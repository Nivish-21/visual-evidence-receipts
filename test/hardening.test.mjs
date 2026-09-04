import assert from "node:assert/strict";
import test from "node:test";

const root = new URL("..", import.meta.url).pathname;
const { candidateUrl, withRetry, withTimeout, anchor } = await import(
  `${root}dist/pipeline.js`
);

test("candidate URL rejects local, private, credentials, ports, and non-HTTPS targets", () => {
  for (const url of [
    "http://example.com/image.jpg",
    "https://localhost/image.jpg",
    "https://127.0.0.1/image.jpg",
    "https://10.0.0.1/image.jpg",
    "https://[::1]/image.jpg",
    "https://user:pass@example.com/image.jpg",
    "https://example.com:8443/image.jpg",
  ]) {
    assert.throws(() => candidateUrl(url), /unsupported_or_private_source/);
  }
  assert.equal(
    candidateUrl("https://example.com/image.jpg").hostname,
    "example.com",
  );
});

test("retry has a bounded attempt count and does not retry invalid input", async () => {
  let attempts = 0;
  const value = await withRetry(async () => {
    attempts += 1;
    if (attempts < 2) throw new Error("provider_unavailable: transient");
    return "ok";
  });
  assert.equal(value, "ok");
  assert.equal(attempts, 2);

  attempts = 0;
  await assert.rejects(
    withRetry(async () => {
      attempts += 1;
      throw new Error("invalid_input: never retry");
    }),
    /invalid_input/,
  );
  assert.equal(attempts, 1);
});

test("provider timeout returns a bounded typed failure", async () => {
  await assert.rejects(
    withTimeout(new Promise(() => undefined), 10, "test provider"),
    /provider_unavailable: test provider timed out/,
  );
});

test("anchor rejects a forged receipt before reading wallet configuration", async () => {
  await assert.rejects(
    anchor({
      unsignedReceipt: { outcome: "verified_image_correspondence" },
      signature: {},
    }),
    /receipt signature or schema is invalid/,
  );
});
