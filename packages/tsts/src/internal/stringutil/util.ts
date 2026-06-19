import type { bool, byte, int } from "../../go/scalars.js";
import type { GoRune, GoSlice } from "../../go/compat.js";
import * as regexp from "../../go/regexp.js";
import { Builder, Count } from "../../go/strings.js";
import { ToLower } from "../../go/unicode.js";
import {
  DecodeLastRuneInString,
  DecodeRuneInBytesAt,
  DecodeRuneInString,
  DecodeRuneInStringAt,
  StringByteAt,
  StringByteLen,
  StringByteSlice,
  StringUtf8Bytes,
} from "../../go/unicode/utf8.js";
import * as utf16 from "../../go/unicode/utf16.js";

// Go strings are immutable UTF-8 byte sequences; `len(s)` is a byte length,
// `s[i]` is a byte, and slices like `s[i:j]` operate on byte offsets. The
// standard-library facades (strings/utf8) follow that contract, so we mirror it
// here by operating over the UTF-8 byte view and converting back to a JS string
// at the boundaries.
const byteLen = StringByteLen;
const byteAt = (s: string, i: int): byte => StringByteAt(s, i) as byte;
const byteSlice = StringByteSlice;
// runeToString encodes a single rune to its UTF-8 JS string form, mirroring
// Go's `string(rune)` conversion.
const runeToString = (r: GoRune): string => {
  if (r < 0 || r > 0x10ffff || (r >= 0xd800 && r <= 0xdfff)) {
    return "�";
  }
  return String.fromCodePoint(r);
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::IsWhiteSpaceLike","kind":"func","status":"implemented","sigHash":"41c294fbbab85c229f9f74ec0035ce0ddbc9c3e83cc968db324790fde8684fce","bodyHash":"1565f25c595d0f90731aff1891082223df54e0d9d0fc0f3256d33ae2373577fa"}
 *
 * Go source:
 * func IsWhiteSpaceLike(ch rune) bool {
 * 	return IsWhiteSpaceSingleLine(ch) || IsLineBreak(ch)
 * }
 */
export function IsWhiteSpaceLike(ch: GoRune): bool {
  return IsWhiteSpaceSingleLine(ch) || IsLineBreak(ch);
}

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
export function IsWhiteSpaceSingleLine(ch: GoRune): bool {
  // Note: nextLine is in the Zs space, and should be considered to be a whitespace.
  // It is explicitly not a line-break as it isn't in the exact set specified by EcmaScript.
  switch (ch) {
    case 0x20: // space
    case 0x09: // tab
    case 0x0b: // verticalTab
    case 0x0c: // formFeed
    case 0x0085: // nextLine
    case 0x00a0: // nonBreakingSpace
    case 0x1680: // ogham
    case 0x2000: // enQuad
    case 0x2001: // emQuad
    case 0x2002: // enSpace
    case 0x2003: // emSpace
    case 0x2004: // threePerEmSpace
    case 0x2005: // fourPerEmSpace
    case 0x2006: // sixPerEmSpace
    case 0x2007: // figureSpace
    case 0x2008: // punctuationEmSpace
    case 0x2009: // thinSpace
    case 0x200a: // hairSpace
    case 0x200b: // zeroWidthSpace
    case 0x202f: // narrowNoBreakSpace
    case 0x205f: // mathematicalSpace
    case 0x3000: // ideographicSpace
    case 0xfeff: // byteOrderMark
      return true;
  }
  return false;
}

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
export function IsLineBreak(ch: GoRune): bool {
  // ES5 7.3:
  // The ECMAScript line terminator characters are listed in Table 3.
  //     Table 3: Line Terminator Characters
  //     Code Unit Value     Name                    Formal Name
  //     U+000A              Line Feed               <LF>
  //     U+000D              Carriage Return         <CR>
  //     U+2028              Line separator          <LS>
  //     U+2029              Paragraph separator     <PS>
  // Only the characters in Table 3 are treated as line terminators. Other new line or line
  // breaking characters are treated as white space but not as line terminators.
  switch (ch) {
    case 0x0a: // lineFeed
    case 0x0d: // carriageReturn
    case 0x2028: // lineSeparator
    case 0x2029: // paragraphSeparator
      return true;
  }
  return false;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::IsDigit","kind":"func","status":"implemented","sigHash":"c705c8b3db86c4c9c53b26585276b43aaea91ddf9368416f0e0482358c993c19","bodyHash":"14f4931b9a23ef614c414bab2f80ae1d830f299a631d1ee8cfae533012bac7c8"}
 *
 * Go source:
 * func IsDigit(ch rune) bool {
 * 	return ch >= '0' && ch <= '9'
 * }
 */
export function IsDigit(ch: GoRune): bool {
  return ch >= 0x30 && ch <= 0x39;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::IsOctalDigit","kind":"func","status":"implemented","sigHash":"00d5d01ffdd6df1f204cdd1ea847014b3bb097869e2e2b2949fca3e5d21405e6","bodyHash":"cb09351fb7726b27277c33adbc85734d65b7adc866d48ea3d17d90c4c3b7dac2"}
 *
 * Go source:
 * func IsOctalDigit(ch rune) bool {
 * 	return ch >= '0' && ch <= '7'
 * }
 */
export function IsOctalDigit(ch: GoRune): bool {
  return ch >= 0x30 && ch <= 0x37;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::IsHexDigit","kind":"func","status":"implemented","sigHash":"4cf1770dfefbada14251a2c2c35b257fea789a524c0ada1bf31c580e197b34e7","bodyHash":"855fd0d700efe879ec52336fab2ad0379c3283bdf8e818b138c5ea16984309c4"}
 *
 * Go source:
 * func IsHexDigit(ch rune) bool {
 * 	return ch >= '0' && ch <= '9' || ch >= 'A' && ch <= 'F' || ch >= 'a' && ch <= 'f'
 * }
 */
export function IsHexDigit(ch: GoRune): bool {
  return (ch >= 0x30 && ch <= 0x39) || (ch >= 0x41 && ch <= 0x46) || (ch >= 0x61 && ch <= 0x66);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::IsASCIILetter","kind":"func","status":"implemented","sigHash":"6ecb7660764126a24a003a5c6c20bf2b514a325dd7e0f7117302ccbc451e7ca2","bodyHash":"924d2eccc1a6b836524f45c4c5ac9ddeeaac5cebb7e645afde1373df80a2971a"}
 *
 * Go source:
 * func IsASCIILetter(ch rune) bool {
 * 	return ch >= 'A' && ch <= 'Z' || ch >= 'a' && ch <= 'z'
 * }
 */
export function IsASCIILetter(ch: GoRune): bool {
  return (ch >= 0x41 && ch <= 0x5a) || (ch >= 0x61 && ch <= 0x7a);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::SplitLines","kind":"func","status":"implemented","sigHash":"d56e738370434e6c604089f889beb63cc7395ec39e67af5a8075569b7f3d52b8","bodyHash":"2e5cfdf6862c30209da32c47cee13303ff11e8d07f07b4f5361c734d08db90d4"}
 * @tsgo-override {"category":"runtime-performance","allow":["body"],"reason":"Scan line breaks with JS/.NET UTF-16 code units because CR/LF separators are ASCII and the returned substrings are identical to TS-Go byte-sliced lines."}
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
export function SplitLines(text: string): GoSlice<string> {
  // make([]string, 0, strings.Count(text, "\n")+1) // preallocate. Go reserves
  // capacity here; the hint has no observable effect on a JS array, but the
  // pure Count call is preserved for fidelity.
  Count(text, "\n");
  const lines: GoSlice<string> = [];
  let start = 0;
  let pos = 0;
  const textLen = text.length;
  while (pos < textLen) {
    switch (text.charCodeAt(pos)) {
      case 0x0d /* '\r' */: {
        if (pos + 1 < textLen && text.charCodeAt(pos + 1) === 0x0a) {
          lines.push(text.slice(start, pos));
          pos += 2;
          start = pos;
          continue;
        }
        // fallthrough
        lines.push(text.slice(start, pos));
        pos++;
        start = pos;
        continue;
      }
      case 0x0a /* '\n' */: {
        lines.push(text.slice(start, pos));
        pos++;
        start = pos;
        continue;
      }
    }
    pos++;
  }
  if (start < text.length) {
    lines.push(text.slice(start));
  }
  return lines;
}

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
export function GuessIndentation(lines: GoSlice<string>): int {
  const MAX_SMI_X86: int = 0x3fffffff;
  let indentation = MAX_SMI_X86;
  for (const line of lines) {
    if (byteLen(line) === 0) {
      continue;
    }
    let i = 0;
    while (i < byteLen(line) && i < indentation) {
      const [ch, size] = DecodeRuneInStringAt(line, i);
      if (!IsWhiteSpaceLike(ch)) {
        break;
      }
      i += size;
    }
    if (i < indentation) {
      indentation = i;
    }
    if (indentation === 0) {
      return 0;
    }
  }
  if (indentation === MAX_SMI_X86) {
    return 0;
  }
  return indentation;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::EncodeURI","kind":"func","status":"implemented","sigHash":"7c3effdc96b020dc9f6246a3d5d575a4f1f8baf3a4df376b8a9653693febb6fc","bodyHash":"dffd309aec6c60affcc908eccc71408afc0f22662886a8b1c00cdd708178b457"}
 * @tsgo-override {"category":"runtime-performance","allow":["body"],"reason":"Avoid full-string UTF-8 materialization for ASCII-heavy URI text; emit the same UTF-8 percent bytes only for non-ASCII code points."}
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
export function EncodeURI(s: string): string {
  const builder = new Builder();
  for (let i = 0; i < s.length; i++) {
    const b = s.charCodeAt(i);
    if (!shouldEscapeForEncodeURI(b)) {
      builder.WriteByte(b);
      continue;
    }
    if (b >= 0x80) {
      const cp = s.codePointAt(i)!;
      const ch = cp > 0xffff ? s.slice(i, i + 2) : s.charAt(i);
      for (const escaped of StringUtf8Bytes(ch)) {
        builder.WriteByte(0x25 /* '%' */);
        builder.WriteByte(byteAt(upperhex, escaped >> 4));
        builder.WriteByte(byteAt(upperhex, escaped & 0x0f));
      }
      if (cp > 0xffff) {
        i++;
      }
      continue;
    }

    builder.WriteByte(0x25 /* '%' */);
    builder.WriteByte(byteAt(upperhex, b >> 4));
    builder.WriteByte(byteAt(upperhex, b & 0x0f));
  }
  return builder.String();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::constGroup::upperhex","kind":"constGroup","status":"implemented","sigHash":"bd628d0eb0bd8836a74fb87452d4db0afa4ffd395061c65111de9b708b6fa875","bodyHash":"cc531723008da7d49178dc0fc71b2dff99511666bf04c96de25e8f3f844885b2"}
 *
 * Go source:
 * const upperhex = "0123456789ABCDEF"
 */
export const upperhex: string = "0123456789ABCDEF";

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
export function shouldEscapeForEncodeURI(b: byte): bool {
  switch (true) {
    case b >= 0x41 /* 'A' */ && b <= 0x5a /* 'Z' */:
      return false;
    case b >= 0x61 /* 'a' */ && b <= 0x7a /* 'z' */:
      return false;
    case b >= 0x30 /* '0' */ && b <= 0x39 /* '9' */:
      return false;
  }

  switch (b) {
    case 0x3b /* ';' */:
    case 0x2f /* '/' */:
    case 0x3f /* '?' */:
    case 0x3a /* ':' */:
    case 0x40 /* '@' */:
    case 0x26 /* '&' */:
    case 0x3d /* '=' */:
    case 0x2b /* '+' */:
    case 0x24 /* '$' */:
    case 0x2c /* ',' */:
    case 0x23 /* '#' */:
    case 0x2d /* '-' */:
    case 0x5f /* '_' */:
    case 0x2e /* '.' */:
    case 0x21 /* '!' */:
    case 0x7e /* '~' */:
    case 0x2a /* '*' */:
    case 0x27 /* '\'' */:
    case 0x28 /* '(' */:
    case 0x29 /* ')' */:
      return false;
    default:
      return true;
  }
}

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
export function getByteOrderMarkLength(text: string): int {
  const textBytes = StringUtf8Bytes(text);
  if (textBytes.length >= 1) {
    const ch0 = textBytes[0]!;
    if (ch0 === 0xfe) {
      if (textBytes.length >= 2 && textBytes[1]! === 0xff) {
        return 2; // utf16be
      }
      return 0;
    }
    if (ch0 === 0xff) {
      if (textBytes.length >= 2 && textBytes[1]! === 0xfe) {
        return 2; // utf16le
      }
      return 0;
    }
    if (ch0 === 0xef) {
      if (textBytes.length >= 3 && textBytes[1]! === 0xbb && textBytes[2]! === 0xbf) {
        return 3; // utf8
      }
      return 0;
    }
  }
  return 0;
}

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
export function RemoveByteOrderMark(text: string): string {
  const length = getByteOrderMarkLength(text);
  if (length > 0) {
    return byteSlice(text, length);
  }
  return text;
}

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
export function AddUTF8ByteOrderMark(text: string): string {
  if (getByteOrderMarkLength(text) === 0) {
    // Go prepends the raw bytes EF BB BF; in a JS string that is U+FEFF. (TextDecoder
    // must not be used here: it strips a leading BOM by default, yielding "".)
    return "\uFEFF" + text;
  }
  return text;
}

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
export function StripQuotes(name: string): string {
  if (byteLen(name) < 2) {
    return name;
  }
  const [firstChar] = DecodeRuneInString(name);
  const [lastChar] = DecodeLastRuneInString(name);
  if (firstChar === lastChar && (firstChar === 0x27 /* '\'' */ || firstChar === 0x22 /* '"' */ || firstChar === 0x60 /* '`' */)) {
    return byteSlice(name, 1, byteLen(name) - 1);
  }
  return name;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::varGroup::matchSlashSomething","kind":"varGroup","status":"implemented","sigHash":"d09249baa9b25762938379176b45b53dafbbf1ac14a760256a306669f079cc84","bodyHash":"bd8d8e5f244055a9f23cadff8be0dc9d49d1c5d2684705d376e62526640bcdc3"}
 *
 * Go source:
 * var matchSlashSomething = regexp.MustCompile(`\\.`)
 */
export const matchSlashSomething: regexp.Regexp = regexp.MustCompile(`\\\\.`);

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::matchSlashReplacer","kind":"func","status":"implemented","sigHash":"9b639d53c6eb5051f3849fa52411841e72642d5bd8bb5b24ac29a88edd6643b0","bodyHash":"add1c043d85c9d225a2df6f6febdf5b13251cb8c8a94c69bed4cab6ac66be239"}
 *
 * Go source:
 * func matchSlashReplacer(in string) string {
 * 	return in[1:]
 * }
 */
export function matchSlashReplacer(in_: string): string {
  return byteSlice(in_, 1);
}

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
export function UnquoteString(str: string): string {
  // strconv.Unquote is insufficient as that only handles a single character inside single quotes, as those are character literals in go
  const inner: string = StripQuotes(str);
  // In strada we do str.replace(/\\./g, s => s.substring(1)) - which is to say, replace all backslash-something with just something
  // That's replicated here faithfully, but it seems wrong! This should probably be an actual unquote operation?
  return matchSlashSomething.ReplaceAllStringFunc(inner, matchSlashReplacer);
}

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
export function LowerFirstChar(str: string): string {
  const [char, size] = DecodeRuneInString(str);
  if (size > 0) {
    return runeToString(ToLower(char)) + byteSlice(str, size);
  }
  return str;
}

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
export function TruncateByRunes(str: string, maxLength: int): string {
  if (byteLen(str) < maxLength) {
    return str;
  }
  if (maxLength <= 0) {
    return "";
  }
  let runeCount = 0;
  // `for i := range str` iterates over the byte offset of each rune start.
  const strBytes = StringUtf8Bytes(str);
  let i = 0;
  while (i < strBytes.length) {
    runeCount++;
    if (runeCount > maxLength) {
      return byteSlice(str, 0, i);
    }
    const [, size] = DecodeRuneInBytesAt(strBytes, i);
    i += size === 0 ? 1 : size;
  }
  return str;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::constGroup::SurrogateLowStart","kind":"constGroup","status":"implemented","sigHash":"75e22149f18242ba9838dcaa357782031e9f589271481653241aa9ede67bb9f2","bodyHash":"5e2140617c0299b93eda64d2d5e5b25c9f59e8b47d61bcf0f628668eb3a282b9"}
 *
 * Go source:
 * const (
 * 	// SurrogateLowStart is the boundary between the high and low halves of the
 * 	// UTF-16 surrogate range. unicode/utf16 only exposes IsSurrogate for the
 * 	// whole range, so this split point is defined here to distinguish the two.
 * 	SurrogateLowStart = 0xDC00
 * )
 */
export const SurrogateLowStart: int = 0xdc00 as int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::IsHighSurrogate","kind":"func","status":"implemented","sigHash":"0e49ff666758f777cb54d06bfba2a9d26a64fd478143494b8b0e161d2c4e83a7","bodyHash":"dbae06aa207c6bbab1c0e6d3f7fdb932c8c71519020fcb14b37c8d739949c1da"}
 *
 * Go source:
 * func IsHighSurrogate(ch rune) bool {
 * 	return utf16.IsSurrogate(ch) && ch < SurrogateLowStart
 * }
 */
export function IsHighSurrogate(ch: GoRune): bool {
  return (utf16.IsSurrogate(ch) && ch < SurrogateLowStart) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::IsLowSurrogate","kind":"func","status":"implemented","sigHash":"2f485c1f7a6d7beeda55b710e6f90709c0b47ca6bfe9a9e1894528632932ddc9","bodyHash":"471bc047be58658cbabd4aab422203e6e3a7ef679661f8a81522fdccb6f04231"}
 *
 * Go source:
 * func IsLowSurrogate(ch rune) bool {
 * 	return utf16.IsSurrogate(ch) && ch >= SurrogateLowStart
 * }
 */
export function IsLowSurrogate(ch: GoRune): bool {
  return (utf16.IsSurrogate(ch) && ch >= SurrogateLowStart) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::IsSurrogate","kind":"func","status":"implemented","sigHash":"21913813f55b4e9cf0d17efeb9caf9201c54bba6a2385779cda63c916e2740db","bodyHash":"2ee83cd0aa4fa5a57c922c1f0079d22d4139869e6e57c6572b2973f77213be9e"}
 *
 * Go source:
 * func IsSurrogate(ch rune) bool {
 * 	return utf16.IsSurrogate(ch)
 * }
 */
export function IsSurrogate(ch: GoRune): bool {
  return utf16.IsSurrogate(ch) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::SurrogatePairToCodePoint","kind":"func","status":"implemented","sigHash":"cd27116220eba3991089c80642673655edc9ae3de226873f1716e8930af87bd7","bodyHash":"05491602b67b6ba071726a0af8f5609351cdda512b1fc1eca6eb6b79729d19e9"}
 *
 * Go source:
 * func SurrogatePairToCodePoint(high rune, low rune) rune {
 * 	return utf16.DecodeRune(high, low)
 * }
 */
export function SurrogatePairToCodePoint(high: GoRune, low: GoRune): GoRune {
  return utf16.DecodeRune(high, low);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::CodePointToSurrogatePair","kind":"func","status":"implemented","sigHash":"80240ce3b885d7d0361d7a5873fb56bca3151462f345c1baa03bcd1b4724c8a4","bodyHash":"1e9141b11836cfbe979314916c8c3ab9aa4a4ab5aed2daf1c6aa8fa04239d782"}
 *
 * Go source:
 * func CodePointToSurrogatePair(ch rune) (high rune, low rune) {
 * 	return utf16.EncodeRune(ch)
 * }
 */
export function CodePointToSurrogatePair(ch: GoRune): [GoRune, GoRune] {
  return utf16.EncodeRune(ch);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::constGroup::surrogateUTF8Lead+surrogateUTF8LeadBits+utf8ContMarker+utf8ContMax+utf8ContMask+surrogateUTF8Byte1Min+surrogateUTF8Byte1Max","kind":"constGroup","status":"implemented","sigHash":"01744899508cfb5f4c0cf35f7ef8e13aca37b4dd4eb009ad02519f22600bed91","bodyHash":"4da5e8ec178a6659a5f3a4c71fec8982883ced413d37a019041bcc6cb742d205"}
 *
 * Go source: const block describing the CESU-8/WTF-8 byte layout Go uses to encode a lone
 * surrogate (U+D000–U+DFFF) that valid UTF-8 cannot represent. TSTS keeps lone surrogates as
 * native JS UTF-16 code units instead (see EncodeJSStringRune/DecodeJSStringRune), so these
 * byte-layout constants are carried for fidelity but are not referenced by the JS-native helpers.
 */
const surrogateUTF8Lead: int = 0xed;
const surrogateUTF8LeadBits: int = 0xd000;
const utf8ContMarker: int = 0x80;
const utf8ContMax: int = 0xbf;
const utf8ContMask: int = 0x3f;
const surrogateUTF8Byte1Min: int = 0xa0;
const surrogateUTF8Byte1Max: int = 0xbf;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::EncodeJSStringRune","kind":"func","status":"implemented","sigHash":"1b022e6bf6f6c57eebaf4d88589ab66f999ca307423a34b6f60e1485fc0dc6c1","bodyHash":"24ea1f4d378e6f40da70e9ba018e40169769c24256e5014bdd4dd172cd17b483"}
 *
 * Go source:
 * func EncodeJSStringRune(ch rune) string {
 * 	if IsSurrogate(ch) {
 * 		return string([]byte{
 * 			surrogateUTF8Lead,
 * 			byte(utf8ContMarker | ((ch >> 6) & utf8ContMask)),
 * 			byte(utf8ContMarker | (ch & utf8ContMask)),
 * 		})
 * 	}
 * 	return string(ch)
 * }
 */
export function EncodeJSStringRune(ch: GoRune): string {
  // Go encodes a lone surrogate as a 3-byte CESU-8 sentinel because Go strings
  // cannot hold surrogate code points via string(rune). JS strings hold lone
  // surrogate code units natively, so the sentinel is the unit itself
  // (String.fromCharCode); TextDecoder would destroy the CESU-8 bytes. byteLen of
  // a lone surrogate is 3 (TextEncoder emits U+FFFD), matching Go's len() of the
  // CESU-8 sentinel for byte-size accounting.
  if (IsSurrogate(ch)) {
    return globalThis.String.fromCharCode(ch);
  }
  return runeToString(ch);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::DecodeJSStringRune","kind":"func","status":"implemented","sigHash":"3ce94d2f5a65d67110a2af4875f01e324a0d8b3cf10b073ff037aa4f10a8b98b","bodyHash":"141078d87f3cdc3a15c995a317ae55f9ea3a99cd39c90d13d7ec15b5f14cefea"}
 *
 * Go source:
 * func DecodeJSStringRune(s string) (rune, int) {
 * 	if len(s) >= 3 &&
 * 		s[0] == surrogateUTF8Lead &&
 * 		s[1] >= surrogateUTF8Byte1Min && s[1] <= surrogateUTF8Byte1Max &&
 * 		s[2] >= utf8ContMarker && s[2] <= utf8ContMax {
 * 		return surrogateUTF8LeadBits | rune(s[1]&utf8ContMask)<<6 | rune(s[2]&utf8ContMask), 3
 * 	}
 * 	return utf8.DecodeRuneInString(s)
 * }
 */
export function DecodeJSStringRune(s: string): [GoRune, int] {
  // The sentinel from EncodeJSStringRune is a lone surrogate code unit (Go: a
  // 3-byte CESU-8 sequence, hence the returned byte size of 3). A high surrogate
  // followed by a matching low surrogate is a real astral character and decodes
  // as the full code point instead.
  const first = s.length > 0 ? s.charCodeAt(0) : 0;
  if (first >= 0xd800 && first <= 0xdfff) {
    const second = s.length > 1 ? s.charCodeAt(1) : 0;
    if (!(first < 0xdc00 && second >= 0xdc00 && second <= 0xdfff)) {
      return [first as GoRune, 3 as int];
    }
  }
  return DecodeRuneInString(s);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/stringutil/util.go::func::CombineSurrogatePairs","kind":"func","status":"implemented","sigHash":"a1bf52fe728f2a9a9fc2f6232cd40647a20590fe3be22823a5c448bd3ddbe38f","bodyHash":"d85a41cbffe933f35dcd2393f6d01037bf949494f67dbbb1852777feb14fc414"}
 *
 * Go source:
 * func CombineSurrogatePairs(s string) string { ... merges adjacent CESU-8 high+low surrogate
 * sentinels into the single supplementary code point's 4-byte UTF-8 form ... }
 */
export function CombineSurrogatePairs(s: string): string {
  // In Go (UTF-8) a high+low surrogate written as two separate CESU-8 sentinels
  // (6 bytes) must be merged into the supplementary code point's single 4-byte
  // form. JS strings are UTF-16: two adjacent surrogate code units already ARE
  // that supplementary code point (and byteLen yields 4 via TextEncoder), so the
  // value is already canonical and no rewrite is needed.
  return s;
}
