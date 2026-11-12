import { encodeKey } from "../ids/index.js";
import type { TyId, SigId, SourceNodeRef } from "../ids/contract.js";
import type { MessageArgument, Violation } from "../diag/contract.js";
import type { VerifyTypes, TypeRule, TypeSite, ExactRational, TypeTerm, TypeBinding, TypeParameterIdentity,
  MemberOrigin, TypeEvidence, TypeVerificationInput, TypeComponent, ConstructionDefinition, Signature,
  ComponentSelector, SumFamily, CategoryEvidence, BindingVerificationInput } from "./contract.js";
import { typeIdentifier, signatureIdentifier, compareText } from "./value.js";
import { memberKeyText, originText, typeText } from "./print.js";

type Add = (rule: TypeRule, site: TypeSite, field: string, value?: number) => void;

function validReference(value: number, length: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0) && value < length;
}

function parameterKey(value: TypeParameterIdentity): string {
  return encodeKey([value.owner, value.index]);
}

function rationalNormalized(value: ExactRational): boolean {
  if (value.denominator <= 0n || value.negativeZero && value.numerator !== 0n) return false;
  let numerator = value.numerator < 0n ? -value.numerator : value.numerator;
  let denominator = value.denominator;
  while (denominator !== 0n) { const remainder = numerator % denominator; numerator = denominator; denominator = remainder; }
  return numerator === 1n && (value.numerator !== 0n || value.denominator === 1n);
}

interface Checks {
  readonly input: TypeVerificationInput;
  readonly add: Add;
  readonly type: (value: TyId, site: TypeSite) => void;
  readonly signature: (value: SigId, site: TypeSite) => void;
}

function vector<Value>(values: readonly Value[], rule: TypeRule, site: TypeSite, field: string, checks: Checks,
  inspect: (value: Value) => void): void {
  for (const [position, value] of values.entries()) {
    if (value === undefined) checks.add(rule, site, field, position);
    else inspect(value);
  }
}

function qualified(value: SourceNodeRef, rule: TypeRule, site: TypeSite, field: string, checks: Checks): void {
  if (!checks.input.nodeExists(value)) checks.add(rule, site, field);
}

function memberOrigin(value: MemberOrigin, site: TypeSite, checks: Checks): void {
  if (value.kind !== "mapped") return;
  qualified(value.owner, "cross-owner-qualified", site, "origin.owner", checks);
  if (value.key.kind === "number" && !rationalNormalized(value.key.value)) checks.add("rational-normalized", site, "origin.key");
}

function construction(value: ConstructionDefinition, site: TypeSite, checks: Checks): void {
  qualified({ kind: "body", value: value.occurrence }, "construction-captures-qualified", site, "definition.occurrence", checks);
  for (const [position, capture] of value.captures.entries()) {
    if (capture === undefined || capture.body !== value.occurrence.body || !checks.input.localExists(capture))
      checks.add("construction-captures-qualified", site, "definition.captures", position);
  }
}

interface InlinePath { readonly parent: InlinePath | null; readonly part: string }
type ComponentValue = { readonly kind: "component"; readonly value: TypeComponent }
  | { readonly kind: "selector"; readonly value: ComponentSelector }
  | { readonly kind: "family"; readonly value: SumFamily };
type ComponentWork = { readonly kind: "enter"; readonly data: ComponentValue; readonly path: InlinePath }
  | { readonly kind: "leave"; readonly value: object } | { readonly kind: "missing"; readonly position: number };

function enterInline(onPath: Set<object>, value: object, path: InlinePath): void {
  if (onPath.has(value)) {
    const parts: string[] = [];
    for (let selected: InlinePath | null = path; selected !== null; selected = selected.parent) parts.push(selected.part);
    throw new TypeError(`Inline cycle at $${parts.reverse().join("")}`);
  }
  onPath.add(value);
}

