import type { bool, int } from "@tsonic/core/types.js";
import type { GoError, GoSlice } from "../../../compat.js";

export type Tag = string & { readonly __goFacadeName: "golang.org/x/text/language.Tag" };
export type Confidence = int;

export const No: Confidence = 0 as Confidence;
export const Low: Confidence = 1 as Confidence;
export const High: Confidence = 2 as Confidence;
export const Exact: Confidence = 3 as Confidence;

export const Und: Tag = "" as Tag;
export const English: Tag = "en" as Tag;

export interface Matcher {
  Match(tag: Tag): [Tag, int, Confidence];
}

export function Parse(value: string): [Tag, GoError] {
  if (value === "") {
    return [Und, undefined];
  }
  try {
    const [canonical] = Intl.getCanonicalLocales(value);
    if (canonical === undefined) {
      return [Und, new globalThis.Error(`language: tag is not well-formed: ${value}`)];
    }
    return [canonical as Tag, undefined];
  } catch (error) {
    return [Und, normalizeError(error, value)];
  }
}

export function MustParse(value: string): Tag {
  const [tag, err] = Parse(value);
  if (err !== undefined) {
    throw err;
  }
  return tag;
}

export function NewMatcher(tags: GoSlice<Tag>): Matcher {
  const canonicalTags = tags.map((tag) => canonicalize(tag));
  return {
    Match(tag: Tag): [Tag, int, Confidence] {
      const requested = canonicalize(tag);
      if (requested === "") {
        const index = indexOf(canonicalTags, English);
        return [English, index, index >= 0 ? Low : No];
      }
      const exact = indexOf(canonicalTags, requested);
      if (exact >= 0) {
        return [canonicalTags[exact]!, exact as int, Exact];
      }
      const baseLanguage = requested.split("-")[0] ?? requested;
      const languageMatch = canonicalTags.findIndex((candidate) => candidate.split("-")[0] === baseLanguage);
      if (languageMatch >= 0) {
        return [canonicalTags[languageMatch]!, languageMatch as int, Low];
      }
      const english = indexOf(canonicalTags, English);
      if (english >= 0) {
        return [English, english, Low];
      }
      return [Und, -1 as int, No];
    },
  };
}

function canonicalize(tag: Tag): Tag {
  if (tag === Und) {
    return Und;
  }
  const [canonical, err] = Parse(tag as string);
  return err === undefined ? canonical : tag;
}

function indexOf(tags: GoSlice<Tag>, tag: Tag): int {
  return tags.findIndex((candidate) => candidate === tag) as int;
}

function normalizeError(error: unknown, value: string): GoError {
  if (error instanceof globalThis.Error) {
    return error;
  }
  return new globalThis.Error(`language: tag is not well-formed: ${value}`);
}
