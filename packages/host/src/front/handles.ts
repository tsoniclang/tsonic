import type { CheckedSourceProgram, CompilerExtension, SourceDeclarationProvider } from "@tsonic/tsts";
import type { ModuleId, PackageId } from "../ids/contract.js";
import type { ExtensionReference, ExtensionReferenceEntry } from "../snapshot/contract.js";

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

  private constructor(entries: readonly ExtensionReferenceEntry[], extensions: readonly CompilerExtension[],
    providers: ReadonlyMap<string, ProviderRegistration>) {
    this.entryRows = entries;
    this.sessionExtensions = extensions;
    this.providerRows = providers;
  }

  static create(entries: readonly ExtensionReferenceEntry[], extensions: readonly CompilerExtension[],
    providers: ReadonlyMap<string, ProviderRegistration>): ExtensionTable {
    return new ExtensionTable(entries, extensions, providers);
  }
  static entries(table: ExtensionTable): readonly ExtensionReferenceEntry[] { return table.entryRows; }
  static extensions(table: ExtensionTable): readonly CompilerExtension[] { return table.sessionExtensions; }
  static providers(table: ExtensionTable): ReadonlyMap<string, ProviderRegistration> { return table.providerRows; }
}

/** One checked program of the SDK with what its capture reads from the snapshot it was opened on. */
export class OpenedProgram {
  private readonly checkedProgram: CheckedSourceProgram;
  private readonly extensionTable: ExtensionTable;
  private readonly moduleByPath: ReadonlyMap<string, ModuleId>;
  private readonly nameByPackage: ReadonlyMap<PackageId, string | null>;
  private readonly textByPath: ReadonlyMap<string, string>;

  private constructor(checked: CheckedSourceProgram, table: ExtensionTable, modules: ReadonlyMap<string, ModuleId>,
    packageNames: ReadonlyMap<PackageId, string | null>, texts: ReadonlyMap<string, string>) {
    this.checkedProgram = checked;
    this.extensionTable = table;
    this.moduleByPath = modules;
    this.nameByPackage = packageNames;
    this.textByPath = texts;
  }

  static create(checked: CheckedSourceProgram, table: ExtensionTable, modules: ReadonlyMap<string, ModuleId>,
    packageNames: ReadonlyMap<PackageId, string | null>, texts: ReadonlyMap<string, string>): OpenedProgram {
    return new OpenedProgram(checked, table, modules, packageNames, texts);
  }
  static checked(program: OpenedProgram): CheckedSourceProgram { return program.checkedProgram; }
  static table(program: OpenedProgram): ExtensionTable { return program.extensionTable; }
  static modules(program: OpenedProgram): ReadonlyMap<string, ModuleId> { return program.moduleByPath; }
  static packageNames(program: OpenedProgram): ReadonlyMap<PackageId, string | null> { return program.nameByPackage; }
  /** The captured text of each file of the session, by path. */
  static texts(program: OpenedProgram): ReadonlyMap<string, string> { return program.textByPath; }
}
