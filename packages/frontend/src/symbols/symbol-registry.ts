import type {
  MemberSymbolId,
  ModuleSymbolId,
  TypeSymbolId,
} from "./symbol-ids.js";
import type {
  MemberSymbol,
  ModuleSymbol,
  TargetMemberRenderInfo,
  TargetModuleRenderInfo,
  TargetRenderTable,
  TargetSurfaceArtifacts,
  TargetSurfaceSnapshot,
  TargetTypeRenderInfo,
  TypeSymbol,
} from "./target-surface.js";

export class TargetSymbolRegistry {
  private readonly typeSymbols = new Map<TypeSymbolId, TypeSymbol>();
  private readonly memberSymbols = new Map<MemberSymbolId, MemberSymbol>();
  private readonly moduleSymbols = new Map<ModuleSymbolId, ModuleSymbol>();
  private readonly typeRenderInfo = new Map<
    TypeSymbolId,
    TargetTypeRenderInfo
  >();
  private readonly memberRenderInfo = new Map<
    MemberSymbolId,
    TargetMemberRenderInfo
  >();
  private readonly moduleRenderInfo = new Map<
    ModuleSymbolId,
    TargetModuleRenderInfo
  >();

  addType(symbol: TypeSymbol, renderInfo?: TargetTypeRenderInfo): void {
    this.typeSymbols.set(symbol.symbolId, symbol);
    if (renderInfo) {
      this.typeRenderInfo.set(symbol.symbolId, renderInfo);
    }
  }

  addMember(symbol: MemberSymbol, renderInfo?: TargetMemberRenderInfo): void {
    this.memberSymbols.set(symbol.symbolId, symbol);
    if (renderInfo) {
      this.memberRenderInfo.set(symbol.symbolId, renderInfo);
    }
  }

  addModule(symbol: ModuleSymbol, renderInfo?: TargetModuleRenderInfo): void {
    this.moduleSymbols.set(symbol.symbolId, symbol);
    if (renderInfo) {
      this.moduleRenderInfo.set(symbol.symbolId, renderInfo);
    }
  }

  snapshot(): TargetSurfaceSnapshot {
    return {
      types: new Map(this.typeSymbols),
      members: new Map(this.memberSymbols),
      modules: new Map(this.moduleSymbols),
    };
  }

  renderTable(): TargetRenderTable {
    return {
      types: new Map(this.typeRenderInfo),
      members: new Map(this.memberRenderInfo),
      modules: new Map(this.moduleRenderInfo),
    };
  }

  artifacts(): TargetSurfaceArtifacts {
    return {
      surface: this.snapshot(),
      renderTable: this.renderTable(),
    };
  }
}
