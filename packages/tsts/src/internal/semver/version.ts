import type { int, uint } from "../../go/scalars.js";
import type { GoError, GoPtr, GoSlice } from "../../go/compat.js";
import * as cmp from "../../go/cmp.js";
import * as fmt from "../../go/fmt.js";
import * as regexp from "../../go/regexp.js";
import * as slices from "../../go/slices.js";
import * as strconv from "../../go/strconv.js";
import * as strings from "../../go/strings.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/semver/version.go::varGroup::versionRegexp","kind":"varGroup","status":"implemented","sigHash":"496edea2c95895fe8bd8f36ae58187dc438cf18ed83306ff7f8ca72685e84760","bodyHash":"a595cd41a1cecb8e821997218c8db2f2ee7bc126bafa0915aae00f42b803f38f"}
 *
 * Go source:
 * var versionRegexp = regexp.MustCompile(`(?i)^(0|[1-9]\d*)(?:\.(0|[1-9]\d*)(?:\.(0|[1-9]\d*)(?:-([a-z0-9-.]+))?(?:\+([a-z0-9-.]+))?)?)?$`)
 */
export const versionRegexp: regexp.Regexp = regexp.MustCompile(
  `(?i)^(0|[1-9]\\d*)(?:\\.(0|[1-9]\\d*)(?:\\.(0|[1-9]\\d*)(?:-([a-z0-9-.]+))?(?:\\+([a-z0-9-.]+))?)?)?$`,
);

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/semver/version.go::varGroup::prereleaseRegexp+prereleasePartRegexp","kind":"varGroup","status":"implemented","sigHash":"9fce1c887723e786f9907f541ff273544628399b68c12dfa2c6f84ec547561e3","bodyHash":"ccac4142d6409af1cdeb312f50cabd8ffb755da3b63bc7f6c57c521590d4765b"}
 *
 * Go source:
 * var (
 * 	prereleaseRegexp     = regexp.MustCompile(`(?i)^(?:0|[1-9]\d*|[a-z-][a-z0-9-]*)(?:\.(?:0|[1-9]\d*|[a-zA-Z-][a-zA-Z0-9-]*))*$`)
 * 	prereleasePartRegexp = regexp.MustCompile(`(?i)^(?:0|[1-9]\d*|[a-z-][a-z0-9-]*)$`)
 * )
 */
export const prereleaseRegexp: regexp.Regexp = regexp.MustCompile(
  `(?i)^(?:0|[1-9]\\d*|[a-z-][a-z0-9-]*)(?:\\.(?:0|[1-9]\\d*|[a-zA-Z-][a-zA-Z0-9-]*))*$`,
);
export const prereleasePartRegexp: regexp.Regexp = regexp.MustCompile(
  `(?i)^(?:0|[1-9]\\d*|[a-z-][a-z0-9-]*)$`,
);

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/semver/version.go::varGroup::buildRegExp+buildPartRegExp","kind":"varGroup","status":"implemented","sigHash":"eaedef8ac94e70695fd372ccb54d5f775da0280855f028a4860a018b5d1e188c","bodyHash":"a8d36cdde644761461d28a017cb0d48fdc7986fcc8e996903eb408920c5c9795"}
 *
 * Go source:
 * var (
 * 	buildRegExp     = regexp.MustCompile(`(?i)^[a-z0-9-]+(?:\.[a-z0-9-]+)*$`)
 * 	buildPartRegExp = regexp.MustCompile(`(?i)^[a-z0-9-]+$`)
 * )
 */
export const buildRegExp: regexp.Regexp = regexp.MustCompile(
  `(?i)^[a-z0-9-]+(?:\\.[a-z0-9-]+)*$`,
);
export const buildPartRegExp: regexp.Regexp = regexp.MustCompile(
  `(?i)^[a-z0-9-]+$`,
);

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/semver/version.go::varGroup::numericIdentifierRegExp","kind":"varGroup","status":"implemented","sigHash":"f044ff6829f467fd2354900c2c6eccdd73d58a030f9087c8958c6c3c6b7e2162","bodyHash":"41912c0bfa86d45cc1bfb6e85a58231c1281ecd02c6c971b2124522059043507"}
 *
 * Go source:
 * var numericIdentifierRegExp = regexp.MustCompile(`^(?:0|[1-9]\d*)$`)
 */
