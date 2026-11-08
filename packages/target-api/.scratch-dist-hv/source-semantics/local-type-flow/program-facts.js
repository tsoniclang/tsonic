import { argumentPassingFactKey, pointerOperationFactKey, sourceMarkerFactKey, } from "@tsonic/tsts";
import { Node_Expression, Node_Operand } from "../../source-model/ast.js";
import { isSourceCallableSignatureDeclaration } from "../../source-model/callable-boundaries.js";
import { isTypeSyntaxNode } from "../../source-model/syntax.js";
import { analyzeSourceEffectiveTypes } from "./solver.js";
import { createSourceTypeDescriptorUnions, sourceTypeDescriptorHasTypeVariables, sourceTypeDescriptorsEqual, sourceTypeDescriptorStructure, sourceTypeDescriptorSum, sourceTypeDescriptorTupleValue, sourceTypeDescriptorUnion, substituteSourceTypeDescriptor } from "./terms.js";
import { sourceTypeDescriptorOpenness, sourceTypeFlowIsBroadSlot } from "./uses.js";
import { sourceTypeDescriptorAwaitedPayload, sourceTypeFlowAwaitedArms } from "./awaited.js";
import { sourceTypeFlowOperatorSpellings } from "./operators.js";
import { sourceTypeDescriptorIndexEntry, sourceTypeDescriptorKeyKind } from "./element-selection.js";
import { createSourceTypeofCategories } from "./typeof-categories.js";
import { sourceTypeDescriptorMemberOriginsEqual } from "./member-origins.js";
import { sourceTypeFlowValueSyntax } from "./value-syntax.js";
import { sourceTypeFlowTypeParameters } from "./defaults.js";
import { sourceTypeFlowBinderArguments, sourceTypeFlowInstantiate } from "./instantiation.js";
import { createSourceRelationQuery } from "./relations.js";
const referenceMarkers = new Set(["write-only-reference", "read-write-reference", "read-only-reference"]);
const pointerMarkers = new Set([
    "address-of", "allocate", "load", "store", "equal-pointer", "hash-pointer", "bind-pointer", "project-pointer",
]);
function invariant(ast, node, message) {
    const file = ast.getSourceFile(node);
    throw new Error(`Source value facts: ${message} (${ast.kindName(node)} at ${file === undefined ? "?" : ast.getFileName(file)}:${ast.pos(node)}).`);
}
/**
 * Builds the value-model facts of one program view. Called once by the SourceProgramFacts assembly (writer B).
 * `programSourceFiles` is the program file order that fixes authored-first sum order (C-2459). `input` is the program's
 * one host-input adapter (created once by the program builder and shared with the selection witnesses, R4/I3).
 */
