import { createHash, generateKeyPairSync, type KeyObject } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import sharp from "sharp";
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  keccak256,
  parseAbi,
  stringToHex,
} from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import {
  createReceipt,
  sha256,
  type EvidenceReceipt,
  type Outcome,
  validateImage,
  verifyReceipt,
} from "./core.js";

export type FaceBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};
type Candidate = { url: string; rank: number; pageUrl?: string };

const MAX_CANDIDATES = 10;
const receiptAbi = parseAbi([
  "event EvidenceAnchored(bytes32 indexed receiptHash, bytes32 indexed collectorKeyId, string schemaVersion, string policyVersion, address indexed issuer)",
]);

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value : undefined;
}

function keyPath(): string {
  return resolve(env("EVIDENCE_KEY_PATH") ?? ".evidence/collector-ed25519.pem");
}

async function collectorKey(): Promise<KeyObject> {
  const path = keyPath();
  try {
    const { createPrivateKey } = await import("node:crypto");
    return createPrivateKey(await readFile(path));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const { privateKey } = generateKeyPairSync("ed25519");
    await mkdir(resolve(path, ".."), { recursive: true, mode: 0o700 });
    await writeFile(path, privateKey.export({ type: "pkcs8", format: "pem" }), {
      mode: 0o600,
    });
    return privateKey;
  }
}

function toFaceBox(
  vertices: Array<{ x?: number | null; y?: number | null }> | null | undefined,
): FaceBox | undefined {
  if (!vertices?.length) return undefined;
  const xs = vertices.map((v) => v.x ?? 0);
  const ys = vertices.map((v) => v.y ?? 0);
  const left = Math.min(...xs),
    top = Math.min(...ys);
  return {
    left,
    top,
    width: Math.max(...xs) - left,
    height: Math.max(...ys) - top,
  };
}

export async function scan(image: string, faceIndex?: number) {
  const input = await validateImage(image);
  if (!env("GOOGLE_APPLICATION_CREDENTIALS"))
    throw new Error(
      "provider_unavailable: GOOGLE_APPLICATION_CREDENTIALS is required for live face detection",
    );
  const client = new ImageAnnotatorClient();
  const [response] = await client.faceDetection({
    image: { content: await readFile(image) },
  });
  const faces = (response.faceAnnotations ?? [])
    .map((face) => toFaceBox(face.boundingPoly?.vertices))
    .filter((box): box is FaceBox => Boolean(box))
    .sort(
      (a, b) =>
        a.top - b.top ||
        a.left - b.left ||
        a.width - b.width ||
        a.height - b.height,
    );
  if (!faces.length)
    return {
      outcome: "candidate_requires_review" as const,
      reason: "no_face",
      input,
      faces,
    };
  if (faces.length > 1 && faceIndex === undefined)
    return {
      outcome: "candidate_requires_review" as const,
      reason: "multiple_faces_needs_selection",
      input,
      faces,
    };
  const selected = faces[faceIndex ?? 0];
  if (!selected) throw new Error("invalid_input: --face-index is out of range");
  if (selected.width < 64 || selected.height < 64)
    return {
      outcome: "candidate_requires_review" as const,
      reason: "face_too_small",
      input,
      faces,
      selected,
    };
  return { outcome: "ready_for_discovery" as const, input, faces, selected };
}

async function discovery(faceCrop: Buffer): Promise<{
  observedAt: string;
  responseSha256: string;
  candidates: Candidate[];
}> {
  if (!env("GOOGLE_APPLICATION_CREDENTIALS"))
    throw new Error(
      "provider_unavailable: GOOGLE_APPLICATION_CREDENTIALS is required for live discovery",
    );
  const client = new ImageAnnotatorClient();
  const [response] = await client.webDetection({
    image: { content: faceCrop },
  });
  const raw = JSON.stringify(response.webDetection ?? {});
  const candidates: Candidate[] = [];
  for (const [rank, item] of (
    response.webDetection?.pagesWithMatchingImages ?? []
  ).entries()) {
    if (item.url) candidates.push({ url: item.url, pageUrl: item.url, rank });
    if (candidates.length === MAX_CANDIDATES) break;
  }
  return {
    observedAt: new Date().toISOString(),
    responseSha256: sha256(raw),
    candidates,
  };
}

function publicHttps(url: string): URL {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.port)
    throw new Error(
      "unsupported_or_private_source: candidate must be HTTPS on default port",
    );
  if (
    /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(
      parsed.hostname,
    )
  )
    throw new Error("unsupported_or_private_source: private candidate host");
  return parsed;
}

async function candidateEvidence(candidates: Candidate[]) {
  const results: Array<{
    urlSha256: string;
    status: string;
    mediaSha256?: string;
  }> = [];
  for (const candidate of candidates) {
    try {
      const url = publicHttps(candidate.url);
      const response = await fetch(url, {
        redirect: "error",
        signal: AbortSignal.timeout(8_000),
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !contentType.startsWith("image/"))
        throw new Error("candidate media unavailable");
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 7 * 1024 * 1024)
        throw new Error("candidate exceeds size limit");
      await sharp(bytes, { limitInputPixels: 20_000_000 }).metadata();
      results.push({
        urlSha256: sha256(url.toString()),
        status: "media_validated",
        mediaSha256: sha256(bytes),
      });
    } catch (error) {
      results.push({
        urlSha256: sha256(candidate.url),
        status:
          error instanceof Error ? error.message : "candidate_unavailable",
      });
    }
  }
  return results;
}

