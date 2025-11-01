/**
 * JavaScript JSON object implementation
 */

using System.Text.Json;

namespace Tsonic.Runtime
{
    /// <summary>
    /// JSON parsing and stringification
    /// </summary>
    public static class JSON
    {
        /// <summary>
        /// Parse JSON string to typed object
        /// </summary>
        public static T parse<T>(string text)
        {
            return JsonSerializer.Deserialize<T>(text)!;
        }

        /// <summary>
        /// Convert object to JSON string
        /// </summary>
        public static string stringify(object value)
        {
            return JsonSerializer.Serialize(value);
        }
    }
}
