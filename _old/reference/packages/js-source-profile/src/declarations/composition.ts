import { jsRegExpObjectDeclarations } from "./regexp.js";
import { jsRegExpResultDeclarations } from "./regexp-results.js";
import { jsStringRegExpDeclarations } from "./string-regexp.js";
import { jsRegExpSymbolDeclarations } from "./symbol-regexp.js";
import { jsCapabilitySourceProfileDeclarations } from "./capabilities.js";
import { sourcePrimitiveProfileDeclarations } from "./primitives.js";

export const jsRegExpSourceProfileDeclarations = [
  jsRegExpSymbolDeclarations,
  jsRegExpResultDeclarations,
  jsRegExpObjectDeclarations,
  jsStringRegExpDeclarations,
].join("\n\n");

export const jsStandardSourceProfileDeclarations = [
  sourcePrimitiveProfileDeclarations,
  jsCapabilitySourceProfileDeclarations,
  jsRegExpSourceProfileDeclarations,
].join("\n\n");
