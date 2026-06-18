import type { bool, byte, int } from "@tsonic/core/types.js";
import type { GoRune, GoSlice } from "../../go/compat.js";
import * as regexp from "../../go/regexp.js";
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::IsWhiteSpaceLike","kind":"func","status":"implemented","sigHash":"41c294fbbab85c229f9f74ec0035ce0ddbc9c3e83cc968db324790fde8684fce","bodyHash":"1565f25c595d0f90731aff1891082223df54e0d9d0fc0f3256d33ae2373577fa"}
 *
 * Go source:
 * func IsWhiteSpaceLike(ch rune) bool {
 * 	return IsWhiteSpaceSingleLine(ch) || IsLineBreak(ch)
 * }
 */
export declare function IsWhiteSpaceLike(ch: GoRune): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::IsWhiteSpaceSingleLine","kind":"func","status":"implemented","sigHash":"346dda5283e1c80c9d243af2e288dab7c0d2a545ed94a3b1386bf7e5fbe86fa8","bodyHash":"e63b3b12b1cd7da0bad2dc582ecde75169c6041205b0b7952e01ee42d901a925"}
 *
 * Go source:
 * func IsWhiteSpaceSingleLine(ch rune) bool {
 * 	// Note: nextLine is in the Zs space, and should be considered to be a whitespace.
 * 	// It is explicitly not a line-break as it isn't in the exact set specified by EcmaScript.
 * 	switch ch {
 * 	case
 * 		' ',    // space
 * 		'\t',   // tab
 * 		'\v',   // verticalTab
 * 		'\f',   // formFeed
 * 		0x0085, // nextLine
 * 		0x00A0, // nonBreakingSpace
 * 		0x1680, // ogham
 * 		0x2000, // enQuad
 * 		0x2001, // emQuad
 * 		0x2002, // enSpace
 * 		0x2003, // emSpace
 * 		0x2004, // threePerEmSpace
 * 		0x2005, // fourPerEmSpace
 * 		0x2006, // sixPerEmSpace
 * 		0x2007, // figureSpace
 * 		0x2008, // punctuationEmSpace
 * 		0x2009, // thinSpace
 * 		0x200A, // hairSpace
 * 		0x200B, // zeroWidthSpace
 * 		0x202F, // narrowNoBreakSpace
 * 		0x205F, // mathematicalSpace
 * 		0x3000, // ideographicSpace
 * 		0xFEFF: // byteOrderMark
 * 		return true
 * 	}
 * 	return false
 * }
 */
export declare function IsWhiteSpaceSingleLine(ch: GoRune): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::IsLineBreak","kind":"func","status":"implemented","sigHash":"59738c0604854d24a322d5ba7579c884f71ce50f144391c2c2be9e10f45d1dbd","bodyHash":"d8fbaed4cf5c20cc5781488118b7bbadf30f251d9be9e9f42de416c8445ecd4e"}
 *
 * Go source:
 * func IsLineBreak(ch rune) bool {
 * 	// ES5 7.3:
 * 	// The ECMAScript line terminator characters are listed in Table 3.
 * 	//     Table 3: Line Terminator Characters
 * 	//     Code Unit Value     Name                    Formal Name
 * 	//     U+000A              Line Feed               <LF>
 * 	//     U+000D              Carriage Return         <CR>
 * 	//     U+2028              Line separator          <LS>
 * 	//     U+2029              Paragraph separator     <PS>
 * 	// Only the characters in Table 3 are treated as line terminators. Other new line or line
 * 	// breaking characters are treated as white space but not as line terminators.
 * 	switch ch {
 * 	case
 * 		'\n',   // lineFeed
 * 		'\r',   // carriageReturn
 * 		0x2028, // lineSeparator
 * 		0x2029: // paragraphSeparator
 * 		return true
 * 	}
 * 	return false
 * }
 */
export declare function IsLineBreak(ch: GoRune): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::IsDigit","kind":"func","status":"implemented","sigHash":"c705c8b3db86c4c9c53b26585276b43aaea91ddf9368416f0e0482358c993c19","bodyHash":"14f4931b9a23ef614c414bab2f80ae1d830f299a631d1ee8cfae533012bac7c8"}
 *
 * Go source:
 * func IsDigit(ch rune) bool {
 * 	return ch >= '0' && ch <= '9'
 * }
 */
