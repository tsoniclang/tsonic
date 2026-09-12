import { fieldFactKey } from "@tsonic/tsts";
import type { Node, ResolvedSourceCallInfo, SourceAnalysisContext, Symbol, Type } from "@tsonic/tsts";
import type { TsonicSourceFileAnalysisContext } from "../../analysis/context.js";
import { readSourceFact } from "../../analysis/source-call.js";
import type { MemorySourceCall } from "../analysis-context.js";
import { publishMemoryFact } from "../analysis-context.js";
import type { TsonicMemoryFieldLayoutFact, TsonicMemoryLayoutFact, TsonicValueMemoryLayoutFact } from "../facts.js";
import { isMemoryFieldDeclaration } from "../selectors.js";
import { createMemoryTypeDomains } from "./domains.js";
import type { MemoryTypeDomain } from "./domains.js";
import { bindMemoryArrayTypeIdentity, bindMemoryTypeIdentity, bindMemoryTypeMember, createMemoryTypeIdentity,
  memoryTypeMember, tsonicMemoryTypeFactKey } from "./facts.js";
import type { MemoryTypeMemberSelection, TsonicMemoryTypeIdentity } from "./facts.js";
import { createMemoryValueDomains } from "./values.js";
import { tsonicRawMemoryOperationFactKey } from "../../pointers/raw-memory/facts.js";
import { selectTsonicFixedArray } from "../../fixed-arrays/selection.js";
import type { TsonicFixedArrayFact } from "../../fixed-arrays/facts.js";
import { tsonicMemoryRecordBindingFactKey } from "../bindings/facts.js";

interface MemoryTypeSelection {
  readonly type: Type;
  readonly domain: MemoryTypeDomain;
  readonly identity: TsonicMemoryTypeIdentity;
}

export interface MemoryTypeContracts {
  layout(call: MemorySourceCall): boolean;
  array(call: MemorySourceCall, element: TsonicMemoryLayoutFact,
    count: { readonly value: bigint; readonly runtimeBase: "number" | "bigint" }): TsonicFixedArrayFact | undefined;
  field(call: MemorySourceCall, declaration: Node, layout: TsonicMemoryLayoutFact): boolean;
  queryField(call: MemorySourceCall, declaration: Node, layout: TsonicMemoryLayoutFact): boolean;
  aggregate(call: MemorySourceCall, fields: readonly Node[]): boolean;
  raw(call: MemorySourceCall, layout: TsonicMemoryLayoutFact): boolean;
  binding(call: MemorySourceCall, field: TsonicMemoryFieldLayoutFact): boolean;
  record(call: MemorySourceCall, layout: TsonicValueMemoryLayoutFact): boolean;
  publish(call: MemorySourceCall): void;
}