function component(root: TypeComponent, site: TypeSite, checks: Checks, path: InlinePath): void {
  const work: ComponentWork[] = [{ kind: "enter", data: { kind: "component", value: root }, path }];
  const onPath = new Set<object>();
  let selected: ComponentWork | undefined;
  while ((selected = work.pop()) !== undefined) {
    if (selected.kind === "leave") { onPath.delete(selected.value); continue; }
    if (selected.kind === "missing") { checks.add("projection-owner", site, "component.path", selected.position); continue; }
    const { data, path } = selected;
    enterInline(onPath, data.value, path);
    work.push({ kind: "leave", value: data.value });
    if (data.kind === "component") {
      qualified(data.value.root, "projection-owner", site, "component.root", checks);
      for (let position = data.value.path.length - 1; position >= 0; position -= 1) {
        const value = data.value.path[position];
        if (value === undefined) work.push({ kind: "missing", position });
        else work.push({ kind: "enter", data: { kind: "selector", value },
          path: { parent: path, part: `.path[${position}]` } });
      }
    } else if (data.kind === "selector") {
      const selector = data.value;
      switch (selector.kind) {
        case "parameter": case "receiver": case "signature-tail": case "result": checks.signature(selector.signature, site); break;
        case "construction-argument": construction(selector.definition, site, checks); break;
        case "member": memberOrigin(selector.origin, site, checks); break;
        case "sum-arm": work.push({ kind: "enter", data: { kind: "family", value: selector.family },
          path: { parent: path, part: ".family" } }); break;
      }
    } else {
      const family = data.value;
      const identities = new Set<string>();
      for (const [index, parameter] of family.parameters.entries()) {
        if (parameter === undefined) { checks.add("parameter-identity", site, "family.parameters", index); continue; }
        const key = parameterKey(parameter);
        if (!Number.isSafeInteger(parameter.index) || parameter.index < 0 || Object.is(parameter.index, -0) || identities.has(key))
          checks.add("parameter-identity", site, "family.parameters", index);
        identities.add(key);
      }
      for (const [index, role] of family.roles.entries()) {
        if (role === undefined) { checks.add("sum-arm-order", site, "family.roles", index); continue; }
        if (!Object.is(role.authoredIndex, index)) checks.add("sum-arm-order", site, "family.roles.authoredIndex", role.authoredIndex);
        qualified(role.component, "cross-owner-qualified", site, "family.roles.component", checks);
        checks.type(role.member, site);
      }
      work.push({ kind: "enter", data: { kind: "component", value: family.component }, path: { parent: path, part: ".component" } });
    }
  }
}

function category(root: CategoryEvidence, site: TypeSite, checks: Checks, path: InlinePath): void {
  type Work = { readonly kind: "enter"; readonly value: CategoryEvidence; readonly path: InlinePath }
    | { readonly kind: "leave"; readonly value: object } | { readonly kind: "missing"; readonly position: number };
  const work: Work[] = [{ kind: "enter", value: root, path }];
  const onPath = new Set<object>();
  let selected: Work | undefined;
  while ((selected = work.pop()) !== undefined) {
    if (selected.kind === "leave") { onPath.delete(selected.value); continue; }
    if (selected.kind === "missing") { checks.add("evidence-type", site, "category.alternatives", selected.position); continue; }
    enterInline(onPath, selected.value, selected.path);
    work.push({ kind: "leave", value: selected.value });
    if (selected.value.kind === "choice") for (let position = selected.value.alternatives.length - 1; position >= 0; position -= 1) {
      const value = selected.value.alternatives[position];
      if (value === undefined) work.push({ kind: "missing", position });
      else work.push({ kind: "enter", value, path: { parent: selected.path, part: `.alternatives[${position}]` } });
    }
  }
}

function termReferences(value: TypeTerm, site: TypeSite, checks: Checks, path: InlinePath): void {
  const types = (values: readonly TyId[], field: string): void => vector(values, "type-reference", site, field, checks, type => checks.type(type, site));
  const signatures = (values: readonly SigId[], field: string): void => vector(values, "signature-reference", site, field, checks, signature => checks.signature(signature, site));
  switch (value.kind) {
    case "literal": checks.type(value.base, site); break;
    case "union": case "intersection": types(value.members, "members"); break;
    case "optional": checks.type(value.value, site); break;
    case "array": case "fixed-array": checks.type(value.element, site); break;
    case "tuple":
      for (const element of value.elements) if (element !== undefined) checks.type(element.type, site);
      break;
    case "shape":
      for (const member of value.members) if (member !== undefined) {
        if (member.read !== null) checks.type(member.read, site);
        if (member.write !== null) checks.type(member.write, site);
        for (const origins of [member.origins, member.readOrigins, member.writeOrigins])
          vector(origins, "member-origins", site, "members.origins", checks, origin => memberOrigin(origin, site, checks));
      }
      for (const index of value.indexes) if (index !== undefined) {
        checks.type(index.key, site); checks.type(index.read, site);
        if (index.write !== null) checks.type(index.write, site);
      }
      signatures(value.calls, "calls"); signatures(value.constructs, "constructs"); break;
    case "callable": signatures(value.calls, "calls"); signatures(value.constructs, "constructs"); break;
    case "declared": types(value.arguments, "arguments"); break;
    case "construction-reference": types(value.arguments, "arguments"); construction(value.definition, site, checks); break;
    case "projection":
      checks.type(value.source, site);
      if (value.projection.kind === "component") component(value.projection.component, site, checks,
        { parent: path, part: ".projection.component" });
      break;
  }
}

