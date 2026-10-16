const providerWellKnownSymbolNames = [
    "asyncDispose",
    "asyncIterator",
    "dispose",
    "hasInstance",
    "isConcatSpreadable",
    "iterator",
    "match",
    "matchAll",
    "replace",
    "search",
    "species",
    "split",
    "toPrimitive",
    "toStringTag",
    "unscopables",
];
const providerWellKnownSymbolNameSet = new Set(providerWellKnownSymbolNames);
export function isProviderWellKnownSymbolName(name) {
    return providerWellKnownSymbolNameSet.has(name);
}
//# sourceMappingURL=provider-well-known-symbols.js.map