import { LinkStore_TryGet } from "../../core/linkstore.js";
import { GetSourceFileOfNode } from "../../ast/utilities.js";
import { SourceFile_FileName } from "../../ast/ast.js";
import { Type_AsStructuredType, ObjectFlagsAnonymous, ObjectFlagsMembersResolved, ObjectFlagsFreshLiteral, ObjectFlagsJSLiteral, ObjectFlagsObjectLiteral, ObjectFlagsObjectLiteralPatternWithComputedProperties, ObjectFlagsPropagatingFlags, ObjectFlagsContainsSpread } from "../types.js";
import { Checker_newAnonymousType } from "./types.js";
export class LiteralConstructionOwner {
    #checker;
    #node;
    #links;
    #root;
    #completed = false;
    constructor(checker, node, links) {
        this.#checker = checker;
        this.#node = node;
        this.#links = links;
    }
    static begin(checker, node, links) {
        return new LiteralConstructionOwner(checker, node, links);
    }
    static complete(owner, root) {
        if (owner.#completed)
            throw new TypeError("An actual native construction question is published only once");
        owner.#root = root;
        owner.#completed = true;
    }
    static read(owner, checker) {
        const file = GetSourceFileOfNode(owner.#node);
        if (owner.#checker !== checker || file === undefined || checker.program.GetSourceFile(SourceFile_FileName(file)) !== file
            || LinkStore_TryGet(checker.typeNodeLinks, owner.#node) !== owner.#links || !owner.#completed || owner.#root === undefined
            || owner.#root.checker !== checker || owner.#links.resolvedType !== owner.#root)
            return undefined;
        return { node: owner.#node, root: owner.#root };
    }
}
function copyIndex(input) {
    return { ...input, components: input.components.slice() };
}
export class LiteralCreation {
    #output;
    #checker;
    #creator;
    #input;
    #owner;
    constructor(output, checker, creator, input, owner) {
        this.#output = output;
        this.#checker = checker;
        this.#creator = "site" in creator ? { ...creator, site: { ...creator.site } } : { ...creator };
        this.#input = input;
        this.#owner = owner;
    }
    static create(checker, creator, symbol, members, calls, constructs, indexes, flags, pattern, owner) {
        const output = Checker_newAnonymousType(checker, symbol, members, calls.slice(), constructs.slice(), indexes.slice());
        if (output === undefined)
            throw new Error("The actual native literal factory returns its fresh output");
        output.objectFlags |= flags;
        if (pattern !== undefined)
            checker.patternForType.set(output, pattern);
        const values = [];
        for (const member of members.values()) {
            if (member === undefined)
                throw new Error("The native literal factory supplies dense members");
            const links = LinkStore_TryGet(checker.valueSymbolLinks, member);
            const spread = LinkStore_TryGet(checker.spreadLinks, member);
            values.push({ symbol: member, target: links?.target, flags: member.Flags, checkFlags: member.CheckFlags,
                nameType: links?.nameType, value: links?.resolvedType, declarations: (member.Declarations ?? []).slice(),
                parent: member.Parent, declaration: member.ValueDeclaration,
                syntheticOrigin: LinkStore_TryGet(checker.mappedSymbolLinks, member)?.syntheticOrigin,
                leftSpread: spread?.leftSpread, rightSpread: spread?.rightSpread });
        }
        const input = { symbol, flags: output.objectFlags, pattern, members: values,
            calls: calls.slice(), constructs: constructs.slice(), indexes: indexes.map(copyIndex) };
        output.derivation = { kind: creator.kind, creation: new LiteralCreation(output, checker, creator, input, owner) };
        return output;
    }
    static read(type) {
        const record = type.derivation;
        if (record?.kind !== "object-literal" && record?.kind !== "literal-fragment"
            && record?.kind !== "literal-merge" && record?.kind !== "literal-partial")
            return undefined;
        const creation = record.creation;
        if (typeof creation !== "object" || creation === null || !(#output in creation)
            || creation.#output !== type || creation.#checker !== type.checker || record.kind !== creation.#creator.kind)
            return undefined;
        const literalFactoryFlags = ObjectFlagsAnonymous | ObjectFlagsMembersResolved | ObjectFlagsFreshLiteral
            | ObjectFlagsJSLiteral | ObjectFlagsObjectLiteral | ObjectFlagsObjectLiteralPatternWithComputedProperties | ObjectFlagsPropagatingFlags | ObjectFlagsContainsSpread;
        if ((type.objectFlags & literalFactoryFlags) !== (creation.#input.flags & literalFactoryFlags)
            || creation.#checker.patternForType.get(type) !== creation.#input.pattern)
            return undefined;
        const members = Type_AsStructuredType(type)?.members;
        if (type.symbol !== creation.#input.symbol || members === undefined || members.size !== creation.#input.members.length)
            return undefined;
        let position = 0;
        for (const symbol of members.values()) {
            const input = creation.#input.members[position++];
            if (input === undefined || symbol !== input.symbol || symbol === undefined)
                return undefined;
            const links = LinkStore_TryGet(creation.#checker.valueSymbolLinks, symbol);
            if (symbol.Flags !== input.flags || symbol.CheckFlags !== input.checkFlags || symbol.Parent !== input.parent
                || symbol.ValueDeclaration !== input.declaration || links?.target !== input.target
                || links?.nameType !== input.nameType
                || input.value !== undefined && links?.resolvedType !== input.value)
                return undefined;
            const spread = LinkStore_TryGet(creation.#checker.spreadLinks, symbol);
            if (LinkStore_TryGet(creation.#checker.mappedSymbolLinks, symbol)?.syntheticOrigin !== input.syntheticOrigin
                || spread?.leftSpread !== input.leftSpread || spread?.rightSpread !== input.rightSpread)
                return undefined;
            const declarations = symbol.Declarations ?? [];
            if (declarations.length !== input.declarations.length)
                return undefined;
            for (let index = 0; index < declarations.length; index++)
                if (declarations[index] !== input.declarations[index])
                    return undefined;
        }
        const structured = Type_AsStructuredType(type);
        if (structured === undefined || structured.signatures.length !== creation.#input.calls.length + creation.#input.constructs.length
            || structured.callSignatureCount !== creation.#input.calls.length
            || structured.indexInfos.length !== creation.#input.indexes.length)
            return undefined;
        for (let index = 0; index < structured.signatures.length; index++)
            if (structured.signatures[index] !== (index < creation.#input.calls.length ? creation.#input.calls[index]
                : creation.#input.constructs[index - creation.#input.calls.length]))
                return undefined;
        for (let index = 0; index < structured.indexInfos.length; index++) {
            const actual = structured.indexInfos[index];
            const input = creation.#input.indexes[index];
            if (actual === undefined || input === undefined || actual.keyType !== input.keyType || actual.valueType !== input.valueType
                || actual.declaration !== input.declaration || actual.isReadonly !== input.isReadonly
                || actual.indexSymbol !== input.indexSymbol || actual.components.length !== input.components.length)
                return undefined;
            for (let component = 0; component < actual.components.length; component++)
                if (actual.components[component] !== input.components[component])
                    return undefined;
        }
        const creator = creation.#creator;
        return { capability: creation, node: "site" in creator ? creator.site.node : creator.node, owner: creation.#owner,
            mode: "site" in creator ? creator.site.mode : creator.mode,
            creator: "site" in creator ? { ...creator, site: { ...creator.site } } : { ...creator },
            inputs: () => {
                const input = creation.#input;
                return { ...input, members: input.members.map(member => ({ ...member, declarations: member.declarations.slice() })),
                    calls: input.calls.slice(), constructs: input.constructs.slice(), indexes: input.indexes.map(copyIndex) };
            } };
    }
}
//# sourceMappingURL=literal-creation.js.map