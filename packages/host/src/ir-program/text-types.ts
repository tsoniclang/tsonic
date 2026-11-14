import type { BindingVector, BodyInstance, Execution, DeclaredExecution, ConstValue, TypeEvidence, TypeComponent, TypeParameter, TypeBinding, SelfBinding, ArtifactBindings, ExactRational, CategoryEvidence, NumericEvidence, SumEvidence, PointerEvidence, ComponentSelector, TypeParameterIdentity, MemberKey, MemberOrigin, LiteralValue, SumArmRole, ConstructionDefinition, SumFamily } from "../ir-types/contract.js";
import type { TextWork } from "./text-values.js";
import type { ConstantReference } from "../ir-types/contract.js";
import { token, text, numeric, numericIdentity, identity, field, record, sequence, deferred, boolean, integer, textSourceNodeRef, textNodeRef, textLocalRef } from "./text-values.js";

export function textBindingVector(value: BindingVector): TextWork {
  return deferred(value, () => {
    return record("BindingVector", [
      field("classBindings", sequence(value.classBindings, entry0 => textTypeBinding(entry0))),
      field("methodBindings", sequence(value.methodBindings, entry0 => textTypeBinding(entry0))),
      field("capturedBindings", sequence(value.capturedBindings, entry0 => textTypeBinding(entry0))),
      field("selfBindings", sequence(value.selfBindings, entry0 => textSelfBinding(entry0))),
    ]);
  });
}

export function textBodyInstance(value: BodyInstance): TextWork {
  return deferred(value, () => {
    return record("BodyInstance", [
      field("body", identity("body", value.body)),
      field("bindings", textArtifactBindings(value.bindings)),
    ]);
  });
}

export function textExecution(value: Execution): TextWork {
  return deferred(value, () => record("Execution", [
    field("instance", textBodyInstance(value.instance)),
    field("provided", numeric(value.provided)),
  ]));
}

export function textConstantReference(value: ConstantReference): TextWork {
  return deferred(value, () => record("ConstantReference", [
    field("initializer", textBodyInstance(value.initializer)), field("context", text(value.context)),
  ]));
}

export function textDeclaredExecution(value: DeclaredExecution): TextWork {
  return deferred(value, () => record("DeclaredExecution", [
    field("request", record("SignatureRequest", [
      field("definition", identity("def", value.request.definition)),
      field("endpoint", text(value.request.endpoint)),
      field("ordinal", numeric(value.request.ordinal)),
      field("bindings", textArtifactBindings(value.request.bindings)),
    ])),
    field("provided", numeric(value.provided)),
  ]));
}

export function textConstValue(value: ConstValue): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "number":
        return record(value.kind, [
      field("type", numericIdentity("t", value.type)),
      field("value", textExactRational(value.value)),
    ]);
      case "bigint":
        return record(value.kind, [
      field("type", numericIdentity("t", value.type)),
      field("value", integer(value.value)),
    ]);
      case "string":
        return record(value.kind, [
      field("type", numericIdentity("t", value.type)),
      field("value", text(value.value)),
    ]);
      case "boolean":
        return record(value.kind, [
      field("type", numericIdentity("t", value.type)),
      field("value", boolean(value.value)),
    ]);
      case "absence":
        return record(value.kind, [
      field("type", numericIdentity("t", value.type)),
    ]);
      case "unique-symbol":
        return record(value.kind, [
      field("type", numericIdentity("t", value.type)),
      field("declaration", identity("def", value.declaration)),
    ]);
      case "error":
        return record(value.kind, [
      field("type", numericIdentity("t", value.type)),
    ]);
    }
  });
}

export function textTypeEvidence(value: TypeEvidence): TextWork {
  return deferred(value, () => {
    return record("TypeEvidence", [
      field("type", numericIdentity("t", value.type)),
      field("component", textSourceNodeRef(value.component)),
      field("category", textCategoryEvidence(value.category)),
      field("numeric", (value.numeric === null ? token("null") : textNumericEvidence(value.numeric))),
      field("sum", (value.sum === null ? token("null") : textSumEvidence(value.sum))),
      field("nominal", (value.nominal === null ? token("null") : identity("def", value.nominal))),
      field("pointer", (value.pointer === null ? token("null") : textPointerEvidence(value.pointer))),
    ]);
  });
}

export function textTypeComponent(value: TypeComponent): TextWork {
  return deferred(value, () => {
    return record("TypeComponent", [
      field("root", textSourceNodeRef(value.root)),
      field("path", sequence(value.path, entry0 => textComponentSelector(entry0))),
    ]);
  });
}

