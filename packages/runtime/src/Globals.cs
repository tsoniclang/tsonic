/**
 * Global functions available at Tsonic.Runtime root level
 */

using System;
using System.Globalization;
using System.Web;

namespace Tsonic.Runtime
{
    /// <summary>
    /// Global functions (parseInt, parseFloat, encoding, etc.)
    /// </summary>
    public static class Globals
    {
        /// <summary>
        /// Parse string to integer with optional radix
        /// </summary>
        public static double parseInt(string str, int? radix = null)
        {
            if (string.IsNullOrWhiteSpace(str))
            {
                return double.NaN;
            }

            str = str.Trim();
            int actualRadix = radix ?? 10;

            if (actualRadix < 2 || actualRadix > 36)
            {
                return double.NaN;
            }

            try
            {
                return Convert.ToInt32(str, actualRadix);
            }
            catch
            {
                return double.NaN;
            }
        }

        /// <summary>
        /// Parse string to floating point number
        /// </summary>
        public static double parseFloat(string str)
        {
            if (string.IsNullOrWhiteSpace(str))
            {
                return double.NaN;
            }

            str = str.Trim();

            if (double.TryParse(str, NumberStyles.Float, CultureInfo.InvariantCulture, out double result))
            {
                return result;
            }

            return double.NaN;
        }

        /// <summary>
        /// Check if value is NaN
        /// </summary>
        public static bool isNaN(double value)
        {
            return double.IsNaN(value);
        }

        /// <summary>
        /// Check if value is finite (not infinite or NaN)
        /// </summary>
        public static bool isFinite(double value)
        {
            return !double.IsInfinity(value) && !double.IsNaN(value);
        }

        /// <summary>
        /// Encode URI component
        /// </summary>
        public static string encodeURIComponent(string component)
        {
            return HttpUtility.UrlEncode(component);
        }

        /// <summary>
        /// Decode URI component
        /// </summary>
        public static string decodeURIComponent(string component)
        {
            return HttpUtility.UrlDecode(component);
        }

        /// <summary>
        /// Encode URI
        /// </summary>
        public static string encodeURI(string uri)
        {
            return Uri.EscapeUriString(uri);
        }

        /// <summary>
        /// Decode URI
        /// </summary>
        public static string decodeURI(string uri)
        {
            return Uri.UnescapeDataString(uri);
        }
    }
}
