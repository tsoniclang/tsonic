
using Tsonic.Runtime;

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
            return Tsonic.Runtime.String.split(str, "").reverse().join("");
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
            return Tsonic.Runtime.String.split(Tsonic.Runtime.String.trim(str), /\s+/).length;
            }

        public static bool isPalindrome(string str)
            {
            var cleaned = Tsonic.Runtime.String.replace(Tsonic.Runtime.String.toLowerCase(str), /[^a-z0-9]/g, "");
            return cleaned == reverse(cleaned);
            }

        public static T? first<T>(Tsonic.Runtime.Array<T> arr)
            {
            return arr[0];
            }

        public static T? last<T>(Tsonic.Runtime.Array<T> arr)
            {
            return arr[arr.length - 1];
            }

        public static Tsonic.Runtime.Array<T> unique<T>(Tsonic.Runtime.Array<T> arr)
            {
            return arr.filter((item, index) => arr.indexOf(item) == index);
            }

        public static Tsonic.Runtime.Array<Tsonic.Runtime.Array<T>> chunk<T>(Tsonic.Runtime.Array<T> arr, double size)
            {
            Tsonic.Runtime.Array<Tsonic.Runtime.Array<T>> result = new Tsonic.Runtime.Array<Tsonic.Runtime.Array<T>>();
            for (var i = 0.0; i < arr.length; i += size)
                {
                result.push(arr.slice(i, i + size));
                }
            return result;
            }
    }
}