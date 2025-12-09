namespace TestCases.realworld.stringutils
{
        public static class stringutils
        {
            public static string capitalize(string str)
                {
                if (global::Tsonic.JSRuntime.String.length(str) == 0)
                    {
                    return str;
                    }
                return global::Tsonic.JSRuntime.String.toUpperCase(global::Tsonic.JSRuntime.String.charAt(str, 0.0)) + global::Tsonic.JSRuntime.String.toLowerCase(global::Tsonic.JSRuntime.String.slice(str, 1.0));
                }

            public static string reverse(string str)
                {
                return global::Tsonic.JSRuntime.Array.join(global::Tsonic.JSRuntime.Array.reverse(global::Tsonic.JSRuntime.String.split(str, "")), "");
                }

            public static string truncate(string str, double maxLength)
                {
                if (global::Tsonic.JSRuntime.String.length(str) <= maxLength)
                    {
                    return str;
                    }
                return global::Tsonic.JSRuntime.String.slice(str, 0.0, maxLength - 3.0) + "...";
                }

            public static double countWords(string str)
                {
                return global::Tsonic.JSRuntime.Array.length(global::Tsonic.JSRuntime.String.split(global::Tsonic.JSRuntime.String.trim(str), /\s+/));
                }

            public static bool isPalindrome(string str)
                {
                var cleaned = global::Tsonic.JSRuntime.String.replace(global::Tsonic.JSRuntime.String.toLowerCase(str), /[^a-z0-9]/g, "");
                return cleaned == reverse(cleaned);
                }

            public static T? first<T>(global::System.Collections.Generic.List<T> arr)
                {
                return global::Tsonic.JSRuntime.Array.get(arr, 0);
                }

            public static T? last<T>(global::System.Collections.Generic.List<T> arr)
                {
                return global::Tsonic.JSRuntime.Array.get(arr, global::Tsonic.JSRuntime.Array.length(arr) - 1);
                }

            public static global::System.Collections.Generic.List<T> unique<T>(global::System.Collections.Generic.List<T> arr)
                {
                return global::Tsonic.JSRuntime.Array.filter(arr, (T item, double index) => global::Tsonic.JSRuntime.Array.indexOf(arr, item) == index);
                }

            public static global::System.Collections.Generic.List<global::System.Collections.Generic.List<T>> chunk<T>(global::System.Collections.Generic.List<T> arr, double size)
                {
                global::System.Collections.Generic.List<global::System.Collections.Generic.List<T>> result = new global::System.Collections.Generic.List<global::System.Collections.Generic.List<T>>();
                for (var i = 0.0; i < global::Tsonic.JSRuntime.Array.length(arr); i += size)
                    {
                    global::Tsonic.JSRuntime.Array.push(result, global::Tsonic.JSRuntime.Array.slice(arr, i, i + size));
                    }
                return result;
                }
        }
}