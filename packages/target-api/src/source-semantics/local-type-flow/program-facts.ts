// The value-model share of SourceProgramFacts (nextgen plan §2, CONTRACT.md): values, sums, relations,
// instantiations and the value-model refusals, built once per program view from the Host solver.
// Every member answers from Host facts only; a missing fact for a supported form throws (I4), it is never undefined
// and never retried through checker types. The returned object owns every per-program table (I5).
import {
  argumentPassingFactKey, pointerOperationFactKey, sourceMarkerFactKey,
  type AstReader, type Node, type SourceFile, type SourcePrimitiveKind,
} from "@tsonic/tsts";
import type {
  SourceElementAccessRecord, SourceInstantiation, SourceInstantiationFacts, SourceNullishAdmission, SourceOperatorRecord,
  SourceRefusal, SourceRelationFacts, SourceTypeofCategoryName, SourceSlotOutcome, SourceSumFacts, SourceTypeOutcome, SourceUnionRelation, SourceValueFacts,
} from "../../public/source/facts.js";
import { Node_Expression, Node_Initializer, Node_Operand } from "../../source-navigation/ast.js";
import { isSourceCallableSignatureDeclaration } from "../../source-navigation/callable-boundaries.js";
import { isTypeSyntaxNode } from "../../source-navigation/syntax.js";
import type { SourceHostInput } from "../../host-input/index.js";
import { analyzeSourceEffectiveTypes, type SourceSolvedValueModel } from "./solver.js";
import { createSourceTypeDescriptorUnions, sourceTypeDescriptorsEqual, sourceTypeDescriptorStructure, sourceTypeDescriptorSum, sourceTypeDescriptorTupleValue,
  sourceTypeDescriptorUnion, substituteSourceTypeDescriptor } from "./terms.js";
import { sourceTypeDescriptorOpenness, sourceTypeFlowIsBroadSlot } from "./uses.js";
import { sourceTypeDescriptorAwaitedPayload } from "./awaited.js";
import { createSourceRelationQuery } from "./relations.js";
import type { SourceObligation } from "../../public/source/analyses.js";
import type { SourceClosedSum, SourceTypeDescriptor, SourceTypeFlowRefusal, SourceTypeFlowSource } from "./types.js";

/** Host record of a native pointer marker operation: the Legacy fact with every checker Type replaced by a descriptor. */
export interface SourcePointerOperationRecord {
  readonly call: Node;
  readonly operation: "address-of" | "allocate" | "load" | "store" | "equal-pointer" | "hash-pointer" | "bind-pointer" | "project-pointer";
  readonly pointee: SourceTypeDescriptor;
  readonly result: SourceTypeDescriptor;
  /** The operand expressions in marker parameter order (storage, initial value, pointer, value, identity/read/write ...). */
  readonly operands: readonly Node[];
  /** address-of / allocate / bind-pointer: the storage location identity. */
  readonly location?: Node;
  readonly storageDeclaration?: Node;
}

export interface SourceValueModelFacts {
  readonly values: SourceValueFacts;
  readonly sums: SourceSumFacts;
  readonly relations: SourceRelationFacts;
  readonly instantiations: SourceInstantiationFacts;
  /** Native pointer operations (request to B: publish as `selections.pointerOperation` or a values member). */
  pointerOperation(call: Node): SourcePointerOperationRecord | SourceRefusal | undefined;
  /** The solver's obligations (interface, read-only, constraint, literal admission, write fit), checker-free and frozen. */
  obligations(): readonly SourceObligation[];
  refusals(): readonly SourceRefusal[];
}

const tokens: ReadonlyMap<string, string> = new Map([
  ["KindPlusToken", "+"], ["KindMinusToken", "-"], ["KindAsteriskToken", "*"], ["KindSlashToken", "/"], ["KindPercentToken", "%"],
  ["KindAsteriskAsteriskToken", "**"], ["KindAmpersandToken", "&"], ["KindBarToken", "|"], ["KindCaretToken", "^"],
  ["KindLessThanLessThanToken", "<<"], ["KindGreaterThanGreaterThanToken", ">>"], ["KindGreaterThanGreaterThanGreaterThanToken", ">>>"],
  ["KindLessThanToken", "<"], ["KindLessThanEqualsToken", "<="], ["KindGreaterThanToken", ">"], ["KindGreaterThanEqualsToken", ">="],
  ["KindEqualsEqualsToken", "=="], ["KindEqualsEqualsEqualsToken", "==="], ["KindExclamationEqualsToken", "!="],
  ["KindExclamationEqualsEqualsToken", "!=="], ["KindAmpersandAmpersandToken", "&&"], ["KindBarBarToken", "||"],
  ["KindQuestionQuestionToken", "??"], ["KindCommaToken", ","], ["KindEqualsToken", "="], ["KindPlusEqualsToken", "+="],
  ["KindMinusEqualsToken", "-="], ["KindAsteriskEqualsToken", "*="], ["KindSlashEqualsToken", "/="], ["KindPercentEqualsToken", "%="],
  ["KindAsteriskAsteriskEqualsToken", "**="], ["KindAmpersandEqualsToken", "&="], ["KindBarEqualsToken", "|="],
  ["KindCaretEqualsToken", "^="], ["KindLessThanLessThanEqualsToken", "<<="], ["KindGreaterThanGreaterThanEqualsToken", ">>="],
  ["KindGreaterThanGreaterThanGreaterThanEqualsToken", ">>>="], ["KindAmpersandAmpersandEqualsToken", "&&="],
  ["KindBarBarEqualsToken", "||="], ["KindQuestionQuestionEqualsToken", "??="], ["KindTildeToken", "~"],
  ["KindExclamationToken", "!"], ["KindPlusPlusToken", "++"], ["KindMinusMinusToken", "--"],
  ["KindInKeyword", "in"], ["KindInstanceOfKeyword", "instanceof"],
]);

const referenceMarkers: ReadonlySet<string> = new Set(["write-only-reference", "read-write-reference", "read-only-reference"]);
const pointerMarkers: ReadonlySet<string> = new Set([
  "address-of", "allocate", "load", "store", "equal-pointer", "hash-pointer", "bind-pointer", "project-pointer",
]);
const wideIntegers: ReadonlySet<SourcePrimitiveKind> = new Set(["int64", "uint64", "int128", "uint128"]);

function invariant(ast: AstReader, node: Node, message: string): never {
  const file = ast.getSourceFile(node);
  throw new Error(`Source value facts: ${message} (${ast.kindName(node)} at ${file === undefined ? "?" : ast.getFileName(file)}:${ast.pos(node)}).`);
}

function accessMode(ast: AstReader, node: Node): "read" | "write" | "read-write" {
  let selected = node;
  let parent = ast.parent(selected);
  while (parent !== undefined && ast.is.IsParenthesizedExpression(parent)) { selected = parent; parent = ast.parent(parent); }
  if (parent === undefined) return "read";
  if (ast.is.IsBinaryExpression(parent) && ast.as.AsBinaryExpression(parent)?.Left === selected) {
    const token = ast.operatorKindName(parent);
    if (token === "KindEqualsToken") return "write";
    if (token !== undefined && tokens.get(token)?.endsWith("=") === true && !["==", "===", "!=", "!==", "<=", ">="].includes(tokens.get(token)!)) {
      return "read-write";
    }
  }
  if ((ast.is.IsPrefixUnaryExpression(parent) || ast.is.IsPostfixUnaryExpression(parent)) &&
    (ast.operatorKindName(parent) === "KindPlusPlusToken" || ast.operatorKindName(parent) === "KindMinusMinusToken")) return "read-write";
  return "read";
}

