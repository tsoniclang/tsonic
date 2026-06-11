import type { bool, int } from "@tsonic/core/types.js";
import type { GoPtr } from "../../go/compat.js";
import * as strings from "../../go/strings.js";
import { AsSourceFile } from "../ast/ast.js";
import type { SourceFileNode } from "../ast/generated/unions.js";
import {
  CompilerOptions_GetAllowJS,
  CompilerOptions_GetResolveJsonModule,
  JsxEmitNone,
  JsxEmitPreserve,
} from "../core/compileroptions.js";
import type { CompilerOptions } from "../core/compileroptions.js";
import { Tristate_DefaultIfUnknown, Tristate_IsTrue } from "../core/tristate.js";
import { Version as coreVersion } from "../core/version.js";
import {
  Could_not_find_a_declaration_file_for_module_0_1_implicitly_has_an_any_type,
  Module_0_was_resolved_to_1_but_allowArbitraryExtensions_is_not_set,
  Module_0_was_resolved_to_1_but_jsx_is_not_set,
  Module_0_was_resolved_to_1_but_resolveJsonModule_is_not_used,
} from "../diagnostics/generated/messages.js";
import type { Message } from "../diagnostics/diagnostics.js";
import { MustParse } from "../semver/version.js";
import type { Version } from "../semver/version.js";
import { TryParseVersionRange, VersionRange_Test } from "../semver/version_range.js";
import {
  ExtensionCjs,
  ExtensionCts,
  ExtensionDcts,
  ExtensionDmts,
  ExtensionDts,
  ExtensionJs,
  ExtensionJson,
  ExtensionJsx,
  ExtensionMjs,
  ExtensionMts,
  ExtensionTs,
  ExtensionTsx,
  TryGetExtensionFromPath,
} from "../tspath/extension.js";
import { NormalizePath } from "../tspath/path.js";
import { moveToNextDirectorySeparatorIfAvailable } from "./resolver.js";
import type { ResolvedModule } from "./types.js";

const CHAR_AT: int = 0x40; // '@'

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/util.go::varGroup::typeScriptVersion","kind":"varGroup","status":"implemented","sigHash":"5ea790652197b354557a923968e58da28d67b2ec3f25c5727cf388cf991ad24a","bodyHash":"aa456a24b17567514562ee03f13a59f6391067b1c2ff7f896b46df2dde1f4bfb"}
 *
 * Go source:
 * var typeScriptVersion = semver.MustParse(core.Version())
 */
export const typeScriptVersion: Version = MustParse(coreVersion());

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/util.go::constGroup::InferredTypesContainingFile","kind":"constGroup","status":"implemented","sigHash":"790fc9de65ca101c9bd4211b78852b0004daadae356d0d4b52059031fe9c7794","bodyHash":"00d9a0f6ea98e4e42c4b78d7268602902626944ee6c71c2d51762522fbad8303"}
 *
 * Go source:
 * const InferredTypesContainingFile = "__inferred type names__.ts"
 */
export const InferredTypesContainingFile: string = "__inferred type names__.ts";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/util.go::func::IsApplicableVersionedTypesKey","kind":"func","status":"implemented","sigHash":"6f9560d6fe67bc7fb6e3f4d78954218cde09a54b30085c476220e2cc7163e99e","bodyHash":"1167df51a188f85aa4899c7e8138007263fbe867d7a365798cf831811bccb306"}
 *
 * Go source:
 * func IsApplicableVersionedTypesKey(key string) bool {
 * 	if !strings.HasPrefix(key, "types@") {
 * 		return false
 * 	}
 * 	range_, ok := semver.TryParseVersionRange(key[len("types@"):])
 * 	if !ok {
 * 		return false
 * 	}
 * 	return range_.Test(&typeScriptVersion)
 * }
 */
