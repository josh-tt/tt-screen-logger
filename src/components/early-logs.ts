// Create a global variable to store early logs
const earlyLogs: Array<{
  type: 'log' | 'warn' | 'error' | 'info';
  args: any[];
  timestamp: number;
}> = [];

// Add TypeScript declaration for early logs
declare global {
  interface Window {
    __earlyLogs?: Array<{
      type: 'log' | 'warn' | 'error' | 'info';
      args: any[];
      timestamp: number;
    }>;
  }
}

// Only do this if we're in the browser
if (typeof window !== 'undefined') {
  // Initialize the global early logs array
  window.__earlyLogs = earlyLogs;
  
  // Capture console methods
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info
  };

  // Override console methods
  console.log = function (...args) {
    earlyLogs.push({
      type: 'log',
      args,
      timestamp: Date.now()
    });
    return originalConsole.log.apply(console, args);
  };

  console.warn = function (...args) {
    earlyLogs.push({
      type: 'warn',
      args,
      timestamp: Date.now()
    });
    return originalConsole.warn.apply(console, args);
  };

  console.error = function (...args) {
    earlyLogs.push({
      type: 'error',
      args,
      timestamp: Date.now()
    });
    return originalConsole.error.apply(console, args);
  };

  console.info = function (...args) {
    earlyLogs.push({
      type: 'info',
      args,
      timestamp: Date.now()
    });
    return originalConsole.info.apply(console, args);
  };
}

// Function to replay logs to the screen logger
export function replayLogsToScreenLogger(maxEntries = 200) {
  if (!window.screenLog || earlyLogs.length === 0) return;

  // Add a separator (not captured in earlyLogs, and not timestamped)
  if (window.screenLog && typeof window.screenLog.log === 'function') {
    window.screenLog.log("---------- EARLY LOGS ----------");
  }

  // Process logs for display - limit to maxEntries, taking the most recent logs
  const logsToReplay = earlyLogs.slice(-maxEntries).filter(log => {
    // Filter out any separator lines before replaying
    return !(
      typeof log.args[0] === "string" &&
      (log.args[0].includes("EARLY LOGS") || log.args[0].includes("END EARLY LOGS"))
    );
  });

  // Re-log each entry (do not log the separator as a log entry)
  for (const log of logsToReplay) {
    if (log.type === 'warn') {
      window.screenLog.warn(...log.args);
    } else if (log.type === 'error') {
      window.screenLog.error(...log.args);
    } else if (log.type === 'info') {
      window.screenLog.info(...log.args);
    } else {
      window.screenLog.log(...log.args);
    }
  }

  // Add end separator (not timestamped)
  if (window.screenLog && typeof window.screenLog.log === 'function') {
    window.screenLog.log("---------- END EARLY LOGS ----------");
  }
} 