export const numericIdentifierRegExp: regexp.Regexp = regexp.MustCompile(
  `^(?:0|[1-9]\\d*)$`,
);

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/semver/version.go::type::Version","kind":"type","status":"implemented","sigHash":"ca5945c6b620ca64e9ee2f71e3d62fc5b1474ea27516ca8d70540bc3b09c5e25","bodyHash":"a972480db15a6da3c0a8b9f20903dc858a70b37017e88f07f40ad74afcc9f97c"}
 *
 * Go source:
 * Version struct {
 * 	major      uint32
 * 	minor      uint32
 * 	patch      uint32
 * 	prerelease []string
 * 	build      []string
 * }
 */
export interface Version {
  major: uint;
  minor: uint;
  patch: uint;
  prerelease: GoSlice<string>;
  build: GoSlice<string>;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/semver/version.go::varGroup::versionZero","kind":"varGroup","status":"implemented","sigHash":"a0355bc1b2d9253096d4b157c3228d5fa5c4f2906e7ac39c09ff41b0c291414e","bodyHash":"01b92de60e6733ed658048815c42ce314e2066d13c4a2a74322bf2a373b7c001"}
 *
 * Go source:
 * var versionZero = Version{
 * 	prerelease: []string{"0"},
 * }
 */
export const versionZero: Version = {
  major: 0,
  minor: 0,
  patch: 0,
  prerelease: ["0"],
  build: [],
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/semver/version.go::method::Version.incrementMajor","kind":"method","status":"implemented","sigHash":"d20feb5885d7e19d6ab91e95cf4af503f99fe11920bd1a5551f9b54aebc36945","bodyHash":"df364b015b87f99eadb2beef68928eb82576dd536fe80d99df449bdbee73e32f"}
 *
 * Go source:
 * func (v *Version) incrementMajor() Version {
 * 	return Version{
 * 		major: v.major + 1,
 * 	}
 * }
 */
export function Version_incrementMajor(receiver: GoPtr<Version>): Version {
  const v: Version = receiver!;
  return {
    major: v.major + 1,
    minor: 0,
    patch: 0,
    prerelease: [],
    build: [],
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/semver/version.go::method::Version.incrementMinor","kind":"method","status":"implemented","sigHash":"e06bda508928e5991514aabdd8ba79294c292653e637ae068c10b03e34f26e07","bodyHash":"dabbedb7ca489636c2af05019c20cbd53b46bef58d2a9cd76be9b46297b08b03"}
 *
 * Go source:
 * func (v *Version) incrementMinor() Version {
 * 	return Version{
 * 		major: v.major,
 * 		minor: v.minor + 1,
 * 	}
 * }
 */
export function Version_incrementMinor(receiver: GoPtr<Version>): Version {
  const v: Version = receiver!;
  return {
    major: v.major,
    minor: v.minor + 1,
    patch: 0,
    prerelease: [],
    build: [],
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/semver/version.go::method::Version.incrementPatch","kind":"method","status":"implemented","sigHash":"623ee73fdb94d0ae987de4b9d3195e76e91979f5e7bde4ef2de2b0f70b8dcf65","bodyHash":"6332920ddfa38c0eba88146948b9a98017aef35d20c2de15f35125c142045f5b"}
 *
 * Go source:
 * func (v *Version) incrementPatch() Version {
 * 	return Version{
 * 		major: v.major,
 * 		minor: v.minor,
 * 		patch: v.patch + 1,
 * 	}
 * }
 */
export function Version_incrementPatch(receiver: GoPtr<Version>): Version {
  const v: Version = receiver!;
  return {
    major: v.major,
    minor: v.minor,
    patch: v.patch + 1,
    prerelease: [],
    build: [],
  };
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/semver/version.go::constGroup::comparisonLessThan+comparisonEqualTo+comparisonGreaterThan","kind":"constGroup","status":"implemented","sigHash":"0083704aec81dce43d9f8c8d04f56e165772696e6d5fea1f7ab2d14f2adf749d","bodyHash":"909b59afa8625afe1d60aafc6870397e2b4b7804b69a5a4400a5f2aa5484ccd5"}
 *
 * Go source:
 * const (
 * 	comparisonLessThan    = -1
 * 	comparisonEqualTo     = 0
 * 	comparisonGreaterThan = 1
 * )
 */
export const comparisonLessThan: int = -1;
export const comparisonEqualTo: int = 0;
export const comparisonGreaterThan: int = 1;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/semver/version.go::method::Version.Compare","kind":"method","status":"implemented","sigHash":"b2e3fbc197fd83d04114c78e4be11333ebcf43aaf8185a05d54b1f5a6dc41807","bodyHash":"e472ff9c8cabe207142f5f1d9b727d63af17636d3707723c685e4e6b27cab221"}
 *
 * Go source:
 * func (a *Version) Compare(b *Version) int {
 * 	// https://semver.org/#spec-item-11
 * 	// > Precedence is determined by the first difference when comparing each of these
 * 	// > identifiers from left to right as follows: Major, minor, and patch versions are
 * 	// > always compared numerically.
 * 	//
 * 	// https://semver.org/#spec-item-11
 * 	// > Precedence for two pre-release versions with the same major, minor, and patch version
 * 	// > MUST be determined by comparing each dot separated identifier from left to right until
 * 	// > a difference is found [...]
 * 	//
 * 	// https://semver.org/#spec-item-11
 * 	// > Build metadata does not figure into precedence
 * 	switch {
 * 	case a == b:
 * 		return comparisonEqualTo
 * 	case a == nil:
 * 		return comparisonLessThan
 * 	case b == nil:
 * 		return comparisonGreaterThan
 * 	}
 * 
 * 	r := cmp.Compare(a.major, b.major)
 * 	if r != 0 {
 * 		return r
 * 	}
 * 
 * 	r = cmp.Compare(a.minor, b.minor)
 * 	if r != 0 {
 * 		return r
 * 	}
 * 
 * 	r = cmp.Compare(a.patch, b.patch)
 * 	if r != 0 {
 * 		return r
 * 	}
 * 
 * 	return comparePreReleaseIdentifiers(a.prerelease, b.prerelease)
 * }
 */
export function Version_Compare(receiver: GoPtr<Version>, b: GoPtr<Version>): int {
  const a: GoPtr<Version> = receiver;
  // https://semver.org/#spec-item-11
  // > Precedence is determined by the first difference when comparing each of these
  // > identifiers from left to right as follows: Major, minor, and patch versions are
  // > always compared numerically.
  //
  // https://semver.org/#spec-item-11
  // > Precedence for two pre-release versions with the same major, minor, and patch version
  // > MUST be determined by comparing each dot separated identifier from left to right until
  // > a difference is found [...]
  //
  // https://semver.org/#spec-item-11
  // > Build metadata does not figure into precedence
  if (a === b) {
    return comparisonEqualTo;
  } else if (a === undefined) {
    return comparisonLessThan;
  } else if (b === undefined) {
    return comparisonGreaterThan;
  }

  let r: int = cmp.Compare(a.major, b.major);
  if (r !== 0) {
    return r;
  }

  r = cmp.Compare(a.minor, b.minor);
  if (r !== 0) {
    return r;
  }

  r = cmp.Compare(a.patch, b.patch);
  if (r !== 0) {
    return r;
  }

  return comparePreReleaseIdentifiers(a.prerelease, b.prerelease);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/semver/version.go::func::comparePreReleaseIdentifiers","kind":"func","status":"implemented","sigHash":"0df48a33e495fff4ad8f02d69ac68a2ae10586d1ce8ff9d66543f52b42037dfc","bodyHash":"330efa8cab5bea6cd574682d773ce1b31bb0588956c7901f96d1dfb17a7a2634"}
 *
 * Go source:
 * func comparePreReleaseIdentifiers(left, right []string) int {
 * 	// https://semver.org/#spec-item-11
 * 	// > When major, minor, and patch are equal, a pre-release version has lower precedence
 * 	// > than a normal version.
 * 	if len(left) == 0 {
 * 		if len(right) == 0 {
 * 			return comparisonEqualTo
 * 		}
 * 		return comparisonGreaterThan
 * 	} else if len(right) == 0 {
 * 		return comparisonLessThan
 * 	}
 * 
 * 	// https://semver.org/#spec-item-11
 * 	// > Precedence for two pre-release versions with the same major, minor, and patch version
 * 	// > MUST be determined by comparing each dot separated identifier from left to right until
 * 	// > a difference is found [...]
 * 	return slices.CompareFunc(left, right, comparePreReleaseIdentifier)
 * }
 */
export function comparePreReleaseIdentifiers(left: GoSlice<string>, right: GoSlice<string>): int {
  // https://semver.org/#spec-item-11
  // > When major, minor, and patch are equal, a pre-release version has lower precedence
  // > than a normal version.
  if (left.length === 0) {
    if (right.length === 0) {
      return comparisonEqualTo;
    }
    return comparisonGreaterThan;
  } else if (right.length === 0) {
    return comparisonLessThan;
  }

  // https://semver.org/#spec-item-11
  // > Precedence for two pre-release versions with the same major, minor, and patch version
  // > MUST be determined by comparing each dot separated identifier from left to right until
  // > a difference is found [...]
  return slices.CompareFunc(left, right, comparePreReleaseIdentifier);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/semver/version.go::func::comparePreReleaseIdentifier","kind":"func","status":"implemented","sigHash":"a63c0c87d2c3408292f897c7c94ba228dec267177858522e12211264b9f1e44f","bodyHash":"5f8f83149df501189b48f018b34bc1167f25c2276af845735e7c860c953adac0"}
 *
 * Go source:
 * func comparePreReleaseIdentifier(left, right string) int {
 * 	// https://semver.org/#spec-item-11
 * 	// > Precedence for two pre-release versions with the same major, minor, and patch version
 * 	// > MUST be determined by comparing each dot separated identifier from left to right until
 * 	// > a difference is found [...]
 * 	compareResult := strings.Compare(left, right)
 * 	if compareResult == 0 {
 * 		return compareResult
 * 	}
 * 
 * 	leftIsNumeric := numericIdentifierRegExp.MatchString(left)
 * 	rightIsNumeric := numericIdentifierRegExp.MatchString(right)
 * 
 * 	if leftIsNumeric || rightIsNumeric {
 * 		// https://semver.org/#spec-item-11
 * 		// > Numeric identifiers always have lower precedence than non-numeric identifiers.
 * 		if !rightIsNumeric {
 * 			return comparisonLessThan
 * 		}
 * 		if !leftIsNumeric {
 * 			return comparisonGreaterThan
 * 		}
 * 
 * 		// https://semver.org/#spec-item-11
 * 		// > identifiers consisting of only digits are compared numerically
 * 		leftAsNumber, leftErr := getUintComponent(left)
 * 		rightAsNumber, rightErr := getUintComponent(right)
 * 		if leftErr != nil || rightErr != nil {
 * 			// This should only happen in the event of an overflow.
 * 			// If so, use the lengths or fall back to string comparison.
 * 			leftLen := len(left)
 * 			rightLen := len(right)
 * 			lenCompare := cmp.Compare(leftLen, rightLen)
 * 			if lenCompare == 0 {
 * 				return compareResult
 * 			} else {
 * 				return lenCompare
 * 			}
 * 		}
 * 		return cmp.Compare(leftAsNumber, rightAsNumber)
 * 	}
 * 
 * 	// https://semver.org/#spec-item-11
 * 	// > identifiers with letters or hyphens are compared lexically in ASCII sort order.
 * 	return compareResult
 * }
 */
export function comparePreReleaseIdentifier(left: string, right: string): int {
  // https://semver.org/#spec-item-11
  // > Precedence for two pre-release versions with the same major, minor, and patch version
  // > MUST be determined by comparing each dot separated identifier from left to right until
  // > a difference is found [...]
  const compareResult: int = strings.Compare(left, right);
  if (compareResult === 0) {
    return compareResult;
  }

  const leftIsNumeric: boolean = numericIdentifierRegExp.MatchString(left);
  const rightIsNumeric: boolean = numericIdentifierRegExp.MatchString(right);

  if (leftIsNumeric || rightIsNumeric) {
    // https://semver.org/#spec-item-11
    // > Numeric identifiers always have lower precedence than non-numeric identifiers.
    if (!rightIsNumeric) {
      return comparisonLessThan;
    }
    if (!leftIsNumeric) {
      return comparisonGreaterThan;
    }

    // https://semver.org/#spec-item-11
    // > identifiers consisting of only digits are compared numerically
    const [leftAsNumber, leftErr] = getUintComponent(left);
    const [rightAsNumber, rightErr] = getUintComponent(right);
    if (leftErr !== undefined || rightErr !== undefined) {
      // This should only happen in the event of an overflow.
      // If so, use the lengths or fall back to string comparison.
      const leftLen: int = left.length;
      const rightLen: int = right.length;
      const lenCompare: int = cmp.Compare(leftLen, rightLen);
      if (lenCompare === 0) {
        return compareResult;
      } else {
        return lenCompare;
      }
    }
    return cmp.Compare(leftAsNumber, rightAsNumber);
  }

  // https://semver.org/#spec-item-11
  // > identifiers with letters or hyphens are compared lexically in ASCII sort order.
  return compareResult;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/semver/version.go::method::Version.String","kind":"method","status":"implemented","sigHash":"e09ff4c9bca9e8058e9a702afb5c6752540f651b1e5010091f7464185bd9e441","bodyHash":"f8291c4b93d83f78ce8a7a2eb06d26b0570f3deceef246084a7ed0ad8e467b1e"}
 *
 * Go source:
 * func (v *Version) String() string {
 * 	var sb strings.Builder
 * 	fmt.Fprintf(&sb, "%d.%d.%d", v.major, v.minor, v.patch)
 * 	if len(v.prerelease) > 0 {
 * 		fmt.Fprintf(&sb, "-%s", strings.Join(v.prerelease, "."))
 * 	}
 * 	if len(v.build) > 0 {
 * 		fmt.Fprintf(&sb, "+%s", strings.Join(v.build, "."))
 * 	}
 * 	return sb.String()
 * }
 */
export function Version_String(receiver: GoPtr<Version>): string {
  const v: Version = receiver!;
  const sb: strings.Builder = new strings.Builder();
  fmt.Fprintf(sb, "%d.%d.%d", v.major, v.minor, v.patch);
  if (v.prerelease.length > 0) {
    fmt.Fprintf(sb, "-%s", strings.Join(v.prerelease, "."));
  }
  if (v.build.length > 0) {
    fmt.Fprintf(sb, "+%s", strings.Join(v.build, "."));
  }
  return sb.String();
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/semver/version.go::type::SemverParseError","kind":"type","status":"implemented","sigHash":"e20f74a52833cee79915f5119c70d120453a9dd7760c849fcf5ab805058c2654","bodyHash":"1f4df4fe021ed3615725d452b8a978948612144a1fe43bfa0c7e9858b54525c5"}
 *
 * Go source:
 * SemverParseError struct {
 * 	origInput string
 * }
 */
export interface SemverParseError {
  origInput: string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/semver/version.go::method::SemverParseError.Error","kind":"method","status":"implemented","sigHash":"736c412076a4a7f5f3f87f833b174e1b0b229a6747ae1b0a2d0ff98d6dc3b80e","bodyHash":"ae83ee21cc36953878138038e50cec851b853493b644332a4afc01419b05eb8e"}
 *
 * Go source:
 * func (e *SemverParseError) Error() string {
 * 	return fmt.Sprintf("Could not parse version string from %q", e.origInput)
 * }
 */
export function SemverParseError_Error(receiver: GoPtr<SemverParseError>): string {
  const e: SemverParseError = receiver!;
  return fmt.Sprintf("Could not parse version string from %q", e.origInput);
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/semver/version.go::func::TryParseVersion","kind":"func","status":"implemented","sigHash":"b0c1adc3d0c09288df0bdecbc609fe1c4c6ff6cccc053223fab9add30ff7229a","bodyHash":"76028d93f6f7cba13c4d11814ebc8b3c415fe40a3a8650a69b632c239516bd7f"}
 *
 * Go source:
 * func TryParseVersion(text string) (Version, error) {
 * 	var result Version
 * 
 * 	match := versionRegexp.FindStringSubmatch(text)
 * 	if match == nil {
 * 		return result, &SemverParseError{origInput: text}
 * 	}
 * 
 * 	majorStr := match[1]
 * 	minorStr := match[2]
 * 	patchStr := match[3]
 * 	prereleaseStr := match[4]
 * 	buildStr := match[5]
 * 
 * 	var err error
 * 
 * 	result.major, err = getUintComponent(majorStr)
 * 	if err != nil {
 * 		return result, err
 * 	}
 * 
 * 	if minorStr != "" {
 * 		result.minor, err = getUintComponent(minorStr)
 * 		if err != nil {
 * 			return result, err
 * 		}
 * 	}
 * 
 * 	if patchStr != "" {
 * 		result.patch, err = getUintComponent(patchStr)
 * 		if err != nil {
 * 			return result, err
 * 		}
 * 	}
 * 
 * 	if prereleaseStr != "" {
 * 		if !prereleaseRegexp.MatchString(prereleaseStr) {
 * 			return result, &SemverParseError{origInput: text}
 * 		}
 * 
 * 		result.prerelease = strings.Split(prereleaseStr, ".")
 * 	}
 * 	if buildStr != "" {
 * 		if !buildRegExp.MatchString(buildStr) {
 * 			return result, &SemverParseError{origInput: text}
 * 		}
 * 
 * 		result.build = strings.Split(buildStr, ".")
 * 	}
 * 
 * 	return result, nil
 * }
 */
export function TryParseVersion(text: string): [Version, GoError] {
  const result: Version = {
    major: 0,
    minor: 0,
    patch: 0,
    prerelease: [],
    build: [],
  };

  const match: GoSlice<string> | undefined = versionRegexp.FindStringSubmatch(text);
  if (match === undefined) {
    return [result, new globalThis.Error(SemverParseError_Error({ origInput: text }))];
  }

  const majorStr: string = match[1]!;
  const minorStr: string = match[2]!;
  const patchStr: string = match[3]!;
  const prereleaseStr: string = match[4]!;
  const buildStr: string = match[5]!;

  const [majorVal, majorErr] = getUintComponent(majorStr);
  if (majorErr !== undefined) {
    return [result, majorErr];
  }
  result.major = majorVal;

  if (minorStr !== "") {
    const [minorVal, minorErr] = getUintComponent(minorStr);
    if (minorErr !== undefined) {
      return [result, minorErr];
    }
    result.minor = minorVal;
  }

  if (patchStr !== "") {
    const [patchVal, patchErr] = getUintComponent(patchStr);
    if (patchErr !== undefined) {
      return [result, patchErr];
    }
    result.patch = patchVal;
  }

  if (prereleaseStr !== "") {
    if (!prereleaseRegexp.MatchString(prereleaseStr)) {
      return [result, new globalThis.Error(SemverParseError_Error({ origInput: text }))];
    }

    result.prerelease = strings.Split(prereleaseStr, ".");
  }
  if (buildStr !== "") {
    if (!buildRegExp.MatchString(buildStr)) {
      return [result, new globalThis.Error(SemverParseError_Error({ origInput: text }))];
    }

    result.build = strings.Split(buildStr, ".");
  }

  return [result, undefined];
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/semver/version.go::func::MustParse","kind":"func","status":"implemented","sigHash":"2e49b0b61ed5d0a4fc659c65f6e955538a6b979d9d617e665d1cbb0990d42d8d","bodyHash":"24f2c208b162edc4eedfec749fe800875f6007c6162aa485cfac06212bf57f26"}
 *
 * Go source:
 * func MustParse(text string) Version {
 * 	v, err := TryParseVersion(text)
 * 	if err != nil {
 * 		panic(err)
 * 	}
 * 	return v
 * }
 */
export function MustParse(text: string): Version {
  const [v, err] = TryParseVersion(text);
  if (err !== undefined) {
    throw err;
  }
  return v;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/semver/version.go::func::getUintComponent","kind":"func","status":"implemented","sigHash":"199c41db88a38dc3382519c0f0039ad44dbdf9b9077edffeac74a7ec79d6b754","bodyHash":"86758d5d0a57c75fec69850d3ce2e8f9a017355c57bce9890728eca7fe97076f"}
 *
 * Go source:
 * func getUintComponent(text string) (uint32, error) {
 * 	r, err := strconv.ParseUint(text, 10, 32)
 * 	return uint32(r), err
 * }
 */
export function getUintComponent(text: string): [uint, GoError] {
  const [r, err] = strconv.ParseUint(text, 10, 32);
  return [(r >>> 0) as uint, err];
}
