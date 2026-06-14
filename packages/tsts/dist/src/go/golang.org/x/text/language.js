export const No = 0;
export const Low = 1;
export const High = 2;
export const Exact = 3;
export const Und = "";
export const English = "en";
export function Parse(value) {
    if (value === "") {
        return [Und, undefined];
    }
    try {
        const [canonical] = Intl.getCanonicalLocales(value);
        if (canonical === undefined) {
            return [Und, new globalThis.Error(`language: tag is not well-formed: ${value}`)];
        }
        return [canonical, undefined];
    }
    catch (error) {
        return [Und, normalizeError(error, value)];
    }
}
export function MustParse(value) {
    const [tag, err] = Parse(value);
    if (err !== undefined) {
        throw err;
    }
    return tag;
}
export function NewMatcher(tags) {
    const canonicalTags = tags.map((tag) => canonicalize(tag));
    return {
        Match(tag) {
            const requested = canonicalize(tag);
            if (requested === "") {
                const index = indexOf(canonicalTags, English);
                return [English, index, index >= 0 ? Low : No];
            }
            const exact = indexOf(canonicalTags, requested);
            if (exact >= 0) {
                return [canonicalTags[exact], exact, Exact];
            }
            const baseLanguage = requested.split("-")[0] ?? requested;
            const languageMatch = canonicalTags.findIndex((candidate) => candidate.split("-")[0] === baseLanguage);
            if (languageMatch >= 0) {
                return [canonicalTags[languageMatch], languageMatch, Low];
            }
            const english = indexOf(canonicalTags, English);
            if (english >= 0) {
                return [English, english, Low];
            }
            return [Und, -1, No];
        },
    };
}
function canonicalize(tag) {
    if (tag === Und) {
        return Und;
    }
    const [canonical, err] = Parse(tag);
    return err === undefined ? canonical : tag;
}
function indexOf(tags, tag) {
    return tags.findIndex((candidate) => candidate === tag);
}
function normalizeError(error, value) {
    if (error instanceof globalThis.Error) {
        return error;
    }
    return new globalThis.Error(`language: tag is not well-formed: ${value}`);
}
//# sourceMappingURL=language.js.map