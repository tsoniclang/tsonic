/**
 * JavaScript operator implementations (typeof, instanceof)
 */

using System;

namespace Tsonic.Runtime
{
    /// <summary>
    /// JavaScript operators that need runtime support
    /// </summary>
    public static class Operators
    {
        /// <summary>
        /// typeof operator - returns JavaScript type string
        /// </summary>
        public static string @typeof(object? value)
        {
            if (value == null)
            {
                return "undefined";
            }

            if (value is string)
            {
                return "string";
            }

            if (value is double || value is int || value is float || value is long || value is decimal)
            {
                return "number";
            }

            if (value is bool)
            {
                return "boolean";
            }

            if (value is Delegate)
            {
                return "function";
            }

            return "object";
        }

        /// <summary>
        /// instanceof operator - checks if object is instance of type
        /// </summary>
        public static bool instanceof(object? obj, Type type)
        {
            if (obj == null)
            {
                return false;
            }

            return type.IsAssignableFrom(obj.GetType());
        }
    }
}
