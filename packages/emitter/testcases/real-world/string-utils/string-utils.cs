
using Tsonic.Runtime;
using System.Collections.Generic;

namespace TestCases.realworld
{
    public static class stringutils
    {
        public static string capitalize(string str)
            {
            if (str.length == 0.0)
                {
                return str;
                }
            return Tsonic.Runtime.String.toUpperCase(Tsonic.Runtime.String.charAt(str, 0.0)) + Tsonic.Runtime.String.toLowerCase(Tsonic.Runtime.String.slice(str, 1.0));
            }

        public static string reverse(string str)
            {
            return Tsonic.Runtime.Array.join(Tsonic.Runtime.Array.reverse(Tsonic.Runtime.String.split(str, "")), "");
            }

        public static string truncate(string str, double maxLength)
            {
            if (str.length <= maxLength)
                {
                return str;
                }
            return Tsonic.Runtime.String.slice(str, 0.0, maxLength - 3.0) + "...";
            }

        public static double countWords(string str)
            {
            return Tsonic.Runtime.Array.length(Tsonic.Runtime.String.split(Tsonic.Runtime.String.trim(str), /\s+/));
            }

        public static bool isPalindrome(string str)
            {
            var cleaned = Tsonic.Runtime.String.replace(Tsonic.Runtime.String.toLowerCase(str), /[^a-z0-9]/g, "");
            return cleaned == reverse(cleaned);
            }

        public static T? first<T>(List<T> arr)
            {
            return Tsonic.Runtime.Array.get(arr, 0.0);
            }

        public static T? last<T>(List<T> arr)
            {
            return Tsonic.Runtime.Array.get(arr, Tsonic.Runtime.Array.length(arr) - 1.0);
            }

        public static List<T> unique<T>(List<T> arr)
            {
            return Tsonic.Runtime.Array.filter(arr, (item, index) => Tsonic.Runtime.Array.indexOf(arr, item) == index);
            }

        public static List<List<T>> chunk<T>(List<T> arr, double size)
            {
            List<List<T>> result = new List<List<T>>();
            for (var i = 0.0; i < Tsonic.Runtime.Array.length(arr); i += size)
                {
                Tsonic.Runtime.Array.push(result, Tsonic.Runtime.Array.slice(arr, i, i + size));
                }
            return result;
            }
    }
}