export const guardedFieldIterationFiles = Object.freeze({
  "options.ts": `
export interface Options {
  extensions?: string[] | false;
  index?: string | string[] | false;
  enabled?: boolean;
}
`,
  "index.ts": `
import type { Options } from "./options.js";

async function suspend(): Promise<void> {}

export function collect(options?: Options): string {
  let result = "";
  if (options?.extensions !== false && options?.extensions !== undefined) {
    for (const extension of options.extensions) result += extension;
  }
  return result;
}

export function optionalValues(options?: Options): string[] | undefined {
  if (options?.extensions === false) return undefined;
  return options?.extensions;
}

export function deferred(options?: Options): () => Promise<string> {
  return async () => {
    await suspend();
    let result = "";
    if (options?.extensions !== false && options?.extensions !== undefined) {
      for (const extension of options.extensions) result += extension;
    }
    return result;
  };
}

export async function run(): Promise<boolean> {
  const present: Options = { extensions: ["a", "b"] };
  const disabled: Options = { extensions: false };
  const absent: Options = {};
  return collect(present) === "ab" && collect(disabled) === "" && collect(absent) === "" && collect() === "" &&
    await deferred(present)() === "ab" && await deferred(disabled)() === "" &&
    await deferred(absent)() === "" && await deferred()() === "" &&
    optionalValues(present) !== undefined && optionalValues(disabled) === undefined &&
    optionalValues(absent) === undefined && optionalValues() === undefined;
}

export async function main(): Promise<void> {
  if (!await run()) throw new Error("guarded field iteration");
}
`,
});
