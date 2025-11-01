/**
 * JavaScript String static helper methods
 * Operates on native C# string type
 */

using System;
using System.Linq;

namespace Tsonic.Runtime
{
    /// <summary>
    /// Static helper class for JavaScript string operations
    /// </summary>
    public static class String
    {
        /// <summary>
        /// Convert string to upper case
        /// </summary>
        public static string toUpperCase(string str)
        {
            return str.ToUpper();
        }

        /// <summary>
        /// Convert string to lower case
        /// </summary>
        public static string toLowerCase(string str)
        {
            return str.ToLower();
        }

        /// <summary>
        /// Remove whitespace from both ends
        /// </summary>
        public static string trim(string str)
        {
            return str.Trim();
        }

        /// <summary>
        /// Remove whitespace from start
        /// </summary>
        public static string trimStart(string str)
        {
            return str.TrimStart();
        }

        /// <summary>
        /// Remove whitespace from end
        /// </summary>
        public static string trimEnd(string str)
        {
            return str.TrimEnd();
        }

        /// <summary>
        /// Get substring from start to end
        /// </summary>
        public static string substring(string str, int start, int? end = null)
        {
            int actualEnd = end ?? str.Length;
            int length = System.Math.Max(0, actualEnd - start);
            return str.Substring(start, System.Math.Min(length, str.Length - start));
        }

        /// <summary>
        /// Get slice of string (supports negative indices)
        /// </summary>
        public static string slice(string str, int start, int? end = null)
        {
            int len = str.Length;
            int actualStart = start < 0 ? System.Math.Max(0, len + start) : System.Math.Min(start, len);
            int actualEnd = end.HasValue
                ? (end.Value < 0 ? System.Math.Max(0, len + end.Value) : System.Math.Min(end.Value, len))
                : len;

            return str.Substring(actualStart, System.Math.Max(0, actualEnd - actualStart));
        }

        /// <summary>
        /// Find first occurrence of substring
        /// </summary>
        public static int indexOf(string str, string searchString, int position = 0)
        {
            return str.IndexOf(searchString, position);
        }

        /// <summary>
        /// Find last occurrence of substring
        /// </summary>
        public static int lastIndexOf(string str, string searchString, int? position = null)
        {
            return position.HasValue
                ? str.LastIndexOf(searchString, position.Value)
                : str.LastIndexOf(searchString);
        }

        /// <summary>
        /// Check if string starts with substring
        /// </summary>
        public static bool startsWith(string str, string searchString)
        {
            return str.StartsWith(searchString);
        }

        /// <summary>
        /// Check if string ends with substring
        /// </summary>
        public static bool endsWith(string str, string searchString)
        {
            return str.EndsWith(searchString);
        }

        /// <summary>
        /// Check if string contains substring
        /// </summary>
        public static bool includes(string str, string searchString)
        {
            return str.Contains(searchString);
        }

        /// <summary>
        /// Replace first occurrence of search with replacement
        /// </summary>
        public static string replace(string str, string search, string replacement)
        {
            return str.Replace(search, replacement);
        }

        /// <summary>
        /// Repeat string count times
        /// </summary>
        public static string repeat(string str, int count)
        {
            return string.Concat(Enumerable.Repeat(str, count));
        }

        /// <summary>
        /// Pad string at start to target length
        /// </summary>
        public static string padStart(string str, int targetLength, string padString = " ")
        {
            return str.PadLeft(targetLength, padString[0]);
        }

        /// <summary>
        /// Pad string at end to target length
        /// </summary>
        public static string padEnd(string str, int targetLength, string padString = " ")
        {
            return str.PadRight(targetLength, padString[0]);
        }

        /// <summary>
        /// Get character at index
        /// </summary>
        public static string charAt(string str, int index)
        {
            return index >= 0 && index < str.Length ? str[index].ToString() : "";
        }

        /// <summary>
        /// Get character code at index
        /// </summary>
        public static double charCodeAt(string str, int index)
        {
            return index >= 0 && index < str.Length ? (double)str[index] : double.NaN;
        }

