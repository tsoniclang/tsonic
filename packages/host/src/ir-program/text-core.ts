import type { HirCallableEndpoint, HirCoreCapture, HirAttribute, HirLexicalScope, CapturedFact, HirMarkersCapture, HirPointerTypeCapture, HirPointerOperationCapture, HirAttributeCapture, HirSafetyCapture, HirArgumentPassingCapture, DeclarationTarget, ImportTarget, HirFieldMarkerCapture, HirCapturedType, HirIntegerOperandCapture, HirAddressIntegerCapture, HirSafetySelectionCapture, HirFieldBindingCapture, HirRecordBindingCapture } from "../ir-hir/contract.js";
import type { TextWork } from "./text-values.js";
import { token, text, numeric, numericIdentity, identity, field, record, sequence, deferred, boolean, textNodeRef, textSourceNodeRef, textLocalRef, textLibraryModuleIdentity } from "./text-values.js";
import { textBindingVector, textTypeComponent } from "./text-types.js";

export function textHirCallableEndpoint(value: HirCallableEndpoint): TextWork {
  return deferred(value, () => {
    return record("HirCallableEndpoint", [
      field("declaration", identity("def", value.declaration)),
      field("role", text(value.role)),
      field("signature", numericIdentity("sig", value.signature)),
      field("body", (value.body === null ? token("null") : identity("body", value.body))),
    ]);
  });
}

export function textHirCoreCapture(value: HirCoreCapture): TextWork {
  return deferred(value, () => {
    return record("HirCoreCapture", [
      field("provider", textCapturedFact(value.provider, entry0 => (entry0 === null ? token("null") : identity("def", entry0)))),
      field("markers", textCapturedFact(value.markers, entry0 => textHirMarkersCapture(entry0))),
      field("pointerType", textCapturedFact(value.pointerType, entry0 => (entry0 === null ? token("null") : textHirPointerTypeCapture(entry0)))),
      field("pointerOperation", textCapturedFact(value.pointerOperation, entry0 => (entry0 === null ? token("null") : textHirPointerOperationCapture(entry0)))),
      field("fieldBinding", textCapturedFact(value.fieldBinding, entry0 => (entry0 === null ? token("null") : textHirFieldBindingCapture(entry0)))),
      field("recordBinding", textCapturedFact(value.recordBinding, entry0 => (entry0 === null ? token("null") : textHirRecordBindingCapture(entry0)))),
      field("attribute", textCapturedFact(value.attribute, entry0 => (entry0 === null ? token("null") : textHirAttributeCapture(entry0)))),
      field("safety", textCapturedFact(value.safety, entry0 => (entry0 === null ? token("null") : textHirSafetyCapture(entry0)))),
      field("argumentPassing", textCapturedFact(value.argumentPassing, entry0 => (entry0 === null ? token("null") : textHirArgumentPassingCapture(entry0)))),
      field("flowState", textCapturedFact(value.flowState, entry0 => (entry0 === null ? token("null") : text(entry0)))),
    ]);
  });
}

export function textHirFieldBindingCapture(value: HirFieldBindingCapture): TextWork {
  return deferred(value, () => {
    return record("HirFieldBindingCapture", [
      field("occurrence", textNodeRef(value.occurrence)),
      field("bindings", textCapturedFact(value.bindings, entry0 => textBindingVector(entry0))),
      field("owner", textCapturedFact(value.owner, entry0 => numericIdentity("t", entry0))),
      field("pointee", textCapturedFact(value.pointee, entry0 => numericIdentity("t", entry0))),
      field("fieldExpression", textNodeRef(value.fieldExpression)),
      field("field", textCapturedFact(value.field, entry0 => textSourceNodeRef(entry0))),
      field("pointerExpression", textNodeRef(value.pointerExpression)),
    ]);
  });
}

