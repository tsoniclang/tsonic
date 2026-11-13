import type { SourceDeclarationPolicy } from "../snapshot/contract.js";

/**
 * One row of the checker option set. A constant row has the same value in every session. Two rows are read from
 * the snapshot: the project root, and whether installed declaration packages are admitted.
 */
export type CheckerOptionValue =
  | { readonly kind: "constant"; readonly value: boolean | string }
  | { readonly kind: "project-root" }
  | { readonly kind: "installed-declarations" };

export interface CheckerOptionRow {
  readonly name: string;
  readonly value: CheckerOptionValue;
  readonly reason: string;
}

export interface CheckerOptionInput {
  readonly projectRoot: string;
  readonly installedDeclarations: SourceDeclarationPolicy["installedDeclarations"];
}

/** The options of the one compiler session of an analysis: exactly one entry per row of the table, and no other. */
export type CheckerOptionSet = Readonly<Record<string, boolean | string | readonly string[]>>;

/**
 * The checker option set of Host, written once. `openCheckedProgram` creates its session with exactly these
 * options. No field of a snapshot, a target selection or a caller changes a constant row.
 */
export const optionTable: readonly CheckerOptionRow[] = [
  { name: "module", value: { kind: "constant", value: "nodenext" },
    reason: "Module formats follow Node's rules as the checker applies them. Every module-format fact is captured per binding from the checker; Host derives none from a file extension." },
  { name: "moduleResolution", value: { kind: "constant", value: "nodenext" },
    reason: "A specifier is resolved by the checker under Node's rules. Host has no second resolver." },
  { name: "target", value: { kind: "constant", value: "es2024" },
    reason: "A pinned checking baseline of the SDK: the language level the checker accepts. It is not a selected native target and not an emission policy, and no native integer, absence or layout restriction is derived from it." },
  { name: "strict", value: { kind: "constant", value: true },
    reason: "One checked meaning for every program: absence is part of a type only where it is written." },
  { name: "noEmit", value: { kind: "constant", value: true },
    reason: "Host never emits JavaScript." },
  { name: "noLib", value: { kind: "constant", value: true },
    reason: "Library declarations are read only from the files of the session, which are the snapshot's texts. Without it the checker reads the libraries bundled with the installed SDK." },
  { name: "allowImportingTsExtensions", value: { kind: "constant", value: true },
    reason: "An import may name a source file by its explicit extension; it is resolved through the one SDK resolver." },
  { name: "allowArbitraryExtensions", value: { kind: "constant", value: true },
    reason: "Admits a statically resolved module that is backed by a declaration file. It is not a dynamic loader, and it does not let a module skip provider or source admission." },
  { name: "preserveSymlinks", value: { kind: "constant", value: true },
    reason: "A module is identified by its captured path in the snapshot, never by a real path that the file system resolves it to." },
  { name: "rootDir", value: { kind: "project-root" },
    reason: "The project root of the snapshot: the package root of its root package." },
  { name: "types", value: { kind: "installed-declarations" },
    reason: "The wildcard admits every installed declaration package when the declaration policy is package-contract. The empty list under the policy none suppresses automatic installed ambient packages; it removes no separately captured bundled or provider file and does not ban explicit module resolution." },
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
