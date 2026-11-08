import type { Node } from "@tsonic/tsts";
import type { SourceMemberKey, SourceMemberOrigin, SourceTypeBinding, SourceTypeDescriptor, SourceTypeDescriptorMember, SourceTypeEvidence } from "../../public/source/contracts.js";
import type { SourceEvidenceComponent, SourceProductionResult } from "../descriptor-contracts.js";
import { sourceFiniteLiteralDomain, sourceOpenLiteralDomain, sourcePresentLiteralDomain, type SourceLiteralUnit } from "../../source-model/literals/domain.js";
import { sourceLiteralUnitKey } from "../../source-model/literals/key.js";
import { sourceSemanticRefusal, type SourceSyntaxProduction } from "./semantic-production.js";
import { sourceKeyEvidence, sourceMemberKeyDomain } from "./type-keys.js";
import type { SourceMemberInventoryRow } from "../member-inventory.js";
import { produceSourceMemberInventory } from "./member-production.js";

export function produceSourceMappedType(context: SourceSyntaxProduction): SourceProductionResult<SourceTypeEvidence> {
  const { ast, builder, reader, syntax } = context;
  if (!ast.is.IsMappedTypeNode(syntax)) throw new Error("A Source mapped producer requires its original mapped TypeNode.");
  const mapped = ast.as.AsMappedTypeNode(syntax);
  const parameter = mapped?.TypeParameter;
  if (mapped === undefined || parameter === undefined || !ast.is.IsTypeParameterDeclaration(parameter) || mapped.Type === undefined) {
    return sourceSemanticRefusal(syntax, "An original mapped type is missing its parameter or value component.");
  }
  const constraint = ast.as.AsTypeParameterDeclaration(parameter)?.Constraint;
  if (constraint === undefined) return sourceSemanticRefusal(parameter, "An original mapped parameter requires its key constraint.");
  const annotation = mapped.Type;
  const questionToken = mapped.QuestionToken;
  const withKey = (value: SourceTypeEvidence): readonly SourceTypeBinding[] => [...context.bindings.filter(binding => binding.declaration !== parameter),
    { declaration: parameter, value }];
  const component = builder.componentIdentity(syntax, []);
  const isKeyOf = ast.is.IsTypeOperatorNode(constraint) && ast.operatorKindName(constraint) === "KindKeyOfKeyword";
  const sourceNode = isKeyOf ? ast.as.AsTypeOperatorNode(constraint)?.Type : undefined;
  const source = sourceNode === undefined ? undefined : reader.describeSyntax(sourceNode, context.bindings);
  if (source !== undefined && source.kind !== "resolved") return source;
  if (source?.kind === "resolved" && builder.freeParameters(source.value).length > 0) {
    return { kind: "resolved", value: builder.evidence({ type: builder.projection(source.value.type, { kind: "component", component }),
      component, category: { kind: "known", category: "object" }, numeric: undefined, sum: undefined },
    [{ selector: { kind: "projection-source" }, value: source.value }], context.component, sourceOpenLiteralDomain,
    { members: { kind: "definition" }, origins: { kind: "complete", nodes: [syntax] } }) };
  }
  const sourceDefinition = source?.kind === "resolved" ? builder.produceDefinition(source.value) : undefined;
  if (sourceDefinition !== undefined && sourceDefinition.kind !== "resolved") return sourceDefinition;
  const sourceValue = sourceDefinition?.kind === "resolved" ? sourceDefinition.value : undefined;
  const sourceType = sourceValue?.type;
  const modifier = (token: Node | undefined, original: boolean): boolean => token === undefined ? original : ast.kindName(token) !== "KindMinusToken";
  const readonly = (original: boolean) => modifier(mapped.ReadonlyToken, original);
  const optional = (original: boolean) => modifier(mapped.QuestionToken, original);

  function option(value: SourceTypeEvidence, wasOptional: boolean): SourceProductionResult<SourceTypeEvidence> {
    if (questionToken === undefined) return { kind: "resolved", value };
    if (!optional(wasOptional)) {
      if (!wasOptional || value.type.kind !== "optional") return { kind: "resolved", value };
      return builder.component(value, { kind: "optional-value" });
    }
    const absence = builder.evidence({ type: builder.intrinsic("absence"), component,
      category: { kind: "known", category: "absence" }, numeric: undefined, sum: undefined }, [], undefined,
    sourceFiniteLiteralDomain([{ kind: "absence" }]),
    { members: { kind: "unavailable" }, origins: { kind: "complete", nodes: [syntax] } });
    return builder.join(component, "authored", [value, absence], undefined);
  }

  function valueFor(key: SourceTypeEvidence, wasOptional: boolean): SourceProductionResult<SourceTypeEvidence> {
    const value = reader.describeSyntax(annotation, withKey(key));
    return value.kind !== "resolved" ? value : option(value.value, wasOptional);
  }

  if (mapped.NameType === undefined && sourceValue !== undefined && (sourceType?.kind === "array" || sourceType?.kind === "tuple")) {
    const children: SourceEvidenceComponent[] = [];
    if (sourceType.kind === "array") {
      const key = builder.evidence({ type: builder.primitive("float64"), component: builder.componentIdentity(parameter, []),
        category: { kind: "known", category: "number" }, numeric: undefined, sum: undefined }, [], undefined, sourcePresentLiteralDomain,
      { members: { kind: "unavailable" }, origins: { kind: "complete", nodes: [parameter] } });
      const value = valueFor(key, false);
      if (value.kind !== "resolved") return value;
      children.push({ selector: { kind: "array-element" }, value: value.value });
      const inventory = produceSourceMemberInventory(context, syntax, context.bindings, value.value);
      if (inventory.kind !== "resolved") return inventory;
      return { kind: "resolved", value: builder.evidence({ type: builder.array(value.value.type, readonly(sourceType.readonly)), component,
        category: { kind: "known", category: "object" }, numeric: undefined, sum: undefined }, children, context.component, sourceOpenLiteralDomain,
      { members: inventory.value, origins: { kind: "complete", nodes: [syntax] } }) };
    }
    const elements: Extract<SourceTypeDescriptor, { readonly kind: "tuple" }>["elements"][number][] = [];
    for (const [index, element] of sourceType.elements.entries()) {
      const key = sourceKeyEvidence(context, parameter, { kind: "string", value: String(index) });
      const value = valueFor(key, element.kind === "optional");
      if (value.kind !== "resolved") return value;
      elements.push({ kind: element.kind === "rest" ? "rest" : optional(element.kind === "optional") ? "optional" : "required",
        type: value.value.type, ...(element.declaration === undefined ? {} : { declaration: element.declaration }) });
      children.push({ selector: { kind: "tuple-element", index }, value: value.value });
    }
    return { kind: "resolved", value: builder.evidence({ type: builder.tuple(elements, readonly(sourceType.readonly)), component,
      category: { kind: "known", category: "object" }, numeric: undefined, sum: undefined }, children, context.component, sourceOpenLiteralDomain,
    { members: { kind: "definition" }, origins: { kind: "complete", nodes: [syntax] } }) };
  }

  const keys: { readonly unit: SourceLiteralUnit; readonly original: SourceTypeDescriptorMember | undefined }[] = [];
  if (sourceType?.kind === "shape") {
    for (const member of sourceType.members) {
      const key = sourceMemberKeyDomain(context, member);
      if (key.kind !== "resolved") return key;
      keys.push({ unit: key.value, original: member });
    }
    if (sourceType.indexes.length > 0) return sourceSemanticRefusal(syntax,
      "This mapped type requires its original complete finite key domain before member publication.", "TSONIC_SOURCE_MAPPED_KEY_NOT_SINGLE");
  } else {
    const keyType = reader.describeSyntax(constraint, context.bindings);
    if (keyType.kind !== "resolved") return keyType;
    if (builder.freeParameters(keyType.value).length > 0) {
      return { kind: "resolved", value: builder.evidence({ type: builder.projection(keyType.value.type, { kind: "component", component }),
        component, category: { kind: "known", category: "object" }, numeric: undefined, sum: undefined },
      [{ selector: { kind: "projection-source" }, value: keyType.value }], context.component, sourceOpenLiteralDomain,
      { members: { kind: "definition" }, origins: { kind: "complete", nodes: [syntax] } }) };
    }
    const domain = builder.domain(keyType.value);
    if (domain.kind === "unreachable") return { kind: "resolved", value: builder.evidence({ type: builder.shape({ members: [], indexes: [], calls: [], constructs: [] }),
      component, category: { kind: "known", category: "object" }, numeric: undefined, sum: undefined }, [], context.component, sourceOpenLiteralDomain,
    { members: { kind: "complete", members: [], indexes: [] }, origins: { kind: "complete", nodes: [syntax] } }) };
    if (domain.kind !== "finite") return sourceSemanticRefusal(syntax,
      "This mapped type requires its original complete finite key domain before member publication.", "TSONIC_SOURCE_MAPPED_KEY_NOT_SINGLE");
    for (const unit of domain.values) keys.push({ unit, original: undefined });
  }
  const children: SourceEvidenceComponent[] = [];
  const members: SourceTypeDescriptorMember[] = [];
  const rows: SourceMemberInventoryRow[] = [];
  const names = new Set<string | Node>();
  for (const key of keys) {
    const keyValue = sourceKeyEvidence(context, parameter, key.unit);
    const selectedKey = mapped.NameType === undefined ? { kind: "resolved" as const, value: keyValue }
      : reader.describeSyntax(mapped.NameType, withKey(keyValue));
    if (selectedKey.kind !== "resolved") return selectedKey;
    const selectedDomain = builder.domain(selectedKey.value);
    if (selectedDomain.kind === "unreachable") continue;
    if (selectedDomain.kind !== "finite" || selectedDomain.values.length !== 1) return sourceSemanticRefusal(syntax,
      "A mapped member requires one exact original mapped key.", "TSONIC_SOURCE_MAPPED_KEY_NOT_SINGLE");
    const unit = selectedDomain.values[0]!;
    const name = sourceLiteralUnitKey(unit);
    if (name === undefined) return sourceSemanticRefusal(syntax, "A mapped member key is not an exact property key.", "TSONIC_SOURCE_MAPPED_KEY_NOT_SINGLE");
    const identity = name.kind === "name" ? name.name : name.declaration;
    if (names.has(identity)) return sourceSemanticRefusal(syntax,
      `Mapped member '${name.kind === "name" ? name.name : "unique symbol"}' has several original key producers.`, "TSONIC_SOURCE_MAPPED_KEY_NOT_SINGLE");
    names.add(identity);
    const mappedKey: SourceMemberKey = unit.kind === "symbol" ? { kind: "unique-symbol", declaration: unit.declaration }
      : unit.kind === "number" ? { kind: "number", value: unit.value }
      : unit.kind === "string" ? { kind: "string", value: unit.value } : (() => { throw new Error("An admitted mapped key requires its exact key category."); })();
    const origin: SourceMemberOrigin = mapped.NameType === undefined && key.original !== undefined
      ? key.original.origin : { kind: "mapped", owner: syntax, key: mappedKey };
    const value = valueFor(keyValue, key.original?.optional ?? false);
    if (value.kind !== "resolved") return value;
    const member: SourceTypeDescriptorMember = { name: name.kind === "name" ? name.name : "", origin,
      optional: optional(key.original?.optional ?? false), readonly: readonly(key.original?.readonly ?? false), type: value.value.type };
    members.push(member);
    children.push({ selector: { kind: "member", origin }, value: value.value });
    const declarations = origin.kind === "declared" ? [origin.declaration] : [origin.owner];
    rows.push({ key: name, name: member.name, declarations, origins: [origin], readOrigins: [origin],
      writeOrigins: member.readonly ? [] : [origin], getters: [], setters: [], read: "property", optional: member.optional, readonly: member.readonly,
      readType: () => ({ kind: "resolved", value: { kind: "present", value: value.value } }),
      writeType: () => ({ kind: "resolved", value: member.readonly ? { kind: "none" } : { kind: "present", value: value.value } }),
      readDomain: () => ({ kind: "present", value: builder.domain(value.value) }) });
  }
  return { kind: "resolved", value: builder.evidence({ type: builder.shape({ members, indexes: [], calls: [], constructs: [] }),
    component, category: { kind: "known", category: "object" }, numeric: undefined, sum: undefined }, children, context.component, sourceOpenLiteralDomain,
  { members: { kind: "complete", members: rows, indexes: [] }, origins: { kind: "complete", nodes: [syntax] } }) };
}
