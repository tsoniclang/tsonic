export const nativeWatcherCompletionSource = `
import { watchFile, unwatchFile, writeFileSync, unlinkSync } from "node:fs";

export function main(): void {
  const path = "native-watcher-completion.txt";
  writeFileSync(path, "before");
  watchFile(path, (current, previous) => {
    unwatchFile(path);
    unlinkSync(path);
    if (current.size <= previous.size) throw new Error("native stat widths lost");
    console.log("native watcher completion");
  });
  writeFileSync(path, "native changed contents");
}
`;

export const nativeWatcherFailureSource = `
import { watchFile, unwatchFile, writeFileSync, unlinkSync } from "node:fs";

let delivered = 0;

export function schedule(): Error {
  const original = new Error("original watcher failure");
  const first = "native-watcher-first.txt";
  const later = "native-watcher-later.txt";
  writeFileSync(first, "before");
  writeFileSync(later, "before");
  watchFile(first, (current, previous) => {
    unwatchFile(first);
    unlinkSync(first);
    if (current.size <= previous.size) throw new Error("first native stat invalid");
    watchFile(later, (next, prior) => {
      unwatchFile(later);
      unlinkSync(later);
      if (next.size <= prior.size) throw new Error("later native stat invalid");
      delivered++;
    });
    writeFileSync(later, "native later contents");
    throw original;
  });
  writeFileSync(first, "native first contents");
  return original;
}

export function count(): number { return delivered; }
`;

export const nativeWatcherNoDemandSource = `
import { existsSync } from "node:fs";

export function main(): void {
  if (existsSync("native-no-demand-missing.txt")) throw new Error("unexpected fixture");
}
`;
