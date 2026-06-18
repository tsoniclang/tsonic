export const LinterPlugin = 1;
export const LoadModeTypesInfo = 1 << 0;
export function Plugin(kind, name, analyzer, loadMode) {
    return { Kind: kind, Name: name, Analyzer: analyzer, LoadMode: loadMode };
}
//# sourceMappingURL=register.js.map