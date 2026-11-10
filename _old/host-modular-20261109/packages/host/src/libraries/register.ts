import type { SourceLibraries } from './contract.js';
import { coreLibrary } from './core.js';
import { jsLibrary } from './js.js';

export const sourceLibraries: SourceLibraries = Object.freeze({ core: coreLibrary, js: jsLibrary });
