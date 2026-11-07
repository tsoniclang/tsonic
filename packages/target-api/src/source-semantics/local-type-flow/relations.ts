// Union relations per use (PLAN §4.3, C-2479 decision 1): every place where a closed sum meets a value, and every
// guard test, rooted in the original sum identity. One producer (R1); targets map the relation to storage and fold guards
// only from it, never rediscovering either from types.
//
//   spread write   `...xs` into an array literal or a rest parameter: the relation every written element shares
//   cast           operand -> `as T`        select-arm / extract-arm / map mode "cast"
//   test           typeof, === / == null|undefined, === literal, instanceof, discriminant member: outcome (+ arms)
//   per-arm        member read or member call on a sum receiver: the member declaration each arm selects
//   narrowed read  declared sum -> read     extract-arm (non-sum read), map mode "narrowed-read" (-1 = excluded arm)
//   write          value -> Host slot       select-arm (non-sum value; discriminant rule 05 §2a D-1..D-12), map, identity
//
// One relation per node, in the priority order above.
import type { AstReader, Node } from "@tsonic/tsts";
import { Node_Expression, Node_Initializer } from "../../source-navigation/ast.js";
import type { SourceLiteralValue } from "../literal-values-model.js";
import type {
  SourceInstantiation, SourceNullishAdmission, SourceRefusal, SourceTypeOutcome, SourceUnionRelation,
} from "../../public/source/facts.js";
import { sourceTypeDescriptorsEqual, sourceTypeDescriptorStructure, sourceTypeDescriptorTupleValue } from "./terms.js";
import type { SourceClosedSum, SourceTypeDescriptor, SourceTypeFlowSource } from "./types.js";
import type { SourceHostInput } from "../../host-input/index.js";

export interface SourceRelationInputs {
  readonly source: SourceTypeFlowSource;
  readonly input: SourceHostInput;
  type(node: Node): SourceTypeOutcome;
  /** The Host destination slot a value use flows into (values.contextual). */
  contextual(node: Node): SourceTypeOutcome | undefined;
  sumOf(type: SourceTypeDescriptor): SourceClosedSum | undefined;
  declaredSlotType(declaration: Node): SourceTypeDescriptor | undefined;
  literal(node: Node): SourceLiteralValue | undefined;
  /** The typeof-site record (A1/A7, K-2657): the one owner of every operand and arm category. */
  typeofCategory(operation: Node, operand: Node): SourceNullishAdmission | SourceRefusal;
  instantiation(use: Node): SourceInstantiation | undefined;
}

type Match = boolean | "unknown" | "refuse";
type TestKind = Extract<SourceUnionRelation, { readonly kind: "test" }>["test"];

const equalities: ReadonlyMap<string, { readonly negated: boolean; readonly strict: boolean }> = new Map([
  ["KindEqualsEqualsEqualsToken", { negated: false, strict: true }], ["KindEqualsEqualsToken", { negated: false, strict: false }],
  ["KindExclamationEqualsEqualsToken", { negated: true, strict: true }], ["KindExclamationEqualsToken", { negated: true, strict: false }],
]);

const absenceDescriptor: SourceTypeDescriptor = Object.freeze({ kind: "intrinsic", intrinsic: "absence" });

function isAbsence(type: SourceTypeDescriptor): boolean {
  return type.kind === "intrinsic" && (type.intrinsic === "absence" || type.intrinsic === "void");
}

function unwrapExpression(ast: AstReader, node: Node): Node {
  let selected = node;
  while (ast.is.IsParenthesizedExpression(selected) || ast.is.IsNonNullExpression(selected) || ast.is.IsSatisfiesExpression(selected)) {
    const inner = Node_Expression(ast, selected);
    if (inner === undefined) break;
    selected = inner;
  }
  return selected;
}

function literalKey(value: SourceLiteralValue | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value.form === "string" || value.form === "template") return `s:${value.text}`;
  if (value.form === "true" || value.form === "false") return `b:${value.form}`;
  const integer = value.integerConstant ?? value.integer;
  if (integer !== undefined) return `n:${integer.toString()}`;
  if (value.number !== undefined) return `n:${String(value.number)}`;
  return undefined;
}

function literalCategory(value: SourceLiteralValue): "string" | "number" | "boolean" | "bigint" {
  if (value.form === "string" || value.form === "template") return "string";
  if (value.form === "true" || value.form === "false") return "boolean";
  return value.form === "bigint" ? "bigint" : "number";
}