function signatureReferences(value: Signature, site: TypeSite, checks: Checks): void {
  if (value.owner !== null) qualified(value.owner, "cross-owner-qualified", site, "owner", checks);
  if (value.composition !== null) vector(value.composition.signatures, "signature-reference", site, "composition.signatures", checks,
    signature => checks.signature(signature, site));
  for (const parameter of value.typeParameters) if (parameter !== undefined) {
    if (parameter.constraint !== null) checks.type(parameter.constraint, site);
    if (parameter.default !== null) checks.type(parameter.default, site);
  }
  if (value.receiver !== null) checks.type(value.receiver, site);
  for (const parameter of value.parameters) if (parameter !== undefined) checks.type(parameter.type, site);
  checks.type(value.result, site);
}

function increasing(values: readonly number[]): boolean {
  let previous = -1;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0) || value <= previous) return false;
    previous = value;
  }
  return true;
}

function originsValid(origins: readonly MemberOrigin[], read: readonly MemberOrigin[], write: readonly MemberOrigin[]): boolean {
  const keys = new Set(origins.map(value => originText(value)));
  const readKeys = read.map(value => originText(value));
  const writeKeys = write.map(value => originText(value));
  return keys.size > 0 && keys.size === origins.length
    && new Set(readKeys).size === read.length && new Set(writeKeys).size === write.length
    && readKeys.every(origin => keys.has(origin)) && writeKeys.every(origin => keys.has(origin));
}

function verifyBindings(bindings: readonly BindingVerificationInput[], typeCount: number, add: Add): void {
  for (const [vectorIndex, entry] of bindings.entries()) {
    if (entry === undefined) {
      add("binding-vector-complete", { kind: "binding", vector: vectorIndex, family: null, position: null }, "bindings", vectorIndex);
      continue;
    }
    const { vector, scope } = entry;
    const families: readonly (readonly ["classBindings" | "methodBindings" | "capturedBindings", readonly TypeBinding[], readonly TypeParameterIdentity[]])[] = [
      ["classBindings", vector.classBindings, scope.classParameters], ["methodBindings", vector.methodBindings, scope.methodParameters],
      ["capturedBindings", vector.capturedBindings, scope.capturedParameters],
    ];
    for (const [family, actual, expected] of families) {
      if (actual.length !== expected.length) add("binding-vector-complete", { kind: "binding", vector: vectorIndex, family, position: null }, "length", actual.length);
      for (const [position, binding] of actual.entries()) {
        const site: TypeSite = { kind: "binding", vector: vectorIndex, family, position };
        const selected = expected[position];
        if (binding === undefined) { add("binding-vector-complete", site, "entry"); continue; }
        if (position < expected.length && (selected === undefined || parameterKey(binding.parameter) !== parameterKey(selected)))
          add("binding-vector-complete", site, "parameter");
        if (binding.kind === "bound" && !validReference(binding.type, typeCount)) add("type-reference", site, "type", binding.type);
      }
    }
    const family = "selfBindings";
    if (vector.selfBindings.length !== scope.selfOwners.length)
      add("binding-vector-complete", { kind: "binding", vector: vectorIndex, family, position: null }, "length", vector.selfBindings.length);
    const owners = new Set(scope.selfOwners);
    const seen = new Set<string>();
    for (const [position, binding] of vector.selfBindings.entries()) {
      const site: TypeSite = { kind: "binding", vector: vectorIndex, family, position };
      if (binding === undefined) { add("binding-vector-complete", site, "entry"); continue; }
      if (!owners.has(binding.owner) || seen.has(binding.owner)) add("self-owner", site, "owner");
      if (scope.selfOwners[position] !== undefined && binding.owner !== scope.selfOwners[position]) add("self-binding-order", site, "owner");
      if (binding.kind === "bound" && !validReference(binding.type, typeCount)) add("type-reference", site, "type", binding.type);
      seen.add(binding.owner);
    }
  }
}