export function textTypeParameter(value: TypeParameter): TextWork {
  return deferred(value, () => {
    return record("TypeParameter", [
      field("identity", textTypeParameterIdentity(value.identity)),
      field("declaration", identity("def", value.declaration)),
      field("constraint", (value.constraint === null ? token("null") : numericIdentity("t", value.constraint))),
      field("default", (value.default === null ? token("null") : numericIdentity("t", value.default))),
    ]);
  });
}

export function textTypeBinding(value: TypeBinding): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "bound":
        return record(value.kind, [
      field("parameter", textTypeParameterIdentity(value.parameter)),
      field("type", numericIdentity("t", value.type)),
    ]);
      case "rigid":
        return record(value.kind, [
      field("parameter", textTypeParameterIdentity(value.parameter)),
    ]);
    }
  });
}

export function textSelfBinding(value: SelfBinding): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "bound":
        return record(value.kind, [
      field("owner", identity("def", value.owner)),
      field("type", numericIdentity("t", value.type)),
    ]);
      case "rigid":
        return record(value.kind, [
      field("owner", identity("def", value.owner)),
    ]);
    }
  });
}

export function textArtifactBindings(value: ArtifactBindings): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "parametric":
        return record(value.kind, []);
      case "instantiated":
        return record(value.kind, [
      field("bindings", textBindingVector(value.bindings)),
    ]);
    }
  });
}

export function textExactRational(value: ExactRational): TextWork {
  return deferred(value, () => {
    return record("ExactRational", [
      field("numerator", integer(value.numerator)),
      field("denominator", integer(value.denominator)),
      field("negativeZero", boolean(value.negativeZero)),
    ]);
  });
}

export function textCategoryEvidence(value: CategoryEvidence): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "known":
        return record(value.kind, [
      field("category", text(value.category)),
    ]);
      case "parameter":
        return record(value.kind, [
      field("declaration", identity("def", value.declaration)),
    ]);
      case "choice":
        return record(value.kind, [
      field("alternatives", sequence(value.alternatives, entry0 => textCategoryEvidence(entry0))),
    ]);
      case "dynamic":
        return record(value.kind, []);
    }
  });
}

export function textNumericEvidence(value: NumericEvidence): TextWork {
  return deferred(value, () => {
    return record(value.kind, [
      field("producer", textNodeRef(value.producer)),
      field("category", textCategoryEvidence(value.category)),
      field("authored", (value.authored === null ? token("null") : textLiteralValue(value.authored))),
    ]);
  });
}

export function textSumEvidence(value: SumEvidence): TextWork {
  return deferred(value, () => {
    return record(value.kind, [
      field("component", textSourceNodeRef(value.component)),
      field("bindings", textBindingVector(value.bindings)),
      field("arms", sequence(value.arms, entry0 => textSumArmRole(entry0))),
    ]);
  });
}

export function textPointerEvidence(value: PointerEvidence): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "raw-address":
        return record(value.kind, []);
      case "typed-location":
        return record(value.kind, [
      field("pointee", numericIdentity("t", value.pointee)),
      field("mutability", text(value.mutability)),
    ]);
      case "native-pointer":
        return record(value.kind, [
      field("declaration", identity("def", value.declaration)),
    ]);
      case "function-pointer":
        return record(value.kind, [
      field("declaration", identity("def", value.declaration)),
      field("parameters", sequence(value.parameters, entry0 => numericIdentity("t", entry0))),
      field("result", numericIdentity("t", value.result)),
      field("abi", sequence(value.abi, entry0 => text(entry0))),
    ]);
    }
  });
}

