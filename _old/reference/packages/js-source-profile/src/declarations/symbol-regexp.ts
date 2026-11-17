export const jsRegExpSymbolDeclarations = `
interface SymbolConstructor {
  readonly match: unique symbol;
  readonly matchAll: unique symbol;
  readonly replace: unique symbol;
  readonly search: unique symbol;
  readonly species: unique symbol;
  readonly split: unique symbol;
}
`.trim();
