export const orderingOraclePrograms = Object.freeze([
  {
    id: "entryExportAndCall",
    source: `export function main(): void {
  console.log("main ran");
}
main();`,
    nodeOutput: ["main ran"],
  },
  {
    id: "entryTopLevelOnly",
    source: `console.log("top-level ran");`,
    nodeOutput: ["top-level ran"],
  },
  {
    id: "thenTiming",
    source: `export function main(): void {
  Promise.resolve(1).then(() => { console.log("callback"); });
  console.log("after");
}
main();`,
    nodeOutput: ["after", "callback"],
  },
  {
    id: "storedAwaitTiming",
    source: `async function body(): Promise<void> {
  console.log("body-start");
  await Promise.resolve(0);
  console.log("body-after-await");
}
export async function main(): Promise<void> {
  const pending = body();
  console.log("after-call");
  await pending;
  console.log("end");
}
await main();`,
    nodeOutput: ["body-start", "after-call", "body-after-await", "end"],
    divergence: {
      id: "D10",
      reason: "A settled native await continues synchronously on both targets.",
      output: ["body-start", "body-after-await", "after-call", "end"],
    },
  },
  {
    id: "fireAndForget",
    source: `async function body(): Promise<void> {
  console.log("body-start");
  await Promise.resolve(0);
  console.log("body-after-await");
}
export function main(): void {
  body();
  console.log("after-call");
}
main();`,
    nodeOutput: ["body-start", "after-call", "body-after-await"],
    divergence: {
      id: "D10",
      reason: "An eager native async body continues synchronously through a settled await.",
      output: ["body-start", "body-after-await", "after-call"],
    },
  },
].map(program => Object.freeze({ ...program,
  family: "ordering", nodeOutput: Object.freeze(program.nodeOutput),
  ...(program.divergence === undefined ? {} : { divergence: Object.freeze({
    ...program.divergence, output: Object.freeze(program.divergence.output),
  }) }),
})));
