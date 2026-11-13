import type { KeyData, Origin } from "../ids/contract.js";
import { encodeKey } from "../ids/index.js";
import type { Diagnostic, DiagnosticCode, DiagnosticIdentityKey, DiagnosticSite, HostDiagnosticCode, LookupDiagnostic, OrderDiagnostics, ResourceLimitReport, UnitPosition } from "./contract.js";

interface DiagnosticEntry {
  readonly diagnostic: Diagnostic;
  readonly key: string;
}

export const sortDiagnostics: OrderDiagnostics = diagnostics => diagnostics
  .map(diagnostic => ({ diagnostic, key: diagnosticKey(diagnostic) }))
  .sort(compareDiagnostics)
  .map(entry => entry.diagnostic);

export const findDiagnosticDefinition: LookupDiagnostic = (registry, code) => {
  for (const definition of registry.definitions) {
    if (definition !== undefined && definition.code === code) return definition;
  }
  return null;
};

export function limitDiagnostic(code: HostDiagnosticCode, report: ResourceLimitReport): Diagnostic {
  const unit = report.unit;
  return ({
    code: { kind: "host", name: code, rendered: code },
    severity: "error",
    site: report.site,
    source: report.owner,
    evidence: [report.limit, unit.request.query, encodeKey(unit.request.key), unit.position.kind],
    message: "A compiler resource limit was reached.",
    arguments: [{ kind: "text", value: report.limit }, { kind: "number", value: report.maximum }],
    related: [],
    fix: null,
  });
}

function positionKey(position: UnitPosition): readonly KeyData[] {
  switch (position.kind) {
    case "result": return [position.kind];
    case "module-node": return [position.kind, position.module, position.node];
    case "source-node": return position.node.kind === "body"
      ? [position.kind, position.node.kind, position.node.value.body, position.node.value.node]
      : [position.kind, position.node.kind, position.node.value.owner, position.node.value.node];
  }
}

export const identityKey: DiagnosticIdentityKey = identity => encodeKey(identity.kind === "checker"
  ? [identity.kind, identity.diagnostic.module, identity.diagnostic.index]
  : [identity.kind, identity.code, identity.unit.request.query, identity.unit.request.key, positionKey(identity.unit.position)]);

function compareDiagnostics(left: DiagnosticEntry, right: DiagnosticEntry): number {
  const first = left.diagnostic;
  const second = right.diagnostic;
  switch (first.site.kind) {
    case "source": {
      if (second.site.kind !== "source") return -1;
      return compareText(first.site.origin.module, second.site.origin.module)
        || compareNumbers(first.site.origin.start, second.site.origin.start)
        || compareText(first.code.rendered, second.code.rendered)
        || compareNumbers(first.site.origin.length, second.site.origin.length)
        || compareText(left.key, right.key);
    }
    case "file":
      if (second.site.kind === "source") return 1;
      if (second.site.kind === "none") return -1;
      return compareText(first.site.path, second.site.path)
        || compareText(first.code.rendered, second.code.rendered)
        || compareText(left.key, right.key);
    case "none":
      if (second.site.kind !== "none") return 1;
      return compareText(first.code.rendered, second.code.rendered) || compareText(left.key, right.key);
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareNumbers(left: number, right: number): number {
  if (Object.is(left, right)) return 0;
  if (Number.isNaN(left)) return 1;
  if (Number.isNaN(right)) return -1;
  if (left === right) return Object.is(left, -0) ? -1 : 1;
  return left < right ? -1 : 1;
}

function vectorKey<Value>(values: readonly Value[], project: (value: Value) => KeyData): readonly KeyData[] {
  const entries: KeyData[] = [values.length];
  values.forEach((value, index) => { entries.push(index, project(value)); });
  return entries;
}

function originKey(origin: Origin): readonly KeyData[] {
  return [origin.module, origin.start, origin.length, vectorKey(origin.derived, derived => derived.kind === "lowering"
    ? [derived.kind, derived.pass] : [derived.kind, derived.expansion])];
}

function siteKey(site: DiagnosticSite): readonly KeyData[] {
  switch (site.kind) {
    case "source": return [site.kind, originKey(site.origin)];
    case "file": return [site.kind, site.path];
    case "none": return [site.kind];
  }
}

function codeKey(code: DiagnosticCode): readonly KeyData[] {
  switch (code.kind) {
    case "host": return [code.kind, code.name, code.rendered];
    case "checker": return [code.kind, code.number, code.rendered];
    case "extension": return [code.kind, code.number, code.extensionCode, code.rendered];
  }
}

function diagnosticKey(diagnostic: Diagnostic): string {
  return encodeKey([
    codeKey(diagnostic.code), diagnostic.severity, siteKey(diagnostic.site), diagnostic.source,
    vectorKey(diagnostic.evidence, value => value), diagnostic.message,
    vectorKey(diagnostic.arguments, argument => [argument.kind, argument.kind === "origin" ? originKey(argument.value) : argument.value]),
    vectorKey(diagnostic.related, related => [siteKey(related.site), codeKey(related.code), related.message]),
    diagnostic.fix === null ? null : [
      diagnostic.fix.description, vectorKey(diagnostic.fix.edits, edit => [originKey(edit.origin), edit.replacement]),
    ],
  ]);
}