        /// <summary>
        /// Split string into array
        /// </summary>
        public static Array<string> split(string str, string separator, int? limit = null)
        {
            string[] parts = str.Split(new[] { separator }, StringSplitOptions.None);

            if (limit.HasValue && parts.Length > limit.Value)
            {
                string[] limited = new string[limit.Value];
                System.Array.Copy(parts, limited, limit.Value);
                return new Array<string>(limited);
            }

            return new Array<string>(parts);
        }

        /// <summary>
        /// Get string length
        /// </summary>
        public static int length(string str)
        {
            return str.Length;
        }

        /// <summary>
        /// Get character at index (supports negative indices)
        /// </summary>
        public static string at(string str, int index)
        {
            int actualIndex = index < 0 ? str.Length + index : index;
            if (actualIndex < 0 || actualIndex >= str.Length)
            {
                return "";
            }
            return str[actualIndex].ToString();
        }

        /// <summary>
        /// Get Unicode code point at index
        /// </summary>
        public static int codePointAt(string str, int index)
        {
            if (index < 0 || index >= str.Length)
            {
                return -1;
            }
            return char.ConvertToUtf32(str, index);
        }

        /// <summary>
        /// Concatenate strings
        /// </summary>
        public static string concat(params string[] strings)
        {
            return string.Concat(strings);
        }

        /// <summary>
        /// Locale-aware string comparison
        /// </summary>
        public static int localeCompare(string str, string compareString)
        {
            return string.Compare(str, compareString, System.Globalization.CultureInfo.CurrentCulture, System.Globalization.CompareOptions.None);
        }

        /// <summary>
        /// Match string against regex pattern
        /// </summary>
        public static Array<string>? match(string str, string pattern)
        {
            var regex = new System.Text.RegularExpressions.Regex(pattern);
            var match = regex.Match(str);

            if (!match.Success)
            {
                return null;
            }

            var result = new Array<string>();
            result.push(match.Value);

            for (int i = 1; i < match.Groups.Count; i++)
            {
                result.push(match.Groups[i].Value);
            }

            return result;
        }

        /// <summary>
        /// Match all occurrences against regex pattern
        /// </summary>
        public static Array<Array<string>> matchAll(string str, string pattern)
        {
            var result = new Array<Array<string>>();
            var regex = new System.Text.RegularExpressions.Regex(pattern);
            var matches = regex.Matches(str);

            foreach (System.Text.RegularExpressions.Match match in matches)
            {
                var matchArray = new Array<string>();
                matchArray.push(match.Value);

                for (int i = 1; i < match.Groups.Count; i++)
                {
                    matchArray.push(match.Groups[i].Value);
                }

                result.push(matchArray);
            }

            return result;
        }

        /// <summary>
        /// Search for regex pattern and return index
        /// </summary>
        public static int search(string str, string pattern)
        {
            var regex = new System.Text.RegularExpressions.Regex(pattern);
            var match = regex.Match(str);
            return match.Success ? match.Index : -1;
        }

        /// <summary>
        /// Replace all occurrences of search with replacement
        /// </summary>
        public static string replaceAll(string str, string search, string replacement)
        {
            return str.Replace(search, replacement);
        }

        /// <summary>
        /// Normalize Unicode string
        /// </summary>
        public static string normalize(string str, string form = "NFC")
        {
            System.Text.NormalizationForm normForm = form switch
            {
                "NFD" => System.Text.NormalizationForm.FormD,
                "NFKC" => System.Text.NormalizationForm.FormKC,
                "NFKD" => System.Text.NormalizationForm.FormKD,
                _ => System.Text.NormalizationForm.FormC
            };
            return str.Normalize(normForm);
        }

