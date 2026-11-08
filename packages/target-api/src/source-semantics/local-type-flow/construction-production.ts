import type { Node } from "@tsonic/tsts";
import type { SourceConstruction, SourcePresence, SourcePropertyName, SourceTypeBinding, SourceTypeEvidence, SourceUseDestination } from "../../public/source/contracts.js";
import type { SourceInputComponent } from "../../host-input/identities.js";
import type { SourceLiteralKey } from "../../source-model/literals/key.js";
import { sourcePresentLiteralDomain, sourceUnreachableLiteralDomain, type SourceLiteralDomain } from "../../source-model/literals/domain.js";
import type { SourceProductionResult } from "../descriptor-contracts.js";
import type { SourceMemberInventory, SourceMemberInventoryRow } from "../member-inventory.js";
import { Node_Expression, ObjectLiteralProperty_Value, SpreadAssignment_Expression } from "../../source-navigation/ast.js";
import { sourceSemanticRefusal, type SourceSemanticProduction } from "./semantic-production.js";
import { produceSourceConstructionDestination } from "./construction-destinations.js";

export interface SourceConstructionProduction extends SourceSemanticProduction {
  value(node: Node): SourceProductionResult<SourceTypeEvidence>;
  completion(declaration: Node, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceTypeEvidence>;
  literalDomain(component: SourceInputComponent, bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceLiteralDomain>;
  propertyName(node: Node): SourceProductionResult<SourcePropertyName>;
  destination(node: Node): SourceProductionResult<SourcePresence<SourceUseDestination>>;
  element(source: SourceTypeEvidence, occurrence: Node): SourceProductionResult<SourceTypeEvidence>;
}

export interface SourceLiteralConstruction {
  readonly value: SourceTypeEvidence;
  readonly construction: SourceConstruction;
}

export function createSourceConstructionProduction(context: SourceConstructionProduction): {
  metadata(occurrence: Node): SourceProductionResult<SourceMemberInventory>;
  produce(occurrence: Node): SourceProductionResult<SourceLiteralConstruction>;
} {
  const { ast, builder, reader, input } = context;
  const metadataCache = new WeakMap<Node, Extract<SourceMemberInventory, { kind: "complete" }>>();
  const constructions = new WeakMap<Node, SourceLiteralConstruction>();
  const active = new Set<Node>();
  const none = Object.freeze({ kind: "resolved", value: Object.freeze({ kind: "none" }) } as const);
  const presence = (value: SourceProductionResult<SourceTypeEvidence>): SourceProductionResult<SourcePresence<SourceTypeEvidence>> =>
    value.kind !== "resolved" ? value : { kind: "resolved", value: { kind: "present", value: value.value } };
  const identity = (key: SourceLiteralKey): string | Node => key.kind === "name" ? key.name : key.declaration;

  function metadata(occurrence: Node): SourceProductionResult<SourceMemberInventory> {
    input.assertNode(occurrence);
    if (!ast.is.IsObjectLiteralExpression(occurrence)) throw new Error("Original construction member metadata requires an object literal.");
    const previous = metadataCache.get(occurrence);
    if (previous !== undefined) return { kind: "resolved", value: previous };
    const rows = new Map<string | Node, SourceMemberInventoryRow>();
    for (const property of ast.properties(occurrence)) {
      if (property === undefined) throw new Error("An object construction requires every original member occurrence.");
      const spread = SpreadAssignment_Expression(ast, property);
      if (spread !== undefined) {
        const value = context.value(spread);
        if (value.kind !== "resolved") return value;
        const inventory = builder.members(value.value);
        if (inventory.kind !== "resolved") return inventory;
        if (inventory.value.kind === "unavailable") return sourceSemanticRefusal(property, "An object spread requires its complete original Source member inventory.");
        for (const row of inventory.value.members) rows.set(identity(row.key), Object.freeze({ ...row, readonly: false,
          getters: [], setters: [], read: "property", writeType: row.readType }));
        continue;
      }
      const name = ast.name(property);
      if (name === undefined) return sourceSemanticRefusal(property, "An object member requires its original property name.");
      const selected = context.propertyName(name);
      if (selected.kind !== "resolved") return selected;
      if (selected.value.kind === "unproven") return sourceSemanticRefusal(name, selected.value.reason);
      const key: SourceLiteralKey = selected.value.kind === "name" ? selected.value : { kind: "symbol", declaration: selected.value.declaration };
      const nameText = selected.value.kind === "name" ? selected.value.name
        : selected.value.kind === "well-known-symbol" ? `Symbol.${selected.value.name}` : ast.text(ast.name(selected.value.declaration));
      const getter = ast.is.IsGetAccessorDeclaration(property), setter = ast.is.IsSetAccessorDeclaration(property);
      const prior = rows.get(identity(key));
      const pairAccessor = (getter || setter) && prior !== undefined && (prior.getters.length > 0 || prior.setters.length > 0);
      const declarations = pairAccessor ? [...prior.declarations, property] : [property];
      const origin = Object.freeze({ kind: "declared" as const, declaration: property });
      const initializer = ObjectLiteralProperty_Value(ast, property);
      const readType = (): SourceProductionResult<SourcePresence<SourceTypeEvidence>> =>
        setter ? none : presence(getter ? context.completion(property, []) : context.value(initializer ?? property));
      const readDomain = (bindings: readonly SourceTypeBinding[]): SourceProductionResult<SourceLiteralDomain> => {
        if (setter) return { kind: "resolved", value: sourceUnreachableLiteralDomain };
        if (ast.is.IsMethodDeclaration(property)) return { kind: "resolved", value: sourcePresentLiteralDomain };
        const annotation = getter ? ast.typeNode(property) : undefined;
        if (getter && annotation === undefined) {
          const result = context.completion(property, bindings);
          return result.kind !== "resolved" ? result : { kind: "resolved", value: builder.domain(result.value) };
        }
        return context.literalDomain(input.syntax(annotation ?? initializer ?? property), bindings);
      };
      const writeType = (): SourceProductionResult<SourcePresence<SourceTypeEvidence>> => {
        if (getter) return none;
        if (!setter) return readType();
        const parameter = ast.parameters(property)[0];
        if (parameter === undefined) return sourceSemanticRefusal(property, "An original setter requires its actual parameter declaration.");
        const annotation = ast.typeNode(parameter);
        return presence(annotation === undefined ? context.value(parameter) : reader.describeSyntax(annotation, []));
      };
      rows.set(identity(key), Object.freeze({ key, name: nameText, declarations: Object.freeze(declarations),
        origins: pairAccessor ? [...prior.origins, origin] : [origin],
        readOrigins: setter ? pairAccessor ? prior.readOrigins : [] : [origin],
        writeOrigins: getter ? pairAccessor ? prior.writeOrigins : [] : [origin],
        getters: getter ? [property] : pairAccessor ? prior.getters : [], setters: setter ? [property] : pairAccessor ? prior.setters : [],
        read: setter ? pairAccessor && prior.getters.length > 0 ? "accessor" : "unavailable"
          : getter ? "accessor" : ast.is.IsMethodDeclaration(property) ? "method" : "property",
        optional: false, readonly: getter && (!pairAccessor || prior.setters.length === 0),
        readType: setter && pairAccessor ? prior.readType : readType,
        writeType: getter && pairAccessor ? prior.writeType : writeType,
        readDomain: setter && pairAccessor ? prior.readDomain : readDomain }));
    }
    const result = Object.freeze({ kind: "complete" as const, members: Object.freeze([...rows.values()]), indexes: Object.freeze([]) });
    metadataCache.set(occurrence, result);
    return { kind: "resolved", value: result };
  }

  function produce(occurrence: Node): SourceProductionResult<SourceLiteralConstruction> {
    input.assertNode(occurrence);
    const previous = constructions.get(occurrence);
    if (previous !== undefined) return { kind: "resolved", value: previous };
    if (active.has(occurrence)) return { kind: "pending", dependencies: [builder.componentIdentity(occurrence, [])] };
    active.add(occurrence);
    try {
      const result = ast.is.IsArrayLiteralExpression(occurrence) ? array(occurrence)
        : ast.is.IsObjectLiteralExpression(occurrence) ? object(occurrence)
          : sourceSemanticRefusal(occurrence, "A Source construction requires its original array or object literal.");
      if (result.kind === "resolved") constructions.set(occurrence, result.value);
      return result;
    } finally { active.delete(occurrence); }
  }

  function array(occurrence: Node): SourceProductionResult<SourceLiteralConstruction> {
    const evaluation: SourceConstruction["evaluation"][number][] = [];
    const values: SourceTypeEvidence[] = [];
    for (const child of ast.elements(occurrence)) {
      if (child === undefined) throw new Error("A Source array construction requires its complete original element vector.");
      if (ast.is.IsOmittedExpression(child)) {
        values.push(builder.evidence({ type: builder.intrinsic("absence"), component: builder.componentIdentity(child, []),
          category: { kind: "known", category: "absence" }, numeric: undefined, sum: undefined }, [], input.syntax(child),
        { kind: "finite", values: [{ kind: "absence" }] }, { members: { kind: "unavailable" }, origins: { kind: "complete", nodes: [child] } }));
        continue;
      }
      const spread = ast.is.IsSpreadElement(child);
      const operand = spread ? Node_Expression(ast, child) : child;
      if (operand === undefined) throw new Error("An original array spread requires its actual operand.");
      const value = context.value(operand);
      if (value.kind !== "resolved") return value;
      evaluation.push({ occurrence: operand, form: spread ? "spread" : "value", value: value.value });
      const element = spread ? context.element(value.value, child) : value;
      if (element.kind !== "resolved") return element;
      values.push(element.value);
    }
    const expected = context.destination(occurrence);
    if (expected.kind !== "resolved") return expected;
    let target: SourceTypeEvidence | undefined;
    if (expected.value.kind === "present") {
      const definition = builder.produceDefinition(expected.value.value.applied);
      if (definition.kind !== "resolved") return definition;
      target = definition.value;
    }
    const parent = ast.parent(occurrence);
    const readonly = parent !== undefined && ast.isConstAssertion(parent);
    const tuple = readonly || target?.type.kind === "tuple";
    const component = builder.componentIdentity(occurrence, []);
    let value: SourceTypeEvidence;
    if (tuple) {
      value = builder.evidence({ type: builder.tuple(values.map(type => ({ kind: "required", type: type.type })), readonly), component,
        category: { kind: "known", category: "object" }, numeric: undefined, sum: undefined },
      values.map((value, index) => ({ selector: { kind: "tuple-element" as const, index }, value })), input.syntax(occurrence), sourcePresentLiteralDomain,
      { members: { kind: "unavailable" }, origins: { kind: "complete", nodes: [occurrence] } });
    } else {
      let element: SourceTypeEvidence;
      if (values.length === 0 && target?.type.kind === "array") {
        const selected = builder.component(target, { kind: "array-element" });
        if (selected.kind === "refused") return selected;
        element = selected.value;
      } else {
        if (values.length === 0) return sourceSemanticRefusal(occurrence, "This empty array has no declared element type.", "TSONIC_UNTYPED_ARRAY_LITERAL");
        const selected = builder.join(builder.componentIdentity(occurrence, [{ kind: "array-element" }]), "inferred", values, undefined);
        if (selected.kind === "refused") return selected;
        element = selected.value;
      }
      value = builder.evidence({ type: builder.array(element.type, false), component, category: { kind: "known", category: "object" },
        numeric: undefined, sum: undefined }, [{ selector: { kind: "array-element" }, value: element }], input.syntax(occurrence), sourcePresentLiteralDomain,
      { members: { kind: "unavailable" }, origins: { kind: "complete", nodes: [occurrence] } });
    }
    const destination = produceSourceConstructionDestination(context, occurrence, value, expected.value);
    if (destination.kind !== "resolved") return destination;
    return { kind: "resolved", value: Object.freeze({ value, construction: Object.freeze({ occurrence, kind: "array", value, destination: destination.value,
      evaluation: Object.freeze(evaluation) }) }) };
  }

  function object(occurrence: Node): SourceProductionResult<SourceLiteralConstruction> {
    const inventory = metadata(occurrence);
    if (inventory.kind !== "resolved") return inventory;
    if (inventory.value.kind !== "complete") return sourceSemanticRefusal(occurrence, "An original object construction requires a complete member inventory.");
    const rows = inventory.value.members;
    const expected = context.destination(occurrence);
    if (expected.kind !== "resolved") return expected;
    if (rows.length === 0 && (expected.value.kind === "none" || expected.value.value.applied.type.kind === "intrinsic" &&
      expected.value.value.applied.type.intrinsic === "unknown")) return sourceSemanticRefusal(occurrence,
      "This object literal has no concrete target member inventory.", "TSONIC_UNTYPED_OBJECT_LITERAL");
    const members: Extract<SourceTypeEvidence["type"], { kind: "shape" }>["members"][number][] = [];
    const children: import("../descriptor-contracts.js").SourceEvidenceComponent[] = [];
    for (const row of rows) {
      const read = row.readType();
      if (read.kind !== "resolved") return read;
      const write = row.writeType();
      if (write.kind !== "resolved") return write;
      const selected = read.value.kind === "present" ? read.value.value : write.value.kind === "present" ? write.value.value : undefined;
      if (selected === undefined || row.origins.length === 0) return sourceSemanticRefusal(occurrence, "A constructed member requires its actual read or write component and original origin.");
      const origin = read.value.kind === "present" ? row.readOrigins[0] : row.writeOrigins[0];
      if (origin === undefined) throw new Error("An original constructed member component requires its role-specific origin.");
      members.push({ name: row.name, origin, optional: row.optional, readonly: row.readonly, type: selected.type });
      if (read.value.kind === "present") for (const origin of row.readOrigins)
        children.push({ selector: { kind: "member", origin }, value: read.value.value });
      if (write.value.kind === "present") for (const origin of row.writeOrigins) {
        if (!row.readOrigins.includes(origin)) children.push({ selector: { kind: "member", origin }, value: write.value.value });
      }
    }
    const value = builder.evidence({ type: builder.shape({ members, indexes: [], calls: [], constructs: [] }),
      component: builder.componentIdentity(occurrence, []), category: { kind: "known", category: "object" }, numeric: undefined, sum: undefined },
    children, input.syntax(occurrence), sourcePresentLiteralDomain, { members: inventory.value, origins: { kind: "complete", nodes: [occurrence] } });
    const evaluation: SourceConstruction["evaluation"][number][] = [];
    for (const property of ast.properties(occurrence)) {
      if (property === undefined) throw new Error("A constructed object requires every original evaluation step.");
      const name = ast.name(property);
      if (name !== undefined && ast.is.IsComputedPropertyName(name)) {
        const expression = ast.as.AsComputedPropertyName(name)?.Expression;
        if (expression === undefined) throw new Error("An original computed property requires its original key expression.");
        const key = context.value(expression);
        if (key.kind !== "resolved") return key;
        evaluation.push({ occurrence: expression, form: "key", value: key.value });
      }
      const spread = SpreadAssignment_Expression(ast, property);
      const initializer = spread ?? ObjectLiteralProperty_Value(ast, property);
      if (initializer === undefined) continue;
      const result = context.value(initializer);
      if (result.kind !== "resolved") return result;
      evaluation.push({ occurrence: initializer, form: spread === undefined ? "value" : "spread", value: result.value });
    }
    const destination = produceSourceConstructionDestination(context, occurrence, value, expected.value);
    if (destination.kind !== "resolved") return destination;
    return { kind: "resolved", value: Object.freeze({ value, construction: Object.freeze({ occurrence, kind: "object", value, destination: destination.value,
      evaluation: Object.freeze(evaluation) }) }) };
  }
  return Object.freeze({ metadata, produce });
}
