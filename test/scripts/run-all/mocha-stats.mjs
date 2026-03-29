#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [, , outputMode, cacheRoot, packageName, prefix] = process.argv;

if (outputMode !== "--shell" || !cacheRoot || !packageName || !prefix) {
  console.error("Usage: mocha-stats.mjs --shell <cache-root> <package-name> <prefix>");
  process.exit(2);
}

const safeSegment = (input) => String(input).replaceAll(/[^a-zA-Z0-9@._-]+/g, "_");
const packageDir = join(cacheRoot, "mocha", safeSegment(packageName));

const emptyBucket = () => ({
  passed: 0,
  failed: 0,
  skipped: 0,
  count: 0,
  executedCount: 0,
  durationSumMs: 0,
  avgMs: 0,
});

const aggregate = {
  all: emptyBucket(),
  regular: emptyBucket(),
  golden: emptyBucket(),
};

const latestById = new Map();

if (existsSync(packageDir)) {
  const files = readdirSync(packageDir).filter((entry) => entry.startsWith("results.") && entry.endsWith(".jsonl"));
  for (const entry of files) {
    const path = join(packageDir, entry);
    const text = readFileSync(path, "utf8");
    for (const line of text.split("\n")) {
      if (!line) continue;
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        continue;
      }
      if (!record || typeof record.id !== "string" || typeof record.status !== "string") continue;
      const previous = latestById.get(record.id);
      if (!previous || String(record.ts ?? "") >= String(previous.ts ?? "")) {
        latestById.set(record.id, record);
      }
    }
  }
}

const addToBucket = (bucket, record) => {
  bucket.count += 1;
  switch (record.status) {
    case "pass":
      bucket.passed += 1;
      bucket.executedCount += 1;
      break;
    case "fail":
      bucket.failed += 1;
      bucket.executedCount += 1;
      break;
    case "skip":
      bucket.skipped += 1;
      break;
    default:
      break;
  }
  if (typeof record.ms === "number" && Number.isFinite(record.ms)) {
    bucket.durationSumMs += Math.max(0, Math.trunc(record.ms));
  }
};

for (const record of latestById.values()) {
  const kind = record.kind === "golden" ? "golden" : "regular";
  addToBucket(aggregate.all, record);
  addToBucket(aggregate[kind], record);
}

for (const bucket of Object.values(aggregate)) {
  bucket.avgMs = bucket.executedCount > 0 ? Math.trunc(bucket.durationSumMs / bucket.executedCount) : 0;
}

const emitBucket = (name, bucket) => {
  console.log(`${prefix}_${name}_PASSED=${bucket.passed}`);
  console.log(`${prefix}_${name}_FAILED=${bucket.failed}`);
  console.log(`${prefix}_${name}_SKIPPED=${bucket.skipped}`);
  console.log(`${prefix}_${name}_COUNT=${bucket.count}`);
  console.log(`${prefix}_${name}_EXECUTED_COUNT=${bucket.executedCount}`);
  console.log(`${prefix}_${name}_TEST_DURATION_SUM_MS=${bucket.durationSumMs}`);
  console.log(`${prefix}_${name}_TEST_AVG_MS=${bucket.avgMs}`);
};

emitBucket("ALL", aggregate.all);
emitBucket("REGULAR", aggregate.regular);
emitBucket("GOLDEN", aggregate.golden);
