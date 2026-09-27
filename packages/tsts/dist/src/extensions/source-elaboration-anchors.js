import { Node_End, Node_Pos } from "../internal/ast/spine.js";
import { encodeIdentityTuple } from "./identity-tuple.js";
export class SourceElaborationAnchors {
    #source;
    #maximumDepth;
    #budget;
    #known = new Map();
    #children = new WeakMap();
    #childIndexes = new WeakMap();
    #anchors = new WeakMap();
    constructor(source, maximumDepth, budget, anchors) {
        this.#source = source;
        this.#maximumDepth = maximumDepth;
        this.#budget = budget;
        for (const anchor of anchors)
            this.#retain(anchor);
    }
    reference(node) {
        const cached = this.#anchors.get(node);
        if (cached !== undefined)
            return cached;
        const file = this.#source.ast.getSourceFile(node);
        if (file === undefined || this.#source.getSourceFile(this.#source.ast.getFileName(file)) !== file) {
            throw new Error("Source elaboration requires syntax from its current compiler epoch.");
        }
        const path = [];
        const visited = new Set();
        let child = node;
        while (child !== file) {
            if (visited.has(child) || path.length >= this.#maximumDepth) {
                throw new Error("Source elaboration anchor is cyclic or exceeds its depth budget.");
            }
            visited.add(child);
            const parent = child.Parent;
            if (parent === undefined)
                throw new Error("Source elaboration anchor has no owning syntax path.");
            this.#readChildren(parent);
            const index = this.#childIndexes.get(parent).get(child);
            if (index === undefined)
                throw new Error("Source elaboration anchor is outside its parent's schema children.");
            path.push(index);
            child = parent;
        }
        path.reverse();
        const fileName = this.#source.ast.getFileName(file);
        const anchor = this.#retain(Object.freeze({
            fileName,
            path: Object.freeze(path),
            kind: node.Kind,
            pos: Node_Pos(node),
            end: Node_End(node),
            id: encodeIdentityTuple([fileName, ...path]),
        }));
        this.#anchors.set(node, anchor);
        return anchor;
    }
    resolve(anchor) {
        const file = this.#source.getSourceFile(anchor.fileName);
        if (file === undefined)
            throw new Error(`Source elaboration file '${anchor.fileName}' is no longer present.`);
        if (anchor.path.length > this.#maximumDepth)
            throw new Error("Source elaboration anchor exceeds its depth budget.");
        let node = file;
        for (const index of anchor.path) {
            const child = this.#readChildren(node)[index];
            if (child === undefined)
                throw new Error("Source elaboration anchor no longer resolves to its exact syntax.");
            node = child;
        }
        if (node.Kind !== anchor.kind || Node_Pos(node) !== anchor.pos || Node_End(node) !== anchor.end) {
            throw new Error("Source elaboration anchor no longer matches its exact syntax.");
        }
        this.#anchors.set(node, anchor);
        return node;
    }
    sourceInputs() {
        return new Map(this.#source.getSourceFiles().filter((file) => file !== undefined)
            .map(file => [this.#source.ast.getFileName(file), file.Text()]));
    }
    #retain(anchor) {
        const existing = this.#known.get(anchor.id);
        if (existing !== undefined) {
            if (existing.kind !== anchor.kind || existing.pos !== anchor.pos || existing.end !== anchor.end) {
                throw new Error("Source elaboration anchor changed within its input revision.");
            }
            return existing;
        }
        this.#budget.reserve(1 + anchor.path.length, anchor.id.length + anchor.fileName.length);
        this.#known.set(anchor.id, anchor);
        return anchor;
    }
    #readChildren(node) {
        const cached = this.#children.get(node);
        if (cached !== undefined)
            return cached;
        const children = Object.freeze(this.#source.ast.children(node).filter((child) => child !== undefined));
        const indexes = new Map();
        for (const [index, child] of children.entries()) {
            if (indexes.has(child))
                throw new Error("Source elaboration syntax contains a repeated child identity.");
            indexes.set(child, index);
        }
        this.#children.set(node, children);
        this.#childIndexes.set(node, indexes);
        return children;
    }
}
//# sourceMappingURL=source-elaboration-anchors.js.map