async function crop(image: string, box: FaceBox): Promise<Buffer> {
  return sharp(image)
    .extract({
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
    })
    .jpeg({ quality: 90 })
    .toBuffer();
}

export async function issue(
  image: string,
  faceIndex: number,
  retainEvidence = false,
): Promise<EvidenceReceipt> {
  const scanned = await scan(image, faceIndex);
  const privateKey = await collectorKey();
  if (scanned.outcome !== "ready_for_discovery")
    return createReceipt({
      outcome: scanned.outcome,
      input: scanned.input,
      privateKey,
    });
  const cropBytes = await crop(image, scanned.selected);
  try {
    const found = await discovery(cropBytes);
    const evidence = await candidateEvidence(found.candidates);
    const outcome: Outcome = evidence.some(
      (candidate) => candidate.status === "media_validated",
    )
      ? "candidate_requires_review"
      : "no_public_match_found";
    const receipt = createReceipt({
      outcome,
      input: scanned.input,
      privateKey,
      discovery: {
        provider: "google-vision-web-detection",
        observedAt: found.observedAt,
        responseSha256: found.responseSha256,
      },
      candidates: evidence,
    });
    if (retainEvidence) {
      const dir = resolve("runs", receipt.unsignedReceipt.receiptId);
      await mkdir(dir, { recursive: true });
      await writeFile(resolve(dir, "selected-face.jpg"), cropBytes, {
        mode: 0o600,
      });
    }
    return receipt;
  } finally {
    cropBytes.fill(0);
  }
}

export async function saveReceipt(
  receipt: EvidenceReceipt,
  destination?: string,
): Promise<string> {
  const file = resolve(
    destination ?? `runs/${receipt.unsignedReceipt.receiptId}/receipt.json`,
  );
  await mkdir(resolve(file, ".."), { recursive: true });
  await writeFile(file, `${JSON.stringify(receipt, null, 2)}\n`, {
    mode: 0o600,
  });
  return file;
}

export async function verifyFile(file: string) {
  const receipt = JSON.parse(await readFile(file, "utf8")) as EvidenceReceipt;
  const integrity = verifyReceipt(receipt);
  return {
    ...integrity,
    receiptStatus:
      integrity.receiptIntegrity === "valid"
        ? "EVIDENCE_UNAVAILABLE"
        : "TAMPERED",
    chainAnchor: "not_requested",
    sourceAvailability: "not_checked",
  };
}

export async function preflight() {
  const rpc = env("SEPOLIA_RPC_URL");
  let chain: string = "not_configured";
  if (rpc) {
    try {
      chain = String(
        await createPublicClient({
          chain: sepolia,
          transport: http(rpc),
        }).getChainId(),
      );
    } catch {
      chain = "unreachable";
    }
  }
  return {
    node: process.version,
    googleApplicationCredentials: Boolean(
      env("GOOGLE_APPLICATION_CREDENTIALS"),
    ),
    sepoliaRpc: chain,
    collectorKeyPath: keyPath(),
    warning:
      "Live Google Vision and Sepolia credentials are required for the positive demo.",
  };
}

export async function anchor(receipt: EvidenceReceipt) {
  if (receipt.unsignedReceipt.outcome !== "verified_image_correspondence")
    throw new Error(
      "chain_unavailable: only verified_image_correspondence may be anchored",
    );
  const rpc = env("SEPOLIA_RPC_URL"),
    privateKey = env("EVIDENCE_ISSUER_PRIVATE_KEY"),
    contract = env("EVIDENCE_REGISTRY_ADDRESS");
  if (!rpc || !privateKey || !contract || !isAddress(contract))
    throw new Error(
      "chain_unavailable: SEPOLIA_RPC_URL, EVIDENCE_ISSUER_PRIVATE_KEY, and EVIDENCE_REGISTRY_ADDRESS are required",
    );
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const wallet = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpc),
  });
  const receiptHash = `0x${receipt.signature.receiptHash}` as `0x${string}`;
  const keyId =
    `0x${Buffer.from(receipt.signature.keyId, "base64url").toString("hex")}` as `0x${string}`;
  const hash = await wallet.writeContract({
    address: contract,
    abi: parseAbi([
      "function anchor(bytes32 receiptHash, bytes32 collectorKeyId, string schemaVersion, string policyVersion)",
    ]),
    functionName: "anchor",
    args: [
      receiptHash,
      keyId,
      receipt.unsignedReceipt.schemaVersion,
      receipt.unsignedReceipt.policyVersion,
    ],
  });
  return { transactionHash: hash, contract, chainId: sepolia.id };
}

export async function removeRun(receipt: EvidenceReceipt) {
  await rm(resolve("runs", receipt.unsignedReceipt.receiptId), {
    recursive: true,
    force: true,
  });
}
export function printable(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
