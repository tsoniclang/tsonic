// Generated from: Person.ts
// Generated at: 2026-01-17T15:36:41.438Z
// WARNING: Do not modify this file manually

namespace TestCases.common.classes.basic
{
    public class Person
    {
        public string name;

        public double age;

        public string greet()
            {
            return $"Hello, I'm {this.name}";
            }

        public void birthday()
            {
            this.age++;
            }
    }
}