export function textHirRecordBindingCapture(value: HirRecordBindingCapture): TextWork {
  return deferred(value, () => {
    return record("HirRecordBindingCapture", [
      field("occurrence", textNodeRef(value.occurrence)),
      field("bindings", textCapturedFact(value.bindings, entry0 => textBindingVector(entry0))),
      field("source", textCapturedFact(value.source, entry0 => numericIdentity("t", entry0))),
      field("layoutExpression", textNodeRef(value.layoutExpression)),
      field("layout", textCapturedFact(value.layout, entry0 => textSourceNodeRef(entry0))),
      field("fields", sequence(value.fields, entry0 => record("HirRecordFieldBindingCapture", [
        field("expression", textNodeRef(entry0.expression)),
        field("binding", textNodeRef(entry0.binding)),
      ]))),
    ]);
  });
}

export function textHirAttribute(value: HirAttribute): TextWork {
  return deferred(value, () => {
    return record("HirAttribute", [
      field("declaration", identity("def", value.declaration)),
      field("occurrence", textSourceNodeRef(value.occurrence)),
      field("arguments", sequence(value.arguments, entry0 => textSourceNodeRef(entry0))),
    ]);
  });
}

export function textHirLexicalScope(value: HirLexicalScope): TextWork {
  return deferred(value, () => {
    return record("HirLexicalScope", [
      field("node", numericIdentity("n", value.node)),
      field("parent", (value.parent === null ? token("null") : numericIdentity("n", value.parent))),
      field("attributes", sequence(value.attributes, entry0 => textHirAttribute(entry0))),
    ]);
  });
}

export function textCapturedFact<Value>(value: CapturedFact<Value>, projectValue: (value: Value) => TextWork): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "available":
        return record(value.kind, [
      field("value", projectValue(value.value)),
    ]);
      case "unavailable":
        return record(value.kind, [
      field("reason", text(value.reason)),
    ]);
    }
  });
}

export function textHirMarkersCapture(value: HirMarkersCapture): TextWork {
  return deferred(value, () => {
    const struct = value.struct;
    const defaultValue = value.defaultValue;
    return record("HirMarkersCapture", [
      field("struct", (struct === null ? token("null") : deferred(struct, () => {
  return record("Record", [
      field("valueType", boolean(struct.valueType)),
      field("fields", textCapturedFact(struct.fields, entry0 => sequence(entry0, entry1 => textHirFieldMarkerCapture(entry1)))),
    ]);
}))),
      field("field", (value.field === null ? token("null") : textHirFieldMarkerCapture(value.field))),
      field("defaultValue", (defaultValue === null ? token("null") : deferred(defaultValue, () => {
  return record("Record", [
      field("typeNode", textSourceNodeRef(defaultValue.typeNode)),
      field("type", textCapturedFact(defaultValue.type, entry0 => numericIdentity("t", entry0))),
    ]);
}))),
      field("jsString", boolean(value.jsString)),
    ]);
  });
}

export function textHirPointerTypeCapture(value: HirPointerTypeCapture): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "raw-address":
        return record(value.kind, []);
      case "typed-location":
        return record(value.kind, [
      field("pointee", textHirCapturedType(value.pointee)),
      field("mutability", text(value.mutability)),
    ]);
      case "native-pointer":
        return record(value.kind, [
      field("declaration", identity("def", value.declaration)),
    ]);
      case "function-pointer":
        return record(value.kind, [
      field("declaration", identity("def", value.declaration)),
      field("parameters", sequence(value.parameters, entry0 => textHirCapturedType(entry0))),
      field("result", textHirCapturedType(value.result)),
      field("abi", sequence(value.abi, entry0 => text(entry0))),
    ]);
    }
  });
}

