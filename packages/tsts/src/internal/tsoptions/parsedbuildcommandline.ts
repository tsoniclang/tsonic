import type { GoPtr, GoSlice } from "../../go/compat.js";
import type { Once } from "../../go/sync.js";
import type { Diagnostic } from "../ast/diagnostic.js";
import type { BuildOptions } from "../core/buildoptions.js";
import type { CompilerOptions } from "../core/compileroptions.js";
import { Map } from "../core/core.js";
import { ResolveConfigFileNameOfProjectReference } from "../core/projectreference.js";
import type { WatchOptions } from "../core/watchoptions.js";
import type { Locale as Locale_b0d69dd1 } from "../locale/locale.js";
import { Parse } from "../locale/locale.js";
import type { ComparePathsOptions } from "../tspath/path.js";
import { ResolvePath } from "../tspath/path.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedbuildcommandline.go::type::ParsedBuildCommandLine","kind":"type","status":"implemented","sigHash":"38430521b70f19c4577653334ca223fc0270319362c20f5925094804f9baee54","bodyHash":"34d6e236b3813a9814ee5118fb03da108b503c446cfe8ee915b12fac81ab1559"}
 *
 * Go source:
 * ParsedBuildCommandLine struct {
 * 	BuildOptions    *core.BuildOptions    `json:"buildOptions"`
 * 	CompilerOptions *core.CompilerOptions `json:"compilerOptions"`
 * 	WatchOptions    *core.WatchOptions    `json:"watchOptions"`
 * 	Projects        []string              `json:"projects"`
 * 	Errors          []*ast.Diagnostic     `json:"errors"`
 * 	Raw             any                   `json:"raw"`
 * 
 * 	comparePathsOptions tspath.ComparePathsOptions
 * 
 * 	resolvedProjectPaths     []string
 * 	resolvedProjectPathsOnce sync.Once
 * 
 * 	locale     locale.Locale
 * 	localeOnce sync.Once
 * }
 */
export interface ParsedBuildCommandLine {
  BuildOptions: GoPtr<BuildOptions>;
  CompilerOptions: GoPtr<CompilerOptions>;
  WatchOptions: GoPtr<WatchOptions>;
  Projects: GoSlice<string>;
  Errors: GoSlice<GoPtr<Diagnostic>>;
  Raw: unknown;
  comparePathsOptions: ComparePathsOptions;
  resolvedProjectPaths: GoSlice<string>;
  resolvedProjectPathsOnce: Once;
  locale: Locale_b0d69dd1;
  localeOnce: Once;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedbuildcommandline.go::method::ParsedBuildCommandLine.ResolvedProjectPaths","kind":"method","status":"implemented","sigHash":"62d754c0a97d15832830d10c5f4f3c52e86d46117e3f8b18cee454ea84eba9d3","bodyHash":"d7ab444200098a4ff923891337b44c60ed0dd6dc607c7cc4f1b51725e86ef2c4"}
 *
 * Go source:
 * func (p *ParsedBuildCommandLine) ResolvedProjectPaths() []string {
 * 	p.resolvedProjectPathsOnce.Do(func() {
 * 		p.resolvedProjectPaths = core.Map(p.Projects, func(project string) string {
 * 			return core.ResolveConfigFileNameOfProjectReference(
 * 				tspath.ResolvePath(p.comparePathsOptions.CurrentDirectory, project),
 * 			)
 * 		})
 * 	})
 * 	return p.resolvedProjectPaths
 * }
 */
export function ParsedBuildCommandLine_ResolvedProjectPaths(receiver: GoPtr<ParsedBuildCommandLine>): GoSlice<string> {
  const p = receiver!;
  p.resolvedProjectPathsOnce.Do(() => {
    p.resolvedProjectPaths = Map(p.Projects, (project: string): string => {
      return ResolveConfigFileNameOfProjectReference(
        ResolvePath(p.comparePathsOptions.CurrentDirectory, project),
      );
    });
  });
  return p.resolvedProjectPaths;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/tsoptions/parsedbuildcommandline.go::method::ParsedBuildCommandLine.Locale","kind":"method","status":"implemented","sigHash":"9a8cd080656f5b01c936f67be6eefe5787f36aa224c0a6d49e1db0d2401fce0a","bodyHash":"9c06ca9f98856b30fb4bac17621e49be3be130f6cb88ac0378f6fd806ac74195"}
 *
 * Go source:
 * func (p *ParsedBuildCommandLine) Locale() locale.Locale {
 * 	p.localeOnce.Do(func() {
 * 		p.locale, _ = locale.Parse(p.CompilerOptions.Locale)
 * 	})
 * 	return p.locale
 * }
 */
export function ParsedBuildCommandLine_Locale(receiver: GoPtr<ParsedBuildCommandLine>): Locale_b0d69dd1 {
  const p = receiver!;
  p.localeOnce.Do(() => {
    [p.locale] = Parse(p.CompilerOptions!.Locale);
  });
  return p.locale;
}
