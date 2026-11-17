import { LiteralConstructionOwner, LiteralCreation } from "../internal/checker/checker/literal-creation.js";
import { Checker_getSpreadType, Checker_tryMergeUnionOfObjectTypeAndEmptyObject } from "../internal/checker/checker/types.js";
import { Checker_newIndexInfo, Checker_newSymbolEx } from "../internal/checker/checker/symbols.js";
import { getPropertyNameFromType } from "../internal/checker/utilities.js";
import { TypeFlagsUnion, TypeFlagsIntersection } from "../internal/checker/types.js";
import { SourceFile_FileName } from "../internal/ast/ast.js";
import { GetSourceFileOfNode } from "../internal/ast/utilities.js";
import { LinkStore_Get } from "../internal/core/linkstore.js";
import { cachedLateBoundSymbolDeclaration, cachedValueTypeSymbol, hasCachedValueTypeKind, reacquireCachedLateBoundSymbol } from "./type-normalization-declarations.js";
import { cachedCompositeConstruction } from "./type-normalization-composites.js";
function admittedInputs(type, source, admitted) {
    const known = admitted.get(type);
    if (known !== undefined && known !== null)
        return known;
    const pending = [type];
    const staged = new Map();
    let root;
    while (pending.length !== 0) {
        const value = pending.pop();
        if (value === undefined)
            throw new Error("Actual fresh literal inputs are dense");
        if (staged.has(value) || admitted.has(value))
            continue;
        if (value.checker !== source)
            throw new TypeError("Actual native constructor inputs retain their source checker");
        const creation = LiteralCreation.read(value);
        if (creation === undefined) {
            const kind = value.derivation?.kind;
            if (kind === "object-literal" || kind === "literal-fragment" || kind === "literal-merge" || kind === "literal-partial")
                throw new TypeError("A fresh literal requires its authenticated actual native output");
            if (hasCachedValueTypeKind(value) && cachedValueTypeSymbol(source, value) === undefined)
                throw new TypeError("The actual literal value input retains its complete native source cache relation");
            if ((value.flags & (TypeFlagsUnion | TypeFlagsIntersection)) !== 0 && value.alias === undefined) {
                const composite = cachedCompositeConstruction(source, value);
                if (composite === undefined)
                    throw new TypeError("The constructor input retains its actual native composite cache");
                for (const member of composite.members) {
                    if (member === undefined)
                        throw new TypeError("Native composite constructor inputs are dense");
                    pending.push(member);
                }
            }
            staged.set(value, null);
            continue;
        }
        const file = GetSourceFileOfNode(creation.node);
        if (file === undefined || source.program.GetSourceFile(SourceFile_FileName(file)) !== file)
            throw new TypeError("A fresh literal retains its actual producing Program node");
        if (creation.owner !== undefined && LiteralConstructionOwner.read(creation.owner, source) === undefined)
            throw new TypeError("A native cached-question creation cannot lose or replace its actual publication");
        const input = creation.inputs();
        staged.set(value, input);
        if (root === undefined)
            root = input;
        if (input.calls.length !== 0 || input.constructs.length !== 0)
            throw new TypeError("The actual complete literal factory has no invented signature inputs");
        const checkType = (dependency) => {
            if (dependency === undefined || dependency.checker !== source)
                throw new TypeError("Every actual fresh literal Type input belongs to its producing checker");
            pending.push(dependency);
        };
        const checkSymbol = (symbol) => {
            if (symbol !== undefined && symbol.checkerId !== undefined && symbol.checkerId !== source.id)
                throw new TypeError("Every actual fresh literal Symbol input has its actual owner");
        };
        const checkTarget = (symbol) => {
            checkSymbol(symbol);
            if (symbol?.checkerId !== undefined && cachedLateBoundSymbolDeclaration(source, symbol) === undefined)
                throw new TypeError("The literal Symbol input retains both actual source declaration caches");
        };
        const operation = creation.creator;
        checkTarget(input.symbol);
        if (operation.kind === "literal-merge") {
            checkType(operation.left);
            checkType(operation.right);
        }
        else if (operation.kind === "literal-partial") {
            checkType(operation.source);
            checkType(operation.other);
        }
        else {
            for (const member of input.members) {
                checkSymbol(member.symbol);
                checkTarget(member.target);
                checkTarget(member.parent);
                if (member.target === undefined)
                    checkTarget(member.symbol);
                if (member.target !== undefined)
                    checkType(member.value);
                if (member.nameType !== undefined)
                    checkType(member.nameType);
            }
            for (const index of input.indexes) {
                checkType(index.keyType);
                checkType(index.valueType);
                checkTarget(index.indexSymbol);
            }
        }
    }
    if (root === undefined)
        throw new Error("The admitted native creation retains its input vector");
    for (const [value, input] of staged)
        admitted.set(value, input);
    return root;
}
export function reacquireFreshLiteral(producer, type, normalize, admitted) {
    const source = type.checker;
    if (source === undefined)
        throw new TypeError("A fresh literal retains its actual checker");
    const input = admittedInputs(type, source, admitted);
    const creation = LiteralCreation.read(type);
    if (creation === undefined)
        throw new TypeError("The fresh literal retains its authenticated creation");
    if (source.program.SourceFiles() !== producer.program.SourceFiles())
        throw new TypeError("Fresh literal normalization requires the same actual Program");
    const selectedType = (value) => {
        if (value === undefined)
            throw new TypeError("An actual literal constructor Type input is present");
        const selected = normalize(value);
        if (selected.checker !== producer)
            throw new TypeError("The literal constructor consumes only target-owned Types");
        return selected;
    };
    const selectedSymbol = (value) => {
        if (value === undefined || value.checkerId === undefined)
            return value;
        const selected = reacquireCachedLateBoundSymbol(source, producer, value);
        if (selected === undefined)
            throw new TypeError("The actual native literal symbol retains its cached producer relation");
        return selected;
    };
    const operation = creation.creator;
    if (operation.kind === "literal-merge" || operation.kind === "literal-partial") {
        const selected = operation.kind === "literal-merge"
            ? Checker_getSpreadType(producer, selectedType(operation.left), selectedType(operation.right), selectedSymbol(input.symbol), operation.flags, operation.readonly, operation.site)
            : Checker_tryMergeUnionOfObjectTypeAndEmptyObject(producer, selectedType(operation.source), operation.readonly, { site: operation.site, role: operation.role, other: selectedType(operation.other) });
        if (selected?.checker !== producer || LiteralCreation.read(selected) === undefined)
            throw new Error("The actual native spread constructor retains its fresh target-owned result");
        return selected;
    }
    const members = new Map();
    for (const member of input.members) {
        let selected;
        if (member.target === undefined)
            selected = selectedSymbol(member.symbol);
        else {
            const target = selectedSymbol(member.target);
            if (target === undefined)
                throw new TypeError("The native literal wrapper retains its real target");
            const value = selectedType(member.value);
            const nameType = member.nameType === undefined ? undefined : selectedType(member.nameType);
            selected = Checker_newSymbolEx(producer, member.flags, nameType === undefined ? target.Name : getPropertyNameFromType(nameType), member.checkFlags);
            if (selected === undefined)
                throw new Error("The native property constructor returns its actual target-owned wrapper");
            selected.Declarations = member.declarations.slice();
            selected.ValueDeclaration = member.declaration;
            selected.Parent = selectedSymbol(member.parent);
            const links = LinkStore_Get(producer.valueSymbolLinks, selected);
            if (links === undefined)
                throw new Error("The native wrapper has its actual target value links");
            links.target = target;
            links.resolvedType = value;
            if (nameType !== undefined)
                links.nameType = nameType;
        }
        if (selected === undefined)
            throw new TypeError("Every actual literal member has a target-owned or genuine shared symbol");
        members.set(selected.Name, selected);
    }
    const indexes = input.indexes.map(index => {
        const selected = Checker_newIndexInfo(producer, selectedType(index.keyType), selectedType(index.valueType), index.isReadonly, index.declaration, index.components.slice());
        if (selected === undefined)
            throw new Error("The native index constructor returns its actual target input");
        selected.indexSymbol = selectedSymbol(index.indexSymbol);
        return selected;
    });
    return LiteralCreation.create(producer, operation, selectedSymbol(input.symbol), members, [], [], indexes, input.flags, input.pattern);
}
//# sourceMappingURL=type-normalization-fresh-literals.js.map