export function textHirPointerOperationCapture(value: HirPointerOperationCapture): TextWork {
  return deferred(value, () => {
    switch (value.family) {
      case "typed-location":
        switch (value.operation) {
          case "address-of":
          case "allocate":
          case "load":
          case "store":
          case "equal-pointer":
          case "hash-pointer":
          case "bind-pointer":
          case "project-pointer":
            return record("HirPointerOperationCapture", [
      field("family", text(value.family)),
      field("operation", text(value.operation)),
      field("exportName", text(value.exportName)),
      field("arguments", sequence(value.arguments, entry0 => textSourceNodeRef(entry0))),
      field("typeArguments", sequence(value.typeArguments, entry0 => textSourceNodeRef(entry0))),
      field("selection", text(value.selection)),
      field("pointee", text(value.pointee)),
    ]);
          case "view":
            return record("HirPointerOperationCapture", [
      field("family", text(value.family)),
      field("operation", text(value.operation)),
      field("pointer", textSourceNodeRef(value.pointer)),
      field("read", textSourceNodeRef(value.read)),
      field("write", textSourceNodeRef(value.write)),
      field("optional", boolean(value.optional)),
    ]);
        }
      case "native-pointer":
        switch (value.operation) {
          case "load":
            return record("HirPointerOperationCapture", [
      field("family", text(value.family)),
      field("operation", text(value.operation)),
      field("pointer", textSourceNodeRef(value.pointer)),
    ]);
          case "store":
            return record("HirPointerOperationCapture", [
      field("family", text(value.family)),
      field("operation", text(value.operation)),
      field("pointer", textSourceNodeRef(value.pointer)),
      field("value", textSourceNodeRef(value.value)),
    ]);
          case "offset":
            return record("HirPointerOperationCapture", [
      field("family", text(value.family)),
      field("operation", text(value.operation)),
      field("pointer", textSourceNodeRef(value.pointer)),
      field("offset", textSourceNodeRef(value.offset)),
    ]);
        }
      case "raw-address":
        switch (value.operation) {
          case "bind-raw-pointer":
            return record("HirPointerOperationCapture", [
      field("family", text(value.family)),
      field("operation", text(value.operation)),
      field("identity", textSourceNodeRef(value.identity)),
    ]);
          case "equal-raw-pointer":
            return record("HirPointerOperationCapture", [
      field("family", text(value.family)),
      field("operation", text(value.operation)),
      field("left", textSourceNodeRef(value.left)),
      field("right", textSourceNodeRef(value.right)),
    ]);
          case "hash-raw-pointer":
            return record("HirPointerOperationCapture", [
      field("family", text(value.family)),
      field("operation", text(value.operation)),
      field("pointer", textSourceNodeRef(value.pointer)),
    ]);
        }
      case "raw-memory":
        switch (value.operation) {
          case "to-raw":
            return record("HirPointerOperationCapture", [
      field("family", text(value.family)),
      field("operation", text(value.operation)),
      field("pointer", textSourceNodeRef(value.pointer)),
      field("layout", textSourceNodeRef(value.layout)),
    ]);
          case "reinterpret":
            return record("HirPointerOperationCapture", [
      field("family", text(value.family)),
      field("operation", text(value.operation)),
      field("raw", textSourceNodeRef(value.raw)),
      field("layout", textSourceNodeRef(value.layout)),
    ]);
          case "byte-offset":
            return record("HirPointerOperationCapture", [
      field("family", text(value.family)),
      field("operation", text(value.operation)),
      field("raw", textSourceNodeRef(value.raw)),
      field("offset", textSourceNodeRef(value.offset)),
      field("integer", textHirIntegerOperandCapture(value.integer)),
      field("dataLayout", textSourceNodeRef(value.dataLayout)),
    ]);
          case "raw-to-address-integer":
            return record("HirPointerOperationCapture", [
      field("family", text(value.family)),
      field("operation", text(value.operation)),
      field("raw", textSourceNodeRef(value.raw)),
      field("integer", textHirAddressIntegerCapture(value.integer)),
      field("dataLayout", textSourceNodeRef(value.dataLayout)),
    ]);
          case "address-integer-to-raw":
            return record("HirPointerOperationCapture", [
      field("family", text(value.family)),
      field("operation", text(value.operation)),
      field("address", textSourceNodeRef(value.address)),
      field("integer", textHirAddressIntegerCapture(value.integer)),
      field("dataLayout", textSourceNodeRef(value.dataLayout)),
    ]);
        }
      case "keep-alive":
        return record("HirPointerOperationCapture", [
      field("family", text(value.family)),
      field("operation", text(value.operation)),
      field("value", textSourceNodeRef(value.value)),
    ]);
    }
  });
}

