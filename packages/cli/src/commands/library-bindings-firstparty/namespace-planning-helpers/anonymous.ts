import type {
  IrClassDeclaration,
  IrInterfaceMember,
  IrModule,
} from "@tsonic/frontend";
import type { Result } from "../../../types.js";
import {
  collectExtensionWrapperImportsFromSourceType,
  typeNodeUsesImportedTypeNames,
} from "../export-resolution.js";
import {
  isPortableMarkerMemberName,
  renderPortableType,
} from "../portable-types.js";
import type {
  ExportedSymbol,
  InternalHelperTypeDeclaration,
  MemberOverride,
  ModuleSourceIndex,
  WrapperImport,
} from "../types.js";
import { registerWrapperImports } from "./registration.js";

export const registerAnonymousHelperClass = (
  anonymousHelperClassNamesByShape: Map<string, string>,
  emittedName: string,
  declaration: IrClassDeclaration
): void => {
  if (
    !emittedName.startsWith("__Anon_") &&
    !declaration.name.startsWith("__Anon_")
  ) {
    return;
  }

  const members: IrInterfaceMember[] = [];
  for (const member of declaration.members) {
    if (member.kind === "propertyDeclaration") {
      if (isPortableMarkerMemberName(member.name)) continue;
      members.push({
        kind: "propertySignature",
        name: member.name,
        type: member.type ?? { kind: "unknownType" },
        isOptional: false,
        isReadonly: member.isReadonly,
      });
      continue;
    }
    if (member.kind === "methodDeclaration") {
      if (isPortableMarkerMemberName(member.name)) continue;
      members.push({
        kind: "methodSignature",
        name: member.name,
        parameters: member.parameters,
        returnType: member.returnType,
        typeParameters: member.typeParameters,
      });
    }
  }

  const shape = renderPortableType(
    { kind: "objectType", members },
    declaration.typeParameters?.map((typeParameter) => typeParameter.name) ??
      [],
    new Map(),
    new Map()
  );
  anonymousHelperClassNamesByShape.set(shape, emittedName);
};

export const collectAnonymousHelperClassNamesByShape = (opts: {
  readonly typeDeclarations: readonly ExportedSymbol[];
  readonly internalHelperTypeDeclarationsByKey: ReadonlyMap<
    string,
    InternalHelperTypeDeclaration
  >;
}): Map<string, string> => {
  const anonymousHelperClassNamesByShape = new Map<string, string>();
  for (const symbol of opts.typeDeclarations) {
    if (
      symbol.kind === "class" &&
      symbol.declaration.kind === "classDeclaration"
    ) {
      registerAnonymousHelperClass(
        anonymousHelperClassNamesByShape,
        symbol.localName,
        symbol.declaration
      );
    }
  }
  for (const helper of opts.internalHelperTypeDeclarationsByKey.values()) {
    if (helper.kind !== "class") continue;
    registerAnonymousHelperClass(
      anonymousHelperClassNamesByShape,
      helper.emittedName,
      helper.declaration as IrClassDeclaration
    );
  }
  return anonymousHelperClassNamesByShape;
};

export const collectAnonymousMemberOverrides = (opts: {
  readonly anonymousHelperClassNamesByShape: ReadonlyMap<string, string>;
  readonly sourceIndexByFileKey: ReadonlyMap<string, ModuleSourceIndex>;
  readonly modulesByFileKey: ReadonlyMap<string, IrModule>;
  readonly wrapperImportByAlias: Map<string, WrapperImport>;
}): Result<readonly MemberOverride[], string> => {
  const memberOverrides: MemberOverride[] = [];
  for (const [moduleKey, sourceIndex] of opts.sourceIndexByFileKey) {
    const sourceModule = opts.modulesByFileKey.get(moduleKey);
    if (!sourceModule) continue;
    for (const [
      shape,
      anonymousType,
    ] of sourceIndex.anonymousTypeLiteralsByShape) {
      const className = opts.anonymousHelperClassNamesByShape.get(shape);
      if (!className) continue;
      for (const [memberName, sourceMember] of anonymousType.members) {
        const wrappersResult = collectExtensionWrapperImportsFromSourceType({
          startModuleKey: moduleKey,
          typeNode: sourceMember.typeNode,
          sourceIndexByFileKey: opts.sourceIndexByFileKey,
          modulesByFileKey: opts.modulesByFileKey,
        });
        if (!wrappersResult.ok) return wrappersResult;
        const wrappers = wrappersResult.value;
        const canUseSourceTypeText = !typeNodeUsesImportedTypeNames(
          sourceMember.typeNode,
          sourceIndex.typeImportsByLocalName
        );
        if (
          !canUseSourceTypeText &&
          wrappers.length === 0 &&
          !sourceMember.isOptional
        ) {
          continue;
        }
        const wrapperRegistered = registerWrapperImports(
          opts.wrapperImportByAlias,
          wrappers,
          sourceModule.filePath
        );
        if (!wrapperRegistered.ok) return wrapperRegistered;
        memberOverrides.push({
          className,
          memberName,
          sourceTypeText: canUseSourceTypeText
            ? sourceMember.typeText
            : undefined,
          replaceWithSourceType: canUseSourceTypeText,
          isOptional: sourceMember.isOptional,
          emitOptionalPropertySyntax: true,
          wrappers,
        });
      }
    }
  }
  return { ok: true, value: memberOverrides };
};
