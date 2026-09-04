import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = new URL("..", import.meta.url).pathname;
const text = (path) => readFileSync(join(root, path), "utf8");

test("repository declares its CLI and required safety documentation", () => {
  assert.equal(existsSync(join(root, "package.json")), true);
  const packageJson = JSON.parse(text("package.json"));
  assert.equal(packageJson.type, "module");
  assert.equal(packageJson.bin.evidence, "dist/cli.js");
  for (const path of [
    "README.md",
    "CONTRIBUTING.md",
    ".env.example",
    ".gitignore",
  ]) {
    assert.equal(existsSync(join(root, path)), true, `${path} is required`);
  }
  const readme = text("README.md");
  for (const phrase of [
    "does not identify people",
    "No server is required",
    "authorized",
    "delete",
    "Google Cloud Vision",
  ]) {
    assert.match(readme, new RegExp(phrase, "i"));
  }
});
