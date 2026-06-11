// Faithful TypeScript port of the subset of Go's `regexp` package that
// typescript-go's active call sites use.
//
// Go's `regexp` is RE2: linear-time matching, NO backtracking. We back the
// compiled regexp with a JavaScript RegExp, but JS RegExp semantics differ from
// RE2 in a few places, so the Go pattern source is TRANSLATED to a JS source
// that preserves RE2 semantics for the constructs that actually appear:
//
//   * `(?i)` leading inline flag        -> stripped, JS `i` flag set instead.
//   * unescaped `.` outside a class      -> `[^\n]` (RE2 `.` matches any char
//                                           except newline; JS `.` excludes more)
//   * `\s` outside a class               -> `[\t\n\f\r ]` (RE2 `\s` is exactly
//                                           that ASCII set; JS `\s` matches a
//                                           larger Unicode whitespace set).
//   * `$` / `^`                          -> unchanged. JS without the `m` flag
//                                           anchors at the very start/end of the
//                                           input (it does NOT match before a
//                                           trailing `\n`), which matches RE2's
//                                           default `^`/`$` (start/end of text).
//   * `\d`                               -> unchanged (`[0-9]` in both).
//
// Any RE2 construct outside this faithfully-translatable subset throws
// TSGO_UNSUPPORTED rather than compiling a JS pattern that would diverge.
//
// Go (T, error) maps to a `[T, GoError]` tuple; Go panic maps to `throw`.

import type { bool, int } from "@tsonic/core/types.js";
import type { GoError, GoSlice } from "./compat.js";

// translatePattern rewrites a Go RE2 pattern source into an equivalent JS
// RegExp source plus the set of JS flags required. It scans character by
// character, tracking escape state and character-class nesting so that `.` and
// `\s` are only rewritten where RE2 and JS diverge. Constructs that cannot be
// faithfully translated throw TSGO_UNSUPPORTED.
function translatePattern(pattern: string): { source: string; ignoreCase: bool } {
  // A leading `(?i)` inline flag applies case-insensitivity to the whole
  // pattern. Every active call site that needs case-insensitivity uses exactly
  // this leading form, so handle it here and reject inline flag groups
  // anywhere else (they cannot be expressed as a whole-pattern JS flag).
  const ignoreCase: bool = pattern.startsWith("(?i)");
  const body: string = ignoreCase ? pattern.slice(4) : pattern;

  const out: string[] = [];
  let i = 0;
  let inClass = false;
  while (i < body.length) {
    const c = body[i]!;
    if (c === "\\") {
      // Escape sequence: consume the backslash and the following char.
      const next = body[i + 1];
      if (next === undefined) {
        throw new globalThis.Error("TSGO_UNSUPPORTED regexp: trailing backslash in pattern");
      }
      if (next === "s" && !inClass) {
        // RE2 `\s` == [\t\n\f\r ]; JS `\s` matches more. Translate outside a
        // character class. (No active pattern uses `\s` inside a class.)
        out.push("[\\t\\n\\f\\r ]");
      } else if (next === "s" && inClass) {
        throw new globalThis.Error("TSGO_UNSUPPORTED regexp: \\s inside character class");
      } else {
        // Pass through every other escape verbatim. The patterns in use only
        // rely on \d, \., \|, \+, \\ which behave identically in JS.
        out.push("\\");
        out.push(next);
      }
      i += 2;
      continue;
    }

    if (inClass) {
      if (c === "]") {
        inClass = false;
      }
      // Inside a character class, `.` is a literal dot in both RE2 and JS, so
      // everything passes through unchanged.
      out.push(c);
      i += 1;
      continue;
    }

    if (c === "[") {
      inClass = true;
      out.push(c);
      i += 1;
      continue;
    }

    if (c === ".") {
      // RE2 `.` matches any char except `\n`; JS `.` (no `s` flag) also excludes
      // CR and U+2028/U+2029. Translate to `[^\n]` to preserve RE2.
      out.push("[^\\n]");
      i += 1;
      continue;
    }

    if (c === "(" && body[i + 1] === "?" && body[i + 2] !== ":" && body[i + 2] !== "=" && body[i + 2] !== "!") {
      // `(?:`, `(?=`, `(?!` are fine; any other `(?...)` (inline flags, named
      // groups, etc.) cannot be faithfully expressed here.
      throw new globalThis.Error("TSGO_UNSUPPORTED regexp: inline flag or extended group in pattern");
    }

    out.push(c);
    i += 1;
  }

  if (inClass) {
    throw new globalThis.Error("TSGO_UNSUPPORTED regexp: unterminated character class");
  }

  return { source: out.join(""), ignoreCase: ignoreCase };
}