function verifyEvidence(evidence: readonly TypeEvidence[], terms: readonly TypeTerm[], checks: Checks): void {
  const { add } = checks;
  for (const [position, value] of evidence.entries()) {
    if (value === undefined) {
      add("evidence-type", { kind: "evidence", position, source: null }, "evidence", position);
      continue;
    }
    const site: TypeSite = { kind: "evidence", position, source: value.component };
    const path: InlinePath = { parent: null, part: `.evidence[${position}]` };
    category(value.category, site, checks, { parent: path, part: ".category" });
    qualified(value.component, "cross-owner-qualified", site, "component", checks);
    const reference = (type: TyId, field: string): void => {
      if (!validReference(type, terms.length)) add("type-reference", site, field, type);
    };
    reference(value.type, "type");
    const term = validReference(value.type, terms.length) ? terms[value.type] : undefined;
    if (value.nominal !== null && term !== undefined
      && (term.kind !== "declared" && term.kind !== "enum" || value.nominal !== term.definition))
      add("evidence-type", site, "nominal");
    if (value.numeric !== null) {
      category(value.numeric.category, site, checks, { parent: path, part: ".numeric.category" });
      qualified({ kind: "body", value: value.numeric.producer }, "cross-owner-qualified", site, "numeric.producer", checks);
      if (value.numeric.kind === "literal" && value.numeric.authored === null) add("evidence-type", site, "numeric.authored");
      if (value.numeric.category.kind === "known" && value.category.kind === "known"
        && value.numeric.category.category !== value.category.category) add("evidence-type", site, "numeric.category");
      const authored = value.numeric.authored;
      if (authored !== null && authored.kind !== "number" && authored.kind !== "bigint") add("evidence-type", site, "numeric.authored.kind");
      if (authored?.kind === "number" && !rationalNormalized(authored.value)) add("rational-normalized", site, "numeric.authored.value");
      if (authored !== null && term?.kind === "literal" && typeText({ kind: "literal", value: authored, base: term.base }) !== typeText(term))
        add("literal-value-exact", site, "numeric.authored.value");
    }
    if (value.pointer?.kind === "typed-location") reference(value.pointer.pointee, "pointer.pointee");
    else if (value.pointer?.kind === "function-pointer") {
      vector(value.pointer.parameters, "type-reference", site, "pointer.parameters", checks, parameter => reference(parameter, "pointer.parameters"));
      reference(value.pointer.result, "pointer.result");
    }
    const sum = value.sum;
    if (sum !== null) {
      qualified(sum.component, "cross-owner-qualified", site, "sum.component", checks);
      let index = 0;
      for (const arm of sum.arms) {
        if (arm === undefined) { add("sum-arm-order", site, "sum.arms", index); index += 1; continue; }
        qualified(arm.component, "cross-owner-qualified", site, "sum.arms.component", checks);
        if (!Object.is(arm.authoredIndex, index)) add("sum-arm-order", site, "sum.arms.authoredIndex", arm.authoredIndex);
        reference(arm.member, "sum.arms.member");
        index += 1;
      }
    }
  }
}

