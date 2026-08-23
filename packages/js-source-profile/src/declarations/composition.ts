import { jsRegExpObjectDeclarations } from "./regexp.js";
import { jsRegExpResultDeclarations } from "./regexp-results.js";
import { jsStringRegExpDeclarations } from "./string-regexp.js";
import { jsRegExpSymbolDeclarations } from "./symbol-regexp.js";

export const jsRegExpSourceProfileDeclarations = [
  jsRegExpSymbolDeclarations,
  jsRegExpResultDeclarations,
  jsRegExpObjectDeclarations,
  jsStringRegExpDeclarations,
].join("\n\n");

export {
  jsRegExpObjectDeclarations,
  jsRegExpResultDeclarations,
  jsRegExpSymbolDeclarations,
  jsStringRegExpDeclarations,
};
