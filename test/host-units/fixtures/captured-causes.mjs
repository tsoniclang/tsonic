import { encodeGroupId } from "../../../packages/host/dist/ids/index.js";
import { hostDiagnosticCode } from "../../../packages/host/dist/diag/index.js";

export function capturedCauses(module, owner, body) {
  const key = [null, "actual", 4, 5n, true, false, [], { kind: "record", fields: [["name", ["nested"]], ["empty", null]] }];
  const request = { query: "actual-captured-dependency", key };
  const positions = [
    { kind: "result" },
    { kind: "module-node", module, node: 0 },
    { kind: "source-node", node: { kind: "item", value: { owner, node: 0 } } },
    { kind: "source-node", node: { kind: "body", value: { body, node: 0 } } },
    { kind: "component", path: key },
    { kind: "inference-variable", group: encodeGroupId([body]), variable: 0 },
  ];
  return [
    { kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module, index: 0 } } },
    { kind: "diagnostic", diagnostic: { kind: "checker", diagnostic: { module, index: 1 } } },
    ...positions.map(position => ({ kind: "unit", unit: { request, position } })),
    { kind: "diagnostic", diagnostic: { kind: "host", unit: { request, position: positions[0] },
      code: hostDiagnosticCode("TSONIC_COMPILER_RESOURCE_LIMIT") } },
  ];
}
