// Generated from: MultipleConstraints.ts
// Generated at: 2026-01-17T15:37:35.108Z
// WARNING: Do not modify this file manually

namespace TestCases.common.types.genericconstraints
{
    public class ComparableShowable<T>
    {
        public int compareTo(T other)
            {
            return 0;
            }

        public string show()
            {
            return "";
            }
    }
    public class NumberValue : ComparableShowable<NumberValue>
    {
        public int value;

        public NumberValue(int value) : base()
            {
            this.value = value;
            }

        public override int compareTo(NumberValue other)
            {
            return this.value - other.value;
            }

        public override string show()
            {
            return $"Value: {this.value}";
            }
    }

            public static class MultipleConstraints
            {
                public static string maxAndShow<T>(T a, T b)
                    where T : ComparableShowable<T>
                    {
                    var comparison = a.compareTo(b);
                    if (comparison >= 0)
                        {
                        return a.show();
                        }
                    return b.show();
                    }
            }
}