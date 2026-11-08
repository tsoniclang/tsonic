export function sourceStorageReference(subject, scope, views) {
    return Object.freeze({ kind: "reference", subject, scope, ...(views === undefined ? {} : { views }) });
}
//# sourceMappingURL=scoped-model.js.map