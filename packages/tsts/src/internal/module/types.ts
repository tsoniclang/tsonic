import type { bool, int } from "@tsonic/core/types.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";
import * as fmt from "../../go/fmt.js";
import * as strings from "../../go/strings.js";
import type { Diagnostic } from "../ast/diagnostic.js";
import * as extension from "../tspath/extension.js";
import type { CompilerOptions, ResolutionMode } from "../core/compileroptions.js";
import type { FS } from "../vfs/vfs.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/types.go::type::ResolutionHost","kind":"type","status":"implemented","sigHash":"81b515a83683f73d0af1aa924c342ed79313c619154c9294468a27fa0052c0c9","bodyHash":"d2874553364b5749637eb3379154f51223483ec56c1f78e21b715135dc5f382a"}
 *
 * Go source:
 * ResolutionHost interface {
 * 	FS() vfs.FS
 * 	GetCurrentDirectory() string
 * }
 */
export interface ResolutionHost {
  FS(): FS;
  GetCurrentDirectory(): string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/types.go::type::ModeAwareCacheKey","kind":"type","status":"implemented","sigHash":"c140cec16d91c6a94d2fc91b902b515fb0240bb454baa44adba9966b16e99785","bodyHash":"18323546afc354ec2e90acbc492df59a681adafe4d182c99cdc86deca3bec5ec"}
 *
 * Go source:
 * ModeAwareCacheKey struct {
 * 	Name string
 * 	Mode core.ResolutionMode
 * }
 */
export interface ModeAwareCacheKey {
  Name: string;
  Mode: ResolutionMode;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/types.go::type::ResolvedProjectReference","kind":"type","status":"implemented","sigHash":"b0981c9ea36989026df7a10de20280fcddc1d3d6c148e5ad5814dfa8c567d449","bodyHash":"5acc7829a1385561ed945c926c025fa983aaf2a3537f94a74133650d429ac38b"}
 *
 * Go source:
 * ResolvedProjectReference interface {
 * 	ConfigName() string
 * 	CompilerOptions() *core.CompilerOptions
 * }
 */
export interface ResolvedProjectReference {
  ConfigName(): string;
  CompilerOptions(): GoPtr<CompilerOptions>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/types.go::type::NodeResolutionFeatures","kind":"type","status":"implemented","sigHash":"837b1776a25d698fd57c22b8183f260b5ee7bbdd97e577d37b0e394eabd85b13","bodyHash":"68d7278dbcef20613284f8f6054da00fefedf5a75744311220ec363f9c8cdac5"}
 *
 * Go source:
 * NodeResolutionFeatures int32
 */
export type NodeResolutionFeatures = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/types.go::constGroup::NodeResolutionFeaturesImports+NodeResolutionFeaturesSelfName+NodeResolutionFeaturesExports+NodeResolutionFeaturesExportsPatternTrailers+NodeResolutionFeaturesImportsPatternRoot+NodeResolutionFeaturesNone+NodeResolutionFeaturesAll+NodeResolutionFeaturesNode16Default+NodeResolutionFeaturesNodeNextDefault+NodeResolutionFeaturesBundlerDefault","kind":"constGroup","status":"implemented","sigHash":"ac7ac108ee6d3db6c3609da81ab6a0b1fbf3f931b8e132ae6b4c14fb0eedd87b","bodyHash":"c664aff0abf30b0f1a3f1d9c94f4af8eb0d43af9e57138381ff4ac6862c9d21a"}
 *
 * Go source:
 * const (
 * 	NodeResolutionFeaturesImports NodeResolutionFeatures = 1 << iota
 * 	NodeResolutionFeaturesSelfName
 * 	NodeResolutionFeaturesExports
 * 	NodeResolutionFeaturesExportsPatternTrailers
 * 	// allowing `#/` root imports in package.json imports field
 * 	// not supported until mass adoption - https://github.com/nodejs/node/pull/60864
 * 	NodeResolutionFeaturesImportsPatternRoot
 * 
 * 	NodeResolutionFeaturesNone            NodeResolutionFeatures = 0
 * 	NodeResolutionFeaturesAll                                    = NodeResolutionFeaturesImports | NodeResolutionFeaturesSelfName | NodeResolutionFeaturesExports | NodeResolutionFeaturesExportsPatternTrailers | NodeResolutionFeaturesImportsPatternRoot
 * 	NodeResolutionFeaturesNode16Default                          = NodeResolutionFeaturesImports | NodeResolutionFeaturesSelfName | NodeResolutionFeaturesExports | NodeResolutionFeaturesExportsPatternTrailers
 * 	NodeResolutionFeaturesNodeNextDefault                        = NodeResolutionFeaturesAll
 * 	NodeResolutionFeaturesBundlerDefault                         = NodeResolutionFeaturesImports | NodeResolutionFeaturesSelfName | NodeResolutionFeaturesExports | NodeResolutionFeaturesExportsPatternTrailers | NodeResolutionFeaturesImportsPatternRoot
 * )
 */
export const NodeResolutionFeaturesImports: NodeResolutionFeatures = 1 << 0;
export const NodeResolutionFeaturesSelfName: NodeResolutionFeatures = 1 << 1;
export const NodeResolutionFeaturesExports: NodeResolutionFeatures = 1 << 2;
export const NodeResolutionFeaturesExportsPatternTrailers: NodeResolutionFeatures = 1 << 3;
export const NodeResolutionFeaturesImportsPatternRoot: NodeResolutionFeatures = 1 << 4;
export const NodeResolutionFeaturesNone: NodeResolutionFeatures = 0;
export const NodeResolutionFeaturesAll: int =
  NodeResolutionFeaturesImports | NodeResolutionFeaturesSelfName | NodeResolutionFeaturesExports | NodeResolutionFeaturesExportsPatternTrailers | NodeResolutionFeaturesImportsPatternRoot;
export const NodeResolutionFeaturesNode16Default: int =
  NodeResolutionFeaturesImports | NodeResolutionFeaturesSelfName | NodeResolutionFeaturesExports | NodeResolutionFeaturesExportsPatternTrailers;
export const NodeResolutionFeaturesNodeNextDefault: int = NodeResolutionFeaturesAll;
export const NodeResolutionFeaturesBundlerDefault: int =
  NodeResolutionFeaturesImports | NodeResolutionFeaturesSelfName | NodeResolutionFeaturesExports | NodeResolutionFeaturesExportsPatternTrailers | NodeResolutionFeaturesImportsPatternRoot;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/types.go::type::PackageId","kind":"type","status":"implemented","sigHash":"78b9c9f58ce0b81766211839a99a3cde6b50a61fb44ef3a166840a14aad93cb2","bodyHash":"6f2c2e5f989d5c5b609cc1155c69730a482ad1a0b3b00df3fc932a2c120d6fc9"}
 *
 * Go source:
 * PackageId struct {
 * 	Name             string
 * 	SubModuleName    string
 * 	Version          string
 * 	PeerDependencies string
 * }
 */
export interface PackageId {
  Name: string;
  SubModuleName: string;
  Version: string;
  PeerDependencies: string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/types.go::method::PackageId.String","kind":"method","status":"implemented","sigHash":"07e1145105c8a286c58ed064a7a513d0a23b765a7ed2b3aea9bb26105dc8e3f3","bodyHash":"58ee473c24f3041f71218f310262fba14511d52c8053f8e927d15aea610e1384"}
 *
 * Go source:
 * func (p *PackageId) String() string {
 * 	return fmt.Sprintf("%s@%s%s", p.PackageName(), p.Version, p.PeerDependencies)
 * }
 */
export function PackageId_String(receiver: GoPtr<PackageId>): string {
  const p = receiver!;
  return fmt.Sprintf("%s@%s%s", PackageId_PackageName(p), p.Version, p.PeerDependencies);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/types.go::method::PackageId.PackageName","kind":"method","status":"implemented","sigHash":"0c9f9971b224ff800cfd18708fd154439a18723a9b2c5e92f0065bf8d6d6121d","bodyHash":"e3087434064739ecc363b51ff5f4b86b2d4c627e5634ecec218743837fdb1abf"}
 *
 * Go source:
 * func (p *PackageId) PackageName() string {
 * 	if p.SubModuleName != "" {
 * 		return p.Name + "/" + p.SubModuleName
 * 	}
 * 	return p.Name
 * }
 */
export function PackageId_PackageName(receiver: GoPtr<PackageId>): string {
  const p = receiver!;
  if (p.SubModuleName !== "") {
    return p.Name + "/" + p.SubModuleName;
  }
  return p.Name;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/types.go::type::ResolvedModule","kind":"type","status":"implemented","sigHash":"86923a570fd3708e4c78e62b1f475230e820af5a107a97dc52cada12a7c05dd2","bodyHash":"53e708be8a4f3098f19f5add396ef4ec4dc8314f1b210ded9411bb8baf7c40df"}
 *
 * Go source:
 * ResolvedModule struct {
 * 	ResolutionDiagnostics    []*ast.Diagnostic
 * 	ResolvedFileName         string
 * 	OriginalPath             string
 * 	Extension                string
 * 	ResolvedUsingTsExtension bool
 * 	PackageId                PackageId
 * 	IsExternalLibraryImport  bool
 * 	AlternateResult          string
 * }
 */
export interface ResolvedModule {
  ResolutionDiagnostics: GoSlice<GoPtr<Diagnostic>>;
  ResolvedFileName: string;
  OriginalPath: string;
  Extension: string;
  ResolvedUsingTsExtension: bool;
  PackageId: PackageId;
  IsExternalLibraryImport: bool;
  AlternateResult: string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/types.go::method::ResolvedModule.IsResolved","kind":"method","status":"implemented","sigHash":"e902c2aac26780befbbd09abc7d82ad51bcbfb33ce82087c272c87179e971f7f","bodyHash":"5e6fb759efff60795350b740b4a605f47c7b7d28e141c5f74f53e2fdf78e176a"}
 *
 * Go source:
 * func (r *ResolvedModule) IsResolved() bool {
 * 	return r != nil && r.ResolvedFileName != ""
 * }
 */
export function ResolvedModule_IsResolved(receiver: GoPtr<ResolvedModule>): bool {
  return receiver !== undefined && receiver.ResolvedFileName !== "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/types.go::type::ResolvedTypeReferenceDirective","kind":"type","status":"implemented","sigHash":"5ef470994bb101b4af61d7d58be3f7c1f9417e69c318d58a47bf935137ddec6a","bodyHash":"c11fbe67219b152359d3ab637880566883cb3549f58dd690a38202f291f6f059"}
 *
 * Go source:
 * ResolvedTypeReferenceDirective struct {
 * 	ResolutionDiagnostics   []*ast.Diagnostic
 * 	Primary                 bool
 * 	ResolvedFileName        string
 * 	OriginalPath            string
 * 	PackageId               PackageId
 * 	IsExternalLibraryImport bool
 * }
 */
export interface ResolvedTypeReferenceDirective {
  ResolutionDiagnostics: GoSlice<GoPtr<Diagnostic>>;
  Primary: bool;
  ResolvedFileName: string;
  OriginalPath: string;
  PackageId: PackageId;
  IsExternalLibraryImport: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/types.go::method::ResolvedTypeReferenceDirective.IsResolved","kind":"method","status":"implemented","sigHash":"f76972df25a94a35fdaf138c5f78e76310995da67456057a47b8f4a1aa93f9b2","bodyHash":"6485d03102f5f2f79e82611d99f41b3b1404a3c1a47d2092aaa08024d83736c2"}
 *
 * Go source:
 * func (r *ResolvedTypeReferenceDirective) IsResolved() bool {
 * 	return r.ResolvedFileName != ""
 * }
 */
export function ResolvedTypeReferenceDirective_IsResolved(receiver: GoPtr<ResolvedTypeReferenceDirective>): bool {
  return receiver!.ResolvedFileName !== "";
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/types.go::type::extensions","kind":"type","status":"implemented","sigHash":"38dd9e9ebf2244716efccd389d8ff09c4c63cb27c4273ab9d05f5e6d8bd42eac","bodyHash":"7a1558fa8b807f24ac2f3884f126fb13e12dd24d518b740fbf6a02faa9a4dbf5"}
 *
 * Go source:
 * extensions int32
 */
export type extensions = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/types.go::constGroup::extensionsTypeScript+extensionsJavaScript+extensionsDeclaration+extensionsJson+extensionsImplementationFiles","kind":"constGroup","status":"implemented","sigHash":"1fc1ab3f2ee5066caa15b0f0943ea1631fb606d3606b4f0c6e2cc8b4f39f418a","bodyHash":"f5b0db3c5f90277e1888db954d57aaa01edc0eaddd5ba551bf254d247cdea3a6"}
 *
 * Go source:
 * const (
 * 	extensionsTypeScript extensions = 1 << iota
 * 	extensionsJavaScript
 * 	extensionsDeclaration
 * 	extensionsJson
 * 
 * 	extensionsImplementationFiles = extensionsTypeScript | extensionsJavaScript
 * )
 */
export const extensionsTypeScript: extensions = 1 << 0;
export const extensionsJavaScript: extensions = 1 << 1;
export const extensionsDeclaration: extensions = 1 << 2;
export const extensionsJson: extensions = 1 << 3;
export const extensionsImplementationFiles: int = extensionsTypeScript | extensionsJavaScript;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/types.go::method::extensions.String","kind":"method","status":"implemented","sigHash":"07c9b49ec98b86cccfff9d2d466581e555912d4ff447fb9314c2d5a239c0b035","bodyHash":"ed85dc3fb27e85045b5d5a019f7720a3964acac3e1622c07b90fb71bff154ba1"}
 *
 * Go source:
 * func (e extensions) String() string {
 * 	result := make([]string, 0, bits.OnesCount(uint(e)))
 * 	if e&extensionsTypeScript != 0 {
 * 		result = append(result, "TypeScript")
 * 	}
 * 	if e&extensionsJavaScript != 0 {
 * 		result = append(result, "JavaScript")
 * 	}
 * 	if e&extensionsDeclaration != 0 {
 * 		result = append(result, "Declaration")
 * 	}
 * 	if e&extensionsJson != 0 {
 * 		result = append(result, "JSON")
 * 	}
 * 	return strings.Join(result, ", ")
 * }
 */
export function extensions_String(receiver: extensions): string {
  const e = receiver;
  const result: GoSlice<string> = [];
  if ((e & extensionsTypeScript) !== 0) {
    result.push("TypeScript");
  }
  if ((e & extensionsJavaScript) !== 0) {
    result.push("JavaScript");
  }
  if ((e & extensionsDeclaration) !== 0) {
    result.push("Declaration");
  }
  if ((e & extensionsJson) !== 0) {
    result.push("JSON");
  }
  return strings.Join(result, ", ");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/module/types.go::method::extensions.Array","kind":"method","status":"implemented","sigHash":"be5c4e0d3a7afd7d458e356ca120da96c474cc05096ef3a59a73e52feb71dfec","bodyHash":"330bf4b29d9166ccbee737ee9d826e15dbe3664ddea6ff6a03b507224837e5ca"}
 *
 * Go source:
 * func (e extensions) Array() []string {
 * 	result := []string{}
 * 	if e&extensionsTypeScript != 0 {
 * 		result = append(result, tspath.SupportedTSImplementationExtensions...)
 * 	}
 * 	if e&extensionsJavaScript != 0 {
 * 		result = append(result, tspath.SupportedJSExtensionsFlat...)
 * 	}
 * 	if e&extensionsDeclaration != 0 {
 * 		result = append(result, tspath.SupportedDeclarationExtensions...)
 * 	}
 * 	if e&extensionsJson != 0 {
 * 		result = append(result, tspath.ExtensionJson)
 * 	}
 * 	return result
 * }
 */
export function extensions_Array(receiver: extensions): GoSlice<string> {
  const e = receiver;
  const result: GoSlice<string> = [];
  if ((e & extensionsTypeScript) !== 0) {
    result.push(...extension.SupportedTSImplementationExtensions);
  }
  if ((e & extensionsJavaScript) !== 0) {
    result.push(...extension.SupportedJSExtensionsFlat);
  }
  if ((e & extensionsDeclaration) !== 0) {
    result.push(...extension.SupportedDeclarationExtensions);
  }
  if ((e & extensionsJson) !== 0) {
    result.push(extension.ExtensionJson);
  }
  return result;
}
