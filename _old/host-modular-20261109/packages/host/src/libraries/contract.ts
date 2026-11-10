import type { SourceLibrary } from '../model/contract.js';

export interface SourceLibraries {
  readonly core: SourceLibrary;
  readonly js: SourceLibrary;
}