/**
 * Builds the value-model facts of one program view. Called once by the SourceProgramFacts assembly (writer B).
 * `programSourceFiles` is the program file order that fixes authored-first sum order (C-2459). `input` is the program's
 * one host-input adapter (created once by the program builder and shared with the selection witnesses, R4/I3).
 */
export function buildSourceValueModelFacts(source: SourceTypeFlowSource, programSourceFiles: readonly SourceFile[],
  input: SourceHostInput): SourceValueModelFacts {
  const { ast } = source;
  const solved: SourceSolvedValueModel = analyzeSourceEffectiveTypes(source, createSourceTypeDescriptorUnions(ast, programSourceFiles), input);
  const owner = solved.owner;
  const refusalRecords = new WeakMap<SourceTypeFlowRefusal, SourceRefusal>();
  const toRefusal = (refusal: SourceTypeFlowRefusal): SourceRefusal => {
    let record = refusalRecords.get(refusal);
    if (record === undefined) {
      record = Object.freeze({ kind: "refused", code: refusal.code, message: refusal.reason, site: refusal.site,
        ...(refusal.related === undefined ? {} : { related: refusal.related }) });
      refusalRecords.set(refusal, record);
    }
    return record;
  };
  const sourceFileOf = (node: Node): SourceFile => ast.getSourceFile(node) ?? invariant(ast, node, "a value node requires its source file");

  // ---- values ----------------------------------------------------------------------------------------------------
  function type(node: Node): SourceTypeOutcome {
    const outcome = solved.get(node);
    if (outcome !== undefined) {
      // An element access whose selection no Host rule names is refused at the access (E8); its record never exists.
      if (outcome.kind !== "refused" && ast.is.IsElementAccessExpression(node)) {
        const selection = elementSelection(node);
        if (selection.kind === "refused") return selection;
      }
      return outcome;
    }
    const declared = solved.declaredSlot(node);
    if (declared !== undefined) {
      return Object.freeze({ kind: "resolved", type: declared.type, provenance: Object.freeze({ group: declared.slot,
        occurrence: node, sourceFile: sourceFileOf(node), component: Object.freeze({ declaration: declared.slot }) }) });
    }
    // An authored type node (annotation, constraint, type argument, provider or marker type syntax): its authored-syntax
    // translation or its refusal.
    const authored = solved.typeSyntax(node);
    if (authored !== undefined) return authored;
    // A declaration that is not a solver slot (R-B4-5): its declared value, or the refusal that it has none.
    if (declarationValueNode(node)) {
      const described = solved.declarationValue(node);
      if (described === undefined) {
        return Object.freeze({ kind: "refused", source: "tsonic", code: "TSONIC_LOCAL_TYPE_UNSUPPORTED", site: node,
          reason: "The value of this declaration has no Host description. Annotate it with a supported type form." });
      }
      return Object.freeze({ kind: "resolved", type: described, provenance: Object.freeze({ group: node, occurrence: node,
        sourceFile: sourceFileOf(node), component: Object.freeze({ declaration: node }) }) });
    }
    return invariant(ast, node, "no Host type for this node; only value nodes, declarations, slots and type nodes have one");
  }
  const resolvedType = (node: Node): SourceTypeDescriptor | undefined => {
    const outcome = type(node);
    return outcome.kind === "refused" ? undefined : outcome.type;
  };
  function requireType(node: Node, purpose: string): SourceTypeDescriptor {
    const outcome = type(node);
    if (outcome.kind === "refused") invariant(ast, node, `${purpose} was requested for a refused value; forward values.type(node) first`);
    return outcome.type;
  }

  function callableReturn(declaration: Node): SourceTypeOutcome {
    const outcome = solved.callableReturn(declaration);
    if (outcome !== undefined) return outcome;
    if (!isSourceCallableSignatureDeclaration(ast, declaration)) invariant(ast, declaration, "callableReturn requires a callable declaration");
    // A callable whose result no Host rule describes is refused at the callable (I4), never left to the target. The
    // same record is in refusals() for every program callable (R-C2-10).
    let refusal = callableReturnRefusals.get(declaration);
    if (refusal === undefined) {
      refusal = Object.freeze({ kind: "refused", source: "tsonic", code: "TSONIC_LOCAL_TYPE_UNSUPPORTED",
        site: declaration, reason: "This callable's result type has no Host rule. Annotate the callable's return type." });
      callableReturnRefusals.set(declaration, refusal);
    }
    return refusal;
  }
  const callableReturnRefusals = new Map<Node, SourceTypeFlowRefusal>();

  // The domain of type() (R-C2-1): value nodes, declarations and slots, and authored type nodes. Not a probe for a
  // fallback: inside the domain type() answers or fails as an invariant.
  const valueNodeSet = new Set(solved.valueNodes);
  function has(node: Node): boolean {
    return valueNodeSet.has(node) || solved.get(node) !== undefined || solved.declaredSlot(node) !== undefined ||
      isTypeSyntaxNode(ast, node) || declarationValueNode(node);
  }
  // Declarations whose value a storage or ownership subject reads (R-B4-5), in program or library files.
  function declarationValueNode(node: Node): boolean {
    return ast.is.IsVariableDeclaration(node) || ast.is.IsParameterDeclaration(node) || ast.is.IsPropertyDeclaration(node) ||
      ast.is.IsPropertySignatureDeclaration(node) || ast.is.IsBindingElement(node) || ast.is.IsClassDeclaration(node) ||
      ast.is.IsFunctionDeclaration(node) || ast.is.IsMethodDeclaration(node) || ast.is.IsMethodSignatureDeclaration(node) ||
      ast.is.IsGetAccessorDeclaration(node) || ast.is.IsSetAccessorDeclaration(node);
  }

  function slot(node: Node): SourceSlotOutcome {
    const declared = solved.declaredSlot(node);
    if (declared !== undefined) {
      return Object.freeze({ kind: "slot", slot: declared.slot, type: declared.type, broad: declared.broad,
        authority: ast.typeNode(declared.slot) !== undefined ? "declared" : "inferred" });
    }
    const outcome = solved.get(node);
    if (outcome?.kind === "refused") return outcome;
    if (outcome !== undefined) {
      return Object.freeze({ kind: "slot", slot: node, type: outcome.type, broad: sourceTypeFlowIsBroadSlot(outcome.type), authority: "inferred" });
    }
    return invariant(ast, node, "no Host slot for this node");
  }

  function admission(use: Node) {
    return solved.slotAdmission(use) ?? invariant(ast, use, "no Host slot admission at this use");
  }

  const operatorRecords = new Map<Node, SourceOperatorRecord | SourceRefusal>();
  function operator(node: Node): SourceOperatorRecord | SourceRefusal {
    const existing = operatorRecords.get(node);
    if (existing !== undefined) return existing;
    let text: string | undefined;
    let operands: readonly (Node | undefined)[];
    if (ast.is.IsBinaryExpression(node)) {
      const binary = ast.as.AsBinaryExpression(node);
      const token = ast.operatorKindName(node);
      text = token === undefined ? undefined : tokens.get(token);
      operands = [binary?.Left, binary?.Right];
    } else if (ast.is.IsPrefixUnaryExpression(node) || ast.is.IsPostfixUnaryExpression(node)) {
      const token = ast.operatorKindName(node);
      text = token === undefined ? undefined : tokens.get(token);
      operands = [Node_Operand(ast, node)];
    } else if (ast.is.IsTypeOfExpression(node)) {
      text = "typeof";
      operands = [Node_Expression(ast, node)];
    } else return invariant(ast, node, "operator records exist for binary, unary and typeof operations only");
    if (text === undefined || operands.some(operand => operand === undefined)) invariant(ast, node, "an operator requires its authored token and operands");
    // A refused operation (its own decision or a refused operand) is published as that refusal (contract R-B1).
    const refused = [node, ...operands as Node[]].map(type).find(outcome => outcome.kind === "refused");
    if (refused !== undefined && refused.kind === "refused") {
      const refusal = toRefusal(refused);
      operatorRecords.set(node, refusal);
      return refusal;
    }
    const result = requireType(node, "an operator record");
    const operandTypes = operands.map(operand => requireType(operand!, "an operator record"));
    const primitiveOf = (selected: SourceTypeDescriptor): SourcePrimitiveKind | undefined => {
      const structure = sourceTypeDescriptorStructure(selected);
      return structure.kind === "primitive" ? structure.primitive : undefined;
    };
    const resultPrimitive = primitiveOf(result);
    const operandPrimitives = operandTypes.map(primitiveOf);
    const record: SourceOperatorRecord = Object.freeze({
      node, operator: text!, operands: Object.freeze(operandTypes), result, admission: "admitted",
      ...(resultPrimitive !== undefined && operandPrimitives.every(kind => kind !== undefined)
        ? { primitive: Object.freeze({ result: resultPrimitive, operands: Object.freeze(operandPrimitives as SourcePrimitiveKind[]) }) } : {}),
      ...(text === "??" ? { coalesce: Object.freeze({ leftAbsence: absence(operandTypes[0]!) }) } : {}),
    });
    operatorRecords.set(node, record);
    return record;
  }
  function absence(selected: SourceTypeDescriptor): "never" | "possible" | "always" {
    const structure = sourceTypeDescriptorStructure(selected);
    if (structure.kind === "intrinsic") {
      return structure.intrinsic === "absence" || structure.intrinsic === "void" ? "always"
        : sourceTypeDescriptorOpenness(ast, structure) === "top" ? "possible" : "never";
    }
    if (structure.kind === "optional") return "possible";
    if (structure.kind === "union") return structure.types.some(member => absence(member) !== "never") ? "possible" : "never";
    return "never";
  }

  // ---- element access (E8, LEDGER E8): the selection is made on the Host descriptor of the receiver, by original
  // identity (member origin, index declaration, tuple position); the checker's member witness is read only where the
  // descriptor has no structure (a declared reference without definition, an intrinsic, a JS API member by name).
  // A supported form always has a record; an unsupported one is refused at the access (values.type(node)).
  type ElementSelection = { readonly selected: SourceElementAccessRecord["selected"]; readonly readonly: boolean };
  const elementSelections = new Map<Node, { readonly kind: "selected"; readonly selection: ElementSelection } |
    { readonly kind: "operand-refused" } | SourceTypeFlowRefusal>();
  const elementRefusal = (node: Node, code: "TSONIC_LOCAL_TYPE_UNSUPPORTED" | "TSONIC_LOCAL_TYPE_UNION", reason: string): SourceTypeFlowRefusal =>
    Object.freeze({ kind: "refused", source: "tsonic", code, site: node, reason });
  function elementKey(indexNode: Node): { readonly name?: string; readonly position?: bigint } {
    const literal = solved.literal(indexNode);
    if (literal === undefined) return {};
    if (literal.form === "string" || literal.form === "template") {
      return /^(0|[1-9]\d*)$/u.test(literal.text) ? { name: literal.text, position: BigInt(literal.text) } : { name: literal.text };
    }
    const position = literal.integerConstant ?? literal.integer;
    return position === undefined ? {} : { name: position.toString(), position };
  }
  // Selection on one receiver structure; undefined when the descriptor does not name it.
  function selectOnStructure(structure: SourceTypeDescriptor, index: SourceTypeDescriptor,
    key: { readonly name?: string; readonly position?: bigint }): ElementSelection | undefined {
    const indexStructure = sourceTypeDescriptorStructure(index);
    const numericIndex = indexStructure.kind === "primitive" && indexStructure.primitive !== "bool" && indexStructure.primitive !== "char";
    const namedMember = key.name !== undefined && key.position === undefined;
    switch (structure.kind) {
      case "string": return namedMember ? undefined : { selected: { kind: "string-character" }, readonly: true };
      case "array": return namedMember ? undefined : { selected: { kind: "element" }, readonly: structure.readonly };
      case "tuple": {
        if (namedMember) return undefined;
        const position = key.position;
        if (position !== undefined && position <= BigInt(Number.MAX_SAFE_INTEGER) &&
          sourceTypeDescriptorTupleValue(structure, Number(position)) !== undefined) {
          return { selected: { kind: "tuple", position: Number(position) }, readonly: structure.readonly };
        }
        return position === undefined && numericIndex ? { selected: { kind: "element" }, readonly: structure.readonly } : undefined;
      }
      case "shape": {
        const member = key.name === undefined ? undefined : structure.members.find(selected => selected.name === key.name);
        if (member !== undefined) {
          const declaration = member.origin.kind === "declared" ? member.origin.declaration : member.origin.owner;
          return { selected: { kind: "member", declaration, name: member.name }, readonly: member.readonly === true };
        }
        const byKey = (kind: "number" | "string") => structure.indexes.find(entry => {
          const keyStructure = sourceTypeDescriptorStructure(entry.key);
          return kind === "string" ? keyStructure.kind === "string"
            : keyStructure.kind === "primitive" && keyStructure.primitive !== "bool" && keyStructure.primitive !== "char";
        });
        const entry = (numericIndex || key.position !== undefined ? byKey("number") : undefined) ??
          (indexStructure.kind === "string" || numericIndex || key.name !== undefined ? byKey("string") : undefined);
        return entry === undefined ? undefined : { selected: { kind: "index-signature", declaration: entry.declaration }, readonly: entry.readonly };
      }
      default: return undefined;
    }
  }
  function elementSelection(node: Node):
    { readonly kind: "selected"; readonly selection: ElementSelection } | { readonly kind: "operand-refused" } | SourceTypeFlowRefusal {
    const existing = elementSelections.get(node);
    if (existing !== undefined) return existing;
    const receiver = Node_Expression(ast, node) ?? invariant(ast, node, "an element access requires its receiver");
    const indexNode = ast.as.AsElementAccessExpression(node)?.ArgumentExpression ?? invariant(ast, node, "an element access requires its index");
    const receiverOutcome = type(receiver);
    const indexOutcome = type(indexNode);
    let selection: { readonly kind: "selected"; readonly selection: ElementSelection } | { readonly kind: "operand-refused" } | SourceTypeFlowRefusal;
    if (receiverOutcome.kind === "refused" || indexOutcome.kind === "refused") selection = Object.freeze({ kind: "operand-refused" });
    else {
      const key = elementKey(indexNode);
      let structure = sourceTypeDescriptorStructure(receiverOutcome.type);
      if (structure.kind === "optional") structure = sourceTypeDescriptorStructure(structure.value);
      let selected: ElementSelection | SourceTypeFlowRefusal | undefined;
      if (structure.kind === "union") {
        // Every present arm must make the same selection; a target then reads the element once (no per-arm element).
        const arms = structure.types.filter(arm => !(arm.kind === "intrinsic" && (arm.intrinsic === "absence" || arm.intrinsic === "void")));
        const choices = arms.map(arm => {
          const armStructure = sourceTypeDescriptorStructure(arm);
          return selectOnStructure(armStructure.kind === "optional" ? sourceTypeDescriptorStructure(armStructure.value) : armStructure,
            indexOutcome.type, key);
        });
        const first = choices[0];
        const same = first !== undefined && choices.every(choice => choice !== undefined &&
          choice.selected.kind === first.selected.kind &&
          (choice.selected.kind !== "tuple" || first.selected.kind === "tuple" && choice.selected.position === first.selected.position) &&
          (choice.selected.kind !== "member" || first.selected.kind === "member" && choice.selected.declaration === first.selected.declaration) &&
          (choice.selected.kind !== "index-signature" || first.selected.kind === "index-signature" &&
            choice.selected.declaration === first.selected.declaration));
        selected = same ? { selected: first.selected, readonly: choices.some(choice => choice!.readonly) }
          : elementRefusal(node, "TSONIC_LOCAL_TYPE_UNION", "The arms of this union receiver select different elements, members or " +
            "index signatures. Narrow the receiver to one arm before the element access.");
      } else selected = selectOnStructure(structure, indexOutcome.type, key);
      if (selected === undefined) {
        // No descriptor structure names the selection: the checker's member witness (selection witness, R3).
        const declaration = input.member(node)?.declarations[0];
        if (declaration !== undefined && ast.is.IsIndexSignatureDeclaration(declaration)) {
          selected = { selected: { kind: "index-signature", declaration }, readonly: ast.hasModifierKind(declaration, "readonly") };
        } else if (declaration !== undefined) {
          const name = ast.name(declaration);
          selected = { selected: { kind: "member", declaration, name: name === undefined ? key.name ?? "" : ast.text(name) },
            readonly: ast.hasModifierKind(declaration, "readonly") };
        } else {
          selected = elementRefusal(node, "TSONIC_LOCAL_TYPE_UNSUPPORTED", structure.kind === "intrinsic"
            ? `An element access on a '${structure.intrinsic}' value names no element, member or index signature. Annotate the receiver with a declared type.`
            : "This element access names no element, tuple position, member or index signature of its receiver. Annotate the receiver with a declared type.");
        }
      }
      selection = "kind" in selected && selected.kind === "refused" ? selected
        : Object.freeze({ kind: "selected", selection: Object.freeze(selected as ElementSelection) });
    }
    elementSelections.set(node, selection);
    return selection;
  }

  const elementRecords = new Map<Node, SourceElementAccessRecord>();
  function elementAccess(node: Node): SourceElementAccessRecord {
    const existing = elementRecords.get(node);
    if (existing !== undefined) return existing;
    if (!ast.is.IsElementAccessExpression(node)) invariant(ast, node, "element access records exist for element access expressions only");
    const result = requireType(node, "an element access record");
    const selection = elementSelection(node);
    if (selection.kind !== "selected") invariant(ast, node, "an element access record was requested for a refused operand; forward values.type of the receiver and index first");
    const receiver = Node_Expression(ast, node)!;
    const indexNode = ast.as.AsElementAccessExpression(node)!.ArgumentExpression!;
    const record: SourceElementAccessRecord = Object.freeze({ node, receiver, receiverType: requireType(receiver, "an element access record"),
      index: requireType(indexNode, "an element access record"), selected: Object.freeze(selection.selection.selected), result,
      readonly: selection.selection.readonly, access: accessMode(ast, node),
      // Part of an optional chain (`a?.[i]`, `a?.b[i]`): the checker's access witness, as for member access.
      optionalChain: input.member(node)?.optionalChain === true });
    elementRecords.set(node, record);
    return record;
  }

  // typeof category of a descriptor's non-nullish part, from its Source (TS) type (N3', contract decision 3).
  function category(selected: SourceTypeDescriptor, operand: Node | undefined): SourceNullishAdmission["category"] {
    const structure = sourceTypeDescriptorStructure(selected);
    switch (structure.kind) {
      case "string": return "string";
      case "primitive":
        if (structure.primitive === "bool") return "boolean";
        if (structure.primitive === "char") return "string";
        return wideIntegers.has(structure.primitive) && (operand === undefined || solved.numberOrigin(operand) === undefined) ? "bigint" : "number";
      case "intrinsic":
        // `object` holds both objects and functions: no single category is proven.
        return structure.intrinsic === "bigint" ? "bigint" : structure.intrinsic === "symbol" ? "symbol" : undefined;
      case "callable": return "function";
      // A value with a call or construct signature is a JS function: a class constructor with static members is a
      // construct-only shape and still `typeof === "function"` (K-2669).
      case "shape": return structure.calls.length > 0 || structure.constructs.length > 0 ? "function" : "object";
      case "array": case "tuple": return "object";
      case "declared":
        if (ast.is.IsEnumDeclaration(structure.declaration)) {
          const members = ast.members(structure.declaration).filter((member): member is Node => member !== undefined);
          return members.length > 0 && members.every(member => {
            const initializer = ast.as.AsEnumMember(member)?.Initializer;
            const value = initializer === undefined ? undefined : solved.literal(initializer);
            return value?.form === "string" || value?.form === "template";
          }) ? "string" : "number";
        }
        // A class instance is an object. A type parameter, or an interface/alias reference without a definition (a
        // recursion cut, an unexpressible declaration-file type), proves no category here.
        return ast.is.IsClassDeclaration(structure.declaration) || ast.is.IsClassExpression(structure.declaration) ? "object" : undefined;
      case "union": {
        const categories = new Set(structure.types.map(member => category(member, operand)));
        return categories.size === 1 ? [...categories][0] : undefined;
      }
      case "optional": return category(structure.value, operand);
    }
  }
  // The nullish admission of an operand whose Host descriptor admits absence (§4.3 E9, N7, K-2676), from the intrinsic
  // null / undefined constituents of the value read at the operand, taken by host-input before the one-absence erasure
  // (aliases with their actual type arguments, generic member and call results, narrowing: host-input/nullish-components).
  // A found intrinsic is proven; a missing one is proven absent only when every constituent was classified. Both found:
  // "both" (an opaque constituent cannot remove a found intrinsic). An opaque constituent or no read: "unavailable".
  function nullishAdmission(operand: Node, absent: boolean): SourceNullishAdmission["admission"] {
    if (!absent) return "none";
    const found = input.nullishComponents(operand);
    if (found.null && found.undefined) return "both";
    if (!found.complete) return "unavailable";
    // A complete read with neither intrinsic while the descriptor keeps absence: the absence arm is not attributable.
    return found.null ? "null-only" : found.undefined ? "undefined-only" : "unavailable";
  }
  // ---- typeof sites (E23, WP0 A1/A7, K-2657) -------------------------------------------------------------------------
  // A wide-integer arm (int64/uint64/int128/uint128) is "number" only when its values come from a Q1-defaulted TS
  // `number` (pre-projection number origin), else "bigint"; every other arm's category follows its descriptor.
  type CategoryName = SourceTypeofCategoryName;
  const isWideInteger = (type: SourceTypeDescriptor): boolean => {
    const structure = sourceTypeDescriptorStructure(type);
    return structure.kind === "primitive" && wideIntegers.has(structure.primitive);
  };
  const isAbsenceArm = (type: SourceTypeDescriptor): boolean =>
    type.kind === "intrinsic" && (type.intrinsic === "absence" || type.intrinsic === "void");
  // The origins of the values that land in one wide-integer arm of a sum, per contributing component (never one
  // operand-wide receipt). An inferred family (a conditional or `??` join) asks each operand that contributes the arm,
  // recursively through the operands' own sums; an authored family is explicit unless the arm comes from a binder of its
  // application (then the origin of the binder's value is not on the descriptor: unproven).
  function wideArmOrigins(sum: SourceClosedSum, arm: SourceTypeDescriptor, depth: number): Set<"number" | "bigint"> | undefined {
    if (depth > 16) return undefined;
    const family = sum.identity.family;
    let operands: readonly (Node | undefined)[] | undefined;
    if (ast.is.IsConditionalExpression(family)) {
      const conditional = ast.as.AsConditionalExpression(family);
      operands = [conditional?.WhenTrue, conditional?.WhenFalse];
    } else if (ast.is.IsBinaryExpression(family) && ast.operatorKindName(family) === "KindQuestionQuestionToken") {
      const binary = ast.as.AsBinaryExpression(family);
      operands = [binary?.Left, binary?.Right];
    }
    if (operands === undefined) {
      const fromBinder = sum.identity.application.some(argument => sourceTypeDescriptorsEqual(argument, arm) ||
        (argument.kind === "union" || argument.kind === "optional") && sums.sumOf(argument)?.arms.some(selected => sourceTypeDescriptorsEqual(selected.type, arm)));
      return fromBinder ? undefined : new Set(["bigint"]);
    }
    const origins = new Set<"number" | "bigint">();
    for (const operand of operands) {
      if (operand === undefined) return undefined;
      const type = resolvedType(operand);
      if (type === undefined) return undefined;
      const inner = type.kind === "union" || type.kind === "optional" ? sums.sumOf(type) : undefined;
      if (inner !== undefined) {
        if (!inner.arms.some(selected => sourceTypeDescriptorsEqual(selected.type, arm))) continue;
        const nested = wideArmOrigins(inner, arm, depth + 1);
        if (nested === undefined) return undefined;
        for (const origin of nested) origins.add(origin);
        continue;
      }
      const structure = sourceTypeDescriptorStructure(type);
      const present = structure.kind === "optional" ? structure.value : type;
      if (!sourceTypeDescriptorsEqual(present, arm)) continue;
      const leaf = valueOrigins(operand, depth + 1);
      if (leaf === undefined) return undefined;
      for (const origin of leaf) origins.add(origin);
    }
    return origins.size === 0 ? undefined : origins;
  }
  // The origins of a scalar wide-integer value, per component: the branches of a conditional or `??` join and the
  // initializer of an unwritten local are followed; any other value has its own pre-Q1 number origin.
  function valueOrigins(node: Node, depth: number): Set<"number" | "bigint"> | undefined {
    if (depth > 16) return undefined;
    let value = node;
    while (ast.is.IsParenthesizedExpression(value) || ast.is.IsSatisfiesExpression(value) || ast.is.IsNonNullExpression(value)) {
      const inner = Node_Expression(ast, value);
      if (inner === undefined) return undefined;
      value = inner;
    }
    const parts = ast.is.IsConditionalExpression(value)
      ? [ast.as.AsConditionalExpression(value)?.WhenTrue, ast.as.AsConditionalExpression(value)?.WhenFalse]
      : ast.is.IsBinaryExpression(value) && ast.operatorKindName(value) === "KindQuestionQuestionToken"
        ? [ast.as.AsBinaryExpression(value)?.Left, ast.as.AsBinaryExpression(value)?.Right] : undefined;
    if (parts === undefined && ast.is.IsIdentifier(value)) {
      const declaration = source.navigation.sourceReferenceFor(value)?.declaration;
      const initializer = declaration !== undefined && ast.is.IsVariableDeclaration(declaration) && ast.typeNode(declaration) === undefined &&
        !source.navigation.declarationUseSummary(declaration).bindingWritten ? Node_Initializer(ast, declaration) : undefined;
      if (initializer !== undefined) return valueOrigins(initializer, depth + 1);
    }
    if (parts === undefined) return new Set([solved.numberOrigin(value) !== undefined ? "number" : "bigint"]);
    const origins = new Set<"number" | "bigint">();
    for (const part of parts) {
      if (part === undefined) return undefined;
      const type = resolvedType(part);
      if (type === undefined || !isWideInteger(type)) continue;
      const nested = valueOrigins(part, depth + 1);
      if (nested === undefined) return undefined;
      for (const origin of nested) origins.add(origin);
    }
    return origins.size === 0 ? undefined : origins;
  }
  function sumArmCategory(sum: SourceClosedSum, index: number, admission: SourceNullishAdmission["admission"]):
    CategoryName | "unproven" | "conflict" {
    const arm = sum.arms[index]!.type;
    if (isAbsenceArm(arm)) return admission === "undefined-only" ? "undefined" : admission === "null-only" ? "object" : "unproven";
    if (!isWideInteger(arm)) return category(arm, undefined) ?? "unproven";
    const origins = wideArmOrigins(sum, arm, 0);
    return origins === undefined ? "unproven" : origins.size === 1 ? [...origins][0]! : "conflict";
  }
  const typeofRecords = new Map<string, SourceNullishAdmission | SourceRefusal>();
  const typeofKeys = new Map<Node, number>();
  const nodeKey = (node: Node): number => {
    let key = typeofKeys.get(node);
    if (key === undefined) { key = typeofKeys.size; typeofKeys.set(node, key); }
    return key;
  };
  function typeofCategory(operation: Node, operand: Node): SourceNullishAdmission | SourceRefusal {
    const key = `${nodeKey(operation)}:${nodeKey(operand)}`;
    const existing = typeofRecords.get(key);
    if (existing !== undefined) return existing;
    const selected = requireType(operand, "a typeof/nullish admission");
    const admission = nullishAdmission(operand, absence(selected) !== "never");
    const sum = selected.kind === "union" || selected.kind === "optional" ? sums.sumOf(selected) : undefined;
    let record: SourceNullishAdmission | SourceRefusal;
    if (sum !== undefined) {
      const categories = sum.arms.map((_, index) => sumArmCategory(sum, index, admission));
      if (categories.includes("conflict")) {
        record = Object.freeze({ kind: "refused", code: "TSONIC_LOCAL_TYPE_UNION", site: operation, related: operand,
          message: "Values from a number and from an explicit 64-bit integer share one union arm of this operand, so its " +
            "typeof category is not proven. Annotate the value as number or as the explicit integer type." });
      } else {
        const roles = sum.roles.map(role => {
          const arms = role.arms.map(arm => Object.freeze({ arm, category: categories[arm] as CategoryName | "unproven" }));
          const proven = [...new Set(arms.flatMap(arm => arm.category === "unproven" ? [] : [arm.category]))];
          return Object.freeze({ role: role.role, categories: Object.freeze(proven), arms: Object.freeze(arms) });
        });
        record = Object.freeze({ kind: "typeof-site", operation, operand, admission,
          sum: Object.freeze({ identity: sum.identity, roles: Object.freeze(roles) }) });
      }
    } else {
      // A narrowed read that extracts one arm of a declared sum keeps that arm's category (its own origin).
      const relation = ast.is.IsIdentifier(operand) ? relationAt(operand) : undefined;
      let selectedCategory: CategoryName | "unproven" | "conflict" | undefined;
      const present = sourceTypeDescriptorStructure(selected);
      const value = present.kind === "optional" ? present.value : selected;
      if (relation?.kind === "extract-arm") selectedCategory = sumArmCategory(sums.sum(relation.sum), relation.arm, admission);
      else if (isWideInteger(value)) {
        const origins = valueOrigins(operand, 0);
        selectedCategory = origins === undefined ? "unproven" : origins.size === 1 ? [...origins][0]! : "conflict";
      } else selectedCategory = category(selected, operand);
      if (selectedCategory === "conflict") {
        record = Object.freeze({ kind: "refused", code: "TSONIC_LOCAL_TYPE_UNION", site: operation, related: operand,
          message: "Values from a number and from an explicit 64-bit integer reach this operand, so its typeof category " +
            "is not proven. Annotate the value as number or as the explicit integer type." });
      } else {
        const scalar = selectedCategory === "unproven" || selectedCategory === "undefined" ? undefined : selectedCategory;
        record = Object.freeze({ kind: "typeof-site", operation, operand, admission, ...(scalar === undefined ? {} : { category: scalar }),
          sum: undefined });
      }
    }
    typeofRecords.set(key, record);
    return record;
  }

  function awaited(node: Node): SourceTypeOutcome {
    if (ast.is.IsAwaitExpression(node)) return type(node);
    const outcome = isSourceCallableSignatureDeclaration(ast, node) ? callableReturn(node) : type(node);
    if (outcome.kind === "refused") return outcome;
    const payload = sourceTypeDescriptorAwaitedPayload(ast, owner, outcome.type);
    if (payload === undefined) {
      return Object.freeze({ kind: "refused", source: "tsonic", code: "TSONIC_LOCAL_TYPE_UNSUPPORTED", site: node,
        reason: "This awaited value is a structural thenable with no declared payload. Await a Promise or a declared thenable." });
    }
    return Object.freeze({ ...outcome, type: payload });
  }

  const values: SourceValueFacts = Object.freeze({
    type, has, contextual: (node: Node) => solved.contextual(node), callableReturn, slot, admission, operator, elementAccess,
    typeofCategory, awaited,
    methodValueUse: (occurrence: Node) => solved.methodValueUse(occurrence),
    literal: (node: Node) => solved.literal(node),
  });

  // ---- sums -----------------------------------------------------------------------------------------------------
  const sums: SourceSumFacts = Object.freeze({
    sum: (identity: Parameters<SourceSumFacts["sum"]>[0]): SourceClosedSum =>
      solved.sum(identity) ?? invariant(ast, identity.family, "an invalid Source sum identity"),
    sumOf: (descriptor: SourceTypeDescriptor) => {
      if (descriptor.kind !== "union" && descriptor.kind !== "optional") return undefined;
      const direct = sourceTypeDescriptorSum(owner, descriptor);
      if (direct !== undefined) return direct;
      // The same application through the one union builder (I6): an optional-of-union whose descriptor object is not the
      // registered one (absence added at an optional read or member) is the registered sum with its absence arm (A11).
      const rebuilt = sourceTypeDescriptorUnion(owner, [descriptor]);
      const sum = rebuilt === undefined ? undefined : sourceTypeDescriptorSum(owner, rebuilt);
      if (sum !== undefined) return sum;
      // An optional of one non-union value is an option (T | absence), not a closed sum.
      if (descriptor.kind === "optional" && sourceTypeDescriptorStructure(descriptor.value).kind !== "union") return undefined;
      return invariant(ast, source.sourceFiles[0]!, "a published union descriptor requires its closed sum record");
    },
    substitute: (descriptor: SourceTypeDescriptor, bindings: ReadonlyMap<Node, SourceTypeDescriptor>) =>
      substituteSourceTypeDescriptor(owner, descriptor, bindings) ??
        invariant(ast, source.sourceFiles[0]!, "substitution requires a descriptor and bindings of this program"),
    // Per-arm components joined by the one union builder (I6, supervisor ruling on B4 D3): equal components are one
    // descriptor; distinct ones are the program's union of them, in the builder's recorded (authored-first) arm order. A
    // union the program never formed has no recorded order, so it has no join.
    join: (components: readonly SourceTypeDescriptor[]) => {
      if (components.length === 0) invariant(ast, source.sourceFiles[0]!, "a join requires at least one component");
      const first = components[0]!;
      if (components.every(component => sourceTypeDescriptorsEqual(component, first))) return first;
      return sourceTypeDescriptorUnion(owner, components);
    },
  });

  // ---- relations -------------------------------------------------------------------------------------------------
  const relationQuery = createSourceRelationQuery({
    source, input, type, contextual: node => solved.contextual(node), sumOf: sums.sumOf,
    declaredSlotType: declaration => solved.declaredSlot(declaration)?.type, literal: node => solved.literal(node),
    typeofCategory, instantiation: use => instantiation(use),
  });
  const relationAt = relationQuery.at;
  const relations: SourceRelationFacts = Object.freeze({ at: relationAt, write: relationQuery.write });

  // ---- instantiations --------------------------------------------------------------------------------------------
  // `super(...)` (R-F5-2): the base class binders come from the authored `extends` type arguments, else the binders'
  // authored defaults (authored-syntax input, R3; no inference takes part). The selected signature is the base
  // constructor the checker selected, or the base class declaration for its implicit constructor.
  function superInstantiation(use: Node): SourceInstantiation | undefined {
    const refusedSuper = (message: string): SourceRefusal => Object.freeze({ kind: "refused", code: "TSONIC_LOCAL_TYPE_GENERIC", site: use, message });
    let constructor = ast.parent(use);
    while (constructor !== undefined && !ast.is.IsConstructorDeclaration(constructor)) constructor = ast.parent(constructor);
    const classDeclaration = constructor === undefined ? undefined : ast.parent(constructor);
    if (classDeclaration === undefined) invariant(ast, use, "a super call requires its enclosing class constructor");
    const heritage = source.navigation.declaredHeritage(classDeclaration);
    const edge = heritage.kind === "resolved" ? heritage.edges.find(selected => selected.kind === "extends") : undefined;
    if (edge === undefined) return refusedSuper("The base class of this super call has no declared heritage the Host can name. Extend a declared class.");
    const base = edge.target.declaration;
    const binders = (ast.typeParameters(base) ?? []).filter((binder): binder is Node => binder !== undefined);
    if (binders.length === 0) return undefined;
    const bindings = new Map<Node, SourceTypeDescriptor>();
    for (const [index, binder] of binders.entries()) {
      const authored = edge.typeArguments[index] ?? ast.as.AsTypeParameterDeclaration(binder)?.DefaultType;
      const outcome = authored === undefined ? undefined : solved.typeSyntax(authored);
      const described = outcome === undefined || outcome.kind === "refused" ? undefined
        : index < edge.typeArguments.length ? outcome.type : substituteSourceTypeDescriptor(owner, outcome.type, bindings);
      if (described === undefined) {
        return refusedSuper("A type argument of the base class has no authored type here. Write every base type argument in the extends clause.");
      }
      bindings.set(binder, described);
    }
    const selected = input.call(use)?.signature;
    if (selected !== undefined && ast.parent(selected) !== base) {
      return refusedSuper("This super call reaches a constructor inherited through the generic base's implicit constructor. Declare the base constructor.");
    }
    const signature = selected ?? base;
    const parameters: SourceTypeDescriptor[] = [];
    if (selected !== undefined) for (const parameter of ast.parameters(selected)) {
      if (parameter === undefined) continue;
      const declared = solved.declaredSlot(parameter)?.type;
      const substituted = declared === undefined ? undefined : substituteSourceTypeDescriptor(owner, declared, bindings);
      if (substituted === undefined) return refusedSuper("A base constructor parameter has no Host type. Annotate the base constructor parameters.");
      parameters.push(substituted);
    }
    const result = resolvedType(use) ?? Object.freeze({ kind: "intrinsic", intrinsic: "void" } as const);
    return Object.freeze({ kind: "call", use, signature,
      receiver: Object.freeze(binders.map(binder => Object.freeze({ declaration: binder, type: bindings.get(binder)! }))),
      method: Object.freeze([]), parameters: Object.freeze(parameters), result });
  }
  const instantiationRecords = new Map<Node, SourceInstantiation | undefined>();
  function instantiation(use: Node): SourceInstantiation | undefined {
    if (instantiationRecords.has(use)) return instantiationRecords.get(use);
    const solvedCall = solved.callInstantiation(use);
    let record: SourceInstantiation | undefined;
    if (ast.is.IsCallExpression(use) && ast.kindName(Node_Expression(ast, use)) === "KindSuperKeyword") {
      record = superInstantiation(use);
    } else if (solvedCall !== undefined && (solvedCall.receiver.length > 0 || solvedCall.method.length > 0)) {
      const signature = input.call(use)?.signature;
      const parameters = solvedCall.parameters;
      const result = solvedCall.result ?? resolvedType(use);
      if (signature === undefined || result === undefined || parameters.some(parameter => parameter === undefined)) {
        record = Object.freeze({ kind: "refused", code: "TSONIC_LOCAL_TYPE_GENERIC", site: use,
          message: "The pinned generic declaration cannot establish one exact source instantiation. Annotate the arguments or provide explicit type arguments." });
      } else {
        record = Object.freeze({ kind: ast.is.IsNewExpression(use) ? "construction" : "call", use, signature,
          receiver: solvedCall.receiver, method: solvedCall.method,
          parameters: Object.freeze(parameters as readonly SourceTypeDescriptor[]), result });
      }
    } else if (solvedCall === undefined) {
      // A generic callable read as a value (not a call's callee): instantiated against its Host destination.
      const value = solved.functionValueInstantiation(use);
      if (value !== undefined) record = value.kind === "refused" ? toRefusal(value) : value;
    }
    instantiationRecords.set(use, record);
    return record;
  }
  const instantiations: SourceInstantiationFacts = Object.freeze({ at: instantiation });

  // ---- native marker refusals and pointer records (moved from Legacy TSTS_SOURCE_SEMANTICS_0001-0003) ------------
  const markerRefusals: SourceRefusal[] = [];
  const pointerRecords = new Map<Node, SourcePointerOperationRecord | SourceRefusal>();
  // N8 (b) place validity (C-2496). Only the outer marker target is classified, from its exact syntax and the
  // declarations it selects; the target's own passing fact (always recorded by Legacy) and a declaration's passing
  // metadata prove nothing about the place. Through parentheses only, a place is: an identifier bound to a variable,
  // parameter or destructured binding; a property access whose selected members are all data storage (a field,
  // property signature, object-literal property, parameter property, module or namespace variable); or an element
  // access whose selected members (if any) are data storage, index signatures or tuple members. No optional chain.
  // Everything else (operators, calls, `new`, literals, `this`, assertions, accessors, methods, functions, classes,
  // enum members) is refused. Writability of `out`/`ref` targets is not decided here (AGENT-A6-NOTES D4).
  const storageBinding = (declaration: Node): boolean => ast.is.IsVariableDeclaration(declaration) ||
    ast.is.IsParameterDeclaration(declaration) || ast.is.IsBindingElement(declaration);
  const storageMember = (declaration: Node): boolean => storageBinding(declaration) ||
    ast.is.IsPropertyDeclaration(declaration) || ast.is.IsPropertySignatureDeclaration(declaration) ||
    ast.is.IsPropertyAssignment(declaration) || ast.is.IsShorthandPropertyAssignment(declaration) ||
    ast.is.IsIndexSignatureDeclaration(declaration) || ast.is.IsNamedTupleMember(declaration);
  const questionDot = (link: Node): Node | undefined => ast.is.IsPropertyAccessExpression(link)
    ? ast.as.AsPropertyAccessExpression(link)?.QuestionDotToken
    : ast.is.IsElementAccessExpression(link) ? ast.as.AsElementAccessExpression(link)?.QuestionDotToken
      : ast.is.IsCallExpression(link) ? ast.as.AsCallExpression(link)?.QuestionDotToken : undefined;
  const inOptionalChain = (access: Node): boolean => {
    for (let link: Node | undefined = access; link !== undefined && (ast.is.IsPropertyAccessExpression(link) ||
      ast.is.IsElementAccessExpression(link) || ast.is.IsCallExpression(link) || ast.is.IsNonNullExpression(link));
      link = Node_Expression(ast, link)) {
      if (questionDot(link) !== undefined) return true;
    }
    return false;
  };
  const argumentPlace = (target: Node): boolean => {
    let place = target;
    // Parentheses and a non-null assertion (`x!`) are transparent: both name the same storage, and the baseline grammar
    // admitted `x!` as a left-hand side (N8 (b) refuses only non-place targets such as calls, `new` and literals).
    // A type assertion (`as`, `<T>x`) stays refused, as it was not a left-hand side at baseline either.
    while (ast.is.IsParenthesizedExpression(place) || ast.is.IsNonNullExpression(place)) {
      place = Node_Expression(ast, place) ?? invariant(ast, place, "a parenthesized or non-null marker target has no operand");
    }
    if (ast.is.IsIdentifier(place)) {
      const declaration = source.navigation.sourceReferenceFor(place)?.declaration;
      return declaration !== undefined && storageBinding(declaration);
    }
    const property = ast.is.IsPropertyAccessExpression(place);
    if (!property && !ast.is.IsElementAccessExpression(place) || inOptionalChain(place)) return false;
    const selected = input.member(place)?.declarations ?? [];
    return (!property || selected.length > 0) && selected.every(storageMember);
  };
  for (const node of solved.valueNodes) {
    if (!ast.is.IsCallExpression(node)) continue;
    const marker = source.sourceFacts.getFact(node, sourceMarkerFactKey);
    if (marker?.kind !== "call-marker") continue;
    const callee = Node_Expression(ast, node);
    const name = callee === undefined ? "marker" : ast.text(ast.is.IsPropertyAccessExpression(callee) ? ast.name(callee) : callee);
    const arguments_ = ast.arguments(node).filter((argument): argument is Node => argument !== undefined);
    if (referenceMarkers.has(marker.marker)) {
      // N8 (b) place validity, C-2496: a reference marker's one argument must be a storage place. Legacy records the
      // argument-role passing fact (WP0 A4: role "argument" with its exact storage expression) on every reference
      // marker call. A declaration-role fact is never place authority.
      const target = arguments_[0];
      const passing = source.sourceFacts.getFact(node, argumentPassingFactKey);
      if (target === undefined || passing?.role !== "argument" || passing.storageExpression !== target) {
        invariant(ast, node, "a reference marker call has no argument-role passing fact naming its target");
      }
      if (!argumentPlace(target)) {
        markerRefusals.push(Object.freeze({ kind: "refused", code: "TSONIC_ARGUMENT_MARKER_NOT_PLACE",
          message: `${name}(...) requires a storage expression.`, site: target, related: node }));
      }
      continue;
    }
    if (!pointerMarkers.has(marker.marker)) continue;
    const fact = source.sourceFacts.getFact(node, pointerOperationFactKey);
    const expected = marker.marker === "project-pointer" ? 2 : 1;
    const method = solved.callInstantiation(node)?.method ?? [];
    if (fact === undefined) {
      const refusal: SourceRefusal = method.length !== expected
        ? Object.freeze({ kind: "refused", code: "TSONIC_POINTER_TYPE_ARGUMENTS", site: node,
          message: `${name}(...) requires ${expected} exact selected pointer type argument${expected === 1 ? "" : "s"}.` })
        : Object.freeze({ kind: "refused", code: "TSONIC_ARGUMENT_MARKER_NOT_PLACE", site: arguments_[0] ?? node, related: node,
          message: `${name}(...) requires writable storage.` });
      markerRefusals.push(refusal);
      pointerRecords.set(node, refusal);
      continue;
    }
    const pointee = method[expected === 2 ? 1 : 0]?.type;
    const result = resolvedType(node);
    if (pointee === undefined || result === undefined) {
      const refusal: SourceRefusal = Object.freeze({ kind: "refused", code: "TSONIC_POINTER_TYPE_ARGUMENTS", site: node,
        message: `${name}(...) requires ${expected} exact selected pointer type argument${expected === 1 ? "" : "s"}.` });
      markerRefusals.push(refusal);
      pointerRecords.set(node, refusal);
      continue;
    }
    const operands = fact.operation === "address-of" ? [fact.storageExpression]
      : fact.operation === "allocate" ? [fact.initialExpression]
      : fact.operation === "load" || fact.operation === "hash-pointer" ? [fact.pointerExpression]
      : fact.operation === "store" ? [fact.pointerExpression, fact.valueExpression]
      : fact.operation === "equal-pointer" ? [fact.leftExpression, fact.rightExpression]
      : fact.operation === "bind-pointer" ? [fact.identityExpression, fact.readExpression, fact.writeExpression]
      : [fact.pointerExpression, fact.fromSourceExpression, fact.toSourceExpression];
    pointerRecords.set(node, Object.freeze({ call: node, operation: fact.operation, pointee, result, operands: Object.freeze(operands),
      ...("locationIdentity" in fact ? { location: fact.locationIdentity } : {}),
      ...(fact.operation === "address-of" && fact.storageDeclaration !== undefined ? { storageDeclaration: fact.storageDeclaration } : {}) }));
  }

  // ---- refusals --------------------------------------------------------------------------------------------------
  const relationRefusals: SourceRefusal[] = [];
  const elementRefusals: SourceRefusal[] = [];
  const anyRefusals: SourceRefusal[] = [];
  for (const node of solved.valueNodes) {
    // An element access refused for its selection (E8) is reported once, with its own site.
    if (ast.is.IsElementAccessExpression(node) && solved.get(node)?.kind !== "refused") {
      const selection = elementSelection(node);
      if (selection.kind === "refused") elementRefusals.push(toRefusal(selection));
    }
    const outcome = type(node);
    if (outcome.kind === "refused") continue;
    // An object literal whose Host type is `any` has no native construction (baseline C# TSONIC_ANY_UNSUPPORTED, now
    // Host-originated, R-F5-A2). Only the literal is refused; an `any` value elsewhere is not.
    if (ast.is.IsObjectLiteralExpression(node)) {
      let literalType = outcome.type;
      while (literalType.kind === "optional") literalType = literalType.value;
      if (literalType.kind === "intrinsic" && literalType.intrinsic === "any") {
        anyRefusals.push(Object.freeze({ kind: "refused", code: "TSONIC_ANY_UNSUPPORTED", site: node,
          message: "'any' has no native representation. Declare the type, or use 'unknown' and narrow it." }));
      }
    }
    // A typeof site whose operand categories are not proven (coincident incompatible origins, A1) is refused once.
    if (ast.is.IsTypeOfExpression(node)) {
      const operand = Node_Expression(ast, node);
      const site = operand === undefined || type(operand).kind === "refused" ? undefined : typeofCategory(node, operand);
      if (site?.kind === "refused") relationRefusals.push(site);
    }
    const relation: SourceUnionRelation | undefined = relationAt(node);
    if (relation?.kind === "refused") relationRefusals.push(relation);
    // A node that is also written into a sum (Q1) has its own write relation; its refusal is reported too.
    const written = relationQuery.write(node);
    if (written?.kind === "refused" && written !== relation) relationRefusals.push(written);
  }
  // Spread elements are not value nodes; their element writes are relations of their own (A4).
  for (const node of solved.nodes) {
    if (!ast.is.IsSpreadElement(node)) continue;
    const relation = relationAt(node);
    if (relation?.kind === "refused") relationRefusals.push(relation);
  }
  for (const node of solved.nodes) if (isSourceCallableSignatureDeclaration(ast, node)) callableReturn(node);
  const allRefusals = Object.freeze([...new Set([...solved.refusals().map(toRefusal), ...markerRefusals, ...elementRefusals, ...anyRefusals, ...relationRefusals,
    ...[...callableReturnRefusals.values()].map(toRefusal)])]);

  // ---- obligations (checker-free projection of the solver's obligation list) ------------------------------------
  const obligationRecords: readonly SourceObligation[] = Object.freeze(solved.obligations().map(obligation => {
    const association = obligation.association;
    const argument = association?.call === undefined || association.binding === undefined ? undefined
      : association.call.sourceArguments[association.binding.sourceArgumentIndex]?.expression;
    return Object.freeze({
      kind: obligation.kind, site: obligation.site, type: obligation.type, required: obligation.required,
      ...(obligation.requiredType === undefined ? {} : { requiredType: obligation.requiredType }),
      ...(obligation.value === undefined ? {} : { value: obligation.value }),
      ...(obligation.valueType === undefined ? {} : { valueType: obligation.valueType }),
      ...(obligation.kind === "literal-admission" ? { authority: obligation.authority } : {}),
      ...(association?.call === undefined ? {} : { call: association.call.call }),
      ...(association?.parameter?.parameterDeclaration === undefined ? {} : { parameter: association.parameter.parameterDeclaration }),
      ...(argument === undefined ? {} : { argument }),
      ...(obligation.valueVariable === undefined ? {} : { valueVariable: obligation.valueVariable }),
    });
  }));

  return Object.freeze({
    values, sums, relations, instantiations,
    obligations: () => obligationRecords,
    pointerOperation: (call: Node) => pointerRecords.get(call),
    refusals: () => allRefusals,
  });
}
