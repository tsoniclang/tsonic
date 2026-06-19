#!/usr/bin/env node
import { performance } from "node:perf_hooks";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../../..");
const utf8Dist = join(repoRoot, "packages/tsts/dist/src/go/unicode/utf8.js");
const unicodeDist = join(repoRoot, "packages/tsts/dist/src/go/unicode.js");
const coreDist = join(repoRoot, "packages/tsts/dist/src/internal/core/core.js");
const stringutilDist = join(repoRoot, "packages/tsts/dist/src/internal/stringutil/util.js");
const stringCompareDist = join(repoRoot, "packages/tsts/dist/src/internal/stringutil/compare.js");

const requiredDist = [utf8Dist, unicodeDist, coreDist, stringutilDist, stringCompareDist];
for (const file of requiredDist) {
  if (!existsSync(file)) {
    throw new Error(`Missing built TSTS artifact: ${file}. Run npx tsc -p packages/tsts/tsconfig.json first.`);
  }
}

const utf8 = await import(pathToFileURL(utf8Dist).href);
const unicode = await import(pathToFileURL(unicodeDist).href);
const core = await import(pathToFileURL(coreDist).href);
const stringutil = await import(pathToFileURL(stringutilDist).href);
const stringCompare = await import(pathToFileURL(stringCompareDist).href);

const encoder = new globalThis.TextEncoder();
const decoder = new globalThis.TextDecoder("utf-8");

