import type { Path } from "../tspath/path.js";
import type { ProgramOptions } from "./program.js";
/**
 * Which file of a program is the library of a given library file name (as GetLibFileName gives it). One binding is
 * derived per program, when its file loader is made, and the loader, the library sort, the library records and the
 * source import preparation all ask it.
 *
 * - `directory`: ordinary input. The library file of a name is that name in the host's default library directory,
 *   as the loader has always taken it.
 * - `explicit`: the caller selected the library files (ProgramOptions.SelectedLibraries). The map is authoritative,
 *   an empty one included: a name with no entry has no file, and the default directory is not consulted. `names`
 *   is the inverse, by the canonical path of each bound file, holding every name bound to it in ascending order.
 */
export type LibraryBinding = {
    readonly kind: "directory";
    readonly directory: string;
} | {
    readonly kind: "explicit";
    readonly files: ReadonlyMap<string, string>;
    readonly names: ReadonlyMap<Path, readonly string[]>;
};
/** The one derivation of a program's library binding. */
export declare function libraryBindingOf(opts: ProgramOptions): LibraryBinding;
/** The one resolver: the file that is the library of `name`, or undefined when the binding has none. */
export declare function selectedLibraryFile(binding: LibraryBinding, name: string): string | undefined;
/** In the explicit kind, the names bound to the file at `path`, in ascending order; undefined when none is. */
export declare function boundLibraryNames(binding: LibraryBinding, path: Path): readonly string[] | undefined;
/**
 * The order of a library file in the program's file list, by its library file name: the rule of
 * fileLoader.getDefaultLibFilePriority (lib.d.ts and lib.es6.d.ts first, then the order of Libs, then the rest).
 */
export declare function libraryNamePriority(name: string): number;
/** Of several names bound to one file (given in ascending order), the one that orders first; a tie keeps the earlier. */
export declare function firstLibraryName(names: readonly string[]): string;
/**
 * The order of a file among the program's library files, by the program's library binding. Directory kind: the
 * file directly in the default library directory is ordered by its base name (the rule of
 * fileLoader.getDefaultLibFilePriority); selected library files: by the names bound to the file's path. Any other
 * file orders after every library.
 */
export declare function boundLibraryPriority(binding: LibraryBinding, fileName: string, path: Path): number;
//# sourceMappingURL=librarybinding.d.ts.map