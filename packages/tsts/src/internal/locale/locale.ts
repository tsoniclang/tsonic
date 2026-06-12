import type { bool, int } from "@tsonic/core/types.js";
import type { Context } from "../../go/context.js";
import { WithValue } from "../../go/context.js";
import type { Tag } from "../../go/golang.org/x/text/language.js";
import { Und } from "../../go/golang.org/x/text/language.js";
import { Parse as language_Parse } from "../../go/golang.org/x/text/language.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/locale/locale.go::type::contextKey","kind":"type","status":"implemented","sigHash":"145a4d492e87e1caa7fa3707ee5ee0952a786a50fc5f06b34cf46263a3763f73","bodyHash":"65e826d5aa9f95dc625b6fa2e3bfa42b2ba824bd6e62e0cc726cf5b7eca25412"}
 *
 * Go source:
 * contextKey int
 */
export type contextKey = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/locale/locale.go::type::Locale","kind":"type","status":"implemented","sigHash":"331b8370bfaa9be88ef646c4032992700bf4c554fdb4c7b30a1d7e72f7bd8853","bodyHash":"c074a9d2d34d485c1752562a9728ef07b1e38efcc0f30cc55dcf36a21c4e84ca"}
 *
 * Go source:
 * Locale language.Tag
 */
export type Locale = Tag;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/locale/locale.go::varGroup::Default","kind":"varGroup","status":"implemented","sigHash":"8e17f9a6a52bc2efcad3db99e2ade86555d82bc4c760c402239e029f68023a12","bodyHash":"94686b4c15a138fd912de4b5f5f7b00188a92c454cb2c17122e57dcec5e43a80"}
 *
 * Go source:
 * var Default Locale
 */
export let Default: Locale = Und as Locale;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/locale/locale.go::func::WithLocale","kind":"func","status":"implemented","sigHash":"98bcaed9c2841ab61a5aaab413b53f0aeefdf075c7be964fdfd3b6b17e8083ca","bodyHash":"e860ac1eb2433526b0d38fb21a8ddb065c6c90ec58bbbb08949a4e2035565a91"}
 *
 * Go source:
 * func WithLocale(ctx context.Context, locale Locale) context.Context {
 * 	return context.WithValue(ctx, contextKey(0), locale)
 * }
 */
export function WithLocale(ctx: Context, locale: Locale): Context {
  return WithValue(ctx, 0 as contextKey, locale);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/locale/locale.go::func::FromContext","kind":"func","status":"implemented","sigHash":"25d93e5a58cf3082a1a85d6e267570b47cbff7d55f2fa4b60aff3603c3235f61","bodyHash":"a785e440ea03f598e31fed196552fd0ff6d606dbe9c112e829987e78c3cf0854"}
 *
 * Go source:
 * func FromContext(ctx context.Context) Locale {
 * 	locale, _ := ctx.Value(contextKey(0)).(Locale)
 * 	return locale
 * }
 */
export function FromContext(ctx: Context): Locale {
  return ctx.Value(0 as contextKey) as Locale;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/locale/locale.go::func::Parse","kind":"func","status":"implemented","sigHash":"be0737940f128b16833176ccc50b8620db5bd2c3e925c144e5760665df4ade30","bodyHash":"89b9f53cd46cefd21eed1fe851bd4c224d519ea95b088ce9b39b20a7aad4f455"}
 *
 * Go source:
 * func Parse(localeStr string) (locale Locale, ok bool) {
 * 	// Parse gracefully fails.
 * 	tag, err := language.Parse(localeStr)
 * 	return Locale(tag), err == nil
 * }
 */
export function Parse(localeStr: string): [Locale, bool] {
  const [tag, err] = language_Parse(localeStr) as [Tag, Error | undefined];
  return [tag as Locale, (err === undefined) as bool];
}