export declare function IsDigit(ch: GoRune): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::IsOctalDigit","kind":"func","status":"implemented","sigHash":"00d5d01ffdd6df1f204cdd1ea847014b3bb097869e2e2b2949fca3e5d21405e6","bodyHash":"cb09351fb7726b27277c33adbc85734d65b7adc866d48ea3d17d90c4c3b7dac2"}
 *
 * Go source:
 * func IsOctalDigit(ch rune) bool {
 * 	return ch >= '0' && ch <= '7'
 * }
 */
export declare function IsOctalDigit(ch: GoRune): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::IsHexDigit","kind":"func","status":"implemented","sigHash":"4cf1770dfefbada14251a2c2c35b257fea789a524c0ada1bf31c580e197b34e7","bodyHash":"855fd0d700efe879ec52336fab2ad0379c3283bdf8e818b138c5ea16984309c4"}
 *
 * Go source:
 * func IsHexDigit(ch rune) bool {
 * 	return ch >= '0' && ch <= '9' || ch >= 'A' && ch <= 'F' || ch >= 'a' && ch <= 'f'
 * }
 */
export declare function IsHexDigit(ch: GoRune): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::IsASCIILetter","kind":"func","status":"implemented","sigHash":"6ecb7660764126a24a003a5c6c20bf2b514a325dd7e0f7117302ccbc451e7ca2","bodyHash":"924d2eccc1a6b836524f45c4c5ac9ddeeaac5cebb7e645afde1373df80a2971a"}
 *
 * Go source:
 * func IsASCIILetter(ch rune) bool {
 * 	return ch >= 'A' && ch <= 'Z' || ch >= 'a' && ch <= 'z'
 * }
 */
export declare function IsASCIILetter(ch: GoRune): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::SplitLines","kind":"func","status":"implemented","sigHash":"d56e738370434e6c604089f889beb63cc7395ec39e67af5a8075569b7f3d52b8","bodyHash":"2e5cfdf6862c30209da32c47cee13303ff11e8d07f07b4f5361c734d08db90d4"}
 *
 * Go source:
 * func SplitLines(text string) []string {
 * 	lines := make([]string, 0, strings.Count(text, "\n")+1) // preallocate
 * 	start := 0
 * 	pos := 0
 * 	for pos < len(text) {
 * 		switch text[pos] {
 * 		case '\r':
 * 			if pos+1 < len(text) && text[pos+1] == '\n' {
 * 				lines = append(lines, text[start:pos])
 * 				pos += 2
 * 				start = pos
 * 				continue
 * 			}
 * 			fallthrough
 * 		case '\n':
 * 			lines = append(lines, text[start:pos])
 * 			pos++
 * 			start = pos
 * 			continue
 * 		}
 * 		pos++
 * 	}
 * 	if start < len(text) {
 * 		lines = append(lines, text[start:])
 * 	}
 * 	return lines
 * }
 */
export declare function SplitLines(text: string): GoSlice<string>;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::GuessIndentation","kind":"func","status":"implemented","sigHash":"bff0127724f2e0f65471081cc7e5b87e90b0ae16d6aacc504bd61cedd4b276cf","bodyHash":"4311b47a88d6c1e26846d386c00b9262f6e9fc2a267e12b98d666a8e052d397f"}
 *
 * Go source:
 * func GuessIndentation(lines []string) int {
 * 	const MAX_SMI_X86 int = 0x3fff_ffff
 * 	indentation := MAX_SMI_X86
 * 	for _, line := range lines {
 * 		if len(line) == 0 {
 * 			continue
 * 		}
 * 		i := 0
 * 		for i < len(line) && i < indentation {
 * 			ch, size := utf8.DecodeRuneInString(line[i:])
 * 			if !IsWhiteSpaceLike(ch) {
 * 				break
 * 			}
 * 			i += size
 * 		}
 * 		if i < indentation {
 * 			indentation = i
 * 		}
 * 		if indentation == 0 {
 * 			return 0
 * 		}
 * 	}
 * 	if indentation == MAX_SMI_X86 {
 * 		return 0
 * 	}
 * 	return indentation
 * }
 */
