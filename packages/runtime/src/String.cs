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
    }
}
