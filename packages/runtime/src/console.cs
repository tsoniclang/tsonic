/**
 * JavaScript console object implementation
 */

using System;

namespace Tsonic.Runtime
{
    /// <summary>
    /// Console logging functions (lowercase class name to match JavaScript)
    /// </summary>
    public static class console
    {
        /// <summary>
        /// Log message to console
        /// </summary>
        public static void log(params object[] data)
        {
            Console.WriteLine(string.Join(" ", data));
        }

        /// <summary>
        /// Log error message to stderr
        /// </summary>
        public static void error(params object[] data)
        {
            Console.Error.WriteLine(string.Join(" ", data));
        }

        /// <summary>
        /// Log warning message
        /// </summary>
        public static void warn(params object[] data)
        {
            Console.WriteLine("WARN: " + string.Join(" ", data));
        }

        /// <summary>
        /// Log info message
        /// </summary>
        public static void info(params object[] data)
        {
            Console.WriteLine(string.Join(" ", data));
        }
    }
}
