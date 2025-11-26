using Tsonic.Runtime;
using Tsonic.JSRuntime;
using System.Collections.Generic;

namespace TestCases.realworld.stringutils
{
        public static class stringutils
        {
            public static string capitalize(string str)
                {
                if (str.length == 0)
                    {
                    return str;
                    }
                return Tsonic.JSRuntime.String.toUpperCase(Tsonic.JSRuntime.String.charAt(str, 0)) + Tsonic.JSRuntime.String.toLowerCase(Tsonic.JSRuntime.String.slice(str, 1));
                }

            public static string reverse(string str)
                {
                return Tsonic.JSRuntime.Array.join(Tsonic.JSRuntime.Array.reverse(Tsonic.JSRuntime.String.split(str, "")), "");
                }

            public static string truncate(string str, double maxLength)
                {
                if (str.length <= maxLength)
                    {
                    return str;
                    }
                return Tsonic.JSRuntime.String.slice(str, 0, maxLength - 3) + "...";
                }

            public static double countWords(string str)
                {
                return Tsonic.Runtime.Array.length(Tsonic.JSRuntime.String.split(Tsonic.JSRuntime.String.trim(str), /\s+/));
                }

            public static bool isPalindrome(string str)
                {
                var cleaned = Tsonic.JSRuntime.String.replace(Tsonic.JSRuntime.String.toLowerCase(str), /[^a-z0-9]/g, "");
                return cleaned == reverse(cleaned);
                }

            public static T? first<T>(List<T> arr)
                {
                return Tsonic.Runtime.Array.get(arr, 0);
                }

            public static T? last<T>(List<T> arr)
                {
                return Tsonic.Runtime.Array.get(arr, Tsonic.Runtime.Array.length(arr) - 1);
                }

            public static List<T> unique<T>(List<T> arr)
                {
                return Tsonic.JSRuntime.Array.filter(arr, (item, index) => Tsonic.JSRuntime.Array.indexOf(arr, item) == index);
                }

            public static List<List<T>> chunk<T>(List<T> arr, double size)
                {
                List<List<T>> result = new List<List<T>>();
                for (var i = 0; i < Tsonic.Runtime.Array.length(arr); i += size)
                    {
                    Tsonic.JSRuntime.Array.push(result, Tsonic.JSRuntime.Array.slice(arr, i, i + size));
                    }
                return result;
                }
        }
}