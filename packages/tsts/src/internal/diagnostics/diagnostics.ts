// Package diagnostics contains generated localizable diagnostic messages.
//
// diagnostics.ts is the faithful 1:1 hand-port of TS-Go's
// internal/diagnostics/diagnostics.go. The generated message catalog
// (the ~2153 &Message{...} declarations + keyToMessage switch) is emitted
// separately by the porter:diagnostics generator into ./generated/messages.ts,
// mirroring how diagnostics_generated.go is produced by generate.go.

import type { bool, int } from "../../go/scalars.js";
import type { GoMap, GoPtr, GoSlice } from "../../go/compat.js";
import { Sprintf } from "../../go/fmt.js";
import * as regexp from "../../go/regexp.js";
import { ParseInt } from "../../go/strconv.js";
import { ToValidUTF8 } from "../../go/strings.js";
import { Map } from "../../go/sync.js";
import type { Tag } from "../../go/golang.org/x/text/language.js";
import { Und } from "../../go/golang.org/x/text/language.js";
import { SameMap } from "../core/core.js";
import type { Locale } from "../locale/locale.js";
import { loadMatchedLocaleMessages } from "./generated/loc.js";
import { keyToMessage } from "./generated/messages.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnostics/diagnostics.go::type::Category","kind":"type","status":"implemented","sigHash":"1960d11204bc296256417f7ea07bd7b5942396d8a42bf9cd600720f2d9d9ef89","bodyHash":"9ed85a7d5c8305a2a52d73283412548b073e28ea8abb464ed426ed1cf24edfa4"}
 *
 * Go source:
 * Category int32
 */
export type Category = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnostics/diagnostics.go::constGroup::CategoryWarning+CategoryError+CategorySuggestion+CategoryMessage","kind":"constGroup","status":"implemented","sigHash":"ec0a4f2f1e66c20fa5f85b843618f7d2ac22640f877a1edcea38731e629623f6","bodyHash":"1d73d259e6d3dd20dad70b8a37e090ea4950c4eade1ff58fc4c8f281c1bab88b"}
 *
 * Go source:
 * const (
 * 	CategoryWarning Category = iota
 * 	CategoryError
 * 	CategorySuggestion
 * 	CategoryMessage
 * )
 */
export const CategoryWarning: Category = 0;
export const CategoryError: Category = 1;
export const CategorySuggestion: Category = 2;
export const CategoryMessage: Category = 3;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnostics/diagnostics.go::method::Category.Name","kind":"method","status":"implemented","sigHash":"108f3bd2da25942df270790a2a30cc068cf7aa501e65c33d5afeaad582914920","bodyHash":"566d8301fe41b426550f971ffd25472f60aab02eb1bc7bef84c4de3b9f695690"}
 *
 * Go source:
 * func (category Category) Name() string {
 * 	switch category {
 * 	case CategoryWarning:
 * 		return "warning"
 * 	case CategoryError:
 * 		return "error"
 * 	case CategorySuggestion:
 * 		return "suggestion"
 * 	case CategoryMessage:
 * 		return "message"
 * 	}
 * 	panic("Unhandled diagnostic category")
 * }
 */
