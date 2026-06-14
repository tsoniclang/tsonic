import * as errors from "../../go/errors.js";
import * as fmt from "../../go/fmt.js";
import * as strings from "../../go/strings.js";
import * as utf8 from "../../go/unicode/utf8.js";
// runeToString mirrors Go's string(rune) conversion: a valid rune yields its
// UTF-8 character, an invalid rune yields the Unicode replacement character.
const runeToString = (r) => {
    if (r < 0 || (r >= 0xd800 && r <= 0xdfff) || r > utf8.MaxRune) {
        return globalThis.String.fromCodePoint(utf8.RuneError);
    }
    return globalThis.String.fromCodePoint(r);
};
const newSlash = () => {
    const c = {
        __kind: "slash",
        String: () => slash_String({}),
    };
    return c;
};
const newLiteral = (value) => {
    const c = {
        __kind: "literal",
        value,
        String: () => literal_String(value),
    };
    return c;
};
const newStar = () => {
    const c = {
        __kind: "star",
        String: () => star_String({}),
    };
    return c;
};
const newAnyChar = () => {
    const c = {
        __kind: "anyChar",
        String: () => anyChar_String({}),
    };
    return c;
};
const newStarStar = () => {
    const c = {
        __kind: "starStar",
        String: () => starStar_String({}),
    };
    return c;
};
const newGroup = (value) => {
    const c = {
        __kind: "group",
        value,
        String: () => group_String(value),
    };
    return c;
};
const newCharRange = (value) => {
    const c = {
        __kind: "charRange",
        value,
        String: () => charRange_String(value),
    };
    return c;
};
// Type guards implementing Go's type switch over the element interface. The
// `in` operator narrows the structural Stringer and the literal `__kind`
// comparison selects the concrete carrier, mirroring Go's `elem.(type)`
// assertions without an unchecked cast.
const isSlashCarrier = (e) => "__kind" in e && e.__kind === "slash";
const isLiteralCarrier = (e) => "__kind" in e && e.__kind === "literal";
const isStarCarrier = (e) => "__kind" in e && e.__kind === "star";
const isAnyCharCarrier = (e) => "__kind" in e && e.__kind === "anyChar";
const isStarStarCarrier = (e) => "__kind" in e && e.__kind === "starStar";
const isGroupCarrier = (e) => "__kind" in e && e.__kind === "group";
const isCharRangeCarrier = (e) => "__kind" in e && e.__kind === "charRange";
// isSlash reports whether e is a slash element, the equivalent of Go's
// `e == (slash{})` value comparison.
const isSlash = (e) => isSlashCarrier(e);
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/glob/glob.go::func::Parse","kind":"func","status":"implemented","sigHash":"a87499459f66b51133a95a5ef548ec504513f9e8889d9eb89baf1462f7f7ea83","bodyHash":"250239f225da19487b39ced5bd86812fa2a8ff057e172f73addcffc7e78d6f93"}
 *
 * Go source:
 * func Parse(pattern string) (*Glob, error) {
 * 	g, _, err := parse(pattern, false)
 * 	return g, err
 * }
 */
