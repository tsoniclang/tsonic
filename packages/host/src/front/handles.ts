import type { CheckedSourceProgram, CompilerExtension, Node, SourceDeclarationProvider, SourceFile, SourceSemanticsModule } from "@tsonic/tsts";
import type { Diagnostic } from "../diag/contract.js";
import type { ModuleId, NodeId } from "../ids/contract.js";
import type { ExtensionReference, ExtensionReferenceEntry, PackageLibraryData, SourceContributions } from "../snapshot/contract.js";
import type { ProgramModule, ProgramModuleSet } from "./contract.js";

export interface OpenedFile {
  readonly file: SourceFile;
  readonly origin: ProgramModule;
  readonly text: string;
}

/** One file's numbering: its nodes in identity order (preorder) and each node's identity. */
export interface FileNumbering {
  readonly nodes: readonly Node[];
  readonly ids: ReadonlyMap<Node, NodeId>;
}

/** A file's numbering, or the resource refusal that stopped it before any node was captured; the limits it was made under. */
export interface FileSyntaxEntry {
  readonly limits: { readonly maximumSyntaxDepth: number; readonly maximumCapturedNodesPerModule: number };
  readonly outcome: { readonly kind: "numbered"; readonly numbering: FileNumbering } | { readonly kind: "refused"; readonly diagnostic: Diagnostic };
}

export interface ProviderRegistration {
  readonly reference: ExtensionReference;
  readonly provider: SourceDeclarationProvider;
}

/**
 * The ordered loaded registrations of one analysis, in the form a compiler session takes them, and the declaration
 * provider registrations indexed by provider identity for the join of a session document to its registration.
 */
export class ExtensionTable {
  private readonly entryRows: readonly ExtensionReferenceEntry[];
  private readonly sessionExtensions: readonly CompilerExtension[];
  private readonly providerRows: ReadonlyMap<string, ProviderRegistration>;
  private readonly semanticsRows: readonly SourceSemanticsModule[];

  private constructor(entries: readonly ExtensionReferenceEntry[], extensions: readonly CompilerExtension[],
    providers: ReadonlyMap<string, ProviderRegistration>, semantics: readonly SourceSemanticsModule[]) {
    this.entryRows = entries;
    this.sessionExtensions = extensions;
    this.providerRows = providers;
    this.semanticsRows = semantics;
  }

  static create(entries: readonly ExtensionReferenceEntry[], extensions: readonly CompilerExtension[],
    providers: ReadonlyMap<string, ProviderRegistration>, semantics: readonly SourceSemanticsModule[]): ExtensionTable {
    return new ExtensionTable(entries, extensions, providers, semantics);
  }
  /** The loaded semantics modules, in registration order: the selected module inventory of core markers. */
  static semantics(table: ExtensionTable): readonly SourceSemanticsModule[] { return table.semanticsRows; }
  static entries(table: ExtensionTable): readonly ExtensionReferenceEntry[] { return table.entryRows; }
  static extensions(table: ExtensionTable): readonly CompilerExtension[] { return table.sessionExtensions; }
  static providers(table: ExtensionTable): ReadonlyMap<string, ProviderRegistration> { return table.providerRows; }
}

/** One checked program of the SDK with what its capture reads from the snapshot it was opened on. */
export class OpenedProgram {
  private readonly checkedProgram: CheckedSourceProgram;
  private readonly extensionTable: ExtensionTable;
  private readonly fileByPath = new Map<string, OpenedFile>();
  private readonly fileByModule = new Map<ModuleId, OpenedFile>();
  private readonly moduleRows: ProgramModuleSet;
  private readonly roleRows: readonly PackageLibraryData[];
  private readonly contributionRows: SourceContributions;
  private readonly syntaxRows = new Map<string, FileSyntaxEntry>();

  private constructor(checked: CheckedSourceProgram, table: ExtensionTable, files: readonly OpenedFile[], libraryData: readonly PackageLibraryData[],
    contributions: SourceContributions) {
    this.checkedProgram = checked;
    this.extensionTable = table;
    for (const entry of files) {
      const module = entry.origin.kind === "snapshot" ? entry.origin.module : entry.origin.document.module;
      this.fileByPath.set(checked.ast.getFileName(entry.file), entry);
      this.fileByModule.set(module, entry);
    }
    this.moduleRows = { modules: files.map(entry => entry.origin) };
    this.roleRows = libraryData;
    this.contributionRows = contributions;
  }

  static create(checked: CheckedSourceProgram, table: ExtensionTable, files: readonly OpenedFile[], libraryData: readonly PackageLibraryData[],
    contributions: SourceContributions): OpenedProgram {
    return new OpenedProgram(checked, table, files, libraryData, contributions);
  }
  /** The snapshot's library data: the closed inventory of library roles of the packages it captured. */
  static libraryData(program: OpenedProgram): readonly PackageLibraryData[] { return program.roleRows; }
  /** The snapshot's source contributions (safety providers, semantics modules, declaration providers). */
  static contributions(program: OpenedProgram): SourceContributions { return program.contributionRows; }
  static checked(program: OpenedProgram): CheckedSourceProgram { return program.checkedProgram; }
  static table(program: OpenedProgram): ExtensionTable { return program.extensionTable; }
  static modules(program: OpenedProgram): ProgramModuleSet { return program.moduleRows; }
  static file(program: OpenedProgram, module: ModuleId): OpenedFile | undefined { return program.fileByModule.get(module); }
  static moduleAt(program: OpenedProgram, path: string): ModuleId | undefined {
    const entry = program.fileByPath.get(path);
    if (entry === undefined) return undefined;
    return entry.origin.kind === "snapshot" ? entry.origin.module : entry.origin.document.module;
  }
  /** The numbering of each file captured so far, by path: made once per file of this program and kept with it. */
  static syntax(program: OpenedProgram): Map<string, FileSyntaxEntry> { return program.syntaxRows; }
}
