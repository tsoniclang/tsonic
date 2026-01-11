namespace TestCases.common.types.genericconstraints
{
    public class ComparableShowable<T>
    {
        public int CompareTo(T other)
            {
            return 0;
            }

        public string Show()
            {
            return "";
            }
    }
    public class NumberValue : ComparableShowable<NumberValue>
    {
        public int Value;

        public NumberValue(int value) : base()
            {
            this.Value = value;
            }

        public override int CompareTo(NumberValue other)
            {
            return this.Value - other.Value;
            }

        public override string Show()
            {
            return $"Value: {this.Value}";
            }
    }

            public static class MultipleConstraints
            {
                public static string MaxAndShow<T>(T a, T b)
                    where T : ComparableShowable<T>
                    {
                    var comparison = a.CompareTo(b);
                    if (comparison >= 0)
                        {
                        return a.Show();
                        }
                    return b.Show();
                    }
            }
}