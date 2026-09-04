#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import {
  anchor,
  issue,
  preflight,
  printable,
  saveReceipt,
  scan,
  verifyFile,
} from "./pipeline.js";

function usage(): never {
  console.error("Usage: evidence <preflight|scan|issue|verify|anchor> ...");
  process.exit(2);
}
function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}
function required(name: string): string {
  const value = arg(name);
  if (!value) throw new Error(`invalid_input: ${name} is required`);
  return value;
}
function consent(): void {
  if (arg("--consent") !== "authorized")
    throw new Error("invalid_input: pass --consent authorized");
}
async function main(): Promise<void> {
  const [command, image] = process.argv.slice(2);
  if (!command) usage();
  if (command === "preflight") console.log(printable(await preflight()));
  else if (command === "scan") {
    consent();
    console.log(
      printable(
        await scan(
          image ?? required("<image>"),
          arg("--face-index") === undefined
            ? undefined
            : Number(required("--face-index")),
        ),
      ),
    );
  } else if (command === "issue") {
    consent();
    if (!image) usage();
    const index = Number(required("--face-index"));
    const receipt = await issue(
      image,
      index,
      process.argv.includes("--retain-evidence"),
    );
    const path = await saveReceipt(receipt, arg("--out"));
    console.log(
      printable({
        receiptPath: path,
        outcome: receipt.unsignedReceipt.outcome,
        receiptHash: receipt.signature.receiptHash,
      }),
    );
  } else if (command === "verify") {
    if (!image) usage();
    console.log(printable(await verifyFile(image)));
  } else if (command === "anchor") {
    if (!image) usage();
    const receipt = JSON.parse(await readFile(image, "utf8"));
    console.log(printable(await anchor(receipt)));
  } else usage();
}
main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const invalid =
    message.startsWith("invalid_input") ||
    message.includes("unsupported or malformed image") ||
    message.includes("below minimum dimensions");
  console.error(message);
  process.exit(invalid ? 2 : 3);
});