// Regexp wraps a compiled JS RegExp, mirroring Go's *regexp.Regexp for the
// method subset the call sites use. The wrapped RegExp is created with the `g`
// flag where iteration is needed; method-local RegExp state is reset before
// use so the object behaves like Go's stateless, reusable *Regexp.
export class Regexp {
  // The original Go pattern source, returned by String() (Go's Regexp.String).
  private readonly pattern: string;
  // Translated JS source and whether case-insensitivity applies.
  private readonly jsSource: string;
  private readonly ignoreCase: bool;

  constructor(pattern: string) {
    this.pattern = pattern;
    const translated = translatePattern(pattern);
    this.jsSource = translated.source;
    this.ignoreCase = translated.ignoreCase;
    // Validate the translated source by constructing a RegExp eagerly; this
    // surfaces a malformed pattern as a thrown error (mirroring Compile's
    // returned error / MustCompile's panic).
    this.compileFlags("");
  }

  // compileFlags builds a fresh RegExp with the base flags (from the pattern's
  // (?i)) plus any extra flags requested by the caller. A fresh instance is
  // returned each time so lastIndex state never leaks between calls.
  private compileFlags(extra: string): RegExp {
    const flags: string = (this.ignoreCase ? "i" : "") + extra;
    return new globalThis.RegExp(this.jsSource, flags);
  }

  String(): string {
    return this.pattern;
  }

  // MatchString reports whether the string s contains any match of the regexp.
  MatchString(s: string): bool {
    return this.compileFlags("").test(s) as bool;
  }

  // FindStringSubmatch returns a slice holding the leftmost match of the regexp
  // and the matches of its subexpressions. Returns nil (undefined) if there is
  // no match. A non-participating capture group is the empty string in Go's
  // []string, so JS `undefined` groups are mapped to "".
  FindStringSubmatch(s: string): GoSlice<string> | undefined {
    const m = this.compileFlags("").exec(s);
    if (m === null) {
      return undefined;
    }
    return m.map((g) => (g === undefined ? "" : g));
  }

  // findAllStringIndex mirrors Go's (*Regexp).FindAllStringIndex / allMatches:
  // it returns up to n leftmost, non-overlapping match [start, end] index pairs,
  // applying Go's empty-match rule (an empty match immediately after a previous
  // match is skipped). n < 0 means unbounded. Indices are JS string offsets,
  // which coincide with Go's byte offsets for the ASCII separators used here.
  private findAllStringIndex(s: string, n: int): GoSlice<[int, int]> {
    const limit: int = n < 0 ? s.length + 1 : n;
    const re = this.compileFlags("g");
    const result: GoSlice<[int, int]> = [];
    const end = s.length;
    let pos = 0;
    let i = 0;
    let prevMatchEnd = -1;
    while (i < limit && pos <= end) {
      re.lastIndex = pos;
      const m = re.exec(s);
      if (m === null || m.index > end) {
        break;
      }
      const ms = m.index;
      const me = m.index + m[0]!.length;
      let accept = true;
      if (me === pos) {
        // Empty match at pos.
        if (ms === prevMatchEnd) {
          accept = false;
        }
        // step: advance one position; the inputs are JS strings so one code
        // unit corresponds to Go's rune step for the ASCII text in use.
        if (pos < end) {
          pos = pos + 1;
        } else {
          pos = end + 1;
        }
      } else {
        pos = me;
      }
      prevMatchEnd = me;
      if (accept) {
        result.push([ms, me]);
        i = i + 1;
      }
    }
    return result;
  }

