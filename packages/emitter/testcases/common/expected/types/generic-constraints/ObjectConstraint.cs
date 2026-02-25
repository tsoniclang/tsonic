// Generated from: ObjectConstraint.ts
// Generated at: 2026-02-25T03:00:53.776Z
// WARNING: Do not modify this file manually

namespace TestCases.common.types.genericconstraints
{
    public class RefWrapper<T>
        where T : class
    {
        public T? value { get; set; }

        public RefWrapper(T? value)
        {
            this.value = value;
        }

        public bool isNull()
        {
            return this.value == null;
        }
    }
}