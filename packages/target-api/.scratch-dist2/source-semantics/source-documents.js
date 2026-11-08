export function createSourceProgramDocuments(ast, sourceFiles) {
    const documents = Object.freeze(sourceFiles.map((sourceFile) => Object.freeze({
        identity: ast.getPath(sourceFile),
        fileName: ast.getFileName(sourceFile),
        text: ast.getSourceText(sourceFile),
        sourceFile,
    })));
    const documentBySourceFile = new WeakMap();
    const documentSet = new Set();
    const identityOwners = new Map();
    for (const document of documents) {
        const previous = identityOwners.get(document.identity);
        if (previous !== undefined && previous !== document.sourceFile) {
            throw new Error(`Checked source program contains duplicate document identity '${document.identity}'.`);
        }
        identityOwners.set(document.identity, document.sourceFile);
        documentBySourceFile.set(document.sourceFile, document);
        documentSet.add(document);
    }
    const authoredNodesByDocument = new WeakMap();
    const forFile = (sourceFile) => {
        const document = documentBySourceFile.get(sourceFile);
        if (document === undefined) {
            throw new Error("Source documents require an exact source file from the checked program.");
        }
        return document;
    };
    const forNode = (node) => {
        const sourceFile = ast.getSourceFile(node);
        if (sourceFile === undefined) {
            throw new Error("Authored source nodes require an exact source file from the checked program.");
        }
        return forFile(sourceFile);
    };
    const occurrenceFor = (node) => {
        const syntaxKind = ast.kindName(node);
        const range = ast.authoredRange(node);
        if (range.kind === "synthetic") {
            return Object.freeze({ kind: "synthetic", syntaxKind });
        }
        return Object.freeze({
            kind: "authored",
            document: forNode(node),
            start: range.start,
            end: range.end,
            syntaxKind,
        });
    };
    const lookupAuthored = (occurrence) => {
        if (!documentSet.has(occurrence.document)) {
            return Object.freeze({ kind: "foreign-document" });
        }
        const index = authoredNodesByDocument.get(occurrence.document) ??
            indexAuthoredNodes(ast, occurrence.document, authoredNodesByDocument);
        const matches = index.get(occurrenceKey(occurrence)) ?? [];
        if (matches.length === 0) {
            return Object.freeze({ kind: "missing" });
        }
        if (matches.length !== 1) {
            return Object.freeze({ kind: "ambiguous", matchCount: matches.length });
        }
        const node = matches[0];
        if (node === undefined) {
            return Object.freeze({ kind: "missing" });
        }
        return Object.freeze({ kind: "available", node });
    };
    return Object.freeze({
        all: documents,
        includes(document) {
            return documentSet.has(document);
        },
        forFile,
        forNode,
        occurrenceFor,
        lookupAuthored,
    });
}
function indexAuthoredNodes(ast, document, cache) {
    const mutable = new Map();
    const pending = [document.sourceFile];
    const seen = new Set();
    while (pending.length > 0) {
        const node = pending.pop();
        if (node === undefined || seen.has(node)) {
            continue;
        }
        seen.add(node);
        const range = ast.authoredRange(node);
        if (range.kind === "authored") {
            const key = occurrenceKey({
                start: range.start,
                end: range.end,
                syntaxKind: ast.kindName(node),
            });
            const nodes = mutable.get(key);
            if (nodes === undefined) {
                mutable.set(key, [node]);
            }
            else {
                nodes.push(node);
            }
        }
        pending.push(...ast.children(node).filter((child) => child !== undefined));
    }
    const frozen = new Map([...mutable].map(([key, nodes]) => [key, Object.freeze([...nodes])]));
    cache.set(document, frozen);
    return frozen;
}
function occurrenceKey(occurrence) {
    return `${occurrence.start}:${occurrence.end}:${occurrence.syntaxKind}`;
}
//# sourceMappingURL=source-documents.js.map