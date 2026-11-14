import type { SourceDeclarationPolicy } from "../snapshot/contract.js";

/** The options Front sets. A name outside this list is not an option of a Host session. */
export type CheckerOptionName =
  | "module" | "moduleResolution" | "target" | "strict" | "noEmit" | "noLib"
  | "allowImportingTsExtensions" | "allowArbitraryExtensions" | "types"
  | "skipLibCheck" | "noUncheckedIndexedAccess" | "exactOptionalPropertyTypes" | "useDefineForClassFields"
  | "esModuleInterop" | "resolveJsonModule" | "allowJs";

/**
 * One row of the checker option set. A constant row has the same value in every session. One row is read from the
 * snapshot: whether installed declaration packages are admitted.
 */
export type CheckerOptionValue =
  | { readonly kind: "constant"; readonly value: boolean | string }
  | { readonly kind: "installed-declarations" };

export interface CheckerOptionRow {
  readonly name: CheckerOptionName;
  readonly value: CheckerOptionValue;
  readonly reason: string;
}

export interface CheckerOption {
  readonly name: CheckerOptionName;
  readonly value: boolean | string | readonly string[];
}

/**
 * The checker option set of Host, written once. `openCheckedProgram` creates its session with exactly these
 * options. No field of a target selection or of a caller changes a row, and an option that is not a row is not
 * set: where a default of the checker decides a checked type, a retained diagnostic or which imports resolve, the
 * option is a row with its value, so that a change of the checker's default changes nothing here. A row exists
 * only where some program checks differently under its other value: an option that no session on captured texts
 * can observe (link preservation: captured files have no links, and a module is its captured path) is not a row.
 */
export const optionTable: readonly CheckerOptionRow[] = [
  { name: "module", value: { kind: "constant", value: "nodenext" },
    reason: "Module formats follow Node's rules as the checker applies them. Every module-format fact is captured per binding from the checker; Host derives none from a file extension." },
  { name: "moduleResolution", value: { kind: "constant", value: "nodenext" },
    reason: "A specifier is resolved by the checker under Node's rules. Host has no second resolver." },
  { name: "target", value: { kind: "constant", value: "es2024" },
    reason: "A pinned checking baseline of the SDK: the language level the checker accepts, above which syntax is a diagnostic. It is not a selected native target and not an emission policy, and no native integer, absence or layout restriction is derived from it. The class-field model is its own row and does not follow from this one." },
  { name: "strict", value: { kind: "constant", value: true },
    reason: "One checked meaning for every program: absence is part of a type only where it is written." },
  { name: "noEmit", value: { kind: "constant", value: true },
    reason: "Host never emits JavaScript." },
  { name: "noLib", value: { kind: "constant", value: true },
    reason: "Library declarations are read only from the files of the session, which are the snapshot's texts. Without it the checker reads the libraries bundled with the installed SDK." },
  { name: "allowImportingTsExtensions", value: { kind: "constant", value: true },
    reason: "An import may name a source file by its explicit extension; it is resolved through the one SDK resolver." },
  { name: "allowArbitraryExtensions", value: { kind: "constant", value: true },
    reason: "Admits a statically resolved module that is backed by a declaration file. It is not a dynamic loader, it gives the module no native meaning, and it does not let a module skip provider or source admission." },
  { name: "types", value: { kind: "installed-declarations" },
    reason: "The wildcard admits every installed declaration package that the snapshot captured when the declaration policy is package-contract. The empty list under the policy none suppresses automatic installed ambient packages; it removes no separately captured bundled or provider file and does not ban explicit module resolution." },
  { name: "skipLibCheck", value: { kind: "constant", value: false },
    reason: "Declaration diagnostics are not waived as a performance shortcut: each keeps its actual dependency or source owner and its cause. There is one checked program and one memoised checker, not a repeated declaration check per consumer." },
  { name: "noUncheckedIndexedAccess", value: { kind: "constant", value: false },
    reason: "A native checked index of an array or fixed array returns the element or its selected failure, not a fabricated absence. The bounds, availability and initialization proofs stay mandatory in Rules, MIR and the analyses." },
  { name: "exactOptionalPropertyTypes", value: { kind: "constant", value: false },
    reason: "Native optional storage has one absence state; no JavaScript property-presence distinction is added that would reject a supplied absence. The rules for argument omission and defaults stay explicit on their own." },
  { name: "useDefineForClassFields", value: { kind: "constant", value: true },
    reason: "The checker models own-field initialization, not an assignment through an inherited setter. The native construction plan and the selected facts own actual construction; no property-definition call and no descriptor runtime is emitted." },
  { name: "esModuleInterop", value: { kind: "constant", value: true },
    reason: "Keeps the checker's supported binding and default evidence for external CommonJS declarations under NodeNext. It admits no authored CommonJS runtime, emits no JavaScript helper, and Host guesses no alias." },
  { name: "resolveJsonModule", value: { kind: "constant", value: false },
    reason: "No JSON file becomes a source module or is interpreted at run time implicitly. Configuration parsing stays Stage 5's; a declaration-backed or provider module still needs an actual native meaning." },
  { name: "allowJs", value: { kind: "constant", value: false },
    reason: "Authored semantic source is the admitted TypeScript model, not a JavaScript surface widened implicitly. External declarations stay ordinary captured declarations." },
];

/** The options of the one compiler session of an analysis: exactly one entry per row of the table, in its order. */
export function optionSet(installedDeclarations: SourceDeclarationPolicy["installedDeclarations"]): readonly CheckerOption[] {
  return optionTable.map((row): CheckerOption => {
    switch (row.value.kind) {
      case "constant": return ({ name: row.name, value: row.value.value });
      case "installed-declarations": return ({ name: row.name, value: installedDeclarations === "package-contract" ? ["*"] : [] });
    }
  });
}