export declare function GuessIndentation(lines: GoSlice<string>): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::EncodeURI","kind":"func","status":"implemented","sigHash":"7c3effdc96b020dc9f6246a3d5d575a4f1f8baf3a4df376b8a9653693febb6fc","bodyHash":"dffd309aec6c60affcc908eccc71408afc0f22662886a8b1c00cdd708178b457"}
 *
 * Go source:
 * func EncodeURI(s string) string {
 * 	var builder strings.Builder
 * 	for i := range len(s) {
 * 		b := s[i]
 * 		if !shouldEscapeForEncodeURI(b) {
 * 			builder.WriteByte(b)
 * 			continue
 * 		}
 *
 * 		for _, escaped := range []byte(s[i : i+1]) {
 * 			builder.WriteByte('%')
 * 			builder.WriteByte(upperhex[escaped>>4])
 * 			builder.WriteByte(upperhex[escaped&0x0f])
 * 		}
 * 	}
 * 	return builder.String()
 * }
 */
export declare function EncodeURI(s: string): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::constGroup::upperhex","kind":"constGroup","status":"implemented","sigHash":"bd628d0eb0bd8836a74fb87452d4db0afa4ffd395061c65111de9b708b6fa875","bodyHash":"cc531723008da7d49178dc0fc71b2dff99511666bf04c96de25e8f3f844885b2"}
 *
 * Go source:
 * const upperhex = "0123456789ABCDEF"
 */
export declare const upperhex: string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::shouldEscapeForEncodeURI","kind":"func","status":"implemented","sigHash":"95cdaf13568927728f414213f52bc31d33131f5eda825782d1cd6f45d0920b3f","bodyHash":"f09a606ea2765666a9a2df21e94e698561d4a39374e1fa2f76b3d0fc9f518fa2"}
 *
 * Go source:
 * func shouldEscapeForEncodeURI(b byte) bool {
 * 	switch {
 * 	case b >= 'A' && b <= 'Z':
 * 		return false
 * 	case b >= 'a' && b <= 'z':
 * 		return false
 * 	case b >= '0' && b <= '9':
 * 		return false
 * 	}
 *
 * 	switch b {
 * 	case ';', '/', '?', ':', '@', '&', '=', '+', '$', ',', '#', '-', '_', '.', '!', '~', '*', '\'', '(', ')':
 * 		return false
 * 	default:
 * 		return true
 * 	}
 * }
 */
export declare function shouldEscapeForEncodeURI(b: byte): bool;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::getByteOrderMarkLength","kind":"func","status":"implemented","sigHash":"a6c98cd9ab2375ed35052a8f984899ae926609d80a014ea07ea93fa2df3fa526","bodyHash":"5ca6a5589a7761463611d04472290bd972b21a6c3bd849e7b0c7c788222de7de"}
 *
 * Go source:
 * func getByteOrderMarkLength(text string) int {
 * 	if len(text) >= 1 {
 * 		ch0 := text[0]
 * 		if ch0 == 0xfe {
 * 			if len(text) >= 2 && text[1] == 0xff {
 * 				return 2 // utf16be
 * 			}
 * 			return 0
 * 		}
 * 		if ch0 == 0xff {
 * 			if len(text) >= 2 && text[1] == 0xfe {
 * 				return 2 // utf16le
 * 			}
 * 			return 0
 * 		}
 * 		if ch0 == 0xef {
 * 			if len(text) >= 3 && text[1] == 0xbb && text[2] == 0xbf {
 * 				return 3 // utf8
 * 			}
 * 			return 0
 * 		}
 * 	}
 * 	return 0
 * }
 */
export declare function getByteOrderMarkLength(text: string): int;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::RemoveByteOrderMark","kind":"func","status":"implemented","sigHash":"155209b9f5dc5b2035b1666e3231e32aeadc86ca68bcad766303da1ff79176dc","bodyHash":"9675cb2a43f4305c3e6d4eea7f882fca92c2a9971abe499054cc0c26dd48379c"}
 *
 * Go source:
 * func RemoveByteOrderMark(text string) string {
 * 	length := getByteOrderMarkLength(text)
 * 	if length > 0 {
 * 		return text[length:]
 * 	}
 * 	return text
 * }
 */
export declare function RemoveByteOrderMark(text: string): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::AddUTF8ByteOrderMark","kind":"func","status":"implemented","sigHash":"b32021b96be25424e7ff49b6e17a4c28a89dc174eb8380dc38f46a89cb114836","bodyHash":"3f8d097c6813a452883acba8620f35722db9a21d6269ef2d0af2789d7ebf6951"}
 *
 * Go source:
 * func AddUTF8ByteOrderMark(text string) string {
 * 	if getByteOrderMarkLength(text) == 0 {
 * 		return "\xEF\xBB\xBF" + text
 * 	}
 * 	return text
 * }
 */
