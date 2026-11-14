import type { TypedValue, ConversionDecision, TirDemand, TirResolution, TargetAccess, TirApplication, TirProtocol, TypedOperation, TirSelection, MemberSelection, ResolvedCallee, TirArgument, TirProtocolStep, TirRestPart } from "../ir-tir/contract.js";
import type { TextWork } from "./text-values.js";
import { token, text, numeric, numericIdentity, identity, field, record, sequence, deferred, boolean, textLocalRef } from "./text-values.js";
import { textRefinementDecision, textEmbeddingDecision, textDeferredDecision, textOperationDecision, textMemberDecision, textApplicationDecision } from "./text-inference.js";
import { textImportTarget } from "./text-core.js";
import { textBodyInstance } from "./text-types.js";

export function textTypedValue(value: TypedValue): TextWork {
  return deferred(value, () => {
    return record("TypedValue", [
      field("type", numericIdentity("t", value.type)),
      field("convertedType", numericIdentity("t", value.convertedType)),
      field("conversion", textConversionDecision(value.conversion)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
      field("demand", textTirDemand(value.demand)),
    ]);
  });
}

export function textConversionDecision(value: ConversionDecision): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "identity":
        return record(value.kind, []);
      case "convert":
        return record(value.kind, [
      field("role", text(value.role)),
      field("operation", textTypedOperation(value.operation)),
    ]);
      case "backed-convert":
        return record(value.kind, [
      field("role", text(value.role)),
      field("embedding", textEmbeddingDecision(value.embedding)),
      field("operation", textTypedOperation(value.operation)),
    ]);
      case "deferred":
        return record(value.kind, [
      field("deferred", textDeferredDecision(value.deferred)),
    ]);
    }
  });
}

export function textTirDemand(value: TirDemand): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "always":
        return record(value.kind, []);
      case "selected":
        return record(value.kind, [
      field("control", numericIdentity("n", value.control)),
      field("when", text(value.when)),
    ]);
      case "never":
        return record(value.kind, [
      field("control", numericIdentity("n", value.control)),
    ]);
    }
  });
}

export function textTirResolution(value: TirResolution): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "local":
        return record(value.kind, [
      field("local", textLocalRef(value.local)),
    ]);
      case "definition":
        return record(value.kind, [
      field("definition", identity("def", value.definition)),
      field("aliases", sequence(value.aliases, entry0 => identity("def", entry0))),
    ]);
      case "module":
        return record(value.kind, [
      field("target", textImportTarget(value.target)),
    ]);
      case "error":
        return record(value.kind, [
      field("diagnostic", numeric(value.diagnostic)),
    ]);
    }
  });
}

export function textTargetAccess(value: TargetAccess): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "write":
        return record(value.kind, [
      field("storage", numericIdentity("t", value.storage)),
    ]);
      case "read-write":
        return record(value.kind, [
      field("storage", numericIdentity("t", value.storage)),
      field("read", numericIdentity("t", value.read)),
      field("narrowing", (value.narrowing === null ? token("null") : textRefinementDecision(value.narrowing))),
      field("evidenceIndex", (value.evidenceIndex === null ? token("null") : numeric(value.evidenceIndex))),
    ]);
    }
  });
}

export function textTirApplication(value: TirApplication): TextWork {
  return deferred(value, () => {
    return record("TirApplication", [
      field("callee", textResolvedCallee(value.callee)),
      field("receiver", (value.receiver === null ? token("null") : numericIdentity("n", value.receiver))),
      field("arguments", sequence(value.arguments, entry0 => textTirArgument(entry0))),
    ]);
  });
}

export function textTirProtocol(value: TirProtocol): TextWork {
  return deferred(value, () => {
    return record(value.kind, [
      field("asynchronous", boolean(value.asynchronous)),
      field("steps", sequence(value.steps, entry0 => textTirProtocolStep(entry0))),
      field("value", numericIdentity("t", value.value)),
      field("completion", numericIdentity("t", value.completion)),
      field("sent", (value.sent === null ? token("null") : numericIdentity("t", value.sent))),
      field("thrown", numericIdentity("t", value.thrown)),
    ]);
  });
}

export function textTypedOperation(value: TypedOperation): TextWork {
  return deferred(value, () => {
    return record("TypedOperation", [
      field("decision", textOperationDecision(value.decision)),
      field("permissionScope", (value.permissionScope === null ? token("null") : numericIdentity("n", value.permissionScope))),
    ]);
  });
}

export function textTirSelection(value: TirSelection): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "conditional":
        return record(value.kind, [
      field("control", numericIdentity("n", value.control)),
      field("whenTrue", numericIdentity("n", value.whenTrue)),
      field("whenFalse", numericIdentity("n", value.whenFalse)),
      field("disposition", text(value.disposition)),
    ]);
      case "and":
      case "or":
      case "coalesce":
        return record(value.kind, [
      field("control", numericIdentity("n", value.control)),
      field("right", numericIdentity("n", value.right)),
      field("disposition", text(value.disposition)),
    ]);
    }
  });
}

export function textMemberSelection(value: MemberSelection): TextWork {
  return deferred(value, () => {
    return record("MemberSelection", [
      field("decision", textMemberDecision(value.decision)),
      field("getter", (value.getter === null ? token("null") : textResolvedCallee(value.getter))),
      field("setter", (value.setter === null ? token("null") : textResolvedCallee(value.setter))),
    ]);
  });
}

export function textResolvedCallee(value: ResolvedCallee): TextWork {
  return deferred(value, () => {
    return record("ResolvedCallee", [
      field("decision", textApplicationDecision(value.decision)),
      field("activation", (value.activation === null ? token("null") : textBodyInstance(value.activation))),
    ]);
  });
}

export function textTirArgument(value: TirArgument): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "provided":
        return record(value.kind, [
      field("parameter", numeric(value.parameter)),
      field("expression", numericIdentity("n", value.expression)),
    ]);
      case "omitted":
        return record(value.kind, [
      field("parameter", numeric(value.parameter)),
      field("value", deferred(value.value, () => {
  switch (value.value.kind) {
    case "absence":
      return record(value.value.kind, []);
    case "initializer":
      return record(value.value.kind, [
      field("instance", textBodyInstance(value.value.instance)),
    ]);
    case "empty-rest":
      return record(value.value.kind, []);
  }
})),
    ]);
      case "rest":
        return record(value.kind, [
      field("parameter", numeric(value.parameter)),
      field("parts", sequence(value.parts, entry0 => textTirRestPart(entry0))),
    ]);
    }
  });
}

export function textTirProtocolStep(value: TirProtocolStep): TextWork {
  return deferred(value, () => {
    return record("TirProtocolStep", [
      field("role", text(value.role)),
      field("operation", textTypedOperation(value.operation)),
      field("callee", (value.callee === null ? token("null") : textResolvedCallee(value.callee))),
    ]);
  });
}

export function textTirRestPart(value: TirRestPart): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "value":
        return record(value.kind, [
      field("expression", numericIdentity("n", value.expression)),
    ]);
      case "spread":
        return record(value.kind, [
      field("expression", numericIdentity("n", value.expression)),
      field("tuple", (value.tuple === null ? token("null") : sequence(value.tuple, entry0 => numericIdentity("t", entry0)))),
    ]);
    }
  });
}
