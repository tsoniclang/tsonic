/**
 * Type converter - TypeScript types to IR types
 * Main dispatcher - re-exports from type-converter/ subdirectory
 */

export {
  convertType,
  convertFunctionType,
  convertObjectType,
  convertBindingName,
  inferType,
} from "./type-converter/index.js";