export function Parse(pattern) {
    const [g, , err] = parse(pattern, false);
    return [g, err];
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/glob/glob.go::func::parse","kind":"func","status":"implemented","sigHash":"866f1a52349ba2273678c99bfe5eb7cd9b7d13848a0ea98f001df0d130e9120d","bodyHash":"2dcf3b5017eecd0638f9e6995273a410ddbd112bb1a9a0ffbf6f2cc8b7c40ec4"}
 *
 * Go source:
 * func parse(pattern string, nested bool) (*Glob, string, error) {
 * 	g := new(Glob)
 * 	for len(pattern) > 0 {
 * 		switch pattern[0] {
 * 		case '/':
 * 			pattern = pattern[1:]
 * 			g.elems = append(g.elems, slash{})
 *
 * 		case '*':
 * 			if len(pattern) > 1 && pattern[1] == '*' {
 * 				if (len(g.elems) > 0 && g.elems[len(g.elems)-1] != slash{}) || (len(pattern) > 2 && pattern[2] != '/') {
 * 					return nil, "", errors.New("** may only be adjacent to '/'")
 * 				}
 * 				pattern = pattern[2:]
 * 				g.elems = append(g.elems, starStar{})
 * 				break
 * 			}
 * 			pattern = pattern[1:]
 * 			g.elems = append(g.elems, star{})
 *
 * 		case '?':
 * 			pattern = pattern[1:]
 * 			g.elems = append(g.elems, anyChar{})
 *
 * 		case '{':
 * 			var gs group
 * 			for pattern[0] != '}' {
 * 				pattern = pattern[1:]
 * 				groupG, pat, err := parse(pattern, true)
 * 				if err != nil {
 * 					return nil, "", err
 * 				}
 * 				if len(pat) == 0 {
 * 					return nil, "", errors.New("unmatched '{'")
 * 				}
 * 				pattern = pat
 * 				gs = append(gs, groupG)
 * 			}
 * 			pattern = pattern[1:]
 * 			g.elems = append(g.elems, gs)
 *
 * 		case '}', ',':
 * 			if nested {
 * 				return g, pattern, nil
 * 			}
 * 			pattern = g.parseLiteral(pattern, false)
 *
 * 		case '[':
 * 			pattern = pattern[1:]
 * 			if len(pattern) == 0 {
 * 				return nil, "", errBadRange
 * 			}
 * 			negate := false
 * 			if pattern[0] == '!' {
 * 				pattern = pattern[1:]
 * 				negate = true
 * 			}
 * 			low, sz, err := readRangeRune(pattern)
 * 			if err != nil {
 * 				return nil, "", err
 * 			}
 * 			pattern = pattern[sz:]
 * 			if len(pattern) == 0 || pattern[0] != '-' {
 * 				return nil, "", errBadRange
 * 			}
 * 			pattern = pattern[1:]
 * 			high, sz, err := readRangeRune(pattern)
 * 			if err != nil {
 * 				return nil, "", err
 * 			}
 * 			pattern = pattern[sz:]
 * 			if len(pattern) == 0 || pattern[0] != ']' {
 * 				return nil, "", errBadRange
 * 			}
 * 			pattern = pattern[1:]
 * 			g.elems = append(g.elems, charRange{negate, low, high})
 *
 * 		default:
 * 			pattern = g.parseLiteral(pattern, nested)
 * 		}
 * 	}
 * 	return g, "", nil
 * }
 */
export function parse(pattern, nested) {
    const g = { elems: [] };
    while (pattern.length > 0) {
        switch (pattern[0]) {
            case "/": {
                pattern = pattern.slice(1);
                g.elems = [...g.elems, newSlash()];
                break;
            }
            case "*": {
                if (pattern.length > 1 && pattern[1] === "*") {
                    if ((g.elems.length > 0 && !isSlash(g.elems[g.elems.length - 1])) || (pattern.length > 2 && pattern[2] !== "/")) {
                        return [undefined, "", errors.New("** may only be adjacent to '/'")];
                    }
                    pattern = pattern.slice(2);
                    g.elems = [...g.elems, newStarStar()];
                    break;
                }
                pattern = pattern.slice(1);
                g.elems = [...g.elems, newStar()];
                break;
            }
            case "?": {
                pattern = pattern.slice(1);
                g.elems = [...g.elems, newAnyChar()];
                break;
            }
            case "{": {
                let gs = [];
                while (pattern[0] !== "}") {
                    pattern = pattern.slice(1);
                    const [groupG, pat, err] = parse(pattern, true);
                    if (err !== undefined) {
                        return [undefined, "", err];
                    }
                    if (pat.length === 0) {
                        return [undefined, "", errors.New("unmatched '{'")];
                    }
                    pattern = pat;
                    gs = [...gs, groupG];
                }
                pattern = pattern.slice(1);
                g.elems = [...g.elems, newGroup(gs)];
                break;
            }
            case "}":
            case ",": {
                if (nested) {
                    return [g, pattern, undefined];
                }
                pattern = Glob_parseLiteral(g, pattern, false);
                break;
            }
            case "[": {
                pattern = pattern.slice(1);
                if (pattern.length === 0) {
                    return [undefined, "", errBadRange];
                }
                let negate = false;
                if (pattern[0] === "!") {
                    pattern = pattern.slice(1);
                    negate = true;
                }
                const [low, sz0, err0] = readRangeRune(pattern);
                if (err0 !== undefined) {
                    return [undefined, "", err0];
                }
                pattern = pattern.slice(sz0);
                if (pattern.length === 0 || pattern[0] !== "-") {
                    return [undefined, "", errBadRange];
                }
                pattern = pattern.slice(1);
                const [high, sz1, err1] = readRangeRune(pattern);
                if (err1 !== undefined) {
                    return [undefined, "", err1];
                }
                pattern = pattern.slice(sz1);
                if (pattern.length === 0 || pattern[0] !== "]") {
                    return [undefined, "", errBadRange];
                }
                pattern = pattern.slice(1);
                g.elems = [...g.elems, newCharRange({ negate, low, high })];
                break;
            }
            default: {
                pattern = Glob_parseLiteral(g, pattern, nested);
                break;
            }
        }
    }
    return [g, "", undefined];
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/glob/glob.go::func::readRangeRune","kind":"func","status":"implemented","sigHash":"53f05a25e4f8f6a4d402ee7dbefe1a11687763a21c6d9613a53b90e7e276396e","bodyHash":"477d8346e6c8f43f1937f20acfda99ed210f8b39dbf2c63a88b9f06c96073419"}
 *
 * Go source:
 * func readRangeRune(input string) (rune, int, error) {
 * 	r, sz := utf8.DecodeRuneInString(input)
 * 	var err error
 * 	if r == utf8.RuneError {
 * 		// See the documentation for DecodeRuneInString.
 * 		switch sz {
 * 		case 0:
 * 			err = errBadRange
 * 		case 1:
 * 			err = errInvalidUTF8
 * 		}
 * 	}
 * 	return r, sz, err
 * }
 */
export function readRangeRune(input) {
    const [r, sz] = utf8.DecodeRuneInString(input);
    let err = undefined;
    if (r === utf8.RuneError) {
        // See the documentation for DecodeRuneInString.
        switch (sz) {
            case 0:
                err = errBadRange;
                break;
            case 1:
                err = errInvalidUTF8;
                break;
        }
    }
    return [r, sz, err];
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/glob/glob.go::varGroup::errBadRange+errInvalidUTF8","kind":"varGroup","status":"implemented","sigHash":"eae985e9b9936fc43171c11499a8d932c96a7b2dcb92ce0ff3a394d3dd97b997","bodyHash":"687ab73ed7ca5102736e28a0e2d9bb8517ac487be4ebd4d039b54255f6c61127"}
 *
 * Go source:
 * var (
 * 	errBadRange    = errors.New("'[' patterns must be of the form [x-y]")
 * 	errInvalidUTF8 = errors.New("invalid UTF-8 encoding")
 * )
 */
export let errBadRange = errors.New("'[' patterns must be of the form [x-y]");
export let errInvalidUTF8 = errors.New("invalid UTF-8 encoding");
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/glob/glob.go::method::Glob.parseLiteral","kind":"method","status":"implemented","sigHash":"94f5e60d0619ca4f856f2677e913ee8c3d3da618286398dc47623b4586272cae","bodyHash":"60facbe6281ac258d49d0301815412c7f859bdf5d9fbc6d84f79502167c88566"}
 *
 * Go source:
 * func (g *Glob) parseLiteral(pattern string, nested bool) string {
 * 	var specialChars string
 * 	if nested {
 * 		specialChars = "*?{[/},"
 * 	} else {
 * 		specialChars = "*?{[/"
 * 	}
 * 	end := strings.IndexAny(pattern, specialChars)
 * 	if end == -1 {
 * 		end = len(pattern)
 * 	}
 * 	g.elems = append(g.elems, literal(pattern[:end]))
 * 	return pattern[end:]
 * }
 */
export function Glob_parseLiteral(receiver, pattern, nested) {
    const g = receiver;
    let specialChars;
    if (nested) {
        specialChars = "*?{[/},";
    }
    else {
        specialChars = "*?{[/";
    }
    let end = strings.IndexAny(pattern, specialChars);
    if (end === -1) {
        end = pattern.length;
    }
    g.elems = [...g.elems, newLiteral(pattern.slice(0, end))];
    return pattern.slice(end);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/glob/glob.go::method::Glob.String","kind":"method","status":"implemented","sigHash":"caa6c19e0fcc6a5d8d23b62bfc6f9389bd5bda5e2264d0f2c28cdb1c0104ed4e","bodyHash":"97d353e715d9e914a47c2a84575a29f22a5f3c8140453c62efd58d0ec0b86ae2"}
 *
 * Go source:
 * func (g *Glob) String() string {
 * 	var b strings.Builder
 * 	for _, e := range g.elems {
 * 		fmt.Fprint(&b, e)
 * 	}
 * 	return b.String()
 * }
 */
export function Glob_String(receiver) {
    const g = receiver;
    const b = new strings.Builder();
    for (const e of g.elems) {
        fmt.Fprint(b, e);
    }
    return b.String();
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/glob/glob.go::method::slash.String","kind":"method","status":"implemented","sigHash":"2714665aeed48d6c99423dd589b2f89f0378109b48a7ed1145969de666565953","bodyHash":"cdeb4748e41d039c1fa7e911744c38137f4ce24d12346088a4b7d82ce55013f5"}
 *
 * Go source:
 * func (s slash) String() string    { return "/" }
 */
export function slash_String(receiver) {
    return "/";
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/glob/glob.go::method::literal.String","kind":"method","status":"implemented","sigHash":"c7cc77f01e3ebdd6759083bcc919bf478ce88b588192d7e4d77a52cfb5d6fae6","bodyHash":"75880a2776f6f1be96d4511beec634591a66fd9e9341fe8d80a0dbc4fdd183ce"}
 *
 * Go source:
 * func (l literal) String() string  { return string(l) }
 */
export function literal_String(receiver) {
    return receiver;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/glob/glob.go::method::star.String","kind":"method","status":"implemented","sigHash":"acd8e053b22c4e3ab63e6aaf1558688dd49906c248fb60bb5af34fc6a3661a61","bodyHash":"ac09f0ebd081af496dbe544f16b5e473c1c1d3212fd62bdba8810a0aa33756c0"}
 *
 * Go source:
 * func (s star) String() string     { return "*" }
 */
export function star_String(receiver) {
    return "*";
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/glob/glob.go::method::anyChar.String","kind":"method","status":"implemented","sigHash":"1fb1e4afb0e304d99c8570f3e6a9cbf7afd6e73dac73a78771ac8177e11b2600","bodyHash":"85c7d7e273fa689936875ef6494fd7b63bb1c491eaa214159d8a4e27335eef64"}
 *
 * Go source:
 * func (a anyChar) String() string  { return "?" }
 */
export function anyChar_String(receiver) {
    return "?";
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/glob/glob.go::method::starStar.String","kind":"method","status":"implemented","sigHash":"eb487143deb947e26eb504e2e4343fec6089aaa140ec454934b44eeb5c79d379","bodyHash":"2ff095c05fbadf0c0b07bff5171c94d43ce8fbe60477a56c08069babcda0d543"}
 *
 * Go source:
 * func (s starStar) String() string { return "**" }
 */
export function starStar_String(receiver) {
    return "**";
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/glob/glob.go::method::group.String","kind":"method","status":"implemented","sigHash":"4e2a53a6849eb882ef9733fb4f1a94b06c90539d8006846603ee225f0720495e","bodyHash":"16d0e99f415b1d864b09fabc8ed01864362c08d1269837f59ecf133db3bd53ab"}
 *
 * Go source:
 * func (g group) String() string {
 * 	var parts []string
 * 	for _, g := range g {
 * 		parts = append(parts, g.String())
 * 	}
 * 	return "{" + strings.Join(parts, ",") + "}"
 * }
 */
export function group_String(receiver) {
    let parts = [];
    for (const g of receiver) {
        parts = [...parts, Glob_String(g)];
    }
    return "{" + strings.Join(parts, ",") + "}";
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/glob/glob.go::method::charRange.String","kind":"method","status":"implemented","sigHash":"a555aae52d097d7a11bebdfcdbba3e7b5e8a5d6af072eea2d6eba6cd3cc71160","bodyHash":"b45df2ad6a73002e1c88ff76df504c9c34716f171fc864eebd3d1bf6e9c8fb50"}
 *
 * Go source:
 * func (r charRange) String() string {
 * 	return "[" + string(r.low) + "-" + string(r.high) + "]"
 * }
 */
export function charRange_String(receiver) {
    return "[" + runeToString(receiver.low) + "-" + runeToString(receiver.high) + "]";
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/glob/glob.go::method::Glob.Match","kind":"method","status":"implemented","sigHash":"d3e53b47f623a72c00e91431235562c76daf9dee1ba168cbf327824df0bd5c12","bodyHash":"b14cdc9717ce247b62cf7907d6ed09f25cfec7c41225115b2f65ce1e1ae451cc"}
 *
 * Go source:
 * func (g *Glob) Match(input string) bool {
 * 	return match(g.elems, input)
 * }
 */
export function Glob_Match(receiver, input) {
    const g = receiver;
    return match(g.elems, input);
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/glob/glob.go::func::match","kind":"func","status":"implemented","sigHash":"085593b900998550bec88606f8e4eda14f6c2bc4a840a2e3f505324ab6ba1f6b","bodyHash":"785a22d2e4691ed0f70af04b235e0f66ad023e130f7420bd2bb60a80f6d71ff8"}
 *
 * Go source:
 * func match(elems []element, input string) (ok bool) {
 * 	var elem any
 * 	for len(elems) > 0 {
 * 		elem, elems = elems[0], elems[1:]
 * 		switch elem := elem.(type) {
 * 		case slash:
 * 			if len(input) == 0 || input[0] != '/' {
 * 				return false
 * 			}
 * 			for input[0] == '/' {
 * 				input = input[1:]
 * 			}
 *
 * 		case starStar:
 * 			// Special cases:
 * 			//  - ** /a matches "a"
 * 			//  - ** / matches everything
 * 			//
 * 			// Note that if ** is followed by anything, it must be '/' (this is
 * 			// enforced by Parse).
 * 			if len(elems) > 0 {
 * 				elems = elems[1:]
 * 			}
 *
 * 			// A trailing ** matches anything.
 * 			if len(elems) == 0 {
 * 				return true
 * 			}
 *
 * 			// Backtracking: advance pattern segments until the remaining pattern
 * 			// elements match.
 * 			for len(input) != 0 {
 * 				if match(elems, input) {
 * 					return true
 * 				}
 * 				_, input = split(input)
 * 			}
 * 			return false
 *
 * 		case literal:
 * 			if !strings.HasPrefix(input, string(elem)) {
 * 				return false
 * 			}
 * 			input = input[len(elem):]
 *
 * 		case star:
 * 			var segInput string
 * 			segInput, input = split(input)
 *
 * 			elemEnd := len(elems)
 * 			for i, e := range elems {
 * 				if e == (slash{}) {
 * 					elemEnd = i
 * 					break
 * 				}
 * 			}
 * 			segElems := elems[:elemEnd]
 * 			elems = elems[elemEnd:]
 *
 * 			// A trailing * matches the entire segment.
 * 			if len(segElems) == 0 {
 * 				break
 * 			}
 *
 * 			// Backtracking: advance characters until remaining subpattern elements
 * 			// match.
 * 			matched := false
 * 			for i := range len(segInput) {
 * 				if match(segElems, segInput[i:]) {
 * 					matched = true
 * 					break
 * 				}
 * 			}
 * 			if !matched {
 * 				return false
 * 			}
 *
 * 		case anyChar:
 * 			if len(input) == 0 || input[0] == '/' {
 * 				return false
 * 			}
 * 			input = input[1:]
 *
 * 		case group:
 * 			// Append remaining pattern elements to each group member looking for a
 * 			// match.
 * 			var branch []element
 * 			for _, m := range elem {
 * 				branch = branch[:0]
 * 				branch = append(branch, m.elems...)
 * 				branch = append(branch, elems...)
 * 				if match(branch, input) {
 * 					return true
 * 				}
 * 			}
 * 			return false
 *
 * 		case charRange:
 * 			if len(input) == 0 || input[0] == '/' {
 * 				return false
 * 			}
 * 			c, sz := utf8.DecodeRuneInString(input)
 * 			if c < elem.low || c > elem.high {
 * 				return false
 * 			}
 * 			input = input[sz:]
 *
 * 		default:
 * 			panic(fmt.Sprintf("segment type %T not implemented", elem))
 * 		}
 * 	}
 *
 * 	return len(input) == 0
 * }
 */
export function match(elems, input) {
    while (elems.length > 0) {
        const elem = elems[0];
        elems = elems.slice(1);
        if (isSlashCarrier(elem)) {
            if (input.length === 0 || input[0] !== "/") {
                return false;
            }
            while (input[0] === "/") {
                input = input.slice(1);
            }
        }
        else if (isStarStarCarrier(elem)) {
            // Special cases:
            //  - **/a matches "a"
            //  - **/ matches everything
            //
            // Note that if ** is followed by anything, it must be '/' (this is
            // enforced by Parse).
            if (elems.length > 0) {
                elems = elems.slice(1);
            }
            // A trailing ** matches anything.
            if (elems.length === 0) {
                return true;
            }
            // Backtracking: advance pattern segments until the remaining pattern
            // elements match.
            while (input.length !== 0) {
                if (match(elems, input)) {
                    return true;
                }
                [, input] = split(input);
            }
            return false;
        }
        else if (isLiteralCarrier(elem)) {
            if (!strings.HasPrefix(input, elem.value)) {
                return false;
            }
            input = input.slice(elem.value.length);
        }
        else if (isStarCarrier(elem)) {
            let segInput;
            [segInput, input] = split(input);
            let elemEnd = elems.length;
            for (let i = 0; i < elems.length; i++) {
                const e = elems[i];
                if (isSlash(e)) {
                    elemEnd = i;
                    break;
                }
            }
            const segElems = elems.slice(0, elemEnd);
            elems = elems.slice(elemEnd);
            // A trailing * matches the entire segment.
            if (segElems.length === 0) {
                continue;
            }
            // Backtracking: advance characters until remaining subpattern elements
            // match.
            let matched = false;
            for (let i = 0; i < segInput.length; i++) {
                if (match(segElems, segInput.slice(i))) {
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                return false;
            }
        }
        else if (isAnyCharCarrier(elem)) {
            if (input.length === 0 || input[0] === "/") {
                return false;
            }
            input = input.slice(1);
        }
        else if (isGroupCarrier(elem)) {
            // Append remaining pattern elements to each group member looking for a
            // match.
            let branch = [];
            for (const m of elem.value) {
                branch = branch.slice(0, 0);
                branch = [...branch, ...m.elems];
                branch = [...branch, ...elems];
                if (match(branch, input)) {
                    return true;
                }
            }
            return false;
        }
        else if (isCharRangeCarrier(elem)) {
            if (input.length === 0 || input[0] === "/") {
                return false;
            }
            const [c, sz] = utf8.DecodeRuneInString(input);
            if (c < elem.value.low || c > elem.value.high) {
                return false;
            }
            input = input.slice(sz);
        }
        else {
            throw new globalThis.Error(fmt.Sprintf("segment type %T not implemented", elem));
        }
    }
    return input.length === 0;
}
/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/glob/glob.go::func::split","kind":"func","status":"implemented","sigHash":"d6c4a499bb2139bc00e6f8009bab92f16ca4450948f133a328d0bd6b3b5162c9","bodyHash":"5d77801ac4ecd91df880f6c514f77f095084c365d1791736f5f18793d4652edd"}
 *
 * Go source:
 * func split(input string) (first, rest string) {
 * 	i := strings.IndexByte(input, '/')
 * 	if i < 0 {
 * 		return input, ""
 * 	}
 * 	first = input[:i]
 * 	for j := i; j < len(input); j++ {
 * 		if input[j] != '/' {
 * 			return first, input[j:]
 * 		}
 * 	}
 * 	return first, ""
 * }
 */
export function split(input) {
    const i = strings.IndexByte(input, "/".charCodeAt(0));
    if (i < 0) {
        return [input, ""];
    }
    const first = input.slice(0, i);
    for (let j = i; j < input.length; j++) {
        if (input[j] !== "/") {
            return [first, input.slice(j)];
        }
    }
    return [first, ""];
}
//# sourceMappingURL=glob.js.map