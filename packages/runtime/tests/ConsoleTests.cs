using Xunit;
using System;
using System.IO;

namespace Tsonic.Runtime.Tests
{
    public class ConsoleTests
    {
        [Fact]
        public void log_WritesToStdout()
        {
            // Just verify it doesn't throw
            console.log("test");
            console.log("test", 123, true);
        }

        [Fact]
        public void error_WritesToStderr()
        {
            // Just verify it doesn't throw
            console.error("error message");
        }

        [Fact]
        public void warn_WritesWarning()
        {
            // Just verify it doesn't throw
            console.warn("warning message");
        }

        [Fact]
        public void info_WritesInfo()
        {
            // Just verify it doesn't throw
            console.info("info message");
        }

        [Fact]
        public void debug_WritesDebug()
        {
            // Just verify it doesn't throw
            console.debug("debug message");
        }

        [Fact]
        public void trace_WritesStackTrace()
        {
            // Just verify it doesn't throw
            console.trace("trace message");
        }

        [Fact]
        public void assert_TrueCondition_DoesNotWrite()
        {
            // Should not throw or write error
            console.assert(true, "This should not be printed");
        }

        [Fact]
        public void assert_FalseCondition_WritesError()
        {
            // Should write to error but not throw
            console.assert(false, "Assertion failed");
        }

        [Fact]
        public void table_DisplaysData()
        {
            // Just verify it doesn't throw
            var data = new { Name = "Test", Value = 42 };
            console.table(data);
        }

        [Fact]
        public void time_StartsTimer()
        {
            // Should not throw
            console.time("test");
            console.timeEnd("test");
        }

        [Fact]
        public void timeEnd_EndsTimerAndLogs()
        {
            console.time("test2");
            System.Threading.Thread.Sleep(10);
            // Should log elapsed time
            console.timeEnd("test2");
        }

        [Fact]
        public void timeLog_LogsElapsedWithoutEnding()
        {
            console.time("test3");
            System.Threading.Thread.Sleep(10);
            console.timeLog("test3", "checkpoint");
            console.timeEnd("test3");
        }

        [Fact]
        public void count_IncrementsCounter()
        {
            // Should log incrementing count
            console.count("myCounter");
            console.count("myCounter");
            console.count("myCounter");
        }

        [Fact]
        public void countReset_ResetsCounter()
        {
            console.count("resetCounter");
            console.count("resetCounter");
            console.countReset("resetCounter");
            console.count("resetCounter"); // Should be 1 again
        }

        [Fact]
        public void group_StartsGroup()
        {
            // Should not throw
            console.group("My Group");
            console.log("Inside group");
            console.groupEnd();
        }

        [Fact]
        public void groupCollapsed_StartsCollapsedGroup()
        {
            // Should not throw
            console.groupCollapsed("Collapsed Group");
            console.log("Inside collapsed group");
            console.groupEnd();
        }

        [Fact]
        public void groupEnd_EndsGroup()
        {
            console.group("Group");
            console.groupEnd();
            // Should not throw
        }

        [Fact]
        public void clear_ClearsConsole()
        {
            // Just verify it doesn't throw
            // Note: May not actually clear in test environment
            console.clear();
        }

        [Fact]
        public void dir_DisplaysObject()
        {
            var obj = new { Name = "Test", Value = 42 };
            console.dir(obj);
        }

        [Fact]
        public void dirxml_DisplaysElement()
        {
            var element = "<div>Test</div>";
            console.dirxml(element);
        }
    }
}