export function textHirAttributeCapture(value: HirAttributeCapture): TextWork {
  return deferred(value, () => {
    const selectedMember = value.selectedMember;
    switch (value.kind) {
      case "builder-state":
        return record(value.kind, [
      field("occurrence", textSourceNodeRef(value.occurrence)),
      field("applicationTarget", textSourceNodeRef(value.applicationTarget)),
      field("selectedMember", (selectedMember === null ? token("null") : deferred(selectedMember, () => {
  return record("Record", [
      field("selectedDeclaration", (selectedMember.selectedDeclaration === null ? token("null") : textSourceNodeRef(selectedMember.selectedDeclaration))),
      field("declarations", sequence(selectedMember.declarations, entry0 => textSourceNodeRef(entry0))),
    ]);
}))),
      field("applicationMemberKind", (value.applicationMemberKind === null ? token("null") : text(value.applicationMemberKind))),
      field("applicationPlacement", (value.applicationPlacement === null ? token("null") : text(value.applicationPlacement))),
      field("applicationParameterName", (value.applicationParameterName === null ? token("null") : text(value.applicationParameterName))),
      field("applicationTargetSpecifier", (value.applicationTargetSpecifier === null ? token("null") : text(value.applicationTargetSpecifier))),
    ]);
      case "application":
        return record(value.kind, [
      field("occurrence", textSourceNodeRef(value.occurrence)),
      field("applicationTarget", textSourceNodeRef(value.applicationTarget)),
      field("selectedMember", (selectedMember === null ? token("null") : deferred(selectedMember, () => {
  return record("Record", [
      field("selectedDeclaration", (selectedMember.selectedDeclaration === null ? token("null") : textSourceNodeRef(selectedMember.selectedDeclaration))),
      field("declarations", sequence(selectedMember.declarations, entry0 => textSourceNodeRef(entry0))),
    ]);
}))),
      field("applicationMemberKind", (value.applicationMemberKind === null ? token("null") : text(value.applicationMemberKind))),
      field("applicationPlacement", (value.applicationPlacement === null ? token("null") : text(value.applicationPlacement))),
      field("applicationParameterName", (value.applicationParameterName === null ? token("null") : text(value.applicationParameterName))),
      field("applicationTargetSpecifier", (value.applicationTargetSpecifier === null ? token("null") : text(value.applicationTargetSpecifier))),
      field("invocation", textSourceNodeRef(value.invocation)),
    ]);
    }
  });
}

export function textHirSafetyCapture(value: HirSafetyCapture): TextWork {
  return deferred(value, () => {
    switch (value.family) {
      case "unsafe-context":
        switch (value.operation) {
          case "expression":
            return record("HirSafetyCapture", [
      field("occurrence", textSourceNodeRef(value.occurrence)),
      field("provider", identity("def", value.provider)),
      field("family", text(value.family)),
      field("operation", text(value.operation)),
      field("expression", textSourceNodeRef(value.expression)),
    ]);
          case "remaining-block":
            return record("HirSafetyCapture", [
      field("occurrence", textSourceNodeRef(value.occurrence)),
      field("provider", identity("def", value.provider)),
      field("family", text(value.family)),
      field("operation", text(value.operation)),
      field("firstDirectStatement", boolean(value.firstDirectStatement)),
    ]);
        }
      case "safety":
        switch (value.operation) {
          case "root":
            return record("HirSafetyCapture", [
      field("occurrence", textSourceNodeRef(value.occurrence)),
      field("provider", identity("def", value.provider)),
      field("family", text(value.family)),
      field("operation", text(value.operation)),
      field("form", text(value.form)),
      field("target", (value.target === null ? token("null") : textSourceNodeRef(value.target))),
    ]);
          case "select-member":
            return record("HirSafetyCapture", [
      field("occurrence", textSourceNodeRef(value.occurrence)),
      field("provider", identity("def", value.provider)),
      field("family", text(value.family)),
      field("operation", text(value.operation)),
      field("predecessor", (value.predecessor === null ? token("null") : textSourceNodeRef(value.predecessor))),
      field("memberKind", text(value.memberKind)),
      field("selection", textHirSafetySelectionCapture(value.selection)),
    ]);
          case "placement":
            return record("HirSafetyCapture", [
      field("occurrence", textSourceNodeRef(value.occurrence)),
      field("provider", identity("def", value.provider)),
      field("family", text(value.family)),
      field("operation", text(value.operation)),
      field("predecessor", (value.predecessor === null ? token("null") : textSourceNodeRef(value.predecessor))),
      field("placement", text(value.placement)),
    ]);
          case "apply":
            return record("HirSafetyCapture", [
      field("occurrence", textSourceNodeRef(value.occurrence)),
      field("provider", identity("def", value.provider)),
      field("family", text(value.family)),
      field("operation", text(value.operation)),
      field("predecessor", (value.predecessor === null ? token("null") : textSourceNodeRef(value.predecessor))),
      field("contract", text(value.contract)),
    ]);
        }
    }
  });
}

