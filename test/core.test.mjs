import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const root = new URL("..", import.meta.url).pathname;
const { canonicalize, createReceipt, verifyReceipt, validateImage } =
  await import(`${root}dist/core.js`);

test("canonicalization is stable across key order and rejects unsupported values", () => {
  assert.equal(
    canonicalize({ b: 2, a: [true, "x"] }),
    '{"a":[true,"x"],"b":2}',
  );
  assert.equal(canonicalize({ z: 1, ä: 2 }), '{"z":1,"ä":2}');
  for (const value of [
    NaN,
    Infinity,
    BigInt(1),
    undefined,
    { missing: undefined },
    [undefined],
  ])
    assert.throws(() => canonicalize(value));
});

test("receipt verification rejects a changed signed field", () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  const receipt = createReceipt({
    outcome: "no_public_match_found",
    input: {
      sha256: "a".repeat(64),
      mime: "image/png",
      width: 640,
      height: 480,
    },
    privateKey,
  });
  assert.equal(verifyReceipt(receipt).receiptIntegrity, "valid");
  receipt.unsignedReceipt.outcome = "candidate_requires_review";
  assert.equal(verifyReceipt(receipt).receiptIntegrity, "tampered");
});

test("input validation rejects a mislabeled non-image", async () => {
  const dir = await mkdtemp(join(tmpdir(), "evidence-test-"));
  const file = join(dir, "not-image.png");
  await writeFile(file, "not an image");
  await assert.rejects(validateImage(file), /unsupported or malformed image/);
});

test("input validation accepts a real PNG and reports a SHA-256", async () => {
  const dir = await mkdtemp(join(tmpdir(), "evidence-test-"));
  const file = join(dir, "image.png");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlN0iAAAAAASUVORK5CYII=",
    "base64",
  );
  await writeFile(file, png);
  const result = await validateImage(file, {
    minimumWidth: 1,
    minimumHeight: 1,
  });
  assert.equal(result.mime, "image/png");
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.equal((await readFile(file)).length, png.length);
});
