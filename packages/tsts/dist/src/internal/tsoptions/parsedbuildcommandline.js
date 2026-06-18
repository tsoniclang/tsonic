import { Map } from "../core/core.js";
import { ResolveConfigFileNameOfProjectReference } from "../core/projectreference.js";
import { Parse } from "../locale/locale.js";
import { ResolvePath } from "../tspath/path.js";
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
export function ParsedBuildCommandLine_ResolvedProjectPaths(receiver) {
    const p = receiver;
    p.resolvedProjectPathsOnce.Do(() => {
        p.resolvedProjectPaths = Map(p.Projects, (project) => {
            return ResolveConfigFileNameOfProjectReference(ResolvePath(p.comparePathsOptions.CurrentDirectory, project));
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
export function ParsedBuildCommandLine_Locale(receiver) {
    const p = receiver;
    p.localeOnce.Do(() => {
        [p.locale] = Parse(p.CompilerOptions.Locale);
    });
    return p.locale;
}
//# sourceMappingURL=parsedbuildcommandline.js.map