export declare function AddUTF8ByteOrderMark(text: string): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::StripQuotes","kind":"func","status":"implemented","sigHash":"98dbbf1cc5887dba211dd6a242118327a5de8bba4abe1d5f59feca41483fb2c2","bodyHash":"f9f72a7b1fb894739a8de18f6c50a572f7e72638e0f61e80b307e2a4ec64511a"}
 *
 * Go source:
 * func StripQuotes(name string) string {
 * 	if len(name) < 2 {
 * 		return name
 * 	}
 * 	firstChar, _ := utf8.DecodeRuneInString(name)
 * 	lastChar, _ := utf8.DecodeLastRuneInString(name)
 * 	if firstChar == lastChar && (firstChar == '\'' || firstChar == '"' || firstChar == '`') {
 * 		return name[1 : len(name)-1]
 * 	}
 * 	return name
 * }
 */
export declare function StripQuotes(name: string): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::varGroup::matchSlashSomething","kind":"varGroup","status":"implemented","sigHash":"d09249baa9b25762938379176b45b53dafbbf1ac14a760256a306669f079cc84","bodyHash":"bd8d8e5f244055a9f23cadff8be0dc9d49d1c5d2684705d376e62526640bcdc3"}
 *
 * Go source:
 * var matchSlashSomething = regexp.MustCompile(`\\.`)
 */
export declare const matchSlashSomething: regexp.Regexp;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::matchSlashReplacer","kind":"func","status":"implemented","sigHash":"9b639d53c6eb5051f3849fa52411841e72642d5bd8bb5b24ac29a88edd6643b0","bodyHash":"add1c043d85c9d225a2df6f6febdf5b13251cb8c8a94c69bed4cab6ac66be239"}
 *
 * Go source:
 * func matchSlashReplacer(in string) string {
 * 	return in[1:]
 * }
 */
export declare function matchSlashReplacer(in_: string): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::UnquoteString","kind":"func","status":"implemented","sigHash":"4076e653169e775db2f979e55462e04da4ef2c04a6025e15e82e6358f5458f2e","bodyHash":"f7d3a77d681400d91b37d58098a44ca6de306fdfc9b25c1b5b7e1556093386d1"}
 *
 * Go source:
 * func UnquoteString(str string) string {
 * 	// strconv.Unquote is insufficient as that only handles a single character inside single quotes, as those are character literals in go
 * 	inner := StripQuotes(str)
 * 	// In strada we do str.replace(/\\./g, s => s.substring(1)) - which is to say, replace all backslash-something with just something
 * 	// That's replicated here faithfully, but it seems wrong! This should probably be an actual unquote operation?
 * 	return matchSlashSomething.ReplaceAllStringFunc(inner, matchSlashReplacer)
 * }
 */
export declare function UnquoteString(str: string): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::LowerFirstChar","kind":"func","status":"implemented","sigHash":"18419acd16ee0a80f7e16b35829cfc750029f80571fbdab2705e6a83db83d6ba","bodyHash":"43027c7b6b0696e83bf9133e27394da8db6eb86e812481b61c4f6b797ca20a52"}
 *
 * Go source:
 * func LowerFirstChar(str string) string {
 * 	char, size := utf8.DecodeRuneInString(str)
 * 	if size > 0 {
 * 		return string(unicode.ToLower(char)) + str[size:]
 * 	}
 * 	return str
 * }
 */
export declare function LowerFirstChar(str: string): string;
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::TruncateByRunes","kind":"func","status":"implemented","sigHash":"2926b6e56eb06e65e80205ea0ca9d917d205bf79efb67e3a54f0df3846f08b9d","bodyHash":"356b2c07045f49e9613ca88ea8c7f2ad01a9b39812efb2253d75bc7fef22f0da"}
 *
 * Go source:
 * func TruncateByRunes(str string, maxLength int) string {
 * 	if len(str) < maxLength {
 * 		return str
 * 	}
 * 	if maxLength <= 0 {
 * 		return ""
 * 	}
 * 	var runeCount int
 * 	for i := range str {
 * 		runeCount++
 * 		if runeCount > maxLength {
 * 			return str[:i]
 * 		}
 * 	}
 * 	return str
 * }
 */
export declare function TruncateByRunes(str: string, maxLength: int): string;
//# sourceMappingURL=util.d.ts.map