export function Stack() {
    const stack = new globalThis.Error().stack ?? "";
    return Array.from(new TextEncoder().encode(stack));
}
//# sourceMappingURL=debug.js.map