export function IsApplicableVersionedTypesKey(key: string): bool {
  if (!strings.HasPrefix(key, "types@")) {
    return false;
  }
  const [range_, ok] = TryParseVersionRange(key.slice("types@".length));
  if (!ok) {
    return false;
  }
  return VersionRange_Test(range_, typeScriptVersion);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/util.go::func::ParseNodeModuleFromPath","kind":"func","status":"implemented","sigHash":"3a65eac0be90e94e9f2551b718a67281e965b2c67d3eb212d6a6268c9e906b1b","bodyHash":"2ad1221cc440dd334b9ca2911ffdd164c0b74794eebf8a74c1ea2270c496819e"}
 *
 * Go source:
 * func ParseNodeModuleFromPath(resolved string, isFolder bool) string {
 * 	path := tspath.NormalizePath(resolved)
 * 	idx := strings.LastIndex(path, "/node_modules/")
 * 	if idx == -1 {
 * 		return ""
 * 	}
 *
 * 	indexAfterNodeModules := idx + len("/node_modules/")
 * 	indexAfterPackageName := moveToNextDirectorySeparatorIfAvailable(path, indexAfterNodeModules, isFolder)
 * 	if path[indexAfterNodeModules] == '@' {
 * 		indexAfterPackageName = moveToNextDirectorySeparatorIfAvailable(path, indexAfterPackageName, isFolder)
 * 	}
 * 	return path[:indexAfterPackageName]
 * }
 */
export function ParseNodeModuleFromPath(resolved: string, isFolder: bool): string {
  const path = NormalizePath(resolved);
  const idx = strings.LastIndex(path, "/node_modules/");
  if (idx === -1) {
    return "";
  }

  const indexAfterNodeModules = idx + "/node_modules/".length;
  const indexAfterPackageNameInitial = moveToNextDirectorySeparatorIfAvailable(path, indexAfterNodeModules, isFolder);
  const indexAfterPackageName =
    path.charCodeAt(indexAfterNodeModules) === CHAR_AT
      ? moveToNextDirectorySeparatorIfAvailable(path, indexAfterPackageNameInitial, isFolder)
      : indexAfterPackageNameInitial;
  return path.slice(0, indexAfterPackageName);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/util.go::func::ParsePackageName","kind":"func","status":"implemented","sigHash":"bbd79269d24d90eac927243f69c8f550f74d9b758dd1dd591e37f07fd42440a7","bodyHash":"dbcfe1f4d7d444ed223d7d53fd5307b8021a2a85d8ec89e1260601863dde8693"}
 *
 * Go source:
 * func ParsePackageName(moduleName string) (packageName, rest string) {
 * 	idx := strings.Index(moduleName, "/")
 * 	if len(moduleName) > 0 && moduleName[0] == '@' {
 * 		offset := idx + 1
 * 		idx = strings.Index(moduleName[offset:], "/")
 * 		if idx != -1 {
 * 			idx += offset
 * 		}
 * 	}
 * 	if idx == -1 {
 * 		return moduleName, ""
 * 	}
 * 	return moduleName[:idx], moduleName[idx+1:]
 * }
 */
export function ParsePackageName(moduleName: string): [string, string] {
  const idxAfterScope = ((): int => {
    const idx0 = strings.Index(moduleName, "/");
    if (moduleName.length > 0 && moduleName.charCodeAt(0) === CHAR_AT) {
      const offset = idx0 + 1;
      const idx1 = strings.Index(moduleName.slice(offset), "/");
      if (idx1 !== -1) {
        return idx1 + offset;
      }
      return idx1;
    }
    return idx0;
  })();
  if (idxAfterScope === -1) {
    return [moduleName, ""];
  }
  return [moduleName.slice(0, idxAfterScope), moduleName.slice(idxAfterScope + 1)];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/util.go::func::MangleScopedPackageName","kind":"func","status":"implemented","sigHash":"788d02e4dd66a0bb8be1f1a36034e821b123a77c775ea4c65e6daca961f59d24","bodyHash":"dfc388b1d9993b33f81cd4889b9f6d4b4ffabaf3af414735fb027c1de0c1be82"}
 *
 * Go source:
 * func MangleScopedPackageName(packageName string) string {
 * 	if len(packageName) > 0 && packageName[0] == '@' {
 * 		idx := strings.Index(packageName, "/")
 * 		if idx == -1 {
 * 			return packageName
 * 		}
 * 		return packageName[1:idx] + "__" + packageName[idx+1:]
 * 	}
 * 	return packageName
 * }
 */
export function MangleScopedPackageName(packageName: string): string {
  if (packageName.length > 0 && packageName.charCodeAt(0) === CHAR_AT) {
    const idx = strings.Index(packageName, "/");
    if (idx === -1) {
      return packageName;
    }
    return packageName.slice(1, idx) + "__" + packageName.slice(idx + 1);
  }
  return packageName;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/util.go::func::UnmangleScopedPackageName","kind":"func","status":"implemented","sigHash":"3698ee491d494456579201dabcc515ecc3e2825a8f0cd829385d13568f9db689","bodyHash":"cfa6a4cdfccb94f94984e319889b3a3d7ce91aee0f7e1769d64193f189404e02"}
 *
 * Go source:
 * func UnmangleScopedPackageName(packageName string) string {
 * 	before, after, ok := strings.Cut(packageName, "__")
 * 	if ok {
 * 		return "@" + before + "/" + after
 * 	}
 * 	return packageName
 * }
 */
export function UnmangleScopedPackageName(packageName: string): string {
  const [before, after, ok] = strings.Cut(packageName, "__");
  if (ok) {
    return "@" + before + "/" + after;
  }
  return packageName;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/util.go::func::GetTypesPackageName","kind":"func","status":"implemented","sigHash":"f45922715cf517d676f01af29519de34445d3af64769d0622ace925887aff29c","bodyHash":"b635d764cdbc8cb7b6052459604fd7d1edc2d623d54b8e4bad39ae3e2f45118d"}
 *
 * Go source:
 * func GetTypesPackageName(packageName string) string {
 * 	return "@types/" + MangleScopedPackageName(packageName)
 * }
 */
export function GetTypesPackageName(packageName: string): string {
  return "@types/" + MangleScopedPackageName(packageName);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/util.go::func::GetPackageNameFromTypesPackageName","kind":"func","status":"implemented","sigHash":"3c86a82e994f7c102032f680d4a821e08a99b54e1d4034a5c456eb1a6f2c5c0f","bodyHash":"188777acfe3e9bdac54e87f1d5d1de35ecc8b00ac41e189178739f473179e467"}
 *
 * Go source:
 * func GetPackageNameFromTypesPackageName(mangledName string) string {
 * 	withoutAtTypePrefix := strings.TrimPrefix(mangledName, "@types/")
 * 	if withoutAtTypePrefix != mangledName {
 * 		return UnmangleScopedPackageName(withoutAtTypePrefix)
 * 	}
 * 	return mangledName
 * }
 */
export function GetPackageNameFromTypesPackageName(mangledName: string): string {
  const withoutAtTypePrefix = strings.TrimPrefix(mangledName, "@types/");
  if (withoutAtTypePrefix !== mangledName) {
    return UnmangleScopedPackageName(withoutAtTypePrefix);
  }
  return mangledName;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/util.go::func::ComparePatternKeys","kind":"func","status":"implemented","sigHash":"a2b1d4ccafbcd0960ada026ebc4f3b9ee7c276f01ca6ffae4b461dfb3da0f088","bodyHash":"a2511d52d927ac59242d94eb84e9597d6e4a1722ced61b415311a807c26766dc"}
 *
 * Go source:
 * func ComparePatternKeys(a, b string) int {
 * 	aPatternIndex := strings.Index(a, "*")
 * 	bPatternIndex := strings.Index(b, "*")
 * 	baseLenA := len(a)
 * 	if aPatternIndex != -1 {
 * 		baseLenA = aPatternIndex + 1
 * 	}
 * 	baseLenB := len(b)
 * 	if bPatternIndex != -1 {
 * 		baseLenB = bPatternIndex + 1
 * 	}
 *
 * 	if baseLenA > baseLenB {
 * 		return -1
 * 	}
 * 	if baseLenB > baseLenA {
 * 		return 1
 * 	}
 * 	if aPatternIndex == -1 {
 * 		return 1
 * 	}
 * 	if bPatternIndex == -1 {
 * 		return -1
 * 	}
 * 	if len(a) > len(b) {
 * 		return -1
 * 	}
 * 	if len(b) > len(a) {
 * 		return 1
 * 	}
 * 	return 0
 * }
 */
export function ComparePatternKeys(a: string, b: string): int {
  const aPatternIndex = strings.Index(a, "*");
  const bPatternIndex = strings.Index(b, "*");
  const baseLenA = aPatternIndex !== -1 ? aPatternIndex + 1 : a.length;
  const baseLenB = bPatternIndex !== -1 ? bPatternIndex + 1 : b.length;

  if (baseLenA > baseLenB) {
    return -1;
  }
  if (baseLenB > baseLenA) {
    return 1;
  }
  if (aPatternIndex === -1) {
    return 1;
  }
  if (bPatternIndex === -1) {
    return -1;
  }
  if (a.length > b.length) {
    return -1;
  }
  if (b.length > a.length) {
    return 1;
  }
  return 0;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/util.go::func::GetResolutionDiagnostic","kind":"func","status":"implemented","sigHash":"81cbc2857ca9604da7d6e28d7de3263b92890e0a3a40c727e75e14832c72fe0b","bodyHash":"f2f43bcf2dd6f3c8d523968bb9b453a1f5ef5926d608d01718cc5d5c922cdecc"}
 *
 * Go source:
 * func GetResolutionDiagnostic(options *core.CompilerOptions, resolvedModule *ResolvedModule, file *ast.SourceFile) *diagnostics.Message {
 * 	needJsx := func() *diagnostics.Message {
 * 		if options.Jsx != core.JsxEmitNone {
 * 			return nil
 * 		}
 * 		return diagnostics.Module_0_was_resolved_to_1_but_jsx_is_not_set
 * 	}
 *
 * 	needAllowJs := func() *diagnostics.Message {
 * 		if options.GetAllowJS() || !options.NoImplicitAny.DefaultIfUnknown(options.Strict).IsTrue() {
 * 			return nil
 * 		}
 * 		return diagnostics.Could_not_find_a_declaration_file_for_module_0_1_implicitly_has_an_any_type
 * 	}
 *
 * 	needResolveJsonModule := func() *diagnostics.Message {
 * 		if options.GetResolveJsonModule() {
 * 			return nil
 * 		}
 * 		return diagnostics.Module_0_was_resolved_to_1_but_resolveJsonModule_is_not_used
 * 	}
 *
 * 	needAllowArbitraryExtensions := func() *diagnostics.Message {
 * 		if file.IsDeclarationFile || options.AllowArbitraryExtensions.IsTrue() {
 * 			return nil
 * 		}
 * 		return diagnostics.Module_0_was_resolved_to_1_but_allowArbitraryExtensions_is_not_set
 * 	}
 *
 * 	switch resolvedModule.Extension {
 * 	case tspath.ExtensionTs, tspath.ExtensionDts,
 * 		tspath.ExtensionMts, tspath.ExtensionDmts,
 * 		tspath.ExtensionCts, tspath.ExtensionDcts:
 * 		// These are always allowed.
 * 		return nil
 * 	case tspath.ExtensionTsx:
 * 		return needJsx()
 * 	case tspath.ExtensionJsx:
 * 		if message := needJsx(); message != nil {
 * 			return message
 * 		}
 * 		return needAllowJs()
 * 	case tspath.ExtensionJs, tspath.ExtensionMjs, tspath.ExtensionCjs:
 * 		return needAllowJs()
 * 	case tspath.ExtensionJson:
 * 		return needResolveJsonModule()
 * 	default:
 * 		return needAllowArbitraryExtensions()
 * 	}
 * }
 */
export function GetResolutionDiagnostic(options: GoPtr<CompilerOptions>, resolvedModule: GoPtr<ResolvedModule>, file: GoPtr<SourceFileNode>): GoPtr<Message> {
  const needJsx = (): GoPtr<Message> => {
    if (options!.Jsx !== JsxEmitNone) {
      return undefined;
    }
    return Module_0_was_resolved_to_1_but_jsx_is_not_set;
  };

  const needAllowJs = (): GoPtr<Message> => {
    if (
      CompilerOptions_GetAllowJS(options) ||
      !Tristate_IsTrue(Tristate_DefaultIfUnknown(options!.NoImplicitAny, options!.Strict))
    ) {
      return undefined;
    }
    return Could_not_find_a_declaration_file_for_module_0_1_implicitly_has_an_any_type;
  };

  const needResolveJsonModule = (): GoPtr<Message> => {
    if (CompilerOptions_GetResolveJsonModule(options)) {
      return undefined;
    }
    return Module_0_was_resolved_to_1_but_resolveJsonModule_is_not_used;
  };

  const needAllowArbitraryExtensions = (): GoPtr<Message> => {
    const sourceFile = AsSourceFile(file);
    if (sourceFile!.IsDeclarationFile || Tristate_IsTrue(options!.AllowArbitraryExtensions)) {
      return undefined;
    }
    return Module_0_was_resolved_to_1_but_allowArbitraryExtensions_is_not_set;
  };

  switch (resolvedModule!.Extension) {
    case ExtensionTs:
    case ExtensionDts:
    case ExtensionMts:
    case ExtensionDmts:
    case ExtensionCts:
    case ExtensionDcts:
      // These are always allowed.
      return undefined;
    case ExtensionTsx:
      return needJsx();
    case ExtensionJsx: {
      const msg = needJsx();
      if (msg !== undefined) {
        return msg;
      }
      return needAllowJs();
    }
    case ExtensionJs:
    case ExtensionMjs:
    case ExtensionCjs:
      return needAllowJs();
    case ExtensionJson:
      return needResolveJsonModule();
    default:
      return needAllowArbitraryExtensions();
  }
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/util.go::func::TryGetJSExtensionForFile","kind":"func","status":"implemented","sigHash":"2024fe4ecbb4b124932ecb0451c62c4bbe11252b46a5de671d4574dea1948e24","bodyHash":"b6a3127e6c6ad394e866ae25c926f59d27b3972f1b3fdf3f21cfd0d01186f514"}
 *
 * Go source:
 * func TryGetJSExtensionForFile(fileName string, options *core.CompilerOptions) string {
 * 	ext := tspath.TryGetExtensionFromPath(fileName)
 * 	switch ext {
 * 	case tspath.ExtensionTs, tspath.ExtensionDts:
 * 		return tspath.ExtensionJs
 * 	case tspath.ExtensionTsx:
 * 		if options.Jsx == core.JsxEmitPreserve {
 * 			return tspath.ExtensionJsx
 * 		}
 * 		return tspath.ExtensionJs
 * 	case tspath.ExtensionJs, tspath.ExtensionJsx, tspath.ExtensionJson:
 * 		return ext
 * 	case tspath.ExtensionDmts, tspath.ExtensionMts, tspath.ExtensionMjs:
 * 		return tspath.ExtensionMjs
 * 	case tspath.ExtensionDcts, tspath.ExtensionCts, tspath.ExtensionCjs:
 * 		return tspath.ExtensionCjs
 * 	default:
 * 		return ""
 * 	}
 * }
 */
export function TryGetJSExtensionForFile(fileName: string, options: GoPtr<CompilerOptions>): string {
  const ext = TryGetExtensionFromPath(fileName);
  switch (ext) {
    case ExtensionTs:
    case ExtensionDts:
      return ExtensionJs;
    case ExtensionTsx:
      if (options!.Jsx === JsxEmitPreserve) {
        return ExtensionJsx;
      }
      return ExtensionJs;
    case ExtensionJs:
    case ExtensionJsx:
    case ExtensionJson:
      return ext;
    case ExtensionDmts:
    case ExtensionMts:
    case ExtensionMjs:
      return ExtensionMjs;
    case ExtensionDcts:
    case ExtensionCts:
    case ExtensionCjs:
      return ExtensionCjs;
    default:
      return "";
  }
}
