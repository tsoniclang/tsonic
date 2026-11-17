import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { hostRoot, validateWaveManifests } from "./npm-wave.mjs";
import { packReleasePackage } from "./package-artifact.mjs";
import { buildReleaseWave } from "./build-wave.mjs";
import { runReleaseLanes } from "./parallel-lanes.mjs";
import { startPackedRegistry } from "./packed-install/registry.mjs";

const wave = validateWaveManifests();
buildReleaseWave(wave);
const releaseRoot = resolve(hostRoot, ".temp/npm-release");
mkdirSync(releaseRoot, { recursive: true });
const scratchRoot = mkdtempSync(resolve(releaseRoot, "packed-install-"));
const tarballRoot = resolve(scratchRoot, "tarballs");
mkdirSync(tarballRoot);
writeFileSync(resolve(scratchRoot, "package.json"), `${JSON.stringify({
  name: "tsonic-packed-install-root", private: true,
}, null, 2)}\n`);
const packed = wave.packages.map(entry => packReleasePackage(entry, tarballRoot));
const registry = await startPackedRegistry(packed);
try {
  await runReleaseLanes(["csharp", "rust"].map(target => ({
    id: `packed-${target}`, command: process.execPath, cwd: hostRoot,
    args: ["scripts/release/packed-install/verify-target.mjs", target, scratchRoot, registry.origin],
  })), scratchRoot);
} finally {
  await new Promise((resolveClose, rejectClose) => {
    registry.server.close(error => error === undefined ? resolveClose() : rejectClose(error));
  });
}
const aggregateHash = createHash("sha256");
for (const entry of packed) {
  aggregateHash.update(`${entry.name}\0${entry.integrity}\n`);
}
const aggregateSha256 = aggregateHash.digest("hex");
const totalFileCount = packed.reduce((count, entry) => count + entry.fileCount, 0);
if (process.env.TSONIC_NPM_PACK_RESULT !== undefined) {
  writeFileSync(process.env.TSONIC_NPM_PACK_RESULT, `${JSON.stringify({
    version: wave.version, aggregateSha256, totalFileCount,
    packages: packed.map(({ name, version, tarballPath, integrity, fileCount }) => ({ name, version, tarballPath, integrity, fileCount })),
  }, null, 2)}\n`, { flag: "wx" });
}
process.stdout.write(`Packed install verified: ${packed.length} packages, ${totalFileCount} files, aggregate SHA-256 ${aggregateSha256}\n`);