export function Category_Name(category: Category): string {
  switch (category) {
    case CategoryWarning:
      return "warning";
    case CategoryError:
      return "error";
    case CategorySuggestion:
      return "suggestion";
    case CategoryMessage:
      return "message";
  }
  throw new globalThis.Error("Unhandled diagnostic category");
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnostics/diagnostics.go::type::Key","kind":"type","status":"implemented","sigHash":"e5d0e9e9d84f816921a1a777155382a8de5e22940423814cd9fde57883114557","bodyHash":"8116d70899d0f2e878924414b202f2f869a6a96178635a65ac094ce45315fe00"}
 *
 * Go source:
 * Key string
 */
export type Key = string;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnostics/diagnostics.go::type::Message","kind":"type","status":"implemented","sigHash":"a05b801837f37f9f77d233878f4cf76702957e58f1f0d2ebead3dd26d36b5861","bodyHash":"bf4f4a72d8103bd1e15ec288b5cf66c29f0278fa07ce8a0284ef88ad31a240f9"}
 *
 * Go source:
 * Message struct {
 * 	code                         int32
 * 	category                     Category
 * 	key                          Key
 * 	text                         string
 * 	reportsUnnecessary           bool
 * 	elidedInCompatibilityPyramid bool
 * 	reportsDeprecated            bool
 * }
 */
export interface Message {
  code: int;
  category: Category;
  key: Key;
  text: string;
  reportsUnnecessary?: bool;
  elidedInCompatibilityPyramid?: bool;
  reportsDeprecated?: bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnostics/diagnostics.go::method::Message.Code","kind":"method","status":"implemented","sigHash":"640a8e501a394072dcac6d413cd63867f18e9cf1db1cf0cf6dbbe1c028616240","bodyHash":"0ba5a58e430ba6f785077729f858895f1cf20dd18f2703c3ce976f7973f75f75"}
 *
 * Go source:
 * func (m *Message) Code() int32                        { return m.code }
 */
export function Message_Code(m: GoPtr<Message>): int {
  return m!.code;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnostics/diagnostics.go::method::Message.Category","kind":"method","status":"implemented","sigHash":"3994c12cdc1c98da3c76d4ec79d45278534e3a40e3f72b837610614cb15a7cb3","bodyHash":"eac3b87d82d7f5c96e35589e04dc7915242402b36d45c3b58d86590518339293"}
 *
 * Go source:
 * func (m *Message) Category() Category                 { return m.category }
 */
export function Message_Category(m: GoPtr<Message>): Category {
  return m!.category;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnostics/diagnostics.go::method::Message.Key","kind":"method","status":"implemented","sigHash":"47c1cfec108a4976f59180ea1124897f068072ca8d5079e16be53b3f8802b06c","bodyHash":"02e511df23dc67444394dd216fed4c89aaceafb2d15687c85e249a1756c52597"}
 *
 * Go source:
 * func (m *Message) Key() Key                           { return m.key }
 */
export function Message_Key(m: GoPtr<Message>): Key {
  return m!.key;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnostics/diagnostics.go::method::Message.ReportsUnnecessary","kind":"method","status":"implemented","sigHash":"db14f472da1810823cb0ebdb51f23ec372b3e15f0bb2f68be35b53526532d741","bodyHash":"879e4b67d8d1a00da1804a3cbfd1438806177f3566e550e431c37bab6b981507"}
 *
 * Go source:
 * func (m *Message) ReportsUnnecessary() bool           { return m.reportsUnnecessary }
 */
export function Message_ReportsUnnecessary(m: GoPtr<Message>): bool {
  return (m!.reportsUnnecessary ?? false) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnostics/diagnostics.go::method::Message.ElidedInCompatibilityPyramid","kind":"method","status":"implemented","sigHash":"0a7766ab329c1d0816e7e54b337226b61cdbbc10766c831408c8cf27acab6b31","bodyHash":"2768492ead7cb829a234accb2bad345505c38eec0521aded7e188b9937a34d0d"}
 *
 * Go source:
 * func (m *Message) ElidedInCompatibilityPyramid() bool { return m.elidedInCompatibilityPyramid }
 */
export function Message_ElidedInCompatibilityPyramid(m: GoPtr<Message>): bool {
  return (m!.elidedInCompatibilityPyramid ?? false) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnostics/diagnostics.go::method::Message.ReportsDeprecated","kind":"method","status":"implemented","sigHash":"d411230f48c58c16e6bf3af672b4ba2429a1919022d5d45342ad3b505ce75f1a","bodyHash":"fb1b21d460f445f9bbc2c0da3a303fc3fa7884750e3a137a33e74c4d0c34fb30"}
 *
 * Go source:
 * func (m *Message) ReportsDeprecated() bool            { return m.reportsDeprecated }
 */
export function Message_ReportsDeprecated(m: GoPtr<Message>): bool {
  return (m!.reportsDeprecated ?? false) as bool;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnostics/diagnostics.go::method::Message.String","kind":"method","status":"implemented","sigHash":"f566569c9e35234f57320d9a05a9e7d5b40d19364c13d608c004be3445cee4ba","bodyHash":"00051c57e6c343775afc2c8e8d7c312b52b5a650523a283bd3d744e449a37995"}
 *
 * Go source:
 * func (m *Message) String() string {
 * 	return m.text
 * }
 */
export function Message_String(m: GoPtr<Message>): string {
  return m!.text;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnostics/diagnostics.go::method::Message.Localize","kind":"method","status":"implemented","sigHash":"8aaca1a246f230d3fa731416048b45ea68a0da91351ea65ee0a30415fea93f0c","bodyHash":"842a49c59737e0a54f2c6bc53aff9de93544642f2c31d0abd49a9c5a706a3c4a"}
 *
 * Go source:
 * func (m *Message) Localize(locale locale.Locale, args ...any) string {
 * 	return Localize(locale, m, "", StringifyArgs(args)...)
 * }
 */
export function Message_Localize(m: GoPtr<Message>, locale: Locale, ...args: Array<unknown>): string {
  return Localize(locale, m, "", ...StringifyArgs(args));
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnostics/diagnostics.go::func::Localize","kind":"func","status":"implemented","sigHash":"f8b5db38eaa0ed90e1d11a4e41f6293fc61bf3f9267565e3eb74136821d87181","bodyHash":"4724d4301b346850cdc8ec8daf7de0d53eb8c0156ab991054ec4453dc09c3d7d"}
 *
 * Go source:
 * func Localize(locale locale.Locale, message *Message, key Key, args ...string) string {
 * 	if message == nil {
 * 		message = keyToMessage(key)
 * 	}
 * 	if message == nil {
 * 		panic("Unknown diagnostic message: " + string(key))
 * 	}
 *
 * 	text := message.text
 * 	if localized, ok := getLocalizedMessages(language.Tag(locale))[message.key]; ok {
 * 		text = localized
 * 	}
 *
 * 	return Format(text, args)
 * }
 */
export function Localize(locale: Locale, message: GoPtr<Message>, key: Key, ...args: Array<string>): string {
  if (message === undefined) {
    message = keyToMessage(key);
  }
  if (message === undefined) {
    throw new globalThis.Error("Unknown diagnostic message: " + key);
  }

  let text = message.text;
  const localizedMessages = getLocalizedMessages(locale);
  const localized = localizedMessages?.get(message.key);
  if (localized !== undefined) {
    text = localized;
  }

  return Format(text, args);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnostics/diagnostics.go::varGroup::localizedMessagesCache","kind":"varGroup","status":"implemented","sigHash":"906df1cb73699858abcb438c57d96db64425fd2917e44637f6c0fcca821356f7","bodyHash":"093651b41111727927e039b3167bcaf45d52bb87807322a704bec38d3255ae25"}
 *
 * Go source:
 * var localizedMessagesCache sync.Map // map[language.Tag]map[Key]string
 */
export const localizedMessagesCache: Map<Tag, GoMap<Key, string> | undefined> = new Map<Tag, GoMap<Key, string> | undefined>();

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnostics/diagnostics.go::func::getLocalizedMessages","kind":"func","status":"implemented","sigHash":"938c8f866fbc7ee358e1b68eceb4d247f7dae4739f97723bc330ddc5a3047236","bodyHash":"79c121d4902ea2df4ae30c8163ca050fd98619c9fb79b1a85d5287003efc1cdb"}
 *
 * Go source:
 * func getLocalizedMessages(loc language.Tag) map[Key]string {
 * 	if loc == language.Und {
 * 		return nil
 * 	}
 *
 * 	// Check cache first
 * 	if cached, ok := localizedMessagesCache.Load(loc); ok {
 * 		if cached == nil {
 * 			return nil
 * 		}
 * 		return cached.(map[Key]string)
 * 	}
 *
 * 	var messages map[Key]string
 *
 * 	_, index, confidence := matcher.Match(loc)
 * 	if confidence >= language.Low && index >= 0 && index < len(localeFuncs) {
 * 		if fn := localeFuncs[index]; fn != nil {
 * 			messages = fn()
 * 		}
 * 	}
 *
 * 	localizedMessagesCache.Store(loc, messages)
 * 	return messages
 * }
 */
export function getLocalizedMessages(loc: Tag): GoMap<Key, string> | undefined {
  if (loc === Und) {
    return undefined;
  }
  const cached = localizedMessagesCache.Load(loc);
  if (cached[1]) {
    return cached[0];
  }
  const messages = loadMatchedLocaleMessages(loc);
  localizedMessagesCache.Store(loc, messages);
  return messages;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnostics/diagnostics.go::varGroup::placeholderRegexp","kind":"varGroup","status":"implemented","sigHash":"45ce797b9a21f93a274a325edfbc7b2aa0f8edb76175afcdae943c6125cad11f","bodyHash":"8a1cbecc09a4660787c863dc8b7186a3ab53e1484e516f69b5288535dab735ff"}
 *
 * Go source:
 * var placeholderRegexp = regexp.MustCompile(`{(\d+)}`)
 */
export const placeholderRegexp: regexp.Regexp = regexp.MustCompile("{(\\d+)}");

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnostics/diagnostics.go::func::Format","kind":"func","status":"implemented","sigHash":"8d0ebfd027fe9bdc6d80156a5f0e328da2c262f3f22071796afad2985f458936","bodyHash":"26677394f0f9f362b2c40aad56d500f24382cf9c597bd43576e032cac001c1b3"}
 *
 * Go source:
 * func Format(text string, args []string) string {
 * 	if len(args) == 0 {
 * 		return text
 * 	}
 *
 * 	// Replace invalid UTF-8 with Unicode replacement character
 * 	args = core.SameMap(args, func(arg string) string {
 * 		return strings.ToValidUTF8(arg, "�")
 * 	})
 *
 * 	return placeholderRegexp.ReplaceAllStringFunc(text, func(match string) string {
 * 		index, err := strconv.ParseInt(match[1:len(match)-1], 10, 0)
 * 		if err != nil || int(index) >= len(args) {
 * 			panic("Invalid formatting placeholder")
 * 		}
 * 		return args[int(index)]
 * 	})
 * }
 */
export function Format(text: string, args: GoSlice<string>): string {
  if (args.length === 0) {
    return text;
  }

  // Replace invalid UTF-8 with Unicode replacement character
  args = SameMap<string>(args, (arg: string): string => {
    return ToValidUTF8(arg, "�");
  });

  return placeholderRegexp.ReplaceAllStringFunc(text, (match: string): string => {
    const [index, err] = ParseInt(byteSlice(match, 1, (byteLen(match) - 1) as int), 10, 0);
    if (err !== undefined || (index as int) >= args.length) {
      throw new globalThis.Error("Invalid formatting placeholder");
    }
    return args[index as int]!;
  });
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/diagnostics/diagnostics.go::func::StringifyArgs","kind":"func","status":"implemented","sigHash":"41bd6330cf3741f51a654e441300548d780906716a750ff1b4969190f2dbc7ff","bodyHash":"22f82cbff781d3567cc9db16dd0655bba13846aff8c8ab19826a12ac951c9078"}
 *
 * Go source:
 * func StringifyArgs(args []any) []string {
 * 	if len(args) == 0 {
 * 		return nil
 * 	}
 *
 * 	result := make([]string, len(args))
 * 	for i, arg := range args {
 * 		if s, ok := arg.(string); ok {
 * 			result[i] = s
 * 		} else {
 * 			result[i] = fmt.Sprintf("%v", arg)
 * 		}
 * 	}
 * 	return result
 * }
 */
export function StringifyArgs(args: GoSlice<unknown>): GoSlice<string> {
  if (args.length === 0) {
    return [];
  }

  const result: GoSlice<string> = new globalThis.Array<string>(args.length);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (typeof arg === "string") {
      result[i] = arg;
    } else {
      result[i] = Sprintf("%v", arg);
    }
  }
  return result;
}

// Go byte-length / byte-slice helpers (mirroring the convention used in
// internal/jsnum/string.ts). `Format` slices the regexp placeholder match
// `match[1:len(match)-1]` with Go byte semantics; placeholder matches are
// ASCII (`{<digits>}`), so byte and code-unit offsets coincide.
const utf8Encoder = new globalThis.TextEncoder();
function byteLen(s: string): int {
  return utf8Encoder.encode(s).length as int;
}
function byteSlice(s: string, start: int, end: int): string {
  const bytes = utf8Encoder.encode(s);
  return new globalThis.TextDecoder().decode(bytes.slice(start as number, end as number));
}
