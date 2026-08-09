import { AsSourceFile } from "../internal/ast/ast.js";
import { NewNodeFactory, Node_End, NodeList_End, NodeList_Pos, Node_Pos, } from "../internal/ast/spine.js";
import { TargetAstNodeDataChildren, TargetAstNodeDataExtended, TargetAstNodeDataString, targetAstNodeEncoding, } from "../internal/ast/generated/encoder.js";
import { NewIdentifier, NewKeywordTypeNode, } from "../internal/ast/generated/factory.js";
import { KindPropertyAssignment, KindPropertySignature, KindShorthandPropertyAssignment, KindUnknownKeyword, } from "../internal/ast/generated/kinds.js";
import { HEADER_OFFSET_EXTENDED_DATA, HEADER_OFFSET_METADATA, HEADER_OFFSET_NODES, HEADER_OFFSET_STRING_TABLE, HEADER_OFFSET_STRING_TABLE_OFFSETS, HEADER_OFFSET_STRUCTURED_DATA, HEADER_SIZE, KIND_NODE_LIST, NODE_DATA_TYPE_CHILDREN, NODE_DATA_TYPE_EXTENDED, NODE_DATA_TYPE_STRING, NODE_EXTENDED_DATA_MASK, NODE_LEN, NODE_STRING_INDEX_MASK, PROTOCOL_VERSION, } from "../internal/ast/generated/protocol.js";
import { defaultTargetAstEncodingLimits, TargetAstResourceBudget, TargetAstResourceLimitError, } from "./target-ast-resource-budget.js";
const noStructuredData = 0xffff_ffff;
export class TargetAstEncodingError extends Error {
    kind;
    field;
    constructor(message, kind, field) {
        super(message);
        this.name = "TargetAstEncodingError";
        this.kind = kind;
        this.field = field;
    }
}
export function encodeTargetSourceFileForPrinting(sourceFile) {
    try {
        return new TargetAstEncoder().encode(sourceFile);
    }
    catch (error) {
        if (error instanceof TargetAstResourceLimitError) {
            throw new TargetAstEncodingError(error.message);
        }
        throw error;
    }
}
class TargetAstEncoder {
    #budget;
    #strings;
    #extended = [];
    #structured = [];
    #nodeValues = new Array(NODE_LEN / 4).fill(0);
    #active = new Set();
    #unknownType;
    #undefinedExpression;
    #nodeCount = 0;
    #parentIndex = 0;
    #previousIndex = 0;
    constructor() {
        this.#budget = new TargetAstResourceBudget(defaultTargetAstEncodingLimits);
        this.#budget.reserveNodeRows(1);
        this.#strings = new StringTable(this.#budget);
        const factory = NewNodeFactory({});
        this.#unknownType = requiredProtocolNode(NewKeywordTypeNode(factory, KindUnknownKeyword), "property-assignment type completion");
        this.#undefinedExpression = requiredProtocolNode(NewIdentifier(factory, "undefined"), "property-signature initializer completion");
    }
    encode(sourceFile) {
        const root = sourceFile.data.AsNode();
        if (root === undefined) {
            throw new TargetAstEncodingError("target source file has no root node");
        }
        const encoding = this.#encoding(root);
        this.#budget.requireDepth(1);
        this.#budget.reserveNodeRows(1);
        this.#nodeCount = 1;
        this.#appendNodeRow(root, 0, this.#nodeData(root, encoding));
        this.#parentIndex = 1;
        this.#previousIndex = 0;
        this.#active.add(root);
        try {
            this.#visitChildren(root, encoding, 1);
        }
        finally {
            this.#active.delete(root);
        }
        return this.#finish();
    }
    #visitNode(node, depth) {
        if (node === undefined) {
            throw new TargetAstEncodingError("present target AST child is absent");
        }
        if (this.#active.has(node)) {
            throw new TargetAstEncodingError("cycle in target AST", node.Kind);
        }
        this.#budget.requireDepth(depth);
        this.#budget.reserveNodeRows(1);
        this.#active.add(node);
        try {
            const encoding = this.#encoding(node);
            this.#nodeCount += 1;
            const current = this.#nodeCount;
            this.#linkPrevious(current);
            this.#appendNodeRow(node, this.#parentIndex, this.#nodeData(node, encoding));
            const savedParent = this.#parentIndex;
            this.#parentIndex = current;
            this.#previousIndex = 0;
            this.#visitChildren(node, encoding, depth);
            this.#previousIndex = current;
            this.#parentIndex = savedParent;
        }
        finally {
            this.#active.delete(node);
        }
    }
    #visitNodeList(nodes, list, depth) {
        this.#budget.requireDepth(depth);
        this.#budget.reserveNodeRows(1);
        this.#nodeCount += 1;
        const current = this.#nodeCount;
        this.#linkPrevious(current);
        this.#nodeValues.push(KIND_NODE_LIST, encodedPosition(NodeList_Pos(list)), encodedPosition(NodeList_End(list)), 0, this.#parentIndex, nodes.length, 0);
        const savedParent = this.#parentIndex;
        this.#parentIndex = current;
        this.#previousIndex = 0;
        for (const node of nodes)
            this.#visitNode(node, depth + 1);
        this.#previousIndex = current;
        this.#parentIndex = savedParent;
    }
    #visitChildren(node, encoding, depth) {
        for (const child of encoding.children) {
            if (!child.present) {
                if (child.required) {
                    throw new TargetAstEncodingError("required target AST child is absent", node.Kind, child.name);
                }
                continue;
            }
            if (child.raw) {
                for (const rawChild of child.nodes ?? []) {
                    this.#visitNode(rawChild, depth + 1);
                }
            }
            else if (child.nodes !== undefined || child.node === undefined) {
                if (child.list === undefined) {
                    throw new TargetAstEncodingError("present target AST node list is absent", node.Kind, child.name);
                }
                this.#visitNodeList(child.nodes ?? [], child.list, depth + 1);
            }
            else {
                this.#visitNode(child.node, depth + 1);
            }
        }
    }
    #nodeData(node, encoding) {
        switch (encoding.dataType) {
            case TargetAstNodeDataChildren:
                return (NODE_DATA_TYPE_CHILDREN |
                    encoding.commonData |
                    childMask(encoding.children)) >>> 0;
            case TargetAstNodeDataString: {
                const index = this.#strings.add(requiredText(node, encoding.text));
                if (index > NODE_STRING_INDEX_MASK) {
                    throw new TargetAstEncodingError("string index exceeds protocol width", node.Kind);
                }
                return (NODE_DATA_TYPE_STRING | encoding.commonData | index) >>> 0;
            }
            case TargetAstNodeDataExtended: {
                const offset = checkedProduct(this.#extended.length, 4, "extended-data byte offset");
                if (offset > NODE_EXTENDED_DATA_MASK) {
                    throw new TargetAstEncodingError("extended-data offset exceeds protocol width", node.Kind);
                }
                this.#appendExtended(node, encoding);
                return (NODE_DATA_TYPE_EXTENDED | encoding.commonData | offset) >>> 0;
            }
        }
    }
    #encoding(node) {
        const encoding = targetAstNodeEncoding(node);
        switch (node.Kind) {
            case KindPropertyAssignment:
            case KindShorthandPropertyAssignment:
                return withRequiredProtocolChild(encoding, "Type", this.#unknownType);
            case KindPropertySignature:
                return withRequiredProtocolChild(encoding, "Initializer", this.#undefinedExpression);
            default:
                return encoding;
        }
    }
    #appendExtended(node, encoding) {
        switch (encoding.extended) {
            case "literal":
                this.#budget.reserveExtendedWords(2);
                this.#extended.push(this.#strings.add(requiredText(node, encoding.text)), encoding.tokenFlags ?? 0);
                return;
            case "template":
                this.#budget.reserveExtendedWords(3);
                this.#extended.push(this.#strings.add(requiredText(node, encoding.text)), this.#strings.add(requiredText(node, encoding.rawText)), encoding.tokenFlags ?? 0);
                return;
            case "source-file":
                this.#appendSourceFile(requiredSourceFile(node));
                return;
            case "none":
                throw new TargetAstEncodingError("extended target AST node has no extended-data owner", node.Kind);
        }
    }
    #appendSourceFile(source) {
        const fileName = source.FileName();
        const path = source.Path();
        if (fileName.length === 0) {
            throw new TargetAstEncodingError("source file name is absent", source.Kind, "FileName");
        }
        if (path.length === 0) {
            throw new TargetAstEncodingError("source path is absent", source.Kind, "Path");
        }
        const references = appendFileReferences(this.#structured, source.ReferencedFiles, this.#budget);
        const typeReferences = appendFileReferences(this.#structured, source.TypeReferenceDirectives, this.#budget);
        const libReferences = appendFileReferences(this.#structured, source.LibReferenceDirectives, this.#budget);
        this.#budget.reserveExtendedWords(12);
        this.#extended.push(this.#strings.add(source.Text()), this.#strings.add(fileName), this.#strings.add(path), source.LanguageVariant, source.ScriptKind, references, typeReferences, libReferences, noStructuredData, noStructuredData, noStructuredData, 0);
    }
    #appendNodeRow(node, parent, data) {
        this.#nodeValues.push(node.Kind, encodedPosition(Node_Pos(node)), encodedPosition(Node_End(node)), 0, parent, data, node.Flags ?? 0);
    }
    #linkPrevious(current) {
        if (this.#previousIndex !== 0) {
            this.#nodeValues[this.#previousIndex * (NODE_LEN / 4) + 3] = current;
        }
    }
    #finish() {
        const stringOffsets = uint32Bytes(this.#strings.offsets);
        const stringData = this.#strings.bytes();
        const extended = uint32Bytes(this.#extended);
        const structured = Uint8Array.from(this.#structured);
        const nodes = uint32Bytes(this.#nodeValues);
        const offsetStringOffsets = HEADER_SIZE;
        const offsetStringData = checkedWireOffset(offsetStringOffsets, stringOffsets.length, "string-table data");
        const offsetExtended = checkedWireOffset(offsetStringData, stringData.length, "extended data");
        const offsetStructured = checkedWireOffset(offsetExtended, extended.length, "structured data");
        const offsetNodes = checkedWireOffset(offsetStructured, structured.length, "node data");
        const encodedLength = checkedWireOffset(offsetNodes, nodes.length, "encoded payload");
        this.#budget.requireEncodedBytes(encodedLength);
        const result = new Uint8Array(encodedLength);
        const view = new DataView(result.buffer);
        view.setUint32(HEADER_OFFSET_METADATA, PROTOCOL_VERSION << 24, true);
        view.setUint32(HEADER_OFFSET_STRING_TABLE_OFFSETS, offsetStringOffsets, true);
        view.setUint32(HEADER_OFFSET_STRING_TABLE, offsetStringData, true);
        view.setUint32(HEADER_OFFSET_EXTENDED_DATA, offsetExtended, true);
        view.setUint32(HEADER_OFFSET_STRUCTURED_DATA, offsetStructured, true);
        view.setUint32(HEADER_OFFSET_NODES, offsetNodes, true);
        result.set(stringOffsets, offsetStringOffsets);
        result.set(stringData, offsetStringData);
        result.set(extended, offsetExtended);
        result.set(structured, offsetStructured);
        result.set(nodes, offsetNodes);
        return result;
    }
}
class StringTable {
    offsets = [];
    #budget;
    #parts = [];
    #length = 0;
    constructor(budget) {
        this.#budget = budget;
    }
    add(value) {
        const bytes = new TextEncoder().encode(value);
        this.#budget.reserveString(bytes.length);
        const index = this.offsets.length;
        const start = this.#length;
        this.#parts.push(bytes);
        this.#length = checkedSum(start, bytes.length, "string-table byte length");
        this.offsets.push(start, this.#length);
        return index;
    }
    bytes() {
        const result = new Uint8Array(this.#length);
        let offset = 0;
        for (const part of this.#parts) {
            result.set(part, offset);
            offset += part.length;
        }
        return result;
    }
}
function appendFileReferences(destination, references, budget) {
    if (references.length === 0)
        return noStructuredData;
    const offset = destination.length;
    appendArrayHeader(destination, references.length, budget);
    for (const reference of references) {
        if (reference === undefined) {
            throw new TargetAstEncodingError("source file reference is absent");
        }
        appendArrayHeader(destination, 5, budget);
        appendMessagePackUint(destination, reference.pos, budget);
        appendMessagePackUint(destination, reference.end, budget);
        appendMessagePackString(destination, reference.FileName, budget);
        appendMessagePackUint(destination, reference.ResolutionMode, budget);
        appendStructuredBytes(destination, budget, reference.Preserve ? 0xc3 : 0xc2);
    }
    return offset;
}
function appendArrayHeader(destination, length, budget) {
    requireUint32(length, "structured array length");
    if (length <= 0x0f) {
        appendStructuredBytes(destination, budget, 0x90 | length);
    }
    else if (length <= 0xffff) {
        appendStructuredBytes(destination, budget, 0xdc, length >>> 8, length);
    }
    else {
        appendStructuredBytes(destination, budget, 0xdd, length >>> 24, length >>> 16, length >>> 8, length);
    }
}
function appendMessagePackUint(destination, value, budget) {
    requireUint32(value, "structured unsigned integer");
    if (value <= 0x7f) {
        appendStructuredBytes(destination, budget, value);
    }
    else if (value <= 0xff) {
        appendStructuredBytes(destination, budget, 0xcc, value);
    }
    else if (value <= 0xffff) {
        appendStructuredBytes(destination, budget, 0xcd, value >>> 8, value);
    }
    else {
        appendStructuredBytes(destination, budget, 0xce, value >>> 24, value >>> 16, value >>> 8, value);
    }
}
function appendMessagePackString(destination, value, budget) {
    const bytes = new TextEncoder().encode(value);
    requireUint32(bytes.length, "structured string byte length");
    if (bytes.length <= 0x1f) {
        appendStructuredBytes(destination, budget, 0xa0 | bytes.length);
    }
    else if (bytes.length <= 0xff) {
        appendStructuredBytes(destination, budget, 0xd9, bytes.length);
    }
    else if (bytes.length <= 0xffff) {
        appendStructuredBytes(destination, budget, 0xda, bytes.length >>> 8, bytes.length);
    }
    else {
        appendStructuredBytes(destination, budget, 0xdb, bytes.length >>> 24, bytes.length >>> 16, bytes.length >>> 8, bytes.length);
    }
    budget.reserveStructuredBytes(bytes.length);
    for (const byte of bytes) {
        destination.push(byte);
    }
}
function appendStructuredBytes(destination, budget, ...bytes) {
    budget.reserveStructuredBytes(bytes.length);
    for (const byte of bytes) {
        if (!Number.isInteger(byte) || byte < 0 || byte > 0xff) {
            throw new TargetAstEncodingError("structured target AST data contains a non-byte value");
        }
        destination.push(byte);
    }
}
function withRequiredProtocolChild(encoding, name, node) {
    let matches = 0;
    const children = encoding.children.map((child) => {
        if (child.name !== name) {
            return child;
        }
        matches += 1;
        if (!child.required || child.raw || child.nodes !== undefined) {
            throw new TargetAstEncodingError("target AST protocol completion does not own one required node", undefined, name);
        }
        return child.present ? child : {
            ...child,
            present: true,
            node,
        };
    });
    if (matches !== 1) {
        throw new TargetAstEncodingError(`target AST protocol completion found ${matches} '${name}' fields`, undefined, name);
    }
    return { ...encoding, children };
}
function requiredProtocolNode(node, subject) {
    if (node === undefined) {
        throw new TargetAstEncodingError(`${subject} was not created`);
    }
    return node;
}
function childMask(children) {
    let mask = 0;
    children.forEach((child, index) => {
        if (child.present)
            mask |= 1 << index;
    });
    return mask >>> 0;
}
function encodedPosition(value) {
    if (value < 0) {
        return 0;
    }
    requireUint32(value, "target AST source position");
    return value;
}
function uint32Bytes(values) {
    const byteLength = checkedProduct(values.length, 4, "uint32 data length");
    const result = new Uint8Array(byteLength);
    const view = new DataView(result.buffer);
    values.forEach((value, index) => {
        requireUint32(value, `uint32 value at index ${index}`);
        view.setUint32(index * 4, value, true);
    });
    return result;
}
function checkedWireOffset(offset, length, subject) {
    const result = checkedSum(offset, length, `${subject} offset`);
    requireUint32(result, `${subject} offset`);
    return result;
}
function checkedProduct(left, right, subject) {
    requireNonNegativeSafeInteger(left, `${subject} left operand`);
    requireNonNegativeSafeInteger(right, `${subject} right operand`);
    const result = left * right;
    if (!Number.isSafeInteger(result)) {
        throw new TargetAstEncodingError(`${subject} exceeds safe integer range`);
    }
    return result;
}
function checkedSum(left, right, subject) {
    requireNonNegativeSafeInteger(left, `${subject} left operand`);
    requireNonNegativeSafeInteger(right, `${subject} right operand`);
    const result = left + right;
    if (!Number.isSafeInteger(result)) {
        throw new TargetAstEncodingError(`${subject} exceeds safe integer range`);
    }
    return result;
}
function requireUint32(value, subject) {
    requireNonNegativeSafeInteger(value, subject);
    if (value > 0xffff_ffff) {
        throw new TargetAstEncodingError(`${subject} exceeds uint32 range`);
    }
}
function requireNonNegativeSafeInteger(value, subject) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new TargetAstEncodingError(`${subject} must be a non-negative safe integer`);
    }
}
function requiredText(node, value) {
    if (value === undefined) {
        throw new TargetAstEncodingError("target AST text is absent", node.Kind);
    }
    return value;
}
function requiredSourceFile(node) {
    const sourceFile = AsSourceFile(node);
    if (sourceFile === undefined) {
        throw new TargetAstEncodingError("source-file node has no source-file data", node.Kind);
    }
    return sourceFile;
}
//# sourceMappingURL=target-ast-encoding.js.map