export function createMemoryTypeContracts(
  source: SourceAnalysisContext,
  owner: TsonicSourceFileAnalysisContext,
  demandOperation: (expression: Node) => void,
): MemoryTypeContracts {
  const queries = source.source.getSourceFileQueries(owner.sourceFile);
  const context: TsonicSourceFileAnalysisContext = { ...queries,
    facts: source.facts, factResolver: source.factResolver, diagnostics: source.diagnostics };
  const { ast, checker, typeShape } = context;
  const domains = createMemoryTypeDomains(context);
  const identities = new Map<string, MemoryTypeSelection[]>();
  const interned = new Map<MemoryTypeDomain, Map<Type, MemoryTypeSelection>>();
  const layouts = new Map<Node, MemoryTypeSelection>();
  const fields = new Map<Node, MemoryTypeSelection>();
  const fieldMembers = new Map<Node, MemoryTypeMemberSelection>();
  const selections = new Map<Node, { readonly selection: MemoryTypeSelection; readonly sourceType: Type;
    readonly fixedArray?: TsonicFixedArrayFact; readonly member?: MemoryTypeMemberSelection }>();
  const valueDomain = createMemoryValueDomains(context, domains, node => {
    demandOperation(node);
    const record = source.facts.get(node, tsonicMemoryRecordBindingFactKey);
    if (record?.call === node) {
      return selections.get(node)?.selection.domain;
    }
    const operation = source.facts.get(node, tsonicRawMemoryOperationFactKey);
    if (operation?.operation === "to-raw" || operation?.operation === "byte-offset" || operation?.operation === "address-integer-to-raw") {
      return domains.rawPointer();
    }
    if (operation?.operation !== "reinterpret") return undefined;
    const pointee = selections.get(node)?.selection.domain;
    return pointee === undefined ? undefined : domains.pointer(pointee);
  });

  function intern(type: Type, domain: MemoryTypeDomain): MemoryTypeSelection {
    const instances = interned.get(domain) ?? new Map<Type, MemoryTypeSelection>();
    const cached = instances.get(type);
    if (cached !== undefined) return cached;
    const bucket = domains.bucket(domain);
    const entries = identities.get(bucket) ?? [];
    const existing = entries.find(entry => typeShape.isTypeIdenticalTo(entry.type, type) && domains.equivalent(entry.domain, domain));
    const result = Object.freeze({ type, domain, identity: existing?.identity ?? createMemoryTypeIdentity() });
    if (domain.kind === "reference") {
      const canonicalType = existing?.type ?? type;
      const properties = new Set(typeShape.getPropertyInfos(canonicalType).map(property => property.symbol));
      const authored = domains.referenceType(domain);
      for (const selectedType of new Set([type, ...(authored === undefined ? [] : [authored])])) {
        if (!typeShape.isTypeIdenticalTo(type, selectedType)) continue;
        for (const property of typeShape.getPropertyInfos(selectedType)) {
          const counterpart = checker.getPropertyOfType(canonicalType, checker.getSymbolName(property.symbol));
          if (counterpart === undefined || !properties.has(counterpart)) {
            throw new Error("Equivalent memory records have no selected member correspondence.");
          }
          for (const declaration of [property.symbol, ...property.rootSymbols].flatMap(symbol => checker.getSymbolDeclarations(symbol))) {
            if (declaration !== undefined) bindMemoryTypeMember(result.identity, declaration, counterpart);
          }
        }
      }
    }
    if (existing === undefined) {
      entries.push(result);
      identities.set(bucket, entries);
    }
    instances.set(type, result);
    interned.set(domain, instances);
    return result;
  }

  function canonical(call: MemorySourceCall): ResolvedSourceCallInfo | undefined {
    const selection = checker.getResolvedCallInfo(call.selected.call);
    if (selection?.outcome !== "applicable" || checker.getSignatureDeclaration(selection.selectedSignature) !==
        call.context.checker.getSignatureDeclaration(call.selected.selection.selectedSignature)) return undefined;
    return selection;
  }

  function selected(call: MemorySourceCall, index: number, annotation?: Node, domain?: MemoryTypeDomain): MemoryTypeSelection | undefined {
    const selection = canonical(call);
    const argument = selection?.sourceSelectedMethodTypeArguments?.[index];
    if (argument === undefined || !domains.isClosed(argument.selectedType)) return undefined;
    const node = argument.explicitTypeNode ?? annotation;
    const actual = node === undefined ? domain ?? domains.selected(argument.selectedType) : domains.authored(node);
    if (actual === undefined || domain !== undefined && !domains.equivalent(actual, domain)) return undefined;
    return intern(argument.selectedType, actual);
  }

  function pointerDomain(call: MemorySourceCall, nilDomain?: MemoryTypeDomain, index = 0): MemoryTypeDomain | undefined {
    const operand = canonical(call)?.sourceArguments[index];
    if (operand === undefined) return undefined;
    if (typeShape.isNullish(operand.type)) return nilDomain;
    const domain = valueDomain(operand.expression);
    return domain === undefined ? undefined : domains.pointee(domain);
  }

  function arrayResult(selection: ResolvedSourceCallInfo, queries: TsonicSourceFileAnalysisContext): TsonicFixedArrayFact | undefined {
    const arguments_ = queries.typeShape.getTypeArguments(selection.sourceResultType);
    if (arguments_.length !== 1 || arguments_[0] === undefined) return undefined;
    const array = selectTsonicFixedArray(arguments_[0], queries,
      { getFact: (subject, key) => readSourceFact(queries, subject, key) },
      { elementType: selection.sourceSelectedMethodTypeArguments?.[0]?.explicitTypeNode });
    return array?.kind === "selected" ? array.fact : undefined;
  }

  return Object.freeze({
    layout(call: MemorySourceCall) {
      const selection = selected(call, 0);
      if (selection === undefined) return false;
      layouts.set(call.selected.call, selection);
      selections.set(call.selected.call, { selection,
        sourceType: call.selected.selection.sourceSelectedMethodTypeArguments![0]!.selectedType });
      return true;
    },
    array(call: MemorySourceCall, layout: TsonicMemoryLayoutFact,
      count: { readonly value: bigint; readonly runtimeBase: "number" | "bigint" }) {
      const canonicalCall = canonical(call);
      if (canonicalCall === undefined) return undefined;
      const fixedArray = arrayResult(canonicalCall, context);
      const original = arrayResult(call.selected.selection, call.context);
      const child = layouts.get(layout.call);
      const element = child === undefined ? undefined : selected(call, 0, undefined, child.domain);
      if (fixedArray === undefined || original === undefined || child === undefined ||
          element?.identity !== child.identity || !typeShape.isTypeIdenticalTo(fixedArray.elementSourceType, element.type) ||
          fixedArray.length !== count.value || original.length !== count.value ||
          fixedArray.lengthRuntimeBase !== count.runtimeBase || original.lengthRuntimeBase !== count.runtimeBase ||
          !domains.isClosed(fixedArray.sourceType)) return undefined;
      const domain = domains.array(fixedArray.sourceType, child.domain, fixedArray.length, fixedArray.lengthRuntimeBase);
      if (domain === undefined) return undefined;
      const selection = intern(fixedArray.sourceType, domain);
      bindMemoryArrayTypeIdentity(selection.identity, child.identity, fixedArray.length, fixedArray.lengthRuntimeBase);
      layouts.set(call.selected.call, selection);
      selections.set(call.selected.call, { selection, sourceType: original.sourceType, fixedArray: original });
      return original;
    },
    field(call: MemorySourceCall, declaration: Node, layout: TsonicMemoryLayoutFact) {
      const child = layouts.get(layout.call);
      const field = readSourceFact(context, declaration, fieldFactKey);
      const annotation = ast.typeNode(declaration) ?? field?.type;
      const selector = call.selected.selection.sourceArguments[0]?.expression;
      const parameter = selector === undefined ? undefined : ast.parameters(selector)[0];
      const parent = selected(call, 0, ast.typeNode(parameter));
      const domain = annotation === undefined || parent === undefined ? undefined : domains.member(annotation, parent.domain);
      const selection = domain === undefined ? selected(call, 1, annotation) : selected(call, 1, undefined, domain);
      if (child === undefined || selection?.identity !== child.identity || parent === undefined) return false;
      const member = memoryTypeMember(parent.identity, declaration);
      if (member === undefined) return false;
      const correspondence = Object.freeze({ owner: parent.identity, declaration, member });
      fields.set(call.selected.call, parent);
      fieldMembers.set(call.selected.call, correspondence);
      selections.set(call.selected.call, { selection, member: correspondence,
        sourceType: call.selected.selection.sourceSelectedMethodTypeArguments![1]!.selectedType });
      return true;
    },
    queryField(call: MemorySourceCall, declaration: Node, layout: TsonicMemoryLayoutFact) {
      const owner = layouts.get(layout.call);
      const selector = call.selected.selection.sourceArguments[1]?.expression;
      const parameter = selector === undefined ? undefined : ast.parameters(selector)[0];
      const selection = selected(call, 0, ast.typeNode(parameter));
      const member = selection === undefined ? undefined : memoryTypeMember(selection.identity, declaration);
      if (owner === undefined || selection?.identity !== owner.identity || member === undefined || layout.kind !== "value" ||
          layout.fields.filter(field => {
            const counterpart = fieldMembers.get(field.call);
            return counterpart?.owner === owner.identity && counterpart.member === member;
          }).length !== 1) return false;
      selections.set(call.selected.call, { selection, member: Object.freeze({ owner: owner.identity, declaration, member }),
        sourceType: call.selected.selection.sourceSelectedMethodTypeArguments![0]!.selectedType });
      return true;
    },
    aggregate(call: MemorySourceCall, members: readonly Node[]) {
      const parent = layouts.get(call.selected.call);
      if (parent === undefined) return false;
      const selected = new Set<Symbol>();
      for (const member of members) {
        const field = fieldMembers.get(member);
        if (fields.get(member)?.identity !== parent.identity || field?.owner !== parent.identity || selected.has(field.member)) return false;
        selected.add(field.member);
      }
      return true;
    },
    raw(call: MemorySourceCall, layout: TsonicMemoryLayoutFact) {
      const child = layouts.get(layout.call);
      if (child === undefined) return false;
      const domain = call.name === "toRawPointer" ? pointerDomain(call, child.domain) : child.domain;
      if (domain === undefined || !domains.equivalent(domain, child.domain)) return false;
      const selection = selected(call, 0, undefined, domain);
      if (selection?.identity !== child.identity) return false;
      selections.set(call.selected.call, { selection,
        sourceType: call.selected.selection.sourceSelectedMethodTypeArguments![0]!.selectedType });
      return true;
    },
    binding(call: MemorySourceCall, field: TsonicMemoryFieldLayoutFact) {
      const parent = fields.get(field.call);
      const child = layouts.get(field.fieldLayout.call);
      const owner = parent === undefined ? undefined : selected(call, 0, undefined, parent.domain);
      const domain = pointerDomain(call, undefined, 1);
      const pointee = domain === undefined ? undefined : selected(call, 1, undefined, domain);
      if (parent === undefined || child === undefined || owner?.identity !== parent.identity ||
          pointee?.identity !== child.identity) return false;
      selections.set(call.selected.call, { selection: pointee,
        sourceType: call.selected.selection.sourceSelectedMethodTypeArguments![1]!.selectedType });
      return true;
    },
    record(call: MemorySourceCall, layout: TsonicValueMemoryLayoutFact) {
      const parent = layouts.get(layout.call);
      const selection = parent === undefined ? undefined : selected(call, 0, undefined, parent.domain);
      if (parent === undefined || selection?.identity !== parent.identity) return false;
      const type = selection.type;
      if (typeShape.isAny(type) || typeShape.isUnknown(type) || typeShape.isNullish(type) ||
          typeShape.isNumberLike(type) || typeShape.isStringLike(type) || typeShape.isBooleanLike(type) ||
          typeShape.isBigIntLike(type) || typeShape.isSymbolLike(type) || typeShape.isArrayLike(type) ||
          typeShape.getCallSignatures(type).length !== 0 || typeShape.getConstructSignatures(type).length !== 0 ||
          typeShape.getIndexInfos(type).length !== 0) return false;
      const properties = typeShape.getPropertyInfos(type);
      if (properties.length !== layout.fields.length) return false;
      if (properties.length === 0 && !checker.getSymbolDeclarations(checker.getTypeSymbol(type)).some(declaration =>
        declaration !== undefined && (ast.is.IsInterfaceDeclaration(declaration) || ast.is.IsTypeLiteralNode(declaration) ||
          ast.is.IsClassDeclaration(declaration)))) return false;
      const remaining = new Set<Symbol>();
      for (const field of layout.fields) {
        const member = fieldMembers.get(field.call);
        if (member?.owner !== parent.identity || remaining.has(member.member)) return false;
        remaining.add(member.member);
      }
      for (const property of properties) {
        const declarations = [...new Set([property.symbol, ...property.rootSymbols].flatMap(symbol =>
          checker.getSymbolDeclarations(symbol).filter(declaration => declaration !== undefined)))];
        const member = declarations.length === 1 ? memoryTypeMember(selection.identity, declarations[0]!) : undefined;
        if (property.optional || declarations.length !== 1) return false;
        if (member === undefined || !remaining.has(member) || !isMemoryFieldDeclaration(declarations[0]!, context)) return false;
        remaining.delete(member);
      }
      selections.set(call.selected.call, { selection,
        sourceType: call.selected.selection.sourceSelectedMethodTypeArguments![0]!.selectedType });
      return true;
    },
    publish(call: MemorySourceCall) {
      const selected = selections.get(call.selected.call);
      const sourceType = selected?.sourceType;
      if (sourceType === undefined || selected === undefined) throw new Error("Missing validated memory type selection.");
      const identity = selected.selection.identity;
      bindMemoryTypeIdentity(identity, call.selected.call, sourceType, selected.fixedArray, selected.member);
      publishMemoryFact(call, tsonicMemoryTypeFactKey, { call: call.selected.call, sourceType, identity });
    },
  });
}
