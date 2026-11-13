import { encodeKey } from "../ids/index.js";
import type { Diagnostic, HostDiagnosticCode, ResourceLimitReport } from "./contract.js";

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
