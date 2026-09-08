import { fieldFactKey } from "@tsonic/tsts";
import type { Node, ResolvedSourceCallInfo, SourceAnalysisContext, Type } from "@tsonic/tsts";
import type { TsonicSourceFileAnalysisContext } from "../../analysis/context.js";
import { readSourceFact } from "../../analysis/source-call.js";
import type { MemorySourceCall } from "../analysis-context.js";
import { publishMemoryFact } from "../analysis-context.js";
import type { TsonicMemoryLayoutFact } from "../facts.js";
import { createMemoryTypeDomains } from "./domains.js";
import type { MemoryTypeDomain } from "./domains.js";
import { bindMemoryTypeIdentity, createMemoryTypeIdentity, tsonicMemoryTypeFactKey } from "./facts.js";
import type { TsonicMemoryTypeIdentity } from "./facts.js";
import { createMemoryValueDomains } from "./values.js";
import { tsonicRawMemoryOperationFactKey } from "../../pointers/raw-memory/facts.js";

interface MemoryTypeSelection {
  readonly type: Type;
  readonly domain: MemoryTypeDomain;
  readonly identity: TsonicMemoryTypeIdentity;
}

export interface MemoryTypeContracts {
  layout(call: MemorySourceCall): boolean;
  field(call: MemorySourceCall, declaration: Node, layout: TsonicMemoryLayoutFact): boolean;
  aggregate(call: MemorySourceCall, fields: readonly Node[]): boolean;
  raw(call: MemorySourceCall, layout: TsonicMemoryLayoutFact): boolean;
  publish(call: MemorySourceCall): void;
}

export function createMemoryTypeContracts(
  source: SourceAnalysisContext,
  owner: TsonicSourceFileAnalysisContext,
  demandRaw: (expression: Node) => void,
): MemoryTypeContracts {
  const queries = source.source.getSourceFileQueries(owner.sourceFile);
  const context: TsonicSourceFileAnalysisContext = { ...queries,
    facts: source.facts, factResolver: source.factResolver, diagnostics: source.diagnostics };
  const { ast, checker, typeShape } = context;
  const domains = createMemoryTypeDomains(context);
  const identities = new Map<MemoryTypeDomain, MemoryTypeSelection[]>();
  const layouts = new Map<Node, MemoryTypeSelection>();
  const fields = new Map<Node, MemoryTypeSelection>();
  const selections = new Map<Node, { readonly selection: MemoryTypeSelection; readonly index: number }>();
  const byIdentity = new Map<TsonicMemoryTypeIdentity, MemoryTypeSelection>();
  const valueDomain = createMemoryValueDomains(context, domains, node => {
    demandRaw(node);
    const operation = source.facts.get(node, tsonicRawMemoryOperationFactKey);
    if (operation?.operation === "to-raw" || operation?.operation === "byte-offset" || operation?.operation === "address-integer-to-raw") {
      return domains.rawPointer();
    }
    if (operation?.operation !== "reinterpret") return undefined;
    const contract = source.facts.get(node, tsonicMemoryTypeFactKey);
    const pointee = contract === undefined ? undefined : byIdentity.get(contract.identity)?.domain;
    return pointee === undefined ? undefined : domains.pointer(pointee);
  });

  function intern(type: Type, domain: MemoryTypeDomain): MemoryTypeSelection {
    const entries = identities.get(domain) ?? [];
    const existing = entries.find(entry => typeShape.isTypeIdenticalTo(entry.type, type));
    if (existing !== undefined) return existing;
    const result = Object.freeze({ type, domain, identity: createMemoryTypeIdentity() });
    entries.push(result);
    identities.set(domain, entries);
    byIdentity.set(result.identity, result);
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
    if (actual === undefined || domain !== undefined && actual !== domain) return undefined;
    return intern(argument.selectedType, actual);
  }

  function pointerDomain(call: MemorySourceCall, nilDomain: MemoryTypeDomain): MemoryTypeDomain | undefined {
    const operand = canonical(call)?.sourceArguments[0];
    if (operand === undefined) return undefined;
    if (typeShape.isNullish(operand.type)) return nilDomain;
    const domain = valueDomain(operand.expression);
    return domain === undefined ? undefined : domains.pointee(domain);
  }

  return Object.freeze({
    layout(call: MemorySourceCall) {
      const selection = selected(call, 0);
      if (selection === undefined) return false;
      layouts.set(call.selected.call, selection);
      selections.set(call.selected.call, { selection, index: 0 });
      return true;
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
      fields.set(call.selected.call, parent);
      selections.set(call.selected.call, { selection, index: 1 });
      return true;
    },
    aggregate(call: MemorySourceCall, members: readonly Node[]) {
      const parent = layouts.get(call.selected.call);
      return parent !== undefined && members.every(member => fields.get(member)?.identity === parent.identity);
    },
    raw(call: MemorySourceCall, layout: TsonicMemoryLayoutFact) {
      const child = layouts.get(layout.call);
      if (child === undefined) return false;
      const domain = call.name === "toRawPointer" ? pointerDomain(call, child.domain) : child.domain;
      if (domain === undefined || domain !== child.domain) return false;
      const selection = selected(call, 0, undefined, domain);
      if (selection?.identity !== child.identity) return false;
      selections.set(call.selected.call, { selection, index: 0 });
      return true;
    },
    publish(call: MemorySourceCall) {
      const selected = selections.get(call.selected.call);
      const sourceType = selected === undefined ? undefined
        : call.selected.selection.sourceSelectedMethodTypeArguments?.[selected.index]?.selectedType;
      if (sourceType === undefined || selected === undefined) throw new Error("Missing validated memory type selection.");
      const identity = selected.selection.identity;
      bindMemoryTypeIdentity(identity, call.selected.call, sourceType);
      publishMemoryFact(call, tsonicMemoryTypeFactKey, { call: call.selected.call, sourceType, identity });
    },
  });
}