export const verifyTypes: VerifyTypes = input => {
  const violations: Violation<TypeRule, TypeSite>[] = [];
  const add: Add = (rule, site, field, value) => {
    const detail: MessageArgument[] = [{ kind: "text", value: field }];
    if (value !== undefined) detail.push({ kind: "number", value });
    violations.push(({ rule, site: (site), detail: (detail.map(argument => (argument))) }));
  };
  const { table } = input;
  const typeOf = (value: TyId, site: TypeSite): TyId => {
    if (!validReference(value, table.terms.length)) add("type-reference", site, "reference", value);
    return value;
  };
  const signatureOf = (value: SigId, site: TypeSite): SigId => {
    if (!validReference(value, table.signatures.length)) add("signature-reference", site, "reference", value);
    return value;
  };
  const checks: Checks = { input, add, type: typeOf, signature: signatureOf };
  for (const [position, value] of table.terms.entries()) {
    const site: TypeSite = { kind: "type", type: typeIdentifier(position) };
    if (value === undefined) { add("type-reference", site, "terms", position); continue; }
    termReferences(value, site, checks, { parent: null, part: `.table.terms[${position}]` });
    if (value.kind === "declared" || value.kind === "enum") {
      const nominal = input.nominalOf(value.definition);
      if (nominal === null || nominal.kind !== value.kind || value.kind === "declared" && !nominal.facets.includes(value.facet))
        add("nominal-definition", site, "definition");
    }
    if (value.kind === "param" && (!Number.isSafeInteger(value.parameter.index) || value.parameter.index < 0 || Object.is(value.parameter.index, -0)))
      add("parameter-identity", site, "parameter.index", value.parameter.index);
    if (value.kind === "union" || value.kind === "intersection") {
      if (value.members.length < 2 || !increasing(value.members)
        || value.members.some(member => table.terms[member]?.kind === value.kind))
        add(value.kind === "union" ? "union-order" : "intersection-order", site, "members");
    } else if (value.kind === "tuple") {
      let rest = false;
      let optional = false;
      for (const [index, element] of value.elements.entries()) {
        if (element === undefined) { add("tuple-rest-order", site, "elements", index); continue; }
        if (rest || element.kind === "required" && optional) add("tuple-rest-order", site, "elements", index);
        if (element.kind === "rest") rest = true;
        else if (element.kind === "optional") optional = true;
      }
    } else if (value.kind === "literal") {
      if (value.value.kind === "number" && !rationalNormalized(value.value.value)) add("rational-normalized", site, "value");
    } else if (value.kind === "shape") {
      let previous: string | null = null;
      for (const [index, member] of value.members.entries()) {
        if (member === undefined) { add("member-order", site, "members", index); continue; }
        const key = memberKeyText(member.key);
        if (previous !== null && compareText(previous, key) >= 0) add("member-order", site, "members", index);
        previous = key;
        if (!originsValid(member.origins, member.readOrigins, member.writeOrigins)) add("member-origins", site, "members.origins", index);
        if (member.key.kind === "number" && !rationalNormalized(member.key.value)) add("rational-normalized", site, "members.key", index);
      }
      let previousDeclaration: string | null = null;
      for (const [index, entry] of value.indexes.entries()) {
        if (entry === undefined) { add("index-order", site, "indexes", index); continue; }
        if (previousDeclaration !== null && compareText(previousDeclaration, entry.declaration) >= 0) add("index-order", site, "indexes", index);
        previousDeclaration = entry.declaration;
      }
    }
    if (value.kind === "fixed-array" || value.kind === "declared" && value.extent !== null) {
      if (value.extent !== null && value.extent.length < 0n) add("extent-exact", site, "extent.length");
    }
    if (value.kind === "shape" || value.kind === "callable") {
      if (!increasing(value.calls) || value.calls.some(signature => table.signatures[signature]?.kind === "construct"))
        add("signature-order", site, "calls");
      if (!increasing(value.constructs) || value.constructs.some(signature => table.signatures[signature]?.kind === "call"))
        add("signature-order", site, "constructs");
    }
  }
  for (const [position, value] of table.signatures.entries()) {
    const site: TypeSite = { kind: "signature", signature: signatureIdentifier(position) };
    if (value === undefined) { add("signature-reference", site, "signatures", position); continue; }
    if (!Object.is(value.id, position)) add("signature-order", site, "id", value.id);
    if (value.composition !== null && !increasing(value.composition.signatures)) add("signature-order", site, "composition.signatures");
    signatureReferences(value, site, checks);
    const owners = new Set<string>();
    const declarations = new Set<string>();
    for (const [index, parameter] of value.typeParameters.entries()) {
      if (parameter === undefined) { add("parameter-identity", site, "typeParameters", index); continue; }
      const key = parameterKey(parameter.identity);
      if (!Object.is(parameter.identity.index, index) || owners.has(key) || declarations.has(parameter.declaration))
        add("parameter-identity", site, "typeParameters", index);
      owners.add(key); declarations.add(parameter.declaration);
    }
    let rest = false;
    let optional = false;
    for (const [index, parameter] of value.parameters.entries()) {
      if (parameter === undefined) { add("parameter-order", site, "parameters", index); continue; }
      if (rest || parameter.kind === "required" && optional || (parameter.kind === "default") !== (parameter.initializer !== null))
        add("parameter-order", site, "parameters", index);
      if (parameter.kind === "rest") rest = true;
      if (parameter.kind === "optional") optional = true;
    }
  }
  verifyBindings(input.bindings, table.terms.length, add);
  verifyEvidence(input.evidence, table.terms, checks);
  return (violations);
};