/** Relation identity for comparing the relations of the several element types one spread writes (`use` excluded). */
function relationKey(relation: SourceUnionRelation): string {
  switch (relation.kind) {
    case "select-arm": return `select:${relation.arm}`;
    case "extract-arm": return `extract:${relation.arm}`;
    case "identity": return "identity";
    case "map": return `map:${relation.mapping.join(",")}`;
    case "refused": return `refused:${relation.message}`;
    default: return relation.kind;
  }
}

export function createSourceRelationQuery(inputs: SourceRelationInputs): (use: Node) => SourceUnionRelation | undefined {
  const { source, input } = inputs;
  const { ast, navigation } = source;
  const cache = new Map<Node, SourceUnionRelation | undefined>();

  const refuse = (use: Node, message: string): SourceRefusal => Object.freeze({
    kind: "refused", code: "TSONIC_LOCAL_TYPE_UNION", message, site: use,
  });
  const resolved = (node: Node): SourceTypeDescriptor | undefined => {
    const outcome = inputs.type(node);
    return outcome.kind === "refused" ? undefined : outcome.type;
  };
  const armIndex = (sum: SourceClosedSum, type: SourceTypeDescriptor): number => isAbsence(type)
    ? sum.arms.findIndex(arm => isAbsence(arm.type))
    : sum.arms.findIndex(arm => sourceTypeDescriptorsEqual(arm.type, type));

  // ---- discriminators (05 §2a D-2): required literal-typed members, read from the members' authored declarations ----
  // The literal evidence survives descriptor erasure through the member's original declaration (never a checked type).
  const literalKeys = (annotation: Node): ReadonlySet<string> | undefined => {
    if (ast.kindName(annotation) === "KindParenthesizedType") {
      const inner = ast.children(annotation).find(child => child !== undefined);
      return inner === undefined ? undefined : literalKeys(inner);
    }
    if (ast.is.IsUnionTypeNode(annotation)) {
      const keys = new Set<string>();
      for (const member of ast.children(annotation)) {
        if (member === undefined) continue;
        const selected = literalKeys(member);
        if (selected === undefined) return undefined;
        for (const key of selected) keys.add(key);
      }
      return keys.size === 0 ? undefined : keys;
    }
    if (!ast.is.IsLiteralTypeNode(annotation)) return undefined;
    const literal = ast.children(annotation)[0];
    const key = literal === undefined ? undefined : literalKey(inputs.literal(literal)) ??
      (ast.is.IsStringLiteral(literal) ? `s:${ast.text(literal)}` : undefined);
    return key === undefined ? undefined : new Set([key]);
  };
  const discriminantCache = new Map<SourceTypeDescriptor, ReadonlyMap<string, ReadonlySet<string>>>();
  // name -> literal keys of every required literal-typed member of an arm.
  const discriminants = (arm: SourceTypeDescriptor): ReadonlyMap<string, ReadonlySet<string>> => {
    const existing = discriminantCache.get(arm);
    if (existing !== undefined) return existing;
    const result = new Map<string, ReadonlySet<string>>();
    const structure = sourceTypeDescriptorStructure(arm);
    if (structure.kind === "shape") {
      for (const member of structure.members) {
        if (member.optional || member.origin.kind !== "declared") continue;
        const annotation = ast.typeNode(member.origin.declaration);
        const keys = annotation === undefined ? undefined : literalKeys(annotation);
        if (keys !== undefined) result.set(member.name, keys);
      }
    }
    discriminantCache.set(arm, result);
    return result;
  };

  // What a spread operand contributes to member `name`: a proven literal key, "unproven", or undefined (no such member).
  const spreadContribution = (operand: Node, name: string): string | "unproven" | undefined => {
    const type = resolved(operand);
    if (type === undefined) return "unproven";
    const sum = inputs.sumOf(type);
    const arms = (sum === undefined ? [type] : sum.arms.map(arm => arm.type)).filter(arm => !isAbsence(arm));
    let first = true;
    let contribution: string | "unproven" | undefined;
    for (const arm of arms) {
      const structure = sourceTypeDescriptorStructure(arm.kind === "optional" ? arm.value : arm);
      if (structure.kind !== "shape") return "unproven";
      const member = structure.members.find(selected => selected.name === name);
      const keys = member === undefined || member.optional ? undefined : discriminants(arm).get(name);
      const selected = member === undefined ? undefined : keys !== undefined && keys.size === 1 ? [...keys][0]! : "unproven";
      if (!first && selected !== contribution) return "unproven";
      contribution = selected;
      first = false;
    }
    return contribution;
  };

  // ---- writes ------------------------------------------------------------------------------------------------------
  const family = (selected: SourceTypeDescriptor): string => {
    const structure = sourceTypeDescriptorStructure(selected);
    return selected.kind === "declared" && selected.definition === undefined ? `declared:${String(ast.pos(selected.declaration))}`
      : structure.kind === "primitive" ? structure.primitive === "bool" ? "bool" : "numeric"
        : structure.kind === "intrinsic" ? `intrinsic:${structure.intrinsic}` : structure.kind;
  };

  // The discriminant rule (05 §2a D-2..D-12, C-2479 decision 1) for an object literal written into a sum with several
  // object-form arms (`candidates`).
  const selectByDiscriminant = (use: Node, literal: Node, sum: SourceClosedSum, candidates: readonly number[]): SourceUnionRelation => {
    const tagged = candidates.map(index => discriminants(sum.arms[index]!.type));
    // D-2: a discriminator is declared, required and literal-typed by EVERY candidate arm.
    const names = [...tagged[0]!.keys()].filter(name => tagged.every(members => members.has(name)));
    if (names.length === 0) {
      return refuse(use, "This object literal is written into a union with several object arms that share no literal " +
        "discriminant property. Annotate the value with one arm's type.");
    }
    // Proven values in authored order; a later own property or spread overrides an earlier one (D-3, D-7, D-8).
    const proven = new Map<string, { readonly key: string; readonly value?: SourceLiteralValue } | "unproven">();
    for (const property of ast.properties(literal)) {
      if (property === undefined) continue;
      if (ast.is.IsSpreadAssignment(property)) {
        const operand = Node_Expression(ast, property);
        for (const name of names) {
          const contribution = operand === undefined ? "unproven" : spreadContribution(operand, name);
          if (contribution !== undefined) proven.set(name, contribution === "unproven" ? "unproven" : { key: contribution });
        }
        continue;
      }
      const nameNode = ast.name(property);
      const name = nameNode === undefined ? undefined : ast.text(nameNode);
      if (name === undefined || !names.includes(name)) continue;
      const initializer = ast.is.IsPropertyAssignment(property) ? Node_Initializer(ast, property)
        : ast.is.IsShorthandPropertyAssignment(property) ? nameNode : undefined;
      const value = initializer === undefined ? undefined : inputs.literal(initializer);
      const key = literalKey(value);
      proven.set(name, key === undefined || value === undefined ? "unproven" : { key, value });
    }
    let remaining = candidates;
    let decided: { readonly property: string; readonly value: SourceLiteralValue } | undefined;
    for (const name of names) {
      const selected = proven.get(name);
      if (selected === undefined || selected === "unproven") continue;
      remaining = remaining.filter(index => discriminants(sum.arms[index]!.type).get(name)!.has(selected.key));
      if (decided === undefined && selected.value !== undefined) decided = { property: name, value: selected.value };
    }
    if (remaining.length === 1) {
      return Object.freeze({ kind: "select-arm", use, sum: sum.identity, arm: remaining[0]!,
        ...(decided === undefined ? {} : { discriminant: Object.freeze(decided) }) });
    }
    if (remaining.length === 0) {
      return refuse(use, "This object literal matches no union arm by its literal discriminant. Write the discriminant value of one arm.");
    }
    const unproven = names.some(name => proven.get(name) === "unproven");
    const anyProven = names.some(name => { const selected = proven.get(name); return selected !== undefined && selected !== "unproven"; });
    return refuse(use, unproven
      ? "A discriminant of this object literal is not a literal value, or a spread may override it, so no single union arm is proven. Write the discriminant as a literal after every spread."
      : anyProven
        ? "This object literal matches several union arms by its literal discriminants. Write a discriminant that selects one arm."
        : "This object literal writes no discriminant of the destination union. Write the discriminant value of one arm.");
  };

  // Arm selection for a non-sum value (`type`) or an aggregate literal (`value`, its syntax decides the form) in a sum.
  const selectArm = (use: Node, value: Node | undefined, type: SourceTypeDescriptor | undefined, sum: SourceClosedSum): SourceUnionRelation => {
    if (type !== undefined) {
      const exact = armIndex(sum, type);
      if (exact >= 0) return Object.freeze({ kind: "select-arm", use, sum: sum.identity, arm: exact });
    }
    const literal = value === undefined ? undefined : unwrapExpression(ast, value);
    const objectLiteral = literal !== undefined && ast.is.IsObjectLiteralExpression(literal);
    const arrayLiteral = literal !== undefined && ast.is.IsArrayLiteralExpression(literal);
    if (!objectLiteral && !arrayLiteral && type === undefined) {
      return refuse(use, "This value has no Host type to select a union arm. Annotate it with one arm's type.");
    }
    const wanted = objectLiteral ? ["shape"] : arrayLiteral ? ["array", "tuple"] : [family(type!)];
    const candidates = sum.arms.flatMap((arm, index) => wanted.includes(family(arm.type)) ? [index] : []);
    // D-1: at most one object-form arm takes the ordinary form rule.
    if (candidates.length === 1) return Object.freeze({ kind: "select-arm", use, sum: sum.identity, arm: candidates[0]! });
    if (objectLiteral && candidates.length > 1) return selectByDiscriminant(use, literal!, sum, candidates);
    return refuse(use, candidates.length === 0
      ? "This value matches no arm of the destination union. Convert it to one arm's type."
      : "This value matches several arms of the destination union. Annotate it with one arm's exact type.");
  };

  const mapSums = (use: Node, mode: "narrowed-read" | "write" | "cast", from: SourceClosedSum, to: SourceClosedSum): SourceUnionRelation => {
    if (from === to) return Object.freeze({ kind: "identity", use, sum: from.identity });
    const mapping = from.arms.map(arm => armIndex(to, arm.type));
    if (mode !== "narrowed-read" && mapping.some(index => index < 0)) {
      return refuse(use, "A union arm of this value has no equal arm in the destination union. Convert the value explicitly.");
    }
    return Object.freeze({ kind: "map", use, mode, source: from.identity, destination: to.identity, mapping: Object.freeze(mapping) });
  };

  const relate = (use: Node, mode: "write" | "cast", value: Node | undefined, from: SourceTypeDescriptor,
    to: SourceTypeDescriptor): SourceUnionRelation | undefined => {
    // A `never` value is never written; no arm is selected for it.
    if (from.kind === "intrinsic" && from.intrinsic === "never") return undefined;
    const toSum = inputs.sumOf(to);
    const unwrapped = value === undefined ? undefined : unwrapExpression(ast, value);
    // An aggregate literal is constructed at its destination: its published type IS the destination, so its arm comes
    // from its syntax (form and discriminant rule), never from a sum-to-sum identity.
    if (toSum !== undefined && mode === "write" && unwrapped !== undefined &&
      (ast.is.IsObjectLiteralExpression(unwrapped) || ast.is.IsArrayLiteralExpression(unwrapped))) {
      return selectArm(use, value, undefined, toSum);
    }
    const fromSum = inputs.sumOf(from);
    if (fromSum !== undefined && toSum !== undefined) return mapSums(use, mode, fromSum, toSum);
    if (toSum !== undefined) {
      const open = sourceTypeDescriptorStructure(from);
      if (open.kind === "intrinsic" && (open.intrinsic === "any" || open.intrinsic === "unknown")) {
        return refuse(use, `An '${open.intrinsic}' value states no arm of the destination union. Cast it to one arm's type first.`);
      }
      return selectArm(use, value, from, toSum);
    }
    if (fromSum !== undefined && mode === "cast") {
      const index = armIndex(fromSum, to);
      return index >= 0 ? Object.freeze({ kind: "extract-arm", use, sum: fromSum.identity, arm: index })
        : refuse(use, "This cast selects no single arm of the operand's union. Cast to one arm's exact type.");
    }
    return undefined;
  };

  // ---- tests -------------------------------------------------------------------------------------------------------
  // The values an operand can hold, as arms: the closed sum's arms, an option's value and absence, or the one descriptor.
  const testArms = (operand: Node): { readonly sum?: SourceClosedSum; readonly arms: readonly SourceTypeDescriptor[] } | undefined => {
    const type = resolved(operand);
    if (type === undefined) return undefined;
    const sum = inputs.sumOf(type);
    if (sum !== undefined) return { sum, arms: sum.arms.map(arm => arm.type) };
    const structure = sourceTypeDescriptorStructure(type);
    return structure.kind === "optional" ? { arms: [structure.value, absenceDescriptor] } : { arms: [type] };
  };
  // An arm whose values the descriptor does not constrain (any, unknown, a type parameter): every test is unknown on it.
  const open = (arm: SourceTypeDescriptor): boolean => {
    const structure = sourceTypeDescriptorStructure(arm);
    return structure.kind === "intrinsic" && (structure.intrinsic === "any" || structure.intrinsic === "unknown") ||
      structure.kind === "declared" && ast.is.IsTypeParameterDeclaration(structure.declaration);
  };

  const testRelation = (use: Node, operand: Node, test: TestKind, negated: boolean,
    predicate: (arm: SourceTypeDescriptor, index: number) => Match): SourceUnionRelation | undefined => {
    const selected = testArms(operand);
    if (selected === undefined) return undefined;
    const results: Match[] = selected.arms.map((arm, index) => !isAbsence(arm) && open(arm) ? "unknown" : predicate(arm, index));
    if (results.includes("refuse")) {
      return refuse(use, "This test cannot separate null from undefined: the operand admits both. Test with '== null' " +
        "or annotate the operand with only one of them.");
    }
    const holds = results.map(result => result === "unknown" ? "unknown" : (result === true) !== negated);
    const outcome = holds.every(result => result === true) ? "always-true" as const
      : holds.every(result => result === false) ? "always-false" as const : "undecided" as const;
    const whenTrue = selected.sum === undefined ? [] : holds.flatMap((result, index) => result === false ? [] : [index]);
    return Object.freeze({ kind: "test", use, operand, test, outcome,
      ...(selected.sum === undefined ? {} : { sum: selected.sum.identity }), whenTrue: Object.freeze(whenTrue) });
  };

  // The class declaration an `instanceof` right operand names; undefined for anything else (a library constructor value).
  const instanceTarget = (right: Node): Node | undefined => {
    const declaration = navigation.sourceReferenceFor(right)?.declaration ?? input.member(right)?.declarations[0];
    return declaration !== undefined && (ast.is.IsClassDeclaration(declaration) || ast.is.IsClassExpression(declaration))
      ? declaration : undefined;
  };
  // The class relation is decided only from complete declared heritage (navigation.declaredHeritagePath).
  const instanceMatch = (arm: SourceTypeDescriptor, target: Node | undefined): Match => {
    if (isAbsence(arm)) return false;
    const structure = sourceTypeDescriptorStructure(arm);
    if (structure.kind === "string" || structure.kind === "primitive" ||
      structure.kind === "intrinsic" && (structure.intrinsic === "bigint" || structure.intrinsic === "symbol")) return false;
    if (arm.kind === "declared" && ast.is.IsEnumDeclaration(arm.declaration)) return false;
    if (target === undefined || arm.kind !== "declared" ||
      !(ast.is.IsClassDeclaration(arm.declaration) || ast.is.IsClassExpression(arm.declaration))) return "unknown";
    if (arm.declaration === target) return true;
    const down = navigation.declaredHeritagePath(arm.declaration, target);
    if (down.kind === "related") return true;
    const up = navigation.declaredHeritagePath(target, arm.declaration);
    if (up.kind === "related" || down.kind === "unresolved" || up.kind === "unresolved") return "unknown";
    return false;   // two classes with complete heritage, neither deriving from the other
  };

  // `x === null` / `x == undefined` on the absence arm, from the operand's nullish admission (N7, C-2479 decision 2 (c)).
  // Only a proven "both" refuses (§4.3); an unproven admission leaves the arm undecided.
  const absenceMatch = (admission: SourceNullishAdmission["admission"], nullish: "null" | "undefined", strict: boolean): Match => {
    if (!strict) return true;
    if (admission === "both") return "refuse";
    if (admission === "unavailable" || admission === "none") return "unknown";
    return admission === `${nullish}-only`;
  };

  // The category of each test arm (aligned with testArms: sum arm index, or 0 for the value of a non-sum operand), from
  // the operand's typeof-site record; a refused site refuses the test with the same record.
  const siteCategories = (operation: Node, operand: Node):
    SourceRefusal | { readonly kind: "site"; readonly admission: SourceNullishAdmission["admission"]; categoryOf(index: number): string | undefined } => {
    const record = inputs.typeofCategory(operation, operand);
    if (record.kind === "refused") return record;
    if (record.sum !== undefined) {
      const categories = new Map(record.sum.roles.flatMap(role => role.arms.map(arm => [arm.arm, arm.category] as const)));
      return { kind: "site", admission: record.admission, categoryOf: index => {
        const category = categories.get(index);
        return category === "unproven" ? undefined : category;
      } };
    }
    return { kind: "site", admission: record.admission, categoryOf: () => record.category };
  };

  function binaryTest(use: Node): SourceUnionRelation | undefined {
    const token = ast.operatorKindName(use);
    const binary = ast.as.AsBinaryExpression(use);
    const left = binary?.Left === undefined ? undefined : unwrapExpression(ast, binary.Left);
    const right = binary?.Right === undefined ? undefined : unwrapExpression(ast, binary.Right);
    if (left === undefined || right === undefined) return undefined;
    if (token === "KindInstanceOfKeyword") {
      const target = instanceTarget(right);
      return testRelation(use, left, "instanceof", false, arm => instanceMatch(arm, target));
    }
    const equality = token === undefined ? undefined : equalities.get(token);
    if (equality === undefined) return undefined;
    for (const [operand, other] of [[left, right], [right, left]] as const) {
      // typeof x === "category" (N3' categories, N7 absence)
      if (ast.is.IsTypeOfExpression(operand)) {
        const subject = Node_Expression(ast, operand);
        const category = inputs.literal(other);
        if (subject === undefined || category?.form !== "string") continue;
        const operandNode = unwrapExpression(ast, subject);
        if (resolved(operandNode) === undefined) return undefined;
        const site = siteCategories(operand, operandNode);
        if (site.kind === "refused") return site;
        const { admission } = site;
        return testRelation(use, operandNode, "typeof", equality.negated, (arm, index) => {
          if (isAbsence(arm)) {
            if (category.text === "undefined") {
              return admission === "both" ? "refuse" : admission === "undefined-only" ? true : admission === "null-only" ? false : "unknown";
            }
            if (category.text === "object") return admission === "null-only" ? true : admission === "undefined-only" ? false : "unknown";
            return false;
          }
          const selected = site.categoryOf(index);
          return selected === undefined ? "unknown" : selected === category.text;
        });
      }
      // x === null / x == undefined
      const nullish = ast.kindName(other) === "KindNullKeyword" ? "null" as const
        : ast.is.IsIdentifier(other) && ast.text(other) === "undefined" &&
          navigation.sourceReferenceFor(other)?.project !== true ? "undefined" as const : undefined;
      if (nullish !== undefined) {
        if (resolved(operand) === undefined) return undefined;
        const site = siteCategories(use, operand);
        if (site.kind === "refused") return site;
        const { admission } = site;
        return testRelation(use, operand, "nullish", equality.negated,
          arm => isAbsence(arm) ? absenceMatch(admission, nullish, equality.strict) : false);
      }
      // x.kind === "a" (discriminant member test)
      if (ast.is.IsPropertyAccessExpression(operand)) {
        const receiver = Node_Expression(ast, operand);
        const key = literalKey(inputs.literal(other));
        const name = ast.name(operand);
        const subject = receiver === undefined ? undefined : unwrapExpression(ast, receiver);
        const arms = subject === undefined ? undefined : testArms(subject);
        if (subject !== undefined && arms !== undefined && key !== undefined && name !== undefined) {
          const property = ast.text(name);
          if (arms.arms.some(arm => discriminants(arm).has(property))) {
            return testRelation(use, subject, "discriminant", equality.negated, arm => {
              if (isAbsence(arm)) return false;
              const keys = discriminants(arm).get(property);
              return keys === undefined ? "unknown" : !keys.has(key) ? false : keys.size === 1 ? true : "unknown";
            });
          }
        }
      }
      // x === literal (strict only: loose equality converts across categories)
      const literal = inputs.literal(other);
      if (literal !== undefined && literalKey(literal) !== undefined && equality.strict && inputs.literal(operand) === undefined) {
        if (resolved(operand) === undefined) return undefined;
        const wanted = literalCategory(literal);
        const site = siteCategories(use, operand);
        if (site.kind === "refused") return site;
        return testRelation(use, operand, "literal", equality.negated, (arm, index) => {
          if (isAbsence(arm)) return false;
          const selected = site.categoryOf(index);
          return selected === undefined || selected === wanted ? "unknown" : false;
        });
      }
    }
    return undefined;
  }

  // ---- per-arm member reads and calls ------------------------------------------------------------------------------
  const memberName = (use: Node): string | undefined => {
    if (ast.is.IsPropertyAccessExpression(use)) {
      const name = ast.name(use);
      return name === undefined ? undefined : ast.text(name);
    }
    const argument = ast.as.AsElementAccessExpression(use)?.ArgumentExpression;
    const key = argument === undefined ? undefined : inputs.literal(argument);
    if (key === undefined) return undefined;
    if (key.form === "string" || key.form === "template") return key.text;
    const integer = key.integerConstant ?? key.integer;
    return integer !== undefined ? integer.toString() : key.number !== undefined ? String(key.number) : undefined;
  };
  // The declaration an arm's member `name` resolves to. undefined for a JS API member (primitive, array, tuple, callable,
  // an Object/Function apparent member: the profile answers by name) and for a mapped member (the shape answers by name).
  const armMember = (arm: SourceTypeDescriptor, name: string): Node | undefined => {
    const structure = sourceTypeDescriptorStructure(arm);
    if (structure.kind === "shape") {
      const member = structure.members.find(selected => selected.name === name);
      if (member?.origin.kind === "declared") return member.origin.declaration;
      if (member?.origin.kind === "class-prototype") return input.declaredMembers(member.origin.owner, name)?.[0];
      if (member !== undefined) return undefined;
      const numeric = /^\d+$/u.test(name);
      const index = (numeric ? structure.indexes.find(entry => sourceTypeDescriptorStructure(entry.key).kind === "primitive") : undefined) ??
        structure.indexes.find(entry => sourceTypeDescriptorStructure(entry.key).kind === "string");
      return index?.declaration;
    }
    // A declared reference without a definition (recursion cut, unexpressible declaration-file type, enum, type
    // parameter): the member of its declared type (declaration input; a type parameter through its constraint).
    if (structure.kind === "declared") return input.declaredMembers(structure.declaration, name)?.[0];
    return undefined;
  };
  function perArm(use: Node): SourceUnionRelation | undefined {
    const receiver = Node_Expression(ast, use);
    const selected = receiver === undefined ? undefined : resolved(receiver);
    const sum = selected === undefined ? undefined : inputs.sumOf(selected);
    const name = memberName(use);
    if (sum === undefined || name === undefined) return undefined;
    const arms = sum.arms.flatMap((arm, index) => {
      if (isAbsence(arm.type)) return [];
      const member = armMember(arm.type, name);
      return [Object.freeze({ arm: index, ...(member === undefined ? {} : { member }) })];
    });
    return Object.freeze({ kind: "per-arm", use, sum: sum.identity, arms: Object.freeze(arms) });
  }

  // ---- spread writes -----------------------------------------------------------------------------------------------
  // The element types a spread operand yields; undefined when its descriptor states none (a non-array iterable).
  const spreadElements = (operand: Node): readonly SourceTypeDescriptor[] | undefined => {
    const type = resolved(operand);
    const structure = type === undefined ? undefined : sourceTypeDescriptorStructure(type);
    if (structure === undefined) return undefined;
    if (structure.kind === "array") return [structure.element];
    if (structure.kind === "tuple") return structure.elements.map(element => element.type);
    if (structure.kind === "string") return [structure];
    return undefined;
  };
  // The destinations of a spread argument: the rest parameter's element, or the fixed parameters it fills.
  const spreadDestinations = (spread: Node, owner: Node):
    { readonly rest?: SourceTypeDescriptor; readonly fixed: readonly SourceTypeDescriptor[] } | undefined => {
    const signature = input.call(owner)?.signature;
    if (signature === undefined) return undefined;
    const parameters = ast.parameters(signature).filter((parameter): parameter is Node => parameter !== undefined);
    const position = ast.arguments(owner).indexOf(spread);
    if (position < 0) return undefined;
    const instantiation = inputs.instantiation(owner);
    const declared = (index: number): SourceTypeDescriptor | undefined =>
      instantiation !== undefined && instantiation.kind !== "refused" ? instantiation.parameters[index]
        : inputs.declaredSlotType(parameters[index]!);
    const restIndex = parameters.findIndex(parameter => ast.as.AsParameterDeclaration(parameter)?.DotDotDotToken !== undefined);
    if (restIndex >= 0 && position >= restIndex) {
      const type = declared(restIndex);
      const structure = type === undefined ? undefined : sourceTypeDescriptorStructure(type);
      return structure?.kind === "array" ? { fixed: [], rest: structure.element } : undefined;
    }
    const fixed = parameters.slice(position, restIndex >= 0 ? restIndex : undefined).map((_, offset) => declared(position + offset));
    return fixed.some(type => type === undefined) ? undefined : { fixed: fixed as SourceTypeDescriptor[] };
  };
  function spreadWrite(use: Node): SourceUnionRelation | undefined {
    const operand = Node_Expression(ast, use);
    const owner = ast.parent(use);
    if (operand === undefined || owner === undefined) return undefined;
    let destination: SourceTypeDescriptor;
    if (ast.is.IsArrayLiteralExpression(owner)) {
      const literal = resolved(owner);
      const structure = literal === undefined ? undefined : sourceTypeDescriptorStructure(literal);
      const position = ast.elements(owner).indexOf(use);
      const element = structure?.kind === "array" ? structure.element
        : structure?.kind === "tuple" && position >= 0 ? sourceTypeDescriptorTupleValue(structure, position) : undefined;
      if (element === undefined) return undefined;
      destination = element;
    } else if (ast.is.IsCallExpression(owner) || ast.is.IsNewExpression(owner)) {
      const selected = spreadDestinations(use, owner);
      if (selected === undefined) return undefined;
      if (selected.rest === undefined) {
        return selected.fixed.some(type => inputs.sumOf(type) !== undefined)
          ? refuse(use, "This spread argument fills fixed parameters of a union type one element at a time. Pass the arguments individually.")
          : undefined;
      }
      destination = selected.rest;
    } else return undefined;
    const elements = spreadElements(operand);
    if (elements === undefined) {
      return inputs.sumOf(destination) === undefined ? undefined
        : refuse(use, "The elements of this spread iterable have no Host element type, so no union arm can be selected for " +
          "them. Spread an array whose element type is declared.");
    }
    const relations = elements.map(element => relate(use, "write", undefined, element, destination));
    const first = relations[0];
    if (relations.every(relation => relation === undefined)) return undefined;
    if (first === undefined || relations.some(relation => relation === undefined || relationKey(relation) !== relationKey(first))) {
      return refuse(use, "The elements of this spread select different arms of the destination union. Spread an array whose " +
        "element type is one arm or the union.");
    }
    return first;
  }

  // ---- dispatch ----------------------------------------------------------------------------------------------------
  function compute(use: Node): SourceUnionRelation | undefined {
    if (ast.is.IsSpreadElement(use)) return spreadWrite(use);
    if (ast.is.IsAsExpression(use) || ast.is.IsTypeAssertion(use)) {
      if (ast.isConstAssertion(use)) return undefined;
      const operand = Node_Expression(ast, use);
      const from = operand === undefined ? undefined : resolved(operand);
      const to = resolved(use);
      return from === undefined || to === undefined ? undefined : relate(use, "cast", operand, from, to);
    }
    if (ast.is.IsBinaryExpression(use)) {
      const test = binaryTest(use);
      if (test !== undefined) return test;
    }
    if (ast.is.IsPropertyAccessExpression(use) || ast.is.IsElementAccessExpression(use)) {
      const relation = perArm(use);
      if (relation !== undefined) return relation;
    }
    if (ast.is.IsIdentifier(use)) {
      const declaration = navigation.sourceReferenceFor(use)?.declaration;
      const declared = declaration === undefined ? undefined : inputs.declaredSlotType(declaration);
      const read = resolved(use);
      const from = declared === undefined ? undefined : inputs.sumOf(declared);
      if (from !== undefined && read !== undefined) {
        const to = inputs.sumOf(read);
        if (to !== undefined && to !== from) return mapSums(use, "narrowed-read", from, to);
        const index = to === undefined ? armIndex(from, read) : -1;
        if (index >= 0) return Object.freeze({ kind: "extract-arm", use, sum: from.identity, arm: index });
      }
    }
    const destination = inputs.contextual(use);
    if (destination === undefined || destination.kind === "refused") return undefined;
    const outcome = inputs.type(use);
    if (outcome.kind === "refused") return undefined;
    return relate(use, "write", use, outcome.construction ?? outcome.type, destination.type);
  }

  return use => {
    if (cache.has(use)) return cache.get(use);
    const result = compute(use);
    cache.set(use, result);
    return result;
  };
}
