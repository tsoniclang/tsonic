import type { Diagnostic, DiagnosticSite, LookupDiagnostic, OrderDiagnostics } from "./contract.js";

export const sortDiagnostics: OrderDiagnostics = diagnostics => [...diagnostics].sort(compareDiagnostics);

export const findDiagnosticDefinition: LookupDiagnostic = (registry, code) => {
  for (const definition of registry.definitions) {
    if (definition.code === code) return definition;
  }
  return null;
};

function compareDiagnostics(left: Diagnostic, right: Diagnostic): number {
  const sites = compareSites(left.site, right.site);
  return sites === 0 ? compareText(left.code.rendered, right.code.rendered) : sites;
}

function compareSites(left: DiagnosticSite, right: DiagnosticSite): number {
  switch (left.kind) {
    case "source": {
      if (right.kind !== "source") return -1;
      const modules = compareText(left.origin.module, right.origin.module);
      return modules === 0 ? left.origin.start - right.origin.start : modules;
    }
    case "file":
      if (right.kind === "source") return 1;
      if (right.kind === "none") return -1;
      return compareText(left.path, right.path);
    case "none":
      return right.kind === "none" ? 0 : 1;
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
