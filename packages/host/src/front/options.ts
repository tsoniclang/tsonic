import type { CheckerOptionInput, CheckerOptionRow, CheckerOptionSet } from "./contract.js";

const constant = (name: string, value: boolean | string, reason: string): CheckerOptionRow =>
  ({ name, value: { kind: "constant", value }, reason });

const fromReference = "The value is the reference implementation's; no clause of the signed specification fixes it.";

/**
 * The checker option set of Host, written once. `openCheckedProgram` creates its session with exactly these
 * options. No field of a snapshot, a target selection or a caller changes a constant row.
 */
export const optionTable: readonly CheckerOptionRow[] = [
  constant("module", "nodenext",
    "Module formats follow Node's rules as the checker applies them. Every module-format fact is captured per binding from the checker; Host derives none from a file extension."),
  constant("moduleResolution", "nodenext",
    "A specifier is resolved by the checker under Node's rules. Host has no second resolver."),
  constant("target", "es2024",
    `The language level the checker accepts. Host emits no JavaScript, so it affects checking only. ${fromReference}`),
  constant("strict", true,
    "One checked meaning for every program: absence is part of a type only where it is written."),
  constant("noEmit", true,
    "Host never emits JavaScript."),
  constant("noLib", true,
    "Library declarations are read only from the files of the session, which are the snapshot's texts. Without it the checker reads the libraries bundled with the installed SDK."),
  constant("allowImportingTsExtensions", true,
    `An import may name a TypeScript source file by its own extension, which is permitted because nothing is emitted. ${fromReference}`),
  constant("allowArbitraryExtensions", true,
    `An import of a file with another extension is checked against its declaration file. ${fromReference}`),
  constant("preserveSymlinks", true,
    "A module is identified by its captured path in the snapshot, never by a real path that the file system resolves it to."),
  { name: "rootDir", value: { kind: "project-root" },
    reason: "The project root of the snapshot: the package root of its root package." },
  { name: "types", value: { kind: "installed-declarations" },
    reason: "Every installed declaration package is admitted when the declaration policy is package-contract, and none when it is none." },
];

export function optionSet(input: CheckerOptionInput): CheckerOptionSet {
  const options: Record<string, boolean | string | readonly string[]> = {};
  optionTable.forEach(row => {
    switch (row.value.kind) {
      case "constant": options[row.name] = row.value.value; break;
      case "project-root": options[row.name] = input.projectRoot; break;
      case "installed-declarations": options[row.name] = input.installedDeclarations === "package-contract" ? ["*"] : []; break;
    }
  });
  return options;
}
