// Names of contract fields and kinds that W2 has not yet published (NEEDS-W4.md, rows A, B, G). The MIR forms are
// published (S2-18) and are no longer mapped here.
// This file maps names and nothing else. It is deleted in the commit that moves the cases to the
// published names.
export const N = Object.freeze({
  // A1: OperationDecision
  execution: "execution", rvalue: "rvalue", invoke: "invoke", failure: "failure", effect: "effect",
  failureNone: "none", failureAbort: "abort", failureUnwind: "unwind", effectRead: "read", effectWrite: "write",
  // A2, A3: MemberDecision
  location: "location", direct: "direct", checked: "checked", accessor: "accessor",
  receiver: "receiver", inPlace: "in-place", reference: "reference",
  // H2: the extent of the carrier of an element access (W2's published name and values; the field lands after A1)
  extent: "extent", extentFixed: "fixed", extentMutable: "mutable",
  // A5, A6, A7: closure, rest and grown constructions
  closure: "closure", construction: "construction", append: "append",
  // A9: activation of a handle-creating call
  activation: "activation", atCreation: "at-creation", deferred: "deferred",
  // G1: the selected equality of a case clause's test
  caseTest: "test",
  // B1: ConstructionPlan
  constructionPlan: "constructionPlan", planSteps: "steps", stepBase: "base-construction",
  stepField: "field-initializer", stepBody: "constructor-body",
});
