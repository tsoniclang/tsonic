import { jsRegExpObjectDeclarations } from "./regexp.js";
import { jsRegExpResultDeclarations } from "./regexp-results.js";
import { jsStringRegExpDeclarations } from "./string-regexp.js";
import { jsRegExpSymbolDeclarations } from "./symbol-regexp.js";
import { jsCapabilitySourceProfileDeclarations } from "./capabilities.js";

export const jsRegExpSourceProfileDeclarations = [
  jsRegExpSymbolDeclarations,
  jsRegExpResultDeclarations,
  jsRegExpObjectDeclarations,
  jsStringRegExpDeclarations,
].join("\n\n");

export const jsStandardSourceProfileDeclarations = [
  jsCapabilitySourceProfileDeclarations,
  jsRegExpSourceProfileDeclarations,
].join("\n\n");

export {
  jsRegExpObjectDeclarations,
  jsRegExpResultDeclarations,
  jsRegExpSymbolDeclarations,
  jsStringRegExpDeclarations,
  jsCapabilitySourceProfileDeclarations,
};
