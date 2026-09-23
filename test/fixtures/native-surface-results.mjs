export const nativeSurfaceResultsSource = `
export function run(): boolean {
  const indexed = [7, 11].map((value, index) => index);
  if (indexed[0] !== 0 || indexed[1] !== 1) return false;
  for (const [position, value] of indexed.entries()) {
    if (position !== value) return false;
  }
  const from = Array.from("ab", (value, index) => index);
  if (from[0] !== 0 || from[1] !== 1) return false;
  const explicit = [7, 11].map<number>((value, index) => index);
  const fractional = [7, 11].map((value, index): number => index + 0.5);
  if (explicit[1] !== 1 || fractional[1] !== 1.5) return false;
  const length = indexed.length;
  if (indexed.at(length - 1) !== 1 || indexed.indexOf(1, length - 1) !== 1) return false;
  if (indexed.slice(length - 1, length)[0] !== 1) return false;
  const mutable = indexed.slice();
  mutable.fill(3, length - 1, length);
  mutable.copyWithin(length - 2, length - 1, length);
  if (mutable.splice(length - 1, length - 1, 4)[0] !== 3) return false;
  mutable.length = length - 1;
  if (mutable.length !== 1 || mutable[0] !== 3) return false;
  const text = "abcd";
  const end = text.length;
  if (text.slice(end - 2, end) !== "cd" || text.substring(end - 2, end) !== "cd") return false;
  if (text.substr(end - 2, end - 2) !== "cd" || text.charAt(end - 1) !== "d") return false;
  if (text.indexOf("d", end - 1) !== 3 || text.lastIndexOf("b", end) !== 1) return false;
  if ("x".repeat(length) !== "xx" || "a".padStart(length, "x") !== "xa") return false;
  const timer = setTimeout(() => {}, 100000);
  clearTimeout(timer);
  const interval = setInterval(() => {}, 100000);
  clearInterval(interval);
  const bytes = new ArrayBuffer(8);
  const sized = new Uint8Array(bytes.byteLength);
  const sizedView = new DataView(sized.buffer, bytes.byteLength - 4, 4);
  sizedView.setUint32(sized.byteLength - 8, 17, true);
  const tail = sized.subarray(sized.length - 4, sized.length);
  if (tail[0] !== 17 || sized.slice(sized.length - 4).length !== 4) return false;
  if (bytes.slice(bytes.byteLength - 4, bytes.byteLength).byteLength !== 4) return false;
  const view = new DataView(bytes);
  view.setUint32(0, bytes.byteLength, true);
  if (view.getUint32(0, true) !== 8) return false;
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
  const lastBytes = bytes.slice(size - 4, size);
  const copied = bytes.copy(Buffer.alloc(8), size - 8, size - 8, size);
  if (lastBytes.length !== 4 || copied !== 8) return false;
  bytes.writeUInt32LE(word, size - 8);
  if (bytes.readUInt32LE(size - 8) !== word) return false;
  const memory = memoryUsage();
  const cpu = process.cpuUsage();
  const previous = { user: cpu.user, system: cpu.system };
  const previousAlias = previous;
  previousAlias.user = 0;
  if (previous.user !== 0) return false;
  const elapsed = process.cpuUsage(previous);
  if (elapsed.user < 0 || elapsed.system < 0) return false;
  cpu.user = 9007199254740993;
  const binary = new DataView(new ArrayBuffer(4));
  binary.setUint32(0, cpu.user, true);
  if (binary.getUint32(0, true) !== 1) return false;
  const words = new Uint32Array(2);
  words[0] = cpu.user;
  words.fill(cpu.user, 1);
  if (words[0] !== 1 || words[1] !== 1) return false;
  words[0] = 0;
  words[0] += cpu.user;
  if (words[0] !== 1) return false;
  const old = words[0]++;
  const next = ++words[1];
  if (old !== 1 || next !== 2 || words[0] !== 2 || words[1] !== 2) return false;
  let receiverCalls = 0;
  let indexCalls = 0;
  const receiver = (): Uint32Array => { receiverCalls++; return words; };
  const index = (): number => { indexCalls++; return 0; };
  const readWord = (): number => words[0];
  const updated = receiver()[index()]++;
  if (updated !== 2 || readWord() !== 3 || receiverCalls !== 1 || indexCalls !== 1) return false;
  const before = hrtime();
  const delta = hrtime(before);
  return size === 8 && size > 0 && memory.rss > 0 && cpu.user === 9007199254740993 &&
    cpu.system >= 0 && delta[0] >= 0 && delta[1] >= 0 && delta[1] < 1000000000 && uptime() >= 0;
}
`;
