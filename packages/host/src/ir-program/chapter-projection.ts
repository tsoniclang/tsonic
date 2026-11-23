import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent, throwInvariant } from "../diag/index.js";
import type { Block, NodeList, Statement, SyntaxChildSlot, SyntaxCopyResult, SyntaxNode, SyntaxPhaseCopy, Token } from "../ir-hir/contract.js";
import { prepareFunctionHeader, prepareSourceFileHeader } from "../ir-hir/index.js";
import type { TirChapterSyntaxSlot, TirFormal, TirModuleRoot, TirModuleStatement, TirReadyCallable, TypedPhase } from "../ir-tir/contract.js";
import type { TypeReferenceRewrite } from "./canonical-types.js";
import type { ProjectionInventory } from "./program-values.js";
import { inventoryRecord } from "./program-values.js";
import type { HeaderOperands, PreparedChapterHeader } from "./syntax-arena.js";
import type { InstantiationStop } from "./work.js";

const absent: InvariantFailure = { owner: "ir-program", query: null, origin: null, message: "A chapter header requires its admitted child image." };
type PhaseCopy = SyntaxPhaseCopy<TypedPhase, InstantiationStop, TypeReferenceRewrite>;
type StatementCell = { kind: "ready-statement"; node: Extract<TirModuleStatement, { kind: "ready-statement" }>["node"] }
  | { kind: "checked-declaration"; node: Extract<TirModuleStatement, { kind: "checked-declaration" }>["node"] }
  | { kind: "ready-callable"; node: TirReadyCallable };

function isHeaderToken<Kind extends "EndOfFile" | "AsteriskToken">(node: SyntaxNode<TypedPhase> | null,
  kind: Kind): node is Token<TypedPhase, Kind> {
  return node?.kind === kind;
}

function ordinary(slot: SyntaxChildSlot<TypedPhase>): TirChapterSyntaxSlot {
  return { kind: "syntax", fields: slot.fields, read: () => {
    const node = slot.read();
    return node.kind === "Parameter" ? { kind: "formal", node } : { kind: "ordinary", node };
  } };
}

function readyStatement(node: Statement<TypedPhase>): node is Extract<TirModuleStatement, { kind: "ready-statement" }>["node"] {
  return node.kind !== "FunctionDeclaration" || node.body === null;
}

export function prepareModuleHeader(scan: ProjectionInventory, node: TirModuleRoot, ordinal: number, phase: PhaseCopy):
SyntaxCopyResult<PreparedChapterHeader, InstantiationStop> {
  const stop = inventoryRecord(scan, 5) ?? inventoryRecord(scan, 14) ?? inventoryRecord(scan, 2) ?? inventoryRecord(scan, 0);
  if (stop !== null) return { kind: "refused", stop };
  const cells: StatementCell[] = [];
  let list: NodeList<TirModuleStatement> | undefined;
  function* statements(field: "statements"): Generator<TirChapterSyntaxSlot> {
    const source = node.statements;
    const rows = source.nodes;
    const length = rows.length;
    list = { loc: source.loc, nodes: cells };
    for (let position = 0; position < length; position += 1) {
      const index = position;
      yield { kind: "statement", fields: [field, "nodes", index], read: () => {
        const slot = requirePresent(rows[index], absent);
        let cell: StatementCell;
        switch (slot.kind) {
          case "ready-statement": cell = { kind: "ready-statement", node: slot.node }; break;
          case "checked-declaration": cell = { kind: "checked-declaration", node: slot.node }; break;
          case "ready-callable": cell = { kind: "ready-callable", node: slot.node }; break;
        }
        cells.push(cell);
        return cell;
      } };
    }
  }
  const header = prepareSourceFileHeader<TypedPhase, TirChapterSyntaxSlot>(node, ordinary, statements);
  const payload = phase.SourceFile(node.tsonic);
  if (payload.kind === "refused") return payload;
  let result: TirModuleRoot | undefined;
  return { kind: "copied", value: { kind: "module", ordinal, slots: header.slots, finish: operands => {
    if (result !== undefined) return result;
    for (const cell of cells) {
      switch (cell.kind) {
        case "checked-declaration": cell.node = operands.checked.declarationOf(cell.node); break;
        case "ready-callable": cell.node = operands.callableOf(cell.node); break;
        case "ready-statement": {
          const projected = requirePresent(operands.typed.statementOf(cell.node) ?? undefined, absent);
          if (!readyStatement(projected)) return throwInvariant(absent);
          cell.node = projected;
          break;
        }
      }
    }
    result = { kind: "SourceFile", ...header.finish(requirePresent(list, absent), source => {
      const image = operands.typed.nodeOf(source);
      return isHeaderToken(image, "EndOfFile") ? image : throwInvariant(absent);
    }), tsonic: payload.value(operands.references) };
    return result;
  } } };
}

export function prepareCallableHeader(scan: ProjectionInventory, node: TirReadyCallable, ordinal: number, phase: PhaseCopy):
SyntaxCopyResult<PreparedChapterHeader, InstantiationStop> {
  const stop = inventoryRecord(scan, 5) ?? inventoryRecord(scan, 15) ?? inventoryRecord(scan, 0);
  if (stop !== null) return { kind: "refused", stop };
  const formals: TirFormal[] = [];
  let list: NodeList<TirFormal> | undefined;
  let block: Block<TypedPhase> | undefined;
  function* parameters(field: "parameters"): Generator<TirChapterSyntaxSlot> {
    const source = node.parameters;
    const rows = source.nodes;
    const length = rows.length;
    list = { loc: source.loc, nodes: formals };
    for (let position = 0; position < length; position += 1) {
      const index = position;
      yield { kind: "syntax", fields: [field, "nodes", index], read: () => {
        const formal = requirePresent(rows[index], absent);
        formals.push(formal);
        return { kind: "formal", node: formal };
      } };
    }
  }
  const listAdmission = () => inventoryRecord(scan, 2);
  const header = prepareFunctionHeader<TypedPhase, TirChapterSyntaxSlot, InstantiationStop>(node, ordinary, parameters,
    field => [{ kind: "syntax", fields: [field], read: () => ({ kind: "ordinary", node: (block = node.body) }) }], listAdmission);
  if (header.kind === "refused") return header;
  const payload = phase.FunctionDeclaration(node.tsonic);
  if (payload.kind === "refused") return payload;
  let result: TirReadyCallable | undefined;
  const finish = (operands: HeaderOperands): TirReadyCallable => {
    if (result !== undefined) return result;
    const typed = operands.typed;
    for (let position = 0; position < formals.length; position += 1)
      formals[position] = requirePresent(typed.parameterOf(requirePresent(formals[position], absent)) ?? undefined, absent);
    const body = typed.bodyRootOf(requirePresent(block, absent));
    if (body?.kind !== "Block") return throwInvariant(absent);
    result = { kind: "FunctionDeclaration", ...header.value.finish(requirePresent(list, absent), body,
      source => requirePresent(typed.modifierOf(source) ?? undefined, absent),
      source => {
        const image = typed.nodeOf(source);
        return image?.kind === "TypeParameter" ? image : throwInvariant(absent);
      }, source => requirePresent(typed.typeNodeOf(source) ?? undefined, absent), source => {
        const image = typed.nodeOf(source);
        return image?.kind === "Identifier" ? image : throwInvariant(absent);
      }, source => {
        const image = typed.nodeOf(source);
        return isHeaderToken(image, "AsteriskToken") ? image : throwInvariant(absent);
      }), tsonic: payload.value(operands.references) };
    return result;
  };
  return { kind: "copied", value: { kind: "callable", ordinal, slots: header.value.slots, finish } };
}
