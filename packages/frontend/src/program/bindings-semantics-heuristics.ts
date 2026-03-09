import fs from "node:fs";
import path from "node:path";

export type BindingsSemanticsHeuristicHit = {
  readonly heuristicKind: "callStyle" | "typeIdentity";
  readonly family: string;
  readonly site: string;
  readonly suite: string;
  readonly sourceFile?: string;
  readonly bindingType?: string;
  readonly memberName?: string;
  readonly alias?: string;
  readonly clrType?: string;
};

const traceFile = process.env.TSONIC_BINDINGS_SEMANTICS_TRACE_FILE;
const traceSuite = process.env.TSONIC_BINDINGS_SEMANTICS_TRACE_SUITE ?? "unknown";
const failFamilies = new Set(
  (process.env.TSONIC_BINDINGS_SEMANTICS_FAIL_FAMILIES ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
);
const seenHits = new Set<string>();

const normalizePath = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  return value.replace(/\\/g, "/");
};

const makeHitKey = (hit: BindingsSemanticsHeuristicHit): string =>
  JSON.stringify(hit);

export const recordBindingsSemanticsHeuristicHit = (
  hit: Omit<BindingsSemanticsHeuristicHit, "suite">
): void => {
  const normalizedHit: BindingsSemanticsHeuristicHit = {
    ...hit,
    suite: traceSuite,
    sourceFile: normalizePath(hit.sourceFile),
  };

  if (failFamilies.has(normalizedHit.family)) {
    const detail =
      normalizedHit.bindingType && normalizedHit.memberName
        ? `${normalizedHit.bindingType}.${normalizedHit.memberName}`
        : normalizedHit.alias ?? normalizedHit.family;
    throw new Error(
      `Bindings-semantics heuristic fallback is forbidden for family '${normalizedHit.family}' (${detail}) at ${normalizedHit.site}`
    );
  }

  if (!traceFile) return;

  const hitKey = makeHitKey(normalizedHit);
  if (seenHits.has(hitKey)) return;
  seenHits.add(hitKey);

  fs.mkdirSync(path.dirname(traceFile), { recursive: true });
  fs.appendFileSync(traceFile, `${JSON.stringify(normalizedHit)}\n`, "utf8");
};
