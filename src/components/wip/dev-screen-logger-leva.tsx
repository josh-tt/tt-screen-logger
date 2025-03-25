"use client"; // for use with next.js only

import { buttonGroup, LevaPanel, useControls, useCreateStore } from "leva";
import { useCallback, useEffect, useRef, useState } from "react";

interface ScreenLoggerProps {
  color?: string;
  fontSize?: string;
  bgColor?: string;
  width?: string;
  height?: string;
  opacity?: number;
  shortcutKey?: string;
  initiallyVisible?: boolean;
  enableTesting?: boolean;
  /** New prop to enable or disable keystroke listeners */
  listenToKeystrokes?: boolean;
}

type LogEntry = {
  type: "log" | "info" | "warn" | "error";
  content: string;
  timestamp: number;
  objectData?: any;
};

/**
 * ScreenLogger Component with Leva UI
 *
 * A customizable console logger that displays logs in a Leva panel.
 *
 * Keyboard Shortcuts:
 * - Ctrl+K: Toggle visibility
 * - Ctrl+T: Toggle throttling
 * - Ctrl+X: Clear logs
 * - Ctrl+Shift+C: Copy logs to clipboard
 */
export function ScreenLogger(props: ScreenLoggerProps = {}) {
  const {
    color = "#ffffff",
    fontSize = "14px",
    bgColor = "#1a1a1a",
    width = "400px",
    height = "auto",
    opacity = 0.9,
    shortcutKey = "k", // default key is 'k'
    initiallyVisible = false,
    enableTesting = false,
    listenToKeystrokes = true,
  } = props;

  // Logs state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [errorLogs, setErrorLogs] = useState<LogEntry[]>([]);
  const [warnLogs, setWarnLogs] = useState<LogEntry[]>([]);
  const [infoLogs, setInfoLogs] = useState<LogEntry[]>([]);
  const [objectLogs, setObjectLogs] = useState<LogEntry[]>([]);

  // References and state
  const isInitializedRef = useRef(false);
  const consoleMethodsRef = useRef<Record<string, any>>({});
  const [isVisible, setIsVisible] = useState(initiallyVisible);

  // Throttling state
  const throttleConfigRef = useRef({
    throttled: false,
    paused: false,
    delay: 250,
  });
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingLogsRef = useRef<Array<{ fn: string; args: any[] }>>([]);
  const lastLogTimeRef = useRef<number>(0);

  // Testing state
  const testSignalIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const testSignalCountRef = useRef(0);

  // Create a dedicated store just for the screen logger
  const loggerStore = useRef(useCreateStore());

  // Use the dedicated store with useControls
  const [
    {
      throttleEnabled,
      throttleDelay,
      pauseLogging,
      searchText,
      showErrors,
      showWarnings,
      showInfo,
      showObjects,
    },
  ] = useControls(
    () => ({
      visibility: {
        value: initiallyVisible,
        label: "Show Logs",
        onChange: (v) => setIsVisible(v),
      },
      throttleEnabled: {
        value: false,
        label: "Enable Throttling",
      },
      throttleDelay: {
        value: 250,
        min: 100,
        max: 2000,
        step: 50,
        label: "Delay (ms)",
        render: (get) => get("throttleEnabled"),
      },
      pauseLogging: {
        value: false,
        label: "Pause All Logging",
      },
      actionButtons: buttonGroup({
        clear: () => clearLogs(),
        copy: () => copyLogs(),
        test: () => toggleTestSignals(),
      }),
      searchText: {
        value: "",
        label: "Search Logs",
      },
      showErrors: {
        value: true,
        label: "Show Errors",
      },
      showWarnings: {
        value: true,
        label: "Show Warnings",
      },
      showInfo: {
        value: true,
        label: "Show Info",
      },
      showObjects: {
        value: true,
        label: "Show Objects",
      },
    }),
    { store: loggerStore.current } // Use dedicated store here
  );

  // Get filtered logs based on search and type filters
  const getFilteredLogs = useCallback(() => {
    let filteredLogs = [...logs];

    if (searchText) {
      filteredLogs = filteredLogs.filter((log) =>
        log.content.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    if (!showErrors) {
      filteredLogs = filteredLogs.filter((log) => log.type !== "error");
    }

    if (!showWarnings) {
      filteredLogs = filteredLogs.filter((log) => log.type !== "warn");
    }

    if (!showInfo) {
      filteredLogs = filteredLogs.filter((log) => log.type !== "info");
    }

    if (!showObjects) {
      filteredLogs = filteredLogs.filter((log) => !log.objectData);
    }

    return filteredLogs;
  }, [logs, searchText, showErrors, showWarnings, showInfo, showObjects]);

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);
    setErrorLogs([]);
    setWarnLogs([]);
    setInfoLogs([]);
    setObjectLogs([]);
    pendingLogsRef.current = [];

    if (throttleTimeoutRef.current) {
      clearTimeout(throttleTimeoutRef.current);
      throttleTimeoutRef.current = null;
    }

    if (window.screenLog) {
      window.screenLog.log("Logs cleared");
    }
  }, []);

  // Copy logs to clipboard
  const copyLogs = useCallback(() => {
    const logsText = logs
      .map((log) => `[${log.type.toUpperCase()}] ${log.content}`)
      .join("\n");

    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(logsText)
        .then(() => {
          addLogEntry("log", "Logs copied to clipboard");
        })
        .catch((err) => {
          addLogEntry("error", "Failed to copy logs: " + err);
        });
    } else {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = logsText;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        addLogEntry("log", "Logs copied to clipboard");
      } catch (err) {
        addLogEntry("error", "Failed to copy logs: " + err);
      }
      document.body.removeChild(textarea);
    }
  }, [logs]);

  // Toggle test signals
  const toggleTestSignals = useCallback(() => {
    if (testSignalIntervalRef.current) {
      clearInterval(testSignalIntervalRef.current);
      testSignalIntervalRef.current = null;
      addLogEntry("log", "Test signals stopped");
    } else {
      startContinuousTestSignals();
      addLogEntry("log", "Test signals started");
    }
  }, []);

  // Add a log entry
  const addLogEntry = useCallback(
    (
      type: "log" | "info" | "warn" | "error",
      content: string,
      objectData?: any
    ) => {
      const entry: LogEntry = {
        type,
        content,
        timestamp: Date.now(),
        objectData,
      };

      setLogs((prev) => [...prev, entry]);

      // Also add to type-specific arrays
      switch (type) {
        case "error":
          setErrorLogs((prev) => [...prev, entry]);
          break;
        case "warn":
          setWarnLogs((prev) => [...prev, entry]);
          break;
        case "info":
          setInfoLogs((prev) => [...prev, entry]);
          break;
      }

      if (objectData) {
        setObjectLogs((prev) => [...prev, entry]);
      }
    },
    []
  );

  // Process a log
  const processLog = useCallback(
    (type: "log" | "info" | "warn" | "error", ...args: any[]) => {
      if (throttleConfigRef.current.paused) return;

      // Convert arguments to string
      const content = args
        .map((arg) => {
          if (typeof arg === "object" && arg !== null) {
            try {
              return JSON.stringify(arg);
            } catch (e) {
              return "[Circular]";
            }
          }
          return String(arg);
        })
        .join(" ");

      const objectData = args.find(
        (arg) => typeof arg === "object" && arg !== null
      );

      if (throttleConfigRef.current.throttled) {
        const now = Date.now();
        if (now - lastLogTimeRef.current >= throttleConfigRef.current.delay) {
          addLogEntry(type, content, objectData);
          lastLogTimeRef.current = now;
        }
        return;
      }

      addLogEntry(type, content, objectData);
    },
    [addLogEntry]
  );

  // Create loggers for each console method
  const createLoggers = useCallback(() => {
    // Store original methods safely
    const originalMethods = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      clear: console.clear.bind(console),
    };

    consoleMethodsRef.current = originalMethods;

    // Override console methods
    console.log = function (...args: any[]) {
      originalMethods.log(...args);
      processLog("log", ...args);
    };

    console.info = function (...args: any[]) {
      originalMethods.info(...args);
      processLog("info", ...args);
    };

    console.warn = function (...args: any[]) {
      originalMethods.warn(...args);
      processLog("warn", ...args);
    };

    console.error = function (...args: any[]) {
      originalMethods.error(...args);
      processLog("error", ...args);
    };

    console.clear = function () {
      originalMethods.clear();
      clearLogs();
    };

    // Create global screenLog object
    window.screenLog = {
      log: function (...args: any[]) {
        processLog("log", ...args);
        // Call original directly without apply to avoid this binding issues
        originalMethods.log(...args);
      },
      info: function (...args: any[]) {
        processLog("info", ...args);
        originalMethods.info(...args);
      },
      warn: function (...args: any[]) {
        processLog("warn", ...args);
        originalMethods.warn(...args);
      },
      error: function (...args: any[]) {
        processLog("error", ...args);
        originalMethods.error(...args);
      },
      clear: clearLogs,
      destroy: destroyLogger,
    };

    addLogEntry("log", "Screen logger initialized");
  }, [processLog, clearLogs, addLogEntry]);

  // Start continuous test signals
  const startContinuousTestSignals = useCallback(() => {
    if (testSignalIntervalRef.current) {
      clearInterval(testSignalIntervalRef.current);
    }

    const delay = throttleConfigRef.current.throttled
      ? throttleConfigRef.current.delay
      : 100;

    testSignalIntervalRef.current = setInterval(() => {
      testSignalCountRef.current++;
      if (window.screenLog) {
        window.screenLog.log(
          `Test log #${testSignalCountRef.current} ${
            throttleConfigRef.current.throttled
              ? `(throttled to ${throttleConfigRef.current.delay}ms)`
              : "(sending 10 logs per second)"
          }`
        );

        // Every 5th message is a warning
        if (testSignalCountRef.current % 5 === 0) {
          window.screenLog.warn(
            `Test warning #${testSignalCountRef.current / 5}`
          );
        }

        // Every 10th message is an error
        if (testSignalCountRef.current % 10 === 0) {
          window.screenLog.error(
            `Test error #${testSignalCountRef.current / 10}`
          );
        }

        // Every 7th message is an object
        if (testSignalCountRef.current % 7 === 0) {
          window.screenLog.log("Object test:", {
            count: testSignalCountRef.current,
            timestamp: new Date().toISOString(),
            throttled: throttleConfigRef.current.throttled,
          });
        }
      }
    }, delay);
  }, []);

  // Stop continuous test signals
  const stopContinuousTestSignals = useCallback(() => {
    if (testSignalIntervalRef.current) {
      clearInterval(testSignalIntervalRef.current);
      testSignalIntervalRef.current = null;
    }
  }, []);

  // Destroy logger and restore original console methods
  const destroyLogger = useCallback(() => {
    const originalMethods = consoleMethodsRef.current;

    if (originalMethods.log) console.log = originalMethods.log;
    if (originalMethods.info) console.info = originalMethods.info;
    if (originalMethods.warn) console.warn = originalMethods.warn;
    if (originalMethods.error) console.error = originalMethods.error;
    if (originalMethods.clear) console.clear = originalMethods.clear;

    stopContinuousTestSignals();

    if (throttleTimeoutRef.current) {
      clearTimeout(throttleTimeoutRef.current);
      throttleTimeoutRef.current = null;
    }

    isInitializedRef.current = false;
    // Fix: Use conditional assignment instead of delete
    window.screenLog = undefined;
  }, [stopContinuousTestSignals]);

  // Watch for control changes
  useEffect(() => {
    throttleConfigRef.current = {
      throttled: throttleEnabled,
      paused: pauseLogging,
      delay: throttleDelay,
    };

    // If testing is active, restart with new settings
    if (testSignalIntervalRef.current) {
      stopContinuousTestSignals();
      startContinuousTestSignals();
    }
  }, [
    throttleEnabled,
    throttleDelay,
    pauseLogging,
    stopContinuousTestSignals,
    startContinuousTestSignals,
  ]);

  // Initialize when component mounts
  useEffect(() => {
    if (!isInitializedRef.current) {
      createLoggers();
      isInitializedRef.current = true;
    }

    return () => {
      destroyLogger();
    };
  }, [createLoggers, destroyLogger]);

  // Toggle visibility based on controls
  useEffect(() => {
    if (isVisible && enableTesting && !testSignalIntervalRef.current) {
      startContinuousTestSignals();
    } else if (!isVisible && testSignalIntervalRef.current) {
      stopContinuousTestSignals();
    }
  }, [
    isVisible,
    enableTesting,
    startContinuousTestSignals,
    stopContinuousTestSignals,
  ]);

  // Add keyboard shortcuts
  useEffect(() => {
    if (!listenToKeystrokes) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle visibility with Ctrl+K (or Cmd+K)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === shortcutKey.toLowerCase() &&
        !e.altKey
      ) {
        e.preventDefault();
        // Toggle the visibility state
        setIsVisible(!isVisible);

        // Don't try to use setSettings - it's not available
        return;
      }

      if (!isVisible) return;

      // Toggle throttling with Ctrl+T (or Cmd+T)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "t") {
        e.preventDefault();
        // We can't directly update Leva controls from here,
        // so we'll update our ref and let the UI catch up
        throttleConfigRef.current = {
          ...throttleConfigRef.current,
          throttled: !throttleConfigRef.current.throttled,
        };
        return;
      }

      // Clear logs with Ctrl+X
      if (e.ctrlKey && e.key.toLowerCase() === "x") {
        e.preventDefault();
        clearLogs();
        return;
      }

      // Copy logs with Ctrl+Shift+C
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copyLogs();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    shortcutKey,
    listenToKeystrokes,
    isVisible,
    setIsVisible,
    clearLogs,
    copyLogs,
  ]);

  // Use the LevaPanel with proper props
  return (
    <>
      <div
        style={{
          position: "fixed",
          top: "10px",
          right: "10px",
          zIndex: 10000,
        }}
      >
        <LevaPanel
          store={loggerStore.current}
          titleBar={{
            title: "Screen Logger",
            filter: false,
            drag: true,
          }}
          theme={{
            colors: {
              accent1: "#805AD5",
              accent2: "#553C9A",
              accent3: "#44337A",
              highlight1: "#805AD5",
              highlight2: "#9F7AEA",
              highlight3: "#B794F4",
              elevation1: bgColor,
              elevation2: "#282828",
              elevation3: "#333333",
            },
          }}
          collapsed={!isVisible}
        />
      </div>

      {isVisible && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width,
            maxHeight: "80vh",
            background: bgColor,
            borderRadius: "6px",
            padding: "15px",
            boxShadow: "0 0 10px rgba(0,0,0,0.3)",
            color,
            fontSize,
            opacity,
            display: isVisible ? "block" : "none",
            overflow: "auto",
            zIndex: 1000,
          }}
        >
          <div style={{ marginBottom: "10px", fontWeight: "bold" }}>
            Log Output ({getFilteredLogs().length} entries)
          </div>

          <div style={{ maxHeight: "60vh", overflowY: "auto", padding: "5px" }}>
            {getFilteredLogs().map((log, index) => (
              <div
                key={index}
                style={{
                  padding: "4px 8px",
                  margin: "4px 0",
                  borderRadius: "3px",
                  background: index % 2 ? "rgba(0,0,0,0.2)" : "transparent",
                  borderLeft: `3px solid ${
                    log.type === "error"
                      ? "#FC8181"
                      : log.type === "warn"
                      ? "#F6AD55"
                      : log.type === "info"
                      ? "#63B3ED"
                      : "#A0AEC0"
                  }`,
                }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ fontSize: "0.8em", opacity: 0.7 }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div>{log.content}</div>
                {log.objectData && (
                  <details style={{ marginTop: "5px" }}>
                    <summary style={{ cursor: "pointer" }}>Object data</summary>
                    <pre
                      style={{
                        background: "rgba(0,0,0,0.3)",
                        padding: "5px",
                        borderRadius: "3px",
                        fontSize: "0.9em",
                        overflow: "auto",
                        maxHeight: "200px",
                      }}
                    >
                      {JSON.stringify(log.objectData, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// Type definition for window.screenLog
declare global {
  interface Window {
    screenLog?: {
      log: (...args: any[]) => void;
      clear: () => void;
      info: (...args: any[]) => void;
      warn: (...args: any[]) => void;
      error: (...args: any[]) => void;
      destroy: () => void;
    };
  }
}
