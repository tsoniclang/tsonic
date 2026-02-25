// Generated from: Person.ts
// Generated at: 2026-02-25T02:59:46.532Z
// WARNING: Do not modify this file manually

namespace TestCases.common.classes.basic
{
    public class Person
    {
        public string name { get; set; }

        public double age { get; set; }

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