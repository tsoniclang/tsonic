/**
 * Emitter options and defaults
 */

import { EmitterOptions } from "../types.js";

/**
 * Default emitter options
 */
export const defaultOptions: EmitterOptions = {
  rootNamespace: "MyApp",
  includeSourceMaps: false,
  indent: 4,
  maxLineLength: 120,
  includeTimestamp: true,
};
