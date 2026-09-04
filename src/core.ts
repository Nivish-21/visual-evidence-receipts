import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomUUID,
  sign,
  verify,
} from "node:crypto";
import { readFile } from "node:fs/promises";
import sharp, { type Metadata } from "sharp";
import { z } from "zod";

export const OUTCOMES = [
  "verified_image_correspondence",
  "candidate_requires_review",
  "no_public_match_found",
  "candidate_unavailable",
  "unsupported_or_private_source",
  "provider_unavailable",
  "invalid_input",
  "chain_unavailable",
] as const;

export type Outcome = (typeof OUTCOMES)[number];

const unsignedReceiptSchema = z
  .object({
    schemaVersion: z.literal("evidence-receipt/v1"),
    policyVersion: z.literal("policy/v1"),
    receiptId: z.string().uuid(),
    capturedAt: z.string().datetime(),
    outcome: z.enum(OUTCOMES),
    input: z.object({
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
    tool: z.object({ version: z.string(), commit: z.string() }),
    discovery: z
      .object({
        provider: z.string(),
        observedAt: z.string().datetime(),
        responseSha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .optional(),
    candidates: z.array(
      z.object({
        urlSha256: z.string().regex(/^[a-f0-9]{64}$/),
        status: z.string(),
        mediaSha256: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .optional(),
      }),
    ),
  })
  .strict();

export type UnsignedReceipt = z.infer<typeof unsignedReceiptSchema>;
export type EvidenceReceipt = {
  unsignedReceipt: UnsignedReceipt;
  signature: {
    algorithm: "Ed25519";
    keyId: string;
    publicKey: string;
    value: string;
    receiptHash: string;
  };
};

function base64url(value: Buffer): string {
  return value.toString("base64url");
}

export function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** RFC 8785-compatible for this receipt's JSON-only schema. */
export function canonicalize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new TypeError("non-finite numbers are not canonical JSON");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
      .join(",")}}`;
  }
  throw new TypeError("unsupported canonical JSON value");
}

export function createReceipt(input: {
  outcome: Outcome;
  input: UnsignedReceipt["input"];
  privateKey: ReturnType<typeof createPrivateKey>;
  discovery?: UnsignedReceipt["discovery"];
  candidates?: UnsignedReceipt["candidates"];
}): EvidenceReceipt {
  const unsignedReceipt = unsignedReceiptSchema.parse({
    schemaVersion: "evidence-receipt/v1",
    policyVersion: "policy/v1",
    receiptId: randomUUID(),
    capturedAt: new Date().toISOString(),
    outcome: input.outcome,
    input: input.input,
    tool: { version: "0.1.0", commit: process.env.GIT_COMMIT ?? "local" },
    discovery: input.discovery,
    candidates: input.candidates ?? [],
  });
  const bytes = Buffer.from(canonicalize(unsignedReceipt));
  const digest = Buffer.from(sha256(bytes), "hex");
  const publicDer = createPublicKey(input.privateKey).export({
    type: "spki",
    format: "der",
  });
  return {
    unsignedReceipt,
    signature: {
      algorithm: "Ed25519",
      keyId: base64url(createHash("sha256").update(publicDer).digest()),
      publicKey: base64url(publicDer),
      value: base64url(sign(null, digest, input.privateKey)),
      receiptHash: digest.toString("hex"),
    },
  };
}

export function verifyReceipt(receipt: EvidenceReceipt): {
  receiptIntegrity: "valid" | "tampered";
  receiptHash: string;
} {
  try {
    const parsed = unsignedReceiptSchema.parse(receipt.unsignedReceipt);
    const digest = Buffer.from(
      sha256(Buffer.from(canonicalize(parsed))),
      "hex",
    );
    const publicKey = createPublicKey({
      key: Buffer.from(receipt.signature.publicKey, "base64url"),
      format: "der",
      type: "spki",
    });
    const expectedKeyId = base64url(
      createHash("sha256")
        .update(publicKey.export({ type: "spki", format: "der" }))
        .digest(),
    );
    const valid =
      receipt.signature.algorithm === "Ed25519" &&
      receipt.signature.receiptHash === digest.toString("hex") &&
      receipt.signature.keyId === expectedKeyId &&
      verify(
        null,
        digest,
        publicKey,
        Buffer.from(receipt.signature.value, "base64url"),
      );
    return {
      receiptIntegrity: valid ? "valid" : "tampered",
      receiptHash: digest.toString("hex"),
    };
  } catch {
    return { receiptIntegrity: "tampered", receiptHash: "" };
  }
}

export async function validateImage(
  file: string,
  limits = {
    maximumBytes: 7 * 1024 * 1024,
    maximumPixels: 20_000_000,
    minimumWidth: 640,
    minimumHeight: 480,
  },
) {
  const bytes = await readFile(file);
  if (bytes.length > limits.maximumBytes)
    throw new Error("image exceeds byte limit");
  let metadata: Metadata;
  try {
    metadata = await sharp(bytes, {
      animated: false,
      limitInputPixels: limits.maximumPixels,
    }).metadata();
  } catch {
    throw new Error("unsupported or malformed image");
  }
  const mime =
    metadata.format === "jpeg"
      ? "image/jpeg"
      : metadata.format === "png"
        ? "image/png"
        : metadata.format === "webp"
          ? "image/webp"
          : undefined;
  if (
    !mime ||
    !metadata.width ||
    !metadata.height ||
    (metadata.pages && metadata.pages > 1)
  )
    throw new Error("unsupported or malformed image");
  if (
    metadata.width < limits.minimumWidth ||
    metadata.height < limits.minimumHeight
  )
    throw new Error("image is below minimum dimensions");
  return {
    sha256: sha256(bytes),
    mime,
    width: metadata.width,
    height: metadata.height,
  } as const;
}
