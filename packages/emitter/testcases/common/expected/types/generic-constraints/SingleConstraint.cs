// Generated from: SingleConstraint.ts
// Generated at: 2026-02-25T03:00:52.464Z
// WARNING: Do not modify this file manually

namespace TestCases.common.types.genericconstraints
{
    public interface Printable
    {
        string toString();
    }

    public class Printer<T>
        where T : Printable
    {
        public T value { get; set; }

        public Printer(T value)
        {
            this.value = value;
        }

        public string print()
        {
            return this.value.toString();
        }
    }
}