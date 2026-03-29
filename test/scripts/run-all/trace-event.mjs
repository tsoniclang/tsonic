#!/usr/bin/env node

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [, , traceFile, runId, eventName, ...rest] = process.argv;

if (!traceFile || !runId || !eventName) {
  process.exit(2);
}

const record = {
  runId,
  event: eventName,
  ts: new Date().toISOString(),
};

for (let index = 0; index < rest.length; index += 2) {
  const key = rest[index];
  if (!key) continue;
  record[key] = rest[index + 1] ?? "";
}

mkdirSync(dirname(traceFile), { recursive: true });
appendFileSync(traceFile, `${JSON.stringify(record)}\n`, "utf8");