export function textHirArgumentPassingCapture(value: HirArgumentPassingCapture): TextWork {
  return deferred(value, () => {
    switch (value.role) {
      case "declaration":
        return record("HirArgumentPassingCapture", [
      field("role", text(value.role)),
      field("mode", text(value.mode)),
    ]);
      case "argument":
        return record("HirArgumentPassingCapture", [
      field("role", text(value.role)),
      field("mode", text(value.mode)),
      field("storageExpression", textSourceNodeRef(value.storageExpression)),
    ]);
    }
  });
}

export function textDeclarationTarget(value: DeclarationTarget): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "local":
        return record(value.kind, [
      field("local", textLocalRef(value.local)),
    ]);
      case "definition":
        return record(value.kind, [
      field("definition", identity("def", value.definition)),
    ]);
    }
  });
}

export function textImportTarget(value: ImportTarget): TextWork {
  return deferred(value, () => {
    switch (value.target) {
      case "project":
        return record("ImportTarget", [
      field("target", text(value.target)),
      field("module", identity("mod", value.module)),
    ]);
      case "library":
        return record("ImportTarget", [
      field("target", text(value.target)),
      field("module", textLibraryModuleIdentity(value.module)),
    ]);
    }
  });
}

export function textHirFieldMarkerCapture(value: HirFieldMarkerCapture): TextWork {
  return deferred(value, () => {
    return record("HirFieldMarkerCapture", [
      field("name", text(value.name)),
      field("typeNode", textSourceNodeRef(value.typeNode)),
      field("type", textCapturedFact(value.type, entry0 => numericIdentity("t", entry0))),
      field("readonly", boolean(value.readonly)),
    ]);
  });
}

export function textHirCapturedType(value: HirCapturedType): TextWork {
  return deferred(value, () => {
    return record("HirCapturedType", [
      field("type", textCapturedFact(value.type, entry0 => numericIdentity("t", entry0))),
      field("component", textTypeComponent(value.component)),
    ]);
  });
}

export function textHirIntegerOperandCapture(value: HirIntegerOperandCapture): TextWork {
  return deferred(value, () => {
    return record("HirIntegerOperandCapture", [
      field("runtimeBase", text(value.runtimeBase)),
      field("signedness", text(value.signedness)),
      field("width", numeric(value.width)),
    ]);
  });
}

export function textHirAddressIntegerCapture(value: HirAddressIntegerCapture): TextWork {
  return deferred(value, () => {
    switch (value.width) {
      case 32:
        return record("HirAddressIntegerCapture", [
      field("width", numeric(value.width)),
      field("runtimeBase", text(value.runtimeBase)),
      field("signedness", text(value.signedness)),
    ]);
      case 64:
        return record("HirAddressIntegerCapture", [
      field("width", numeric(value.width)),
      field("runtimeBase", text(value.runtimeBase)),
      field("signedness", text(value.signedness)),
    ]);
    }
  });
}

export function textHirSafetySelectionCapture(value: HirSafetySelectionCapture): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "selected":
        return record(value.kind, [
      field("expression", textSourceNodeRef(value.expression)),
      field("declaration", (value.declaration === null ? token("null") : textSourceNodeRef(value.declaration))),
      field("declarations", sequence(value.declarations, entry0 => textSourceNodeRef(entry0))),
    ]);
      case "unavailable":
        return record(value.kind, [
      field("reason", text(value.reason)),
    ]);
    }
  });
}