function parseArgs(argv) {
  const options = { runs: 7, json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--runs") options.runs = Math.max(3, Number(argv[++i]));
    else if (arg === "--json") options.json = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function measure(fn) {
  const start = performance.now();
  const checksum = fn();
  const millis = performance.now() - start;
  return { millis, checksum };
}

function runPair(name, legacy, current, runs) {
  const legacySamples = [];
  const currentSamples = [];
  let legacyChecksum;
  let currentChecksum;

  legacy();
  current();

  for (let run = 0; run < runs; run++) {
    const first = run % 2 === 0 ? "legacy" : "current";
    const samples = first === "legacy"
      ? [measure(legacy), measure(current)]
      : [measure(current), measure(legacy)];
    const legacyResult = first === "legacy" ? samples[0] : samples[1];
    const currentResult = first === "legacy" ? samples[1] : samples[0];
    legacySamples.push(legacyResult.millis);
    currentSamples.push(currentResult.millis);
    legacyChecksum = legacyResult.checksum;
    currentChecksum = currentResult.checksum;
  }

  if (legacyChecksum !== currentChecksum) {
    throw new Error(`${name} checksum mismatch: legacy=${legacyChecksum} current=${currentChecksum}`);
  }

  const legacyMs = median(legacySamples);
  const currentMs = median(currentSamples);
  return {
    name,
    legacyMs,
    currentMs,
    speedup: legacyMs / currentMs,
    checksum: currentChecksum,
  };
}

function legacyByteLen(s) {
  return encoder.encode(s).length;
}

function legacyByteAt(s, i) {
  return encoder.encode(s)[i];
}

function legacyByteSlice(s, start, end) {
  return decoder.decode(encoder.encode(s).subarray(start, end));
}

function legacyUTF16Len(s) {
  return decoder.decode(encoder.encode(s)).length;
}

function legacyDecodeRuneInStringAt(s, offset) {
  const bytes = encoder.encode(s);
  return utf8.DecodeRuneInBytesAt(bytes, offset);
}

function legacySplitLines(text) {
  const lines = [];
  let start = 0;
  let pos = 0;
  while (pos < legacyByteLen(text)) {
    const ch = legacyByteAt(text, pos);
    if (ch === 0x0d || ch === 0x0a) {
      if (ch === 0x0d && pos + 1 < legacyByteLen(text) && legacyByteAt(text, pos + 1) === 0x0a) {
        lines.push(legacyByteSlice(text, start, pos));
        pos += 2;
        start = pos;
        continue;
      }
      lines.push(legacyByteSlice(text, start, pos));
      pos++;
      start = pos;
      continue;
    }
    pos++;
  }
  if (start < legacyByteLen(text)) {
    lines.push(legacyByteSlice(text, start));
  }
  return lines;
}

function legacyCompareStringsCaseInsensitive(a, b) {
  if (a === b) {
    return 0;
  }
  for (;;) {
    const [ca, sa] = legacyDecodeRuneInStringAt(a, 0);
    const [cb, sb] = legacyDecodeRuneInStringAt(b, 0);
    if (sa === 0) {
      return sb === 0 ? 0 : -1;
    }
    if (sb === 0) {
      return 1;
    }
    const lca = unicode.ToLower(ca);
    const lcb = unicode.ToLower(cb);
    if (lca !== lcb) {
      return lca < lcb ? -1 : 1;
    }
    a = legacyByteSlice(a, sa);
    b = legacyByteSlice(b, sb);
  }
}

function makeAsciiSource(lineCount) {
  const line = "export const value = condition ? left + right : fallback;\n";
  return line.repeat(lineCount);
}

function makeMixedSource(lineCount) {
  const line = "const café = `𝄞${value}`; // ελληνικά 中文 русский 😀\r\n";
  return line.repeat(lineCount);
}

function checksumStrings(values) {
  let checksum = 0;
  for (const value of values) {
    checksum = (checksum + value.length) | 0;
    if (value.length > 0) checksum = (checksum + value.charCodeAt(0)) | 0;
  }
  return checksum;
}

const asciiSource = makeAsciiSource(2_000);
const mixedSource = makeMixedSource(300);
const compareLeft = makeMixedSource(40);
const compareRight = compareLeft.toLocaleUpperCase();

const options = parseArgs(process.argv.slice(2));

const benchmarks = [
  runPair(
    "UTF16Len large mixed source",
    () => {
      let checksum = 0;
      for (let i = 0; i < 800; i++) checksum += legacyUTF16Len(mixedSource);
      return checksum;
    },
    () => {
      let checksum = 0;
      for (let i = 0; i < 800; i++) checksum += core.UTF16Len(mixedSource);
      return checksum;
    },
    options.runs,
  ),
  runPair(
    "byte length repeated ASCII source",
    () => {
      let checksum = 0;
      for (let i = 0; i < 400; i++) checksum += legacyByteLen(asciiSource);
      return checksum;
    },
    () => {
      let checksum = 0;
      for (let i = 0; i < 400; i++) checksum += utf8.StringByteLen(asciiSource);
      return checksum;
    },
    options.runs,
  ),
  runPair(
    "decode runes by byte offset",
    () => {
      let checksum = 0;
      const byteLength = legacyByteLen(mixedSource);
      for (let pass = 0; pass < 2; pass++) {
        let offset = 0;
        while (offset < byteLength) {
          const [rune, size] = legacyDecodeRuneInStringAt(mixedSource, offset);
          checksum = (checksum + rune + size) | 0;
          offset += size === 0 ? 1 : size;
        }
      }
      return checksum;
    },
    () => {
      let checksum = 0;
      const byteLength = utf8.StringByteLen(mixedSource);
      for (let pass = 0; pass < 2; pass++) {
        let offset = 0;
        while (offset < byteLength) {
          const [rune, size] = utf8.DecodeRuneInStringAt(mixedSource, offset);
          checksum = (checksum + rune + size) | 0;
          offset += size === 0 ? 1 : size;
        }
      }
      return checksum;
    },
    options.runs,
  ),
  runPair(
    "SplitLines mixed CRLF source",
    () => checksumStrings(legacySplitLines(mixedSource)),
    () => checksumStrings(stringutil.SplitLines(mixedSource)),
    options.runs,
  ),
  runPair(
    "case-insensitive compare mixed source",
    () => {
      let checksum = 0;
      for (let i = 0; i < 2; i++) {
        checksum += legacyCompareStringsCaseInsensitive(compareLeft, compareRight);
      }
      return checksum;
    },
    () => {
      let checksum = 0;
      for (let i = 0; i < 2; i++) {
        checksum += stringCompare.CompareStringsCaseInsensitive(compareLeft, compareRight);
      }
      return checksum;
    },
    options.runs,
  ),
];

if (options.json) {
  console.log(JSON.stringify({ runs: options.runs, benchmarks }, null, 2));
} else {
  console.log(`# UTF-8/source-text performance benchmark`);
  console.log(`runs: ${options.runs} (median)`);
  console.log(`| case | legacy ms | current ms | speedup |`);
  console.log(`|---|---:|---:|---:|`);
  for (const row of benchmarks) {
    console.log(`| ${row.name} | ${row.legacyMs.toFixed(3)} | ${row.currentMs.toFixed(3)} | ${row.speedup.toFixed(1)}x |`);
  }
}