        /// <summary>
        /// Get substring from start (deprecated but still used)
        /// </summary>
        public static string substr(string str, int start, int? length = null)
        {
            int actualStart = start < 0 ? System.Math.Max(0, str.Length + start) : start;
            if (actualStart >= str.Length)
            {
                return "";
            }

            int actualLength = length ?? (str.Length - actualStart);
            actualLength = System.Math.Min(actualLength, str.Length - actualStart);

            return str.Substring(actualStart, actualLength);
        }

        /// <summary>
        /// Convert to lowercase using locale
        /// </summary>
        public static string toLocaleLowerCase(string str)
        {
            return str.ToLower(System.Globalization.CultureInfo.CurrentCulture);
        }

        /// <summary>
        /// Convert to uppercase using locale
        /// </summary>
        public static string toLocaleUpperCase(string str)
        {
            return str.ToUpper(System.Globalization.CultureInfo.CurrentCulture);
        }

        /// <summary>
        /// Convert to string
        /// </summary>
        public static string toString(string str)
        {
            return str;
        }

        /// <summary>
        /// Get primitive value
        /// </summary>
        public static string valueOf(string str)
        {
            return str;
        }

        /// <summary>
        /// Check if string is well-formed Unicode
        /// </summary>
        public static bool isWellFormed(string str)
        {
            for (int i = 0; i < str.Length; i++)
            {
                char c = str[i];
                if (char.IsSurrogate(c))
                {
                    if (char.IsHighSurrogate(c))
                    {
                        if (i + 1 >= str.Length || !char.IsLowSurrogate(str[i + 1]))
                        {
                            return false;
                        }
                        i++;
                    }
                    else
                    {
                        return false;
                    }
                }
            }
            return true;
        }

        /// <summary>
        /// Ensure string is well-formed Unicode
        /// </summary>
        public static string toWellFormed(string str)
        {
            var result = new System.Text.StringBuilder();
            for (int i = 0; i < str.Length; i++)
            {
                char c = str[i];
                if (char.IsSurrogate(c))
                {
                    if (char.IsHighSurrogate(c))
                    {
                        if (i + 1 < str.Length && char.IsLowSurrogate(str[i + 1]))
                        {
                            result.Append(c);
                            result.Append(str[i + 1]);
                            i++;
                        }
                        else
                        {
                            result.Append('\uFFFD'); // Replacement character
                        }
                    }
                    else
                    {
                        result.Append('\uFFFD'); // Replacement character
                    }
                }
                else
                {
                    result.Append(c);
                }
            }
            return result.ToString();
        }

        /// <summary>
        /// Trim whitespace from start (alias for trimStart)
        /// </summary>
        public static string trimLeft(string str)
        {
            return str.TrimStart();
        }

        /// <summary>
        /// Trim whitespace from end (alias for trimEnd)
        /// </summary>
        public static string trimRight(string str)
        {
            return str.TrimEnd();
        }

        /// <summary>
        /// Static method: Create string from character codes
        /// </summary>
        public static string fromCharCode(params int[] codes)
        {
            var chars = new char[codes.Length];
            for (int i = 0; i < codes.Length; i++)
            {
                chars[i] = (char)codes[i];
            }
            return new string(chars);
        }

        /// <summary>
        /// Static method: Create string from code points
        /// </summary>
        public static string fromCodePoint(params int[] codePoints)
        {
            var result = new System.Text.StringBuilder();
            foreach (int codePoint in codePoints)
            {
                if (codePoint < 0 || codePoint > 0x10FFFF)
                {
                    throw new ArgumentOutOfRangeException(nameof(codePoints), "Invalid code point");
                }
                result.Append(char.ConvertFromUtf32(codePoint));
            }
            return result.ToString();
        }

        /// <summary>
        /// Static method: Get raw template string
        /// </summary>
        public static string raw(Array<string> template, params object[] substitutions)
        {
            var result = new System.Text.StringBuilder();
            for (int i = 0; i < template.length; i++)
            {
                result.Append(template[i]);
                if (i < substitutions.Length)
                {
                    result.Append(substitutions[i]);
                }
            }
            return result.ToString();
        }
    }
}