export function buildSourceValueModelFacts(source, programSourceFiles, input) {
    const { ast } = source;
    const solved = analyzeSourceEffectiveTypes(source, createSourceTypeDescriptorUnions(ast, programSourceFiles), input);
    const owner = solved.owner;
    const refusalRecords = new WeakMap();
    const toRefusal = (refusal) => {
        let record = refusalRecords.get(refusal);
        if (record === undefined) {
            record = Object.freeze({ kind: "refused", code: refusal.code, message: refusal.reason, site: refusal.site,
                ...(refusal.related === undefined ? {} : { related: refusal.related }) });
            refusalRecords.set(refusal, record);
        }
        return record;
    };
    const sourceFileOf = (node) => ast.getSourceFile(node) ?? invariant(ast, node, "a value node requires its source file");
    // ---- values ----------------------------------------------------------------------------------------------------
    // One outcome per node for this program view. The declaration and ambient branches describe through the descriptor
    // reader, whose expansion of a recursive library type is costly, so a repeated query must not describe again.
    const typeOutcomes = new Map();
    function type(node) {
        const known = typeOutcomes.get(node);
        if (known !== undefined)
            return known;
        const outcome = describeNode(node);
        typeOutcomes.set(node, outcome);
        return outcome;
    }
    function describeNode(node) {
        const outcome = solved.get(node);
        if (outcome !== undefined) {
            // An element access whose selection no Host rule names is refused at the access (E8); its record never exists.
            if (outcome.kind !== "refused" && ast.is.IsElementAccessExpression(node)) {
                const selection = elementSelection(node);
                if (selection.kind === "refused")
                    return selection;
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
        if (authored !== undefined)
            return authored;
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
        // A class, interface or type alias declaration outside the solver's program files (a library or profile declaration
        // file): its declared type, or the refusal that it has none. One rule for every class declaration: a program class
        // also publishes its declared (instance) type (solver.ts describeTypeDeclaration); the constructor value is the type
        // of a value read of the class name, never of the declaration.
        if (ast.is.IsClassDeclaration(node) || ast.is.IsInterfaceDeclaration(node) || ast.is.IsTypeAliasDeclaration(node)) {
            const described = solved.typeDeclarationValue(node);
            if (described === undefined) {
                return Object.freeze({ kind: "refused", source: "tsonic", code: "TSONIC_LOCAL_TYPE_UNSUPPORTED", site: node,
                    reason: "This type declaration has no Host description." });
            }
            return Object.freeze({ kind: "resolved", type: described, provenance: Object.freeze({ group: node, occurrence: node,
                    sourceFile: sourceFileOf(node) }) });
        }
        // An ambient value expression of a declaration file (a computed member name such as `[Symbol.iterator]`, an enum
        // member or export-assignment expression) is outside the solver's program-file domain (defaults.ts skips declaration
        // files). It is described from declaration input (the referenced declarations through the one descriptor reader), or
        // refused.
        if (ambientValueExpression(node)) {
            const described = solved.declarationValue(node);
            if (described === undefined) {
                return Object.freeze({ kind: "refused", source: "tsonic", code: "TSONIC_LOCAL_TYPE_UNSUPPORTED", site: node,
                    reason: "This ambient declaration-file expression has no Host description." });
            }
            return Object.freeze({ kind: "resolved", type: described, provenance: Object.freeze({ group: node, occurrence: node,
                    sourceFile: sourceFileOf(node) }) });
        }
        // An object-literal member declaration (`a: e`, `a`): the member the literal's own construction declares (its
        // published construction shape, else its published shape), else the destination member it fills (literal member
        // correspondence). A refused literal refuses its members.
        if (ast.is.IsPropertyAssignment(node) || ast.is.IsShorthandPropertyAssignment(node))
            return literalMemberValue(node);
        // A declaration's own name denotes the declaration's value (`function f`, `class C`, `x` in `let x`).
        if (declarationName(node)) {
            const declared = type(ast.parent(node));
            return declared.kind === "refused" ? declared : Object.freeze({ ...declared,
                provenance: Object.freeze({ ...declared.provenance, occurrence: node }) });
        }
        return invariant(ast, node, "no Host type for this node; only value nodes, declarations, slots and type nodes have one");
    }
    function literalMemberValue(member) {
        const literal = ast.parent(member);
        if (literal === undefined || !ast.is.IsObjectLiteralExpression(literal))
            return invariant(ast, member, "an object-literal member requires its literal");
        const published = solved.get(literal) ?? invariant(ast, literal, "an object literal requires its published Host type");
        if (published.kind === "refused")
            return published;
        const own = (type) => {
            const structure = type === undefined ? undefined : sourceTypeDescriptorStructure(type);
            return structure?.kind === "shape" ? structure.members.find(entry => entry.origin.kind === "declared" && entry.origin.declaration === member) : undefined;
        };
        let selected = own(published.construction) ?? own(published.type);
        const origin = selected === undefined ? published.memberCorrespondence?.find(pair => pair.property === member)?.origin : undefined;
        if (origin !== undefined) {
            const structure = sourceTypeDescriptorStructure(published.type);
            selected = structure.kind === "shape"
                ? structure.members.find(entry => sourceTypeDescriptorMemberOriginsEqual(entry.origin, origin)) : undefined;
        }
        if (selected === undefined) {
            return Object.freeze({ kind: "refused", source: "tsonic", code: "TSONIC_LOCAL_TYPE_UNSUPPORTED", site: member,
                reason: "The value of this object-literal member has no Host description. Annotate the object literal with a supported type form." });
        }
        return Object.freeze({ kind: "resolved", type: selected.type, provenance: Object.freeze({ group: literal, occurrence: member,
                sourceFile: sourceFileOf(member), component: Object.freeze({ declaration: member }) }) });
    }
    const resolvedType = (node) => {
        const outcome = type(node);
        return outcome.kind === "refused" ? undefined : outcome.type;
    };
    function requireType(node, purpose) {
        const outcome = type(node);
        if (outcome.kind === "refused")
            invariant(ast, node, `${purpose} was requested for a refused value; forward values.type(node) first`);
        return outcome.type;
    }
    function callableReturn(declaration) {
        const outcome = solved.callableReturn(declaration);
        if (outcome !== undefined)
            return outcome;
        if (!isSourceCallableSignatureDeclaration(ast, declaration))
            invariant(ast, declaration, "callableReturn requires a callable declaration");
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
    const callableReturnRefusals = new Map();
    // The domain of type() (R-C2-1): value nodes, declarations and slots, and authored type nodes. Not a probe for a
    // fallback: inside the domain type() answers or fails as an invariant.
    const valueNodeSet = new Set(solved.valueNodes);
    function has(node) {
        return valueNodeSet.has(node) || solved.get(node) !== undefined || solved.declaredSlot(node) !== undefined ||
            isTypeSyntaxNode(ast, node) || declarationValueNode(node) || ast.is.IsPropertyAssignment(node) ||
            ast.is.IsShorthandPropertyAssignment(node) || ast.is.IsClassDeclaration(node) || ast.is.IsInterfaceDeclaration(node) ||
            ast.is.IsTypeAliasDeclaration(node) ||
            ambientValueExpression(node) || declarationName(node);
    }
    // A value expression of a declaration file: value syntax under the only value positions such a file has, a computed
    // member name, an enum member or an export assignment. An import or export binding name, a type name and any other
    // identifier of a declaration file are not values.
    function ambientValueExpression(node) {
        if (!sourceTypeFlowValueSyntax(ast, node) || !ast.isDeclarationFile(sourceFileOf(node)))
            return false;
        for (let at = ast.parent(node); at !== undefined && !ast.is.IsSourceFile(at); at = ast.parent(at)) {
            if (ast.is.IsComputedPropertyName(at) || ast.is.IsEnumMember(at) || ast.is.IsExportAssignment(at))
                return true;
        }
        return false;
    }
    function declarationName(node) {
        const named = ast.parent(node);
        return named !== undefined && ast.name(named) === node && has(named);
    }
    // Declarations whose value a storage or ownership subject reads (R-B4-5), in program or library files.
    function declarationValueNode(node) {
        return ast.is.IsVariableDeclaration(node) || ast.is.IsParameterDeclaration(node) || ast.is.IsPropertyDeclaration(node) ||
            ast.is.IsPropertySignatureDeclaration(node) || ast.is.IsBindingElement(node) ||
            ast.is.IsFunctionDeclaration(node) || ast.is.IsMethodDeclaration(node) || ast.is.IsMethodSignatureDeclaration(node) ||
            ast.is.IsGetAccessorDeclaration(node) || ast.is.IsSetAccessorDeclaration(node);
    }
    function slot(node) {
        const declared = solved.declaredSlot(node);
        if (declared !== undefined) {
            return Object.freeze({ kind: "slot", slot: declared.slot, type: declared.type, broad: declared.broad,
                openness: sourceTypeDescriptorOpenness(ast, declared.type),
                authority: ast.typeNode(declared.slot) !== undefined ? "declared" : "inferred" });
        }
        const outcome = solved.get(node);
        if (outcome?.kind === "refused")
            return outcome;
        if (outcome !== undefined) {
            return Object.freeze({ kind: "slot", slot: node, type: outcome.type, broad: sourceTypeFlowIsBroadSlot(outcome.type), authority: "inferred",
                openness: sourceTypeDescriptorOpenness(ast, outcome.type) });
        }
        // A declaration outside the solver's program files (a library, profile or provider parameter, property or member):
        // its slot is its declared value (declaration input), or the refusal that it has none.
        if (declarationValueNode(node)) {
            const described = type(node);
            if (described.kind === "refused")
                return described;
            return Object.freeze({ kind: "slot", slot: node, type: described.type, broad: sourceTypeFlowIsBroadSlot(described.type),
                openness: sourceTypeDescriptorOpenness(ast, described.type),
                authority: ast.typeNode(node) !== undefined ? "declared" : "inferred" });
        }
        return invariant(ast, node, "no Host slot for this node");
    }
    // One destination domain (WP0 A3, K-2678, D4): every use with a slot admission has its Host destination in
    // `contextual`, and that destination is the admission's published slot (the identical descriptor object, so
    // `contextual(use).type === admission(use).destination === slot(admission.slot).type`). The admission producer
    // reaches uses through their association component (generic, rest, array element and property uses) where the
    // declared-slots reader has no entry for the use; those uses get the admission's destination here. Where both readers
    // name a destination, they must agree (I4). A use without an admission keeps the declared-slots destination.
    const contextualOutcomes = new Map();
    // The destination of a use with its consistency breach, if any (D4-2: the destination invariants are lazy). The
    // published reads (values.contextual, destination) raise the breach; the eager refusal collection reads the
    // destination through the relation inputs without raising it, so one bad use fails only where it is read (R1 #16).
    const contextualBreaches = new Map();
    function contextualDestination(use) {
        const known = contextualOutcomes.get(use);
        if (known !== undefined)
            return known ?? undefined;
        const declared = solved.contextual(use);
        const published = solved.slotAdmission(use);
        let outcome = declared;
        if (published !== undefined) {
            const slotFact = solved.declaredSlot(published.slot) ??
                invariant(ast, use, "a Host slot admission requires its published declared slot");
            const destination = slotFact.type;
            const breach = published.kind === "admitted" && published.destination !== destination
                ? "a Host slot admission must name its slot's published destination"
                : declared?.kind === "refused" ? "an admitted use has a refused Host destination"
                    : declared !== undefined && !sourceTypeDescriptorsEqual(declared.type, destination)
                        ? "the declared-slot destination and the slot admission destination of this use disagree" : undefined;
            if (breach !== undefined)
                contextualBreaches.set(use, breach);
            const sourceFile = ast.getSourceFile(use) ?? invariant(ast, use, "a Host destination requires its source file");
            outcome = Object.freeze({ kind: "resolved", type: destination,
                provenance: (declared?.kind === "refused" ? undefined : declared?.provenance) ??
                    Object.freeze({ group: use, occurrence: use, sourceFile }) });
        }
        contextualOutcomes.set(use, outcome ?? null);
        return outcome;
    }
    function contextual(use) {
        const outcome = contextualDestination(use);
        const breach = contextualBreaches.get(use);
        return breach === undefined ? outcome : invariant(ast, use, breach);
    }
    // The destination slot of a use (Q69, K-2683): the contextual descriptor (the identical object), its slot node and the
    // Host broadness decision. An admitted use names its admission slot; any other use names the declared-slot reader's
    // slot node (solver contextualSlot, the admission producer's rule). Memoized and frozen.
    const destinations = new Map();
    function destination(use) {
        const known = destinations.get(use);
        if (known !== undefined)
            return known ?? undefined;
        const outcome = contextual(use);
        let selected;
        if (outcome?.kind === "refused")
            selected = toRefusal(outcome);
        else if (outcome !== undefined) {
            const slot = solved.slotAdmission(use)?.slot ?? solved.contextualSlot(use) ??
                invariant(ast, use, "a Host destination requires its slot node");
            selected = Object.freeze({ kind: "slot", slot, type: outcome.type, broad: sourceTypeFlowIsBroadSlot(outcome.type) });
        }
        destinations.set(use, selected ?? null);
        return selected;
    }
    // The admission domain is the broad Host destinations: inside it a missing admission is a Host defect (I4); outside it
    // (no destination, or a destination that is not a broad slot) no admission exists and asking for one is a caller error.
    function admission(use) {
        const published = solved.slotAdmission(use);
        if (published !== undefined)
            return published;
        const destination = contextual(use);
        if (destination !== undefined && destination.kind !== "refused" && sourceTypeFlowIsBroadSlot(destination.type)) {
            return invariant(ast, use, "no Host slot admission at this use, although its Host destination is a broad slot");
        }
        return invariant(ast, use, "no Host slot admission at this use: it flows into no broad Host slot");
    }
    const operatorRecords = new Map();
    function operator(node) {
        const existing = operatorRecords.get(node);
        if (existing !== undefined)
            return existing;
        let text;
        let operands;
        if (ast.is.IsBinaryExpression(node)) {
            const binary = ast.as.AsBinaryExpression(node);
            const token = ast.operatorKindName(node);
            text = token === undefined ? undefined : sourceTypeFlowOperatorSpellings.get(token);
            operands = [binary?.Left, binary?.Right];
        }
        else if (ast.is.IsPrefixUnaryExpression(node) || ast.is.IsPostfixUnaryExpression(node)) {
            const token = ast.operatorKindName(node);
            text = token === undefined ? undefined : sourceTypeFlowOperatorSpellings.get(token);
            operands = [Node_Operand(ast, node)];
        }
        else if (ast.is.IsTypeOfExpression(node)) {
            text = "typeof";
            operands = [Node_Expression(ast, node)];
        }
        else
            return invariant(ast, node, "operator records exist for binary, unary and typeof operations only");
        if (text === undefined || operands.some(operand => operand === undefined))
            invariant(ast, node, "an operator requires its authored token and operands");
        // A refused operation (its own decision or a refused operand) is published as that refusal (contract R-B1).
        const refused = [node, ...operands].map(type).find(outcome => outcome.kind === "refused");
        if (refused !== undefined && refused.kind === "refused") {
            const refusal = toRefusal(refused);
            operatorRecords.set(node, refusal);
            return refusal;
        }
        const result = requireType(node, "an operator record");
        const operandTypes = operands.map(operand => requireType(operand, "an operator record"));
        const primitiveOf = (selected) => {
            const structure = sourceTypeDescriptorStructure(selected);
            return structure.kind === "primitive" ? structure.primitive : undefined;
        };
        const resultPrimitive = primitiveOf(result);
        const operandPrimitives = operandTypes.map(primitiveOf);
        const record = Object.freeze({
            node, operator: text, operands: Object.freeze(operandTypes), result, admission: "admitted",
            ...(resultPrimitive !== undefined && operandPrimitives.every(kind => kind !== undefined)
                ? { primitive: Object.freeze({ result: resultPrimitive, operands: Object.freeze(operandPrimitives) }) } : {}),
            ...(text === "??" ? { coalesce: Object.freeze({ leftAbsence: absence(operandTypes[0]) }) } : {}),
        });
        operatorRecords.set(node, record);
        return record;
    }
    function absence(selected) {
        const structure = sourceTypeDescriptorStructure(selected);
        if (structure.kind === "intrinsic") {
            return structure.intrinsic === "absence" || structure.intrinsic === "void" ? "always"
                : sourceTypeDescriptorOpenness(ast, structure) === "top" ? "possible" : "never";
        }
        if (structure.kind === "optional")
            return "possible";
        if (structure.kind === "union")
            return structure.types.some(member => absence(member) !== "never") ? "possible" : "never";
        return "never";
    }
    const elementSelections = new Map();
    const elementRefusal = (node, code, reason) => Object.freeze({ kind: "refused", source: "tsonic", code, site: node, reason });
    function elementKey(indexNode) {
        const literal = solved.literal(indexNode);
        if (literal === undefined)
            return {};
        if (literal.form === "string" || literal.form === "template") {
            return /^(0|[1-9]\d*)$/u.test(literal.text) ? { name: literal.text, position: BigInt(literal.text) } : { name: literal.text };
        }
        const position = literal.integerConstant ?? literal.integer;
        return position === undefined ? {} : { name: position.toString(), position };
    }
    // Selection on one receiver structure; undefined when the descriptor does not name it.
    function selectOnStructure(structure, index, key) {
        // The key kind and the index signature come from the one selector (element-selection.ts, R1 #6).
        const keyKind = key.position !== undefined ? "number"
            : sourceTypeDescriptorKeyKind(index, { ast, literal: node => solved.literal(node) }) ?? (key.name !== undefined ? "string" : undefined);
        const numericIndex = keyKind === "number";
        const namedMember = key.name !== undefined && key.position === undefined;
        switch (structure.kind) {
            case "string": return namedMember ? undefined : { selected: { kind: "string-character" }, readonly: true };
            case "array": return namedMember ? undefined : { selected: { kind: "element" }, readonly: structure.readonly };
            case "tuple": {
                if (namedMember)
                    return undefined;
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
                const entry = keyKind === undefined ? undefined : sourceTypeDescriptorIndexEntry(structure, keyKind);
                return entry === undefined ? undefined : { selected: { kind: "index-signature", declaration: entry.declaration }, readonly: entry.readonly };
            }
            default: return undefined;
        }
    }
    function elementSelection(node) {
        const existing = elementSelections.get(node);
        if (existing !== undefined)
            return existing;
        const receiver = Node_Expression(ast, node) ?? invariant(ast, node, "an element access requires its receiver");
        const indexNode = ast.as.AsElementAccessExpression(node)?.ArgumentExpression ?? invariant(ast, node, "an element access requires its index");
        const receiverOutcome = type(receiver);
        const indexOutcome = type(indexNode);
        let selection;
        if (receiverOutcome.kind === "refused" || indexOutcome.kind === "refused")
            selection = Object.freeze({ kind: "operand-refused" });
        else {
            const key = elementKey(indexNode);
            let structure = sourceTypeDescriptorStructure(receiverOutcome.type);
            if (structure.kind === "optional")
                structure = sourceTypeDescriptorStructure(structure.value);
            let selected;
            if (structure.kind === "union") {
                // Every present arm must make the same selection; a target then reads the element once (no per-arm element).
                const arms = structure.types.filter(arm => !(arm.kind === "intrinsic" && (arm.intrinsic === "absence" || arm.intrinsic === "void")));
                const choices = arms.map(arm => {
                    const armStructure = sourceTypeDescriptorStructure(arm);
                    return selectOnStructure(armStructure.kind === "optional" ? sourceTypeDescriptorStructure(armStructure.value) : armStructure, indexOutcome.type, key);
                });
                const first = choices[0];
                const same = first !== undefined && choices.every(choice => choice !== undefined &&
                    choice.selected.kind === first.selected.kind &&
                    (choice.selected.kind !== "tuple" || first.selected.kind === "tuple" && choice.selected.position === first.selected.position) &&
                    (choice.selected.kind !== "member" || first.selected.kind === "member" && choice.selected.declaration === first.selected.declaration) &&
                    (choice.selected.kind !== "index-signature" || first.selected.kind === "index-signature" &&
                        choice.selected.declaration === first.selected.declaration));
                selected = same ? { selected: first.selected, readonly: choices.some(choice => choice.readonly) }
                    : elementRefusal(node, "TSONIC_LOCAL_TYPE_UNION", "The arms of this union receiver select different elements, members or " +
                        "index signatures. Narrow the receiver to one arm before the element access.");
            }
            else
                selected = selectOnStructure(structure, indexOutcome.type, key);
            if (selected === undefined) {
                // No descriptor structure names the selection: the checker's member witness (selection witness, R3).
                const declaration = input.member(node)?.declarations[0];
                if (declaration !== undefined && ast.is.IsIndexSignatureDeclaration(declaration)) {
                    selected = { selected: { kind: "index-signature", declaration }, readonly: ast.hasModifierKind(declaration, "readonly") };
                }
                else if (declaration !== undefined) {
                    // A member name is read through the property-name selection (a computed key such as `[Value.First]` has no
                    // text of its own).
                    const name = ast.name(declaration);
                    const named = name === undefined ? undefined : input.at(declaration).propertyName(name);
                    const memberName = name === undefined ? key.name ?? "" : named?.kind === "resolved" ? named.name
                        : ast.is.IsComputedPropertyName(name) ? undefined : ast.text(name);
                    selected = memberName === undefined
                        ? elementRefusal(node, "TSONIC_LOCAL_TYPE_UNSUPPORTED", "This element access selects a member whose computed key has no constant name.")
                        : { selected: { kind: "member", declaration, name: memberName }, readonly: ast.hasModifierKind(declaration, "readonly") };
                }
                else {
                    selected = elementRefusal(node, "TSONIC_LOCAL_TYPE_UNSUPPORTED", structure.kind === "intrinsic"
                        ? `An element access on a '${structure.intrinsic}' value names no element, member or index signature. Annotate the receiver with a declared type.`
                        : "This element access names no element, tuple position, member or index signature of its receiver. Annotate the receiver with a declared type.");
                }
            }
            selection = "kind" in selected && selected.kind === "refused" ? selected
                : Object.freeze({ kind: "selected", selection: Object.freeze(selected) });
        }
        elementSelections.set(node, selection);
        return selection;
    }
    const elementRecords = new Map();
    // The access kind is the checker's access selection (the member witness, one owner, as memberAccess): the callee of a
    // call through transparent wrappers is "call"; `delete a[i]` reads.
    function elementAccessMode(node) {
        const witness = input.member(node);
        if (witness === undefined)
            return invariant(ast, node, "an element access record requires its checker access selection");
        if (witness.callCallee)
            return "call";
        return witness.accessMode === "delete" ? "read" : witness.accessMode;
    }
    // An element or string-character selection names the index signature the checker selected (the member witness), when
    // it selected one (FX-CC #9: the lib `[n: number]: T` of the receiver).
    function elementSelected(node, selected) {
        if (selected.kind !== "element" && selected.kind !== "string-character")
            return selected;
        const declaration = input.member(node)?.declarations.find(candidate => ast.is.IsIndexSignatureDeclaration(candidate));
        return declaration === undefined ? selected : { ...selected, declaration };
    }
    function elementAccess(node) {
        const existing = elementRecords.get(node);
        if (existing !== undefined)
            return existing;
        if (!ast.is.IsElementAccessExpression(node))
            invariant(ast, node, "element access records exist for element access expressions only");
        const result = requireType(node, "an element access record");
        const selection = elementSelection(node);
        if (selection.kind !== "selected")
            invariant(ast, node, "an element access record was requested for a refused operand; forward values.type of the receiver and index first");
        const receiver = Node_Expression(ast, node);
        const indexNode = ast.as.AsElementAccessExpression(node).ArgumentExpression;
        const record = Object.freeze({ node, receiver, receiverType: requireType(receiver, "an element access record"),
            argument: indexNode, index: requireType(indexNode, "an element access record"), selected: Object.freeze(elementSelected(node, selection.selection.selected)), result,
            readonly: selection.selection.readonly, access: elementAccessMode(node),
            // Part of an optional chain (`a?.[i]`, `a?.b[i]`): the checker's access witness, as for member access.
            optionalChain: input.member(node)?.optionalChain === true });
        elementRecords.set(node, record);
        return record;
    }
    const typeofDecision = createSourceTypeofCategories({ ast, input, solved, sums: { sum: identity => sums.sum(identity),
            sumOf: descriptor => sums.sumOf(descriptor) }, relationAt: node => relationAt(node), resolvedType, requireType, absence });
    const typeofRecords = new Map();
    const typeofKeys = new Map();
    const nodeKey = (node) => {
        let key = typeofKeys.get(node);
        if (key === undefined) {
            key = typeofKeys.size;
            typeofKeys.set(node, key);
        }
        return key;
    };
    function typeofCategory(operation, operand) {
        const key = `${nodeKey(operation)}:${nodeKey(operand)}`;
        const existing = typeofRecords.get(key);
        if (existing !== undefined)
            return existing;
        const record = typeofDecision(operation, operand);
        typeofRecords.set(key, record);
        return record;
    }
    function awaited(node) {
        if (ast.is.IsAwaitExpression(node))
            return type(node);
        const outcome = isSourceCallableSignatureDeclaration(ast, node) ? callableReturn(node) : type(node);
        if (outcome.kind === "refused")
            return outcome;
        const payload = sourceTypeDescriptorAwaitedPayload(ast, owner, outcome.type);
        if (payload === undefined) {
            return Object.freeze({ kind: "refused", source: "tsonic", code: "TSONIC_LOCAL_TYPE_UNSUPPORTED", site: node,
                reason: "This awaited value is a structural thenable with no declared payload. Await a Promise or a declared thenable." });
        }
        return Object.freeze({ ...outcome, type: payload });
    }
    // The awaited-arm relation (awaited.ts) at the nodes of `awaited`: the operand is the await operand, the callable's
    // return or the value itself; the awaited result is `awaited(node)`.
    const awaitedArmRecords = new Map();
    function awaitedArms(node) {
        if (awaitedArmRecords.has(node))
            return awaitedArmRecords.get(node);
        const operandNode = ast.is.IsAwaitExpression(node) ? Node_Expression(ast, node) : undefined;
        const operand = operandNode !== undefined ? type(operandNode)
            : isSourceCallableSignatureDeclaration(ast, node) ? callableReturn(node) : type(node);
        const result = awaited(node);
        const record = operand.kind === "refused" || result.kind === "refused" ? undefined
            : sourceTypeFlowAwaitedArms(ast, owner, descriptor => sums.sumOf(descriptor), node, operand.type, result.type);
        awaitedArmRecords.set(node, record);
        return record;
    }
    const values = Object.freeze({
        type, has, contextual, destination, callableReturn, slot, admission, operator, elementAccess,
        typeofCategory, awaited, awaitedArms,
        methodValueUse: (occurrence) => solved.methodValueUse(occurrence),
        literal: (node) => solved.literal(node),
        literalDomain: (node) => solved.literalDomain(node),
    });
    // ---- sums -----------------------------------------------------------------------------------------------------
    const sums = Object.freeze({
        sum: (identity) => solved.sum(identity) ?? invariant(ast, identity.family, "an invalid Source sum identity"),
        sumOf: (descriptor) => {
            if (descriptor.kind !== "union" && descriptor.kind !== "optional")
                return undefined;
            const direct = sourceTypeDescriptorSum(owner, descriptor);
            if (direct !== undefined)
                return direct;
            // The same application through the one union builder (I6): an optional-of-union whose descriptor object is not the
            // registered one (absence added at an optional read or member) is the registered sum with its absence arm (A11).
            const rebuilt = sourceTypeDescriptorUnion(owner, [descriptor]);
            const sum = rebuilt === undefined ? undefined : sourceTypeDescriptorSum(owner, rebuilt);
            if (sum !== undefined)
                return sum;
            // An optional of one non-union value is an option (T | absence), not a closed sum.
            if (descriptor.kind === "optional" && sourceTypeDescriptorStructure(descriptor.value).kind !== "union")
                return undefined;
            return invariant(ast, source.sourceFiles[0], "a published union descriptor requires its closed sum record");
        },
        substitute: (descriptor, bindings) => substituteSourceTypeDescriptor(owner, descriptor, bindings) ??
            invariant(ast, source.sourceFiles[0], "substitution requires a descriptor and bindings of this program"),
        // Per-arm components joined by the one union builder (I6, supervisor ruling on B4 D3): equal components are one
        // descriptor; distinct ones are the program's union of them, in the builder's recorded (authored-first) arm order. A
        // union the program never formed has no recorded order, so it has no join.
        join: (components) => {
            if (components.length === 0)
                invariant(ast, source.sourceFiles[0], "a join requires at least one component");
            const first = components[0];
            if (components.every(component => sourceTypeDescriptorsEqual(component, first)))
                return first;
            return sourceTypeDescriptorUnion(owner, components);
        },
    });
    // ---- relations -------------------------------------------------------------------------------------------------
    const relationQuery = createSourceRelationQuery({
        source, input, type, contextual: contextualDestination, sumOf: sums.sumOf,
        declaredSlotType: declaration => solved.declaredSlot(declaration)?.type, literal: node => solved.literal(node),
        typeofCategory, instantiation: use => instantiation(use),
    });
    const relationAt = relationQuery.at;
    const relations = Object.freeze({ at: relationAt, write: relationQuery.write });
    // ---- instantiations --------------------------------------------------------------------------------------------
    // `super(...)` (R-F5-2): the base class binders come from the authored `extends` type arguments, else the binders'
    // authored defaults (authored-syntax input, R3; no inference takes part). The selected signature is the base
    // constructor the checker selected, or the base class declaration for its implicit constructor.
    function superInstantiation(use) {
        const refusedSuper = (message) => Object.freeze({ kind: "refused", code: "TSONIC_LOCAL_TYPE_GENERIC", site: use, message });
        let constructor = ast.parent(use);
        while (constructor !== undefined && !ast.is.IsConstructorDeclaration(constructor))
            constructor = ast.parent(constructor);
        const classDeclaration = constructor === undefined ? undefined : ast.parent(constructor);
        if (classDeclaration === undefined)
            invariant(ast, use, "a super call requires its enclosing class constructor");
        const heritage = source.navigation.declaredHeritage(classDeclaration);
        const edge = heritage.kind === "resolved" ? heritage.edges.find(selected => selected.kind === "extends") : undefined;
        if (edge === undefined)
            return refusedSuper("The base class of this super call has no declared heritage the Host can name. Extend a declared class.");
        const base = edge.target.declaration;
        // The base's binders through the one type-parameter-owner role classifier (a heritage target that owns no type
        // parameter list, e.g. a variable holding a class, has none).
        const binders = sourceTypeFlowTypeParameters(ast, base);
        if (binders.length === 0)
            return undefined;
        const bindings = new Map();
        for (const [index, binder] of binders.entries()) {
            const authored = edge.typeArguments[index] ?? ast.as.AsTypeParameterDeclaration(binder)?.DefaultType;
            const outcome = authored === undefined ? undefined : solved.typeSyntax(authored);
            const described = outcome === undefined || outcome.kind === "refused" ? undefined
                : index < edge.typeArguments.length ? outcome.type : sourceTypeFlowInstantiate(owner, bindings, outcome.type);
            if (described === undefined) {
                return refusedSuper("A type argument of the base class has no authored type here. Write every base type argument in the extends clause.");
            }
            bindings.set(binder, described);
        }
        const selected = input.call(use)?.signature;
        const inherited = selected !== undefined && ast.parent(selected) !== base;
        const signature = selected ?? base;
        const parameters = [];
        if (selected !== undefined)
            for (const parameter of ast.parameters(selected)) {
                if (parameter === undefined)
                    continue;
                const declared = solved.declaredSlot(parameter)?.type;
                const substituted = declared === undefined ? undefined : sourceTypeFlowInstantiate(owner, bindings, declared);
                if (substituted === undefined)
                    return refusedSuper("A base constructor parameter has no Host type. Annotate the base constructor parameters.");
                // A constructor inherited from a further base (R1 #19) is exact when its parameters name no binder that the generic
                // base's bindings leave open (`class B<T> extends A {}`); only an open one is refused.
                if (inherited && sourceTypeDescriptorHasTypeVariables(ast, substituted)) {
                    return refusedSuper("This super call reaches a constructor inherited through the generic base's implicit constructor. Declare the base constructor.");
                }
                parameters.push(substituted);
            }
        const result = resolvedType(use) ?? Object.freeze({ kind: "intrinsic", intrinsic: "void" });
        return Object.freeze({ kind: "call", use, signature,
            receiver: sourceTypeFlowBinderArguments(owner, binders, bindings), method: Object.freeze([]), parameters: Object.freeze(parameters), result });
    }
    const instantiationRecords = new Map();
    function instantiation(use) {
        if (instantiationRecords.has(use))
            return instantiationRecords.get(use);
        const solvedCall = solved.callInstantiation(use);
        let record;
        if (ast.is.IsCallExpression(use) && ast.kindName(Node_Expression(ast, use)) === "KindSuperKeyword") {
            record = superInstantiation(use);
        }
        else if (solvedCall !== undefined && (solvedCall.receiver.length > 0 || solvedCall.method.length > 0)) {
            const signature = input.call(use)?.signature;
            const parameters = solvedCall.parameters;
            const result = solvedCall.result ?? resolvedType(use);
            if (signature === undefined || result === undefined || parameters.some(parameter => parameter === undefined)) {
                record = Object.freeze({ kind: "refused", code: "TSONIC_LOCAL_TYPE_GENERIC", site: use,
                    message: "The pinned generic declaration cannot establish one exact source instantiation. Annotate the arguments or provide explicit type arguments." });
            }
            else {
                // FX-CC-H3: a method binder given explicitly carries its authored type-argument node (by position among the
                // selected signature's binders); a defaulted or inferred binder has none.
                const binders = sourceTypeFlowTypeParameters(ast, signature);
                const authored = ast.typeArguments(use);
                const method = Object.freeze(solvedCall.method.map(argument => {
                    const position = binders.indexOf(argument.declaration);
                    const node = position >= 0 ? authored[position] : undefined;
                    return node === undefined ? argument : Object.freeze({ ...argument, authored: node });
                }));
                record = Object.freeze({ kind: ast.is.IsNewExpression(use) ? "construction" : "call", use, signature,
                    receiver: solvedCall.receiver, method,
                    parameters: Object.freeze(parameters), result });
            }
        }
        else if (solvedCall === undefined) {
            // A generic callable read as a value (not a call's callee): instantiated against its Host destination.
            const value = solved.functionValueInstantiation(use);
            if (value !== undefined)
                record = value.kind === "refused" ? toRefusal(value) : value;
        }
        instantiationRecords.set(use, record);
        return record;
    }
    const instantiations = Object.freeze({ at: instantiation });
    // ---- native marker refusals and pointer records (moved from Legacy TSTS_SOURCE_SEMANTICS_0001-0003) ------------
    const markerRefusals = [];
    const pointerRecords = new Map();
    // N8 (b) place validity (C-2496). Only the outer marker target is classified, from its exact syntax and the
    // declarations it selects; the target's own passing fact (always recorded by Legacy) and a declaration's passing
    // metadata prove nothing about the place. Through parentheses only, a place is: an identifier bound to a variable,
    // parameter or destructured binding; a property access whose selected members are all data storage (a field,
    // property signature, object-literal property, parameter property, module or namespace variable); or an element
    // access whose selected members (if any) are data storage, index signatures or tuple members. No optional chain.
    // Everything else (operators, calls, `new`, literals, `this`, assertions, accessors, methods, functions, classes,
    // enum members) is refused. Writability of `out`/`ref` targets is not decided here (AGENT-A6-NOTES D4).
    const storageBinding = (declaration) => ast.is.IsVariableDeclaration(declaration) ||
        ast.is.IsParameterDeclaration(declaration) || ast.is.IsBindingElement(declaration);
    const storageMember = (declaration) => storageBinding(declaration) ||
        ast.is.IsPropertyDeclaration(declaration) || ast.is.IsPropertySignatureDeclaration(declaration) ||
        ast.is.IsPropertyAssignment(declaration) || ast.is.IsShorthandPropertyAssignment(declaration) ||
        ast.is.IsIndexSignatureDeclaration(declaration) || ast.is.IsNamedTupleMember(declaration);
    const questionDot = (link) => ast.is.IsPropertyAccessExpression(link)
        ? ast.as.AsPropertyAccessExpression(link)?.QuestionDotToken
        : ast.is.IsElementAccessExpression(link) ? ast.as.AsElementAccessExpression(link)?.QuestionDotToken
            : ast.is.IsCallExpression(link) ? ast.as.AsCallExpression(link)?.QuestionDotToken : undefined;
    const inOptionalChain = (access) => {
        for (let link = access; link !== undefined && (ast.is.IsPropertyAccessExpression(link) ||
            ast.is.IsElementAccessExpression(link) || ast.is.IsCallExpression(link) || ast.is.IsNonNullExpression(link)); link = Node_Expression(ast, link)) {
            if (questionDot(link) !== undefined)
                return true;
        }
        return false;
    };
    const argumentPlace = (target) => {
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
        if (!property && !ast.is.IsElementAccessExpression(place) || inOptionalChain(place))
            return false;
        const selected = input.member(place)?.declarations ?? [];
        return (!property || selected.length > 0) && selected.every(storageMember);
    };
    for (const node of solved.valueNodes) {
        if (!ast.is.IsCallExpression(node))
            continue;
        const marker = source.sourceFacts.getFact(node, sourceMarkerFactKey);
        if (marker?.kind !== "call-marker")
            continue;
        const callee = Node_Expression(ast, node);
        const name = callee === undefined ? "marker" : ast.text(ast.is.IsPropertyAccessExpression(callee) ? ast.name(callee) : callee);
        const arguments_ = ast.arguments(node).filter((argument) => argument !== undefined);
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
        if (!pointerMarkers.has(marker.marker))
            continue;
        const fact = source.sourceFacts.getFact(node, pointerOperationFactKey);
        const expected = marker.marker === "project-pointer" ? 2 : 1;
        const method = solved.callInstantiation(node)?.method ?? [];
        if (fact === undefined) {
            const refusal = method.length !== expected
                ? Object.freeze({ kind: "refused", code: "TSTS_SOURCE_SEMANTICS_0003", site: node,
                    message: `${name}(...) requires ${expected} exact selected pointer type argument${expected === 1 ? "" : "s"}.` })
                // Q78: the address-of writability refusal keeps its baseline code (Legacy TSTS_SOURCE_SEMANTICS_0002), message and
                // site; TSONIC_ARGUMENT_MARKER_NOT_PLACE is approved only for out/ref/inref marker targets (N8).
                : Object.freeze({ kind: "refused", code: "TSTS_SOURCE_SEMANTICS_0002", site: arguments_[0] ?? node, related: node,
                    message: `${name}(...) requires writable storage.` });
            markerRefusals.push(refusal);
            pointerRecords.set(node, refusal);
            continue;
        }
        const pointee = method[expected === 2 ? 1 : 0]?.type;
        const result = resolvedType(node);
        if (pointee === undefined || result === undefined) {
            const refusal = Object.freeze({ kind: "refused", code: "TSTS_SOURCE_SEMANTICS_0003", site: node,
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
    const relationRefusals = [];
    const elementRefusals = [];
    const anyRefusals = [];
    for (const node of solved.valueNodes) {
        // An element access refused for its selection (E8) is reported once, with its own site.
        if (ast.is.IsElementAccessExpression(node) && solved.get(node)?.kind !== "refused") {
            const selection = elementSelection(node);
            if (selection.kind === "refused")
                elementRefusals.push(toRefusal(selection));
        }
        const outcome = type(node);
        if (outcome.kind === "refused")
            continue;
        // An object literal whose Host type is `any` has no native construction (baseline C# TSONIC_ANY_UNSUPPORTED, now
        // Host-originated, R-F5-A2). Only the literal is refused; an `any` value elsewhere is not.
        if (ast.is.IsObjectLiteralExpression(node)) {
            let literalType = outcome.type;
            while (literalType.kind === "optional")
                literalType = literalType.value;
            if (literalType.kind === "intrinsic" && literalType.intrinsic === "any") {
                anyRefusals.push(Object.freeze({ kind: "refused", code: "TSONIC_ANY_UNSUPPORTED", site: node,
                    message: "'any' has no native representation. Declare the type, or use 'unknown' and narrow it." }));
            }
        }
        // A typeof site whose operand categories are not proven (coincident incompatible origins, A1) is refused once.
        if (ast.is.IsTypeOfExpression(node)) {
            const operand = Node_Expression(ast, node);
            const site = operand === undefined || type(operand).kind === "refused" ? undefined : typeofCategory(node, operand);
            if (site?.kind === "refused")
                relationRefusals.push(site);
        }
        const relation = relationAt(node);
        if (relation?.kind === "refused")
            relationRefusals.push(relation);
        // A node that is also written into a sum (Q1) has its own write relation; its refusal is reported too.
        const written = relationQuery.write(node);
        if (written?.kind === "refused" && written !== relation)
            relationRefusals.push(written);
    }
    // Spread elements are not value nodes; their element writes are relations of their own (A4).
    for (const node of solved.nodes) {
        if (!ast.is.IsSpreadElement(node))
            continue;
        const relation = relationAt(node);
        if (relation?.kind === "refused")
            relationRefusals.push(relation);
    }
    for (const node of solved.nodes)
        if (isSourceCallableSignatureDeclaration(ast, node))
            callableReturn(node);
    // A call, construction or super call whose instantiation the Host refuses is refused where it is used: the refusal is
    // the answer of `instantiations.at(use)`, which the consumer that needs the instantiation forwards unchanged (Q105,
    // R11). It is not in the eager census: a call no consumer instantiates (a receiver-only generic the target reads from
    // other facts) compiled at baseline and must not be refused. A generic function value is likewise refused only where it
    // is instantiated (A3-D4).
    const allRefusals = Object.freeze([...new Set([...solved.refusals().map(toRefusal), ...markerRefusals, ...elementRefusals, ...anyRefusals, ...relationRefusals,
            ...[...callableReturnRefusals.values()].map(toRefusal)])]);
    // ---- obligations (checker-free projection of the solver's obligation list) ------------------------------------
    const obligationRecords = Object.freeze(solved.obligations().map(obligation => {
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
        pointerOperation: (call) => pointerRecords.get(call),
        refusals: () => allRefusals,
    });
}
//# sourceMappingURL=program-facts.js.map