export function textComponentSelector(value: ComponentSelector): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "class-value":
        return record(value.kind, []);
      case "construction-argument":
        return record(value.kind, [
      field("definition", textConstructionDefinition(value.definition)),
      field("index", numeric(value.index)),
    ]);
      case "optional-value":
        return record(value.kind, []);
      case "array-element":
        return record(value.kind, []);
      case "tuple-element":
        return record(value.kind, [
      field("index", numeric(value.index)),
    ]);
      case "union-member":
      case "argument-place":
      case "parameter-place":
        return record(value.kind, [
      field("index", numeric(value.index)),
    ]);
      case "intersection-member":
        return record(value.kind, [
      field("index", numeric(value.index)),
    ]);
      case "intersection-result":
        return record(value.kind, []);
      case "argument-tail":
      case "parameter-tail":
        return record(value.kind, [
      field("start", numeric(value.start)),
    ]);
      case "member":
        return record(value.kind, [
      field("origin", textMemberOrigin(value.origin)),
    ]);
      case "index-key":
      case "index-value":
        return record(value.kind, [
      field("declaration", identity("def", value.declaration)),
    ]);
      case "projection-source":
        return record(value.kind, []);
      case "parameter":
        return record(value.kind, [
      field("signature", numericIdentity("sig", value.signature)),
      field("index", numeric(value.index)),
    ]);
      case "receiver":
        return record(value.kind, [
      field("signature", numericIdentity("sig", value.signature)),
    ]);
      case "signature-tail":
        return record(value.kind, [
      field("signature", numericIdentity("sig", value.signature)),
      field("start", numeric(value.start)),
      field("readonly", boolean(value.readonly)),
    ]);
      case "tuple-slice":
        return record(value.kind, [
      field("start", numeric(value.start)),
      field("endCount", numeric(value.endCount)),
      field("readonly", boolean(value.readonly)),
    ]);
      case "result":
        return record(value.kind, [
      field("signature", numericIdentity("sig", value.signature)),
    ]);
      case "type-argument":
        return record(value.kind, [
      field("declaration", identity("def", value.declaration)),
      field("index", numeric(value.index)),
    ]);
      case "sum-arm":
        return record(value.kind, [
      field("family", textSumFamily(value.family)),
      field("index", numeric(value.index)),
    ]);
      case "awaited":
        return record(value.kind, []);
    }
  });
}

export function textTypeParameterIdentity(value: TypeParameterIdentity): TextWork {
  return deferred(value, () => {
    return record("TypeParameterIdentity", [
      field("owner", identity("def", value.owner)),
      field("index", numeric(value.index)),
    ]);
  });
}

export function textMemberKey(value: MemberKey): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "text":
        return record(value.kind, [
      field("value", text(value.value)),
    ]);
      case "number":
        return record(value.kind, [
      field("value", textExactRational(value.value)),
    ]);
      case "symbol":
        return record(value.kind, [
      field("declaration", identity("def", value.declaration)),
    ]);
    }
  });
}

export function textMemberOrigin(value: MemberOrigin): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "declared":
        return record(value.kind, [
      field("declaration", identity("def", value.declaration)),
    ]);
      case "class-prototype":
        return record(value.kind, [
      field("owner", identity("def", value.owner)),
    ]);
      case "mapped":
        return record(value.kind, [
      field("owner", textSourceNodeRef(value.owner)),
      field("key", textMemberKey(value.key)),
    ]);
    }
  });
}

export function textLiteralValue(value: LiteralValue): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "number":
        return record(value.kind, [
      field("token", text(value.token)),
      field("value", textExactRational(value.value)),
    ]);
      case "bigint":
        return record(value.kind, [
      field("token", text(value.token)),
      field("value", integer(value.value)),
    ]);
      case "string":
        return record(value.kind, [
      field("value", text(value.value)),
    ]);
      case "boolean":
        return record(value.kind, [
      field("value", boolean(value.value)),
    ]);
      case "absence":
        return record(value.kind, []);
      case "unique-symbol":
        return record(value.kind, [
      field("declaration", identity("def", value.declaration)),
    ]);
    }
  });
}

export function textSumArmRole(value: SumArmRole): TextWork {
  return deferred(value, () => {
    return record("SumArmRole", [
      field("authoredIndex", numeric(value.authoredIndex)),
      field("component", textSourceNodeRef(value.component)),
      field("member", numericIdentity("t", value.member)),
    ]);
  });
}

export function textConstructionDefinition(value: ConstructionDefinition): TextWork {
  return deferred(value, () => {
    return record("ConstructionDefinition", [
      field("occurrence", textNodeRef(value.occurrence)),
      field("captures", sequence(value.captures, entry0 => textLocalRef(entry0))),
    ]);
  });
}

export function textSumFamily(value: SumFamily): TextWork {
  return deferred(value, () => {
    return record("SumFamily", [
      field("origin", text(value.origin)),
      field("component", textTypeComponent(value.component)),
      field("parameters", sequence(value.parameters, entry0 => textTypeParameterIdentity(entry0))),
      field("roles", sequence(value.roles, entry0 => textSumArmRole(entry0))),
    ]);
  });
}
