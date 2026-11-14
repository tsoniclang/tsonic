// Names of contract fields that are not published yet. Every other name the fixtures use is the published one
// (the decision records of S2-11 and S2-9, the MIR forms of S2-18). This file maps names and nothing else; an entry
// is deleted in the commit that publishes its name, and the file with its last entry.
export const N = {
  // The extent of the carrier of an element access: `extent: "fixed" | "mutable"` on the element arm of the access
  // decision. Waits for the decision-shape commit (extent with E1; NEEDS-W4 H2).
  extent: "extent", extentFixed: "fixed", extentMutable: "mutable",
  // The selected equality of a case clause's test (G1). Waits for the same commit.
  caseTest: "test",
  // The class-owned ConstructionPlan and its steps (B1). Waits for the typed-body side of the implicit-construction
  // root (S2-15, W2).
  constructionPlan: "constructionPlan", planSteps: "steps", stepBase: "base-construction",
  stepField: "field-initializer", stepBody: "constructor-body",
};
