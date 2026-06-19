#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../../..");
const scannerDist = join(repoRoot, "packages/tsts/dist/src/internal/scanner/scanner.js");
const kindsDist = join(repoRoot, "packages/tsts/dist/src/internal/ast/generated/kinds.js");
const languageVariantDist = join(repoRoot, "packages/tsts/dist/src/internal/core/languagevariant.js");

const requiredDist = [scannerDist, kindsDist, languageVariantDist];
for (const file of requiredDist) {
  if (!existsSync(file)) {
    throw new Error(`Missing built TSTS artifact: ${file}. Run npx tsc -p packages/tsts/tsconfig.json first.`);
  }
}

const scanner = await import(pathToFileURL(scannerDist).href);
const kinds = await import(pathToFileURL(kindsDist).href);
const languageVariant = await import(pathToFileURL(languageVariantDist).href);

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

function scanAll(text, configure) {
  const s = scanner.NewScanner();
  scanner.Scanner_SetText(s, text);
  if (configure !== undefined) {
    configure(s);
  }

  let count = 0;
  let checksum = 0;
  for (;;) {
    const token = scanner.Scanner_Scan(s);
    const start = scanner.Scanner_TokenStart(s);
    const end = scanner.Scanner_TokenEnd(s);
    checksum = ((checksum * 33) + token + start + end) | 0;
    count++;
    if (token === kinds.KindEndOfFile) {
      break;
    }
    if (count > text.length * 4 + 10_000) {
      throw new Error(`scanner did not reach EOF after ${count} tokens`);
    }
  }
  return { count, checksum };
}

function measure(fn) {
  const start = performance.now();
  const result = fn();
  return { millis: performance.now() - start, ...result };
}

function runCase(name, text, configure, runs) {
  const samples = [];
  let expected;

  scanAll(text, configure);
  for (let run = 0; run < runs; run++) {
    const result = measure(() => scanAll(text, configure));
    const key = `${result.count}:${result.checksum}`;
    if (expected === undefined) {
      expected = key;
    } else if (expected !== key) {
      throw new Error(`${name} checksum changed: expected ${expected}, got ${key}`);
    }
    samples.push(result.millis);
  }

  const medianMs = median(samples);
  const [count, checksum] = expected.split(":").map(Number);
  return {
    name,
    chars: text.length,
    tokens: count,
    medianMs,
    tokensPerMs: count / medianMs,
    checksum,
  };
}

function makeAsciiSource(lineCount) {
  const line = "export const value = condition ? left + right : fallback;\n";
  const fn = "function compute(input: number): number { return input + 1; }\n";
  const type = "type Pair<T> = { readonly left: T; readonly right: T };\n";
  return (line + fn + type).repeat(lineCount);
}

function makeMixedSource(lineCount) {
  const line = "const café = `𝄞${value}`; // ελληνικά 中文 русский 😀\r\n";
  const re = "const match = /\\p{Letter}+/u.exec(café);\n";
  const comment = "/** résumé naïve jalapeño — scanner unicode path */\n";
  return (comment + line + re).repeat(lineCount);
}

function makeJsxSource(lineCount) {
  const component = `
export function Component(props: { title: string }) {
  return <section data-kind="demo"><h1>{props.title}</h1><span>{items.map(item => <b key={item}>{item}</b>)}</span></section>;
}
`;
  return component.repeat(lineCount);
}

function fmt(value, digits = 2) {
  return value.toFixed(digits);
}

const options = parseArgs(process.argv.slice(2));
const cases = [
  runCase("ASCII TypeScript source", makeAsciiSource(1_500), undefined, options.runs),
  runCase("mixed Unicode source", makeMixedSource(500), undefined, options.runs),
  runCase(
    "JSX source",
    makeJsxSource(350),
    (s) => scanner.Scanner_SetLanguageVariant(s, languageVariant.LanguageVariantJSX),
    options.runs,
  ),
];

if (options.json) {
  console.log(JSON.stringify({ runs: options.runs, cases }, null, 2));
} else {
  console.log("# TSTS scanner benchmark");
  console.log(`runs: ${options.runs} (median, built dist)`);
  console.log("| case | chars | tokens | median ms | tokens/ms | checksum |");
  console.log("|---|---:|---:|---:|---:|---:|");
  for (const item of cases) {
    console.log(`| ${item.name} | ${item.chars} | ${item.tokens} | ${fmt(item.medianMs)} | ${fmt(item.tokensPerMs)} | ${item.checksum} |`);
  }
}
