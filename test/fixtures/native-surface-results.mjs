export const nativeSurfaceResultsSource = `
export function run(): boolean {
  const timer = setTimeout(() => {}, 100000);
  clearTimeout(timer);
  const interval = setInterval(() => {}, 100000);
  clearInterval(interval);
  const bytes = new ArrayBuffer(8);
  const view = new DataView(bytes);
  view.setUint32(0, 4294967295, true);
  const word = view.getUint32(0, true);
  view.setFloat32(4, 1.5, true);
  const single = view.getFloat32(4, true);
  if (word !== 4294967295 || single !== 1.5 || bytes.byteLength !== 8) return false;
  const words = new Uint32Array([4294967295, 7, 0]);
  const first = words[0];
  const last = words.at(-1);
  words.sort((left, right) => left === right ? 0 : left < right ? -1 : 1);
  if (first !== 4294967295 || last !== 0 || words[0] !== 0 || words[2] !== 4294967295) return false;
  const clamped = new Uint8ClampedArray(2);
  clamped[0] = 300;
  clamped[1] = 1.5;
  const alias = clamped.subarray(0);
  if (alias[0] !== 255 || alias[1] !== 2) return false;
  alias[0] = -10;
  if (clamped[0] !== 0 || clamped.length !== 2) return false;
  const matched = /word/d.exec("a word");
  if (matched === null || matched.index !== 2 || matched.indices === undefined) return false;
  const span = matched.indices[0];
  if (span === undefined || span[0] !== 2 || span[1] !== 6) return false;
  const options = new Intl.NumberFormat("en", { maximumSignificantDigits: 3 }).resolvedOptions();
  return options.maximumSignificantDigits === 3 && options.minimumFractionDigits === undefined &&
    "abc".length === 3 && "abc".codePointAt(0) === 97 &&
    "abc".indexOf("b") === 1 && "abc".search(/z/) === -1 &&
    Number.isNaN("".charCodeAt(0)) && Number.isNaN(Math.min(1, Number.NaN));
}
`;

export const nativeNodeResultsSource = `
import { Buffer } from "node:buffer";
import { statSync, writeFileSync, unlinkSync } from "node:fs";
import process, { memoryUsage, hrtime, uptime } from "node:process";
export function run(): boolean {
  const bytes = Buffer.alloc(8);
  const written = bytes.writeUInt32LE(4294967295, 0);
  const word = bytes.readUInt32LE(0);
  if (word !== 4294967295 || written !== 4 || bytes.length !== 8) return false;
  writeFileSync("native-counter-proof.bin", bytes);
  const stats = statSync("native-counter-proof.bin");
  unlinkSync("native-counter-proof.bin");
  const size = stats.size;
  const memory = memoryUsage();
  const cpu = process.cpuUsage();
  const before = hrtime();
  const delta = hrtime(before);
  return size === 8 && size > 0 && memory.rss > 0 && cpu.user >= 0 &&
    cpu.system >= 0 && delta[0] >= 0 && delta[1] >= 0 && delta[1] < 1000000000 && uptime() >= 0;
}
`;