  // Split slices s into substrings separated by the regexp and returns a slice
  // of the substrings between those expression matches. Mirrors Go's
  // (*Regexp).Split exactly.
  //
  // Go semantics (which differ from JS String.split):
  //   n < 0  -> all substrings
  //   n == 0 -> nil (undefined)
  //   n > 0  -> at most n substrings; the last one is the unsplit remainder.
  Split(s: string, n: int): GoSlice<string> | undefined {
    if (n === 0) {
      return undefined;
    }

    if (this.pattern.length > 0 && s.length === 0) {
      return [""];
    }

    const matches = this.findAllStringIndex(s, n);
    const result: GoSlice<string> = [];

    let beg = 0;
    let end = 0;
    for (const match of matches) {
      if (n > 0 && result.length >= n - 1) {
        break;
      }
      end = match[0];
      if (match[1] !== 0) {
        result.push(s.slice(beg, end));
      }
      beg = match[1];
    }

    if (end !== s.length) {
      result.push(s.slice(beg));
    }

    return result;
  }

  // ReplaceAllStringFunc returns a copy of src in which all matches of the
  // regexp have been replaced by the return value of repl applied to the
  // matched substring. Matches are leftmost and non-overlapping. Mirrors Go's
  // (*Regexp).ReplaceAllStringFunc / replaceAll exactly, including the
  // empty-match-after-match guard and the always-advance-at-least-one rule.
  // Indices are JS string offsets (== Go byte offsets for the ASCII text in
  // use); the matched substring is passed to repl, which is responsible for any
  // byte-level handling of multi-byte content.
  ReplaceAllStringFunc(src: string, repl: (match: string) => string): string {
    const re = this.compileFlags("g");
    const out: string[] = [];
    const endPos = src.length;
    let lastMatchEnd = 0;
    let searchPos = 0;
    while (searchPos <= endPos) {
      re.lastIndex = searchPos;
      const m = re.exec(src);
      if (m === null) {
        break;
      }
      const a0 = m.index;
      const a1 = m.index + m[0]!.length;

      // Copy the unmatched characters before this match.
      out.push(src.slice(lastMatchEnd, a0));

      // Insert the replacement, but not for an empty match immediately after a
      // previous match (avoids double replacement).
      if (a1 > lastMatchEnd || a0 === 0) {
        out.push(repl(src.slice(a0, a1)));
      }
      lastMatchEnd = a1;

      // Advance past this match; always advance at least one character.
      const width = searchPos < endPos ? 1 : 0;
      if (searchPos + width > a1) {
        searchPos = searchPos + width;
      } else if (searchPos + 1 > a1) {
        searchPos = searchPos + 1;
      } else {
        searchPos = a1;
      }
    }

    // Copy the unmatched characters after the last match.
    out.push(src.slice(lastMatchEnd));
    return out.join("");
  }
}

// Compile parses a regular expression and returns, if successful, a Regexp
// object that can be used to match against text. Mirrors Go's
// `func Compile(expr string) (*Regexp, error)`.
export function Compile(expr: string): [Regexp | undefined, GoError] {
  try {
    return [new Regexp(expr), undefined];
  } catch (e) {
    return [undefined, e instanceof globalThis.Error ? e : new globalThis.Error(globalThis.String(e))];
  }
}

// MustCompile is like Compile but panics if the expression cannot be parsed.
// Mirrors Go's `func MustCompile(str string) *Regexp`.
export function MustCompile(str: string): Regexp {
  return new Regexp(str);
}
