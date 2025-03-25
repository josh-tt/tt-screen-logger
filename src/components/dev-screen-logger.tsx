"use client"; // for use with next.js only

import { useCallback, useEffect, useRef, useState } from "react";

interface ScreenLoggerProps {
  color?: string;
  fontSize?: string;
  bgColor?: string;
  position?: "top" | "bottom";
  width?: string;
  height?: string;
  buttonPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  opacity?: number;
  shortcutKey?: string;
  showButton?: boolean;
  initiallyVisible?: boolean;
  enableTesting?: boolean;
  initialPosition?:
    | "top"
    | "bottom"
    | "left"
    | "right"
    | "center"
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right";
  /** New prop to enable or disable keystroke listeners */
  listenToKeystrokes?: boolean;
}

type LoggerPosition =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

// In the interface for throttleConfigRef, we need to add the _previousState field
type ThrottleConfig = {
  throttled: boolean;
  paused: boolean;
  delay: number;
  _previousState?: {
    throttled: boolean;
    delay: number;
  };
};

/**
 * ScreenLogger Component
 *
 * A customizable console logger that displays logs directly on the screen.
 *
 * Keyboard Shortcuts:
 * - Ctrl+K: Toggle visibility
 * - Ctrl+T: Toggle throttling
 * - Ctrl+X: Clear logs
 * - Ctrl+Shift+C: Copy logs to clipboard
 * - Ctrl+[i,u,o,j,l,.,m,,,h]: Change panel position
 */
export function ScreenLogger(props: ScreenLoggerProps = {}) {
  const {
    color = "oklch(0.967 0.001 286.375)",
    fontSize = "1em",
    bgColor = "rgb(26, 26, 26);",
    position = "bottom",
    width = "50%",
    height = "100vh",
    buttonPosition = "bottom-right",
    opacity = 0.9,
    shortcutKey = "k", // default key is 'k'
    showButton = true,
    initiallyVisible = true,
    initialPosition = "bottom",
    enableTesting = true, // Default to false to avoid test signals unless explicitly enabled
    listenToKeystrokes = true, // New prop: default to listening to keystrokes
  } = props;

  const [isVisible, setIsVisible] = useState(initiallyVisible);
  const isInitializedRef = useRef(false);
  const logElementRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [loggerPosition, setLoggerPosition] = useState<LoggerPosition>(
    initialPosition as LoggerPosition
  );
  const [loggerWidth, setLoggerWidth] = useState<string>("50%"); // Track width separately

  // --- THROTTLING STATE ---
  // Combined throttle config stored in a ref to avoid stale closures.
  const throttleConfigRef = useRef<ThrottleConfig>({
    throttled: false,
    paused: false,
    delay: 250,
  });
  const [isLoggingThrottled, setIsLoggingThrottled] = useState(false);
  const [throttleDelay, setThrottleDelay] = useState(250);
  const [isLoggingPaused, setIsLoggingPaused] = useState(false);
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingLogsRef = useRef<Array<{ fn: string; args: any[] }>>([]);
  const lastLogTimeRef = useRef<number>(0);

  const [searchQuery, setSearchQuery] = useState("");

  // A helper function to filter logs based on the query.
  const filterLogs = useCallback(() => {
    const contentEl = document.getElementById("screenlog-content");
    if (!contentEl) return;

    // Get all log entries in the content container
    Array.from(contentEl.children).forEach((el) => {
      // Skip the throttle indicator if it's somehow in the content
      if (el.id === "screenlog-throttle-indicator") return;

      const logEntry = el as HTMLElement;

      if (searchQuery === "") {
        // If search is empty, show all logs
        logEntry.style.display = "";
      } else if (
        el.textContent?.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        // Show logs that match the search
        logEntry.style.display = "";
      } else {
        // Hide logs that don't match
        logEntry.style.display = "none";
      }
    });

    // Don't show search activity in logs to avoid cluttering
  }, [searchQuery]);

  // Test signals
  const testSignalIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const testSignalCountRef = useRef(0);

  // Function to update log entry count
  const updateLogCount = useCallback(() => {
    if (!logElementRef.current) return;
    const header = document.getElementById("screenlog-header");
    const contentEl = document.getElementById("screenlog-content");

    if (header && contentEl) {
      const count = Array.from(contentEl.children).length;
      header.textContent = `Log (${count} entries)`;
      header.style.color = color;
    }
  }, []);

  // --- UPDATE THROTTLING INDICATOR ---
  const updateThrottlingIndicator = useCallback(() => {
    if (!logElementRef.current) return;
    const existingIndicator = document.getElementById(
      "screenlog-throttle-indicator"
    );
    if (existingIndicator) {
      existingIndicator.remove();
    }
    const { throttled, paused, delay } = throttleConfigRef.current;
    if (!throttled && !paused) return;

    const indicator = document.createElement("div");
    indicator.id = "screenlog-throttle-indicator";
    indicator.style.position = "sticky";
    indicator.style.bottom = "0";
    indicator.style.left = "0";
    indicator.style.width = "100%";
    indicator.style.padding = "8px";
    indicator.style.fontSize = "12px";
    indicator.style.fontWeight = "bold";
    indicator.style.textAlign = "center";
    indicator.style.zIndex = "10";
    indicator.style.borderTop = "1px solid rgba(255, 255, 255, 0.2)";
    indicator.style.borderRadius = "0 0 6px 6px";
    indicator.style.margin = "0";
    indicator.style.background = bgColor;

    if (paused) {
      indicator.style.backgroundColor = "oklch(0.681 0.162 75.834)";
      indicator.style.color = "white";
      indicator.textContent = "PAUSED";
    } else {
      indicator.style.backgroundColor = "oklch(0.577 0.245 27.325)";
      indicator.style.color = "white";
      indicator.textContent = `THROTTLED: Every ${delay}ms`;
    }

    // Make sure the indicator is at the bottom
    logElementRef.current.appendChild(indicator);

    // Update log count whenever throttling indicator changes
    updateLogCount();
  }, [updateLogCount, bgColor]);

  // Function to handle search state changes and control auto-pause
  const handleSearchChange = useCallback(
    (query: string) => {
      const wasPreviouslySearching = searchQuery !== "";
      const isNowSearching = query !== "";

      // Update the search query state
      setSearchQuery(query);

      // Auto-pause/resume based on search state
      if (!wasPreviouslySearching && isNowSearching) {
        // Starting a search - pause logging if not already paused
        if (!throttleConfigRef.current.paused) {
          // Save current throttle state for later
          const wasThrottled = throttleConfigRef.current.throttled;
          const prevDelay = throttleConfigRef.current.delay;

          // Store previous state for resuming
          throttleConfigRef.current._previousState = {
            throttled: wasThrottled,
            delay: prevDelay,
          };

          // Enable pause
          throttleConfigRef.current.paused = true;
          throttleConfigRef.current.throttled = false;
          setIsLoggingPaused(true);
          setIsLoggingThrottled(false);

          // Update the UI to reflect paused state
          updateThrottlingIndicator();
        }
      } else if (wasPreviouslySearching && !isNowSearching) {
        // Ending a search - resume if we auto-paused
        if (
          throttleConfigRef.current.paused &&
          throttleConfigRef.current._previousState
        ) {
          // Restore previous throttle state
          throttleConfigRef.current.paused = false;
          throttleConfigRef.current.throttled =
            throttleConfigRef.current._previousState.throttled;
          throttleConfigRef.current.delay =
            throttleConfigRef.current._previousState.delay;

          // Clean up
          delete throttleConfigRef.current._previousState;

          // Update the UI
          setIsLoggingPaused(false);
          setIsLoggingThrottled(throttleConfigRef.current.throttled);

          // Update the UI to reflect restored state
          updateThrottlingIndicator();
        }
      }

      // Apply the filter
      setTimeout(filterLogs, 0);
    },
    [searchQuery, filterLogs, updateThrottlingIndicator]
  );

  // --- TEST SIGNALS ---
  const startContinuousTestSignals = useCallback(() => {
    if (testSignalIntervalRef.current) {
      clearInterval(testSignalIntervalRef.current);
      testSignalIntervalRef.current = null;
    }
    const currentDelay = throttleConfigRef.current.throttled
      ? throttleConfigRef.current.delay
      : 10;
    testSignalIntervalRef.current = setInterval(() => {
      testSignalCountRef.current++;
      if (window.screenLog) {
        window.screenLog.log(
          `Test log #${testSignalCountRef.current} ${
            throttleConfigRef.current.throttled
              ? `(throttled to ${throttleConfigRef.current.delay}ms)`
              : "(sending 100 logs per second)"
          }`
        );
      }
    }, currentDelay);
  }, []);

  const stopContinuousTestSignals = useCallback(() => {
    if (testSignalIntervalRef.current) {
      clearInterval(testSignalIntervalRef.current);
      testSignalIntervalRef.current = null;
    }
  }, []);

  // --- COPY LOGS FUNCTION ---
  const copyLogs = useCallback(() => {
    if (logElementRef.current) {
      const logsText = logElementRef.current.innerText;
      if (navigator.clipboard) {
        navigator.clipboard
          .writeText(logsText)
          .then(() => {
            if (window.screenLog) {
              window.screenLog.log("Logs copied to clipboard");
            }
          })
          .catch((err) => {
            if (window.screenLog) {
              window.screenLog.log("Failed to copy logs", err);
            }
          });
      } else {
        // Fallback for older browsers
        const textarea = document.createElement("textarea");
        textarea.value = logsText;
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand("copy");
          if (window.screenLog) {
            window.screenLog.log("Logs copied to clipboard");
          }
        } catch (err) {
          if (window.screenLog) {
            window.screenLog.log("Failed to copy logs", err);
          }
        }
        document.body.removeChild(textarea);
      }
    }
  }, []);

  // --- TOGGLE THROTTLING ---
  const toggleThrottling = useCallback(() => {
    if (throttleTimeoutRef.current) {
      clearTimeout(throttleTimeoutRef.current);
      throttleTimeoutRef.current = null;
    }
    stopContinuousTestSignals();
    const current = throttleConfigRef.current;
    let newThrottled = current.throttled;
    let newPaused = current.paused;
    let newDelay = current.delay;
    let message = "";
    if (!current.throttled && !current.paused) {
      newThrottled = true;
      newPaused = false;
      newDelay = 250;
      message = "🔄 THROTTLING ENABLED: 250ms";
      lastLogTimeRef.current = Date.now();
    } else if (current.throttled && current.delay === 250) {
      newThrottled = true;
      newPaused = false;
      newDelay = 500;
      message = "🔄 THROTTLING SET TO: 500ms";
    } else if (current.throttled && current.delay === 500) {
      newThrottled = true;
      newPaused = false;
      newDelay = 1000;
      message = "🔄 THROTTLING SET TO: 1000ms";
    } else if (current.throttled && current.delay === 1000) {
      newThrottled = false;
      newPaused = true;
      newDelay = 1000;
      message = "⏸️ LOGGING PAUSED - No new logs will be shown";
    } else {
      newThrottled = false;
      newPaused = false;
      newDelay = 250;
      message = "✅ THROTTLING DISABLED - Normal logging resumed";
    }
    throttleConfigRef.current = {
      throttled: newThrottled,
      paused: newPaused,
      delay: newDelay,
    };
    setIsLoggingThrottled(newThrottled);
    setIsLoggingPaused(newPaused);
    setThrottleDelay(newDelay);
    pendingLogsRef.current = [];
    setTimeout(() => {
      if (window.screenLog) {
        window.screenLog.log(message);
      }
      updateThrottlingIndicator();
      if (enableTesting) {
        startContinuousTestSignals();
      }
    }, 50);
  }, [
    enableTesting,
    stopContinuousTestSignals,
    updateThrottlingIndicator,
    startContinuousTestSignals,
  ]);

  // --- RESPONSIVE WIDTH & POSITIONING ---
  const getResponsiveWidth = useCallback((position: LoggerPosition): string => {
    const screenWidth = window.innerWidth;
    if (screenWidth <= 640) {
      if (position === "left" || position === "right") return "50%";
      if (position === "top" || position === "bottom") return "90%";
      if (position.includes("top-") || position.includes("bottom-"))
        return "50%";
      if (position === "center") return "90%";
    } else if (screenWidth <= 1024) {
      if (position === "left" || position === "right") return "30%";
      if (position === "top" || position === "bottom") return "70%";
      if (position.includes("top-") || position.includes("bottom-"))
        return "30%";
      if (position === "center") return "70%";
    }
    if (position === "left" || position === "right") return "20%";
    if (position === "top" || position === "bottom") return "50%";
    if (position.includes("top-") || position.includes("bottom-")) return "20%";
    if (position === "center") return "60%";
    return "50%";
  }, []);

  const resizeLogger = useCallback(
    (direction: "increase" | "decrease") => {
      return;
    },
    [
      loggerPosition,
      loggerWidth,
      color,
      isLoggingThrottled,
      updateThrottlingIndicator,
    ]
  );

  const handleKeyboardResize = useCallback(
    (direction: "increase" | "decrease") => {
      return;
    },
    [resizeLogger]
  );

  const handleWindowResize = useCallback(() => {
    if (!logElementRef.current || !isVisible) return;
    const position = loggerPosition;
    const newWidth = getResponsiveWidth(position);
    setLoggerWidth(newWidth);
    if (position === "top" || position === "bottom") {
      logElementRef.current.style.left = `calc((100% - ${newWidth}) / 2)`;
      logElementRef.current.style.right = `calc((100% - ${newWidth}) / 2)`;
    } else if (position === "center") {
      const offset = (100 - parseInt(newWidth)) / 2;
      logElementRef.current.style.left = `${offset}%`;
      logElementRef.current.style.right = `${offset}%`;
    } else {
      logElementRef.current.style.width = newWidth;
    }
  }, [isVisible, loggerPosition, getResponsiveWidth]);

  const updateLoggerPosition = useCallback(
    (newPosition: LoggerPosition) => {
      if (!logElementRef.current) return;
      const newWidth = getResponsiveWidth(newPosition);

      // Store the previous position to determine direction
      const previousPosition = loggerPosition;
      setLoggerWidth(newWidth);
      setLoggerPosition(newPosition);

      const element = logElementRef.current;

      // Determine animation direction based on position change
      let transitionOrigin = "";
      if (previousPosition === "top" && newPosition === "bottom") {
        transitionOrigin = "center bottom"; // Moving from top to bottom
      } else if (previousPosition === "bottom" && newPosition === "top") {
        transitionOrigin = "center top"; // Moving from bottom to top
      } else if (previousPosition === "left" && newPosition === "right") {
        transitionOrigin = "right center"; // Moving from left to right
      } else if (previousPosition === "right" && newPosition === "left") {
        transitionOrigin = "left center"; // Moving from right to left
      } else if (newPosition === "center") {
        transitionOrigin = "center center"; // Moving to center from anywhere
      } else if (newPosition.includes("top")) {
        transitionOrigin = "top center"; // Moving to any top position
      } else if (newPosition.includes("bottom")) {
        transitionOrigin = "bottom center"; // Moving to any bottom position
      } else if (newPosition === "left") {
        transitionOrigin = "left center"; // Moving to left
      } else if (newPosition === "right") {
        transitionOrigin = "right center"; // Moving to right
      }

      // Reset styles before applying new ones
      element.style.transition = "all 0.15s ease-in-out";
      element.style.transformOrigin = transitionOrigin;

      // Add a small animation for position changes
      if (previousPosition !== newPosition) {
        element.style.opacity = "0.3";
        element.style.transform = "scale(0.95)";

        // Reset animation after a short delay
        setTimeout(() => {
          element.style.opacity = "1";
          element.style.transform = "scale(1)";
        }, 20);
      }

      element.style.top = "auto";
      element.style.right = "auto";
      element.style.bottom = "auto";
      element.style.left = "auto";
      element.style.borderRadius = "";

      switch (newPosition) {
        case "top":
          element.style.top = "0";
          element.style.left = `calc((100% - ${newWidth}) / 2)`;
          element.style.right = `calc((100% - ${newWidth}) / 2)`;
          element.style.bottom = "auto";
          element.style.borderBottomLeftRadius = "12px";
          element.style.borderBottomRightRadius = "12px";
          break;
        case "top-left":
          element.style.top = "0";
          element.style.left = "0";
          element.style.right = "auto";
          element.style.bottom = "auto";
          element.style.borderBottomRightRadius = "12px";
          break;
        case "top-right":
          element.style.top = "0";
          element.style.right = "0";
          element.style.left = "auto";
          element.style.bottom = "auto";
          element.style.borderBottomLeftRadius = "12px";
          break;
        case "left":
          element.style.top = "0";
          element.style.left = "0";
          element.style.right = "auto";
          element.style.bottom = "0";
          element.style.borderTopRightRadius = "12px";
          element.style.borderBottomRightRadius = "12px";
          break;
        case "right":
          element.style.top = "0";
          element.style.right = "0";
          element.style.left = "auto";
          element.style.bottom = "0";
          element.style.borderTopLeftRadius = "12px";
          element.style.borderBottomLeftRadius = "12px";
          break;
        case "bottom":
          element.style.bottom = "0";
          element.style.left = `calc((100% - ${newWidth}) / 2)`;
          element.style.right = `calc((100% - ${newWidth}) / 2)`;
          element.style.top = "auto";
          element.style.borderTopLeftRadius = "12px";
          element.style.borderTopRightRadius = "12px";
          break;
        case "bottom-left":
          element.style.bottom = "0";
          element.style.left = "0";
          element.style.right = "auto";
          element.style.top = "auto";
          element.style.borderTopRightRadius = "12px";
          break;
        case "bottom-right":
          element.style.bottom = "0";
          element.style.right = "0";
          element.style.left = "auto";
          element.style.top = "auto";
          element.style.borderTopLeftRadius = "12px";
          break;
        case "center":
          const offset = (100 - parseInt(newWidth)) / 2;
          element.style.top = "20%";
          element.style.left = `${offset}%`;
          element.style.right = `${offset}%`;
          element.style.bottom = "auto";
          element.style.borderRadius = "12px";
          break;
        default:
          element.style.bottom = "0";
          element.style.left = "0";
          element.style.right = "0";
          element.style.top = "auto";
      }
      if (newPosition === "left" || newPosition === "right") {
        element.style.width = newWidth;
        element.style.maxHeight = "100vh";
        element.style.height = "100vh";
      } else if (newPosition === "center") {
        element.style.width = newWidth;
        element.style.maxHeight = "60vh";
        element.style.height = "60vh";
      } else {
        element.style.width = newWidth;
        element.style.maxHeight = "40vh";
        element.style.height = "40vh";
      }
      element.style.borderTop = "";
      element.style.borderRight = "";
      element.style.borderBottom = "";
      element.style.borderLeft = "";
      if (newPosition.includes("bottom")) {
        element.style.borderTop = "1px solid rgba(255,255,255,0.1)";
      } else if (newPosition.includes("top")) {
        element.style.borderBottom = "1px solid rgba(255,255,255,0.1)";
      }
      if (newPosition === "left") {
        element.style.borderRight = "1px solid rgba(255,255,255,0.1)";
      } else if (newPosition === "right") {
        element.style.borderLeft = "1px solid rgba(255,255,255,0.1)";
      }

      // Ensure content area gets proper height
      const contentEl = element.querySelector(
        "#screenlog-content"
      ) as HTMLElement;
      if (contentEl) {
        contentEl.style.height = "calc(100% - 50px)";
        contentEl.style.overflowY = "scroll";
      }

      if (window.screenLog) {
        window.screenLog.log(`Logger position changed to: ${newPosition}`);
      }
    },
    [getResponsiveWidth, loggerPosition]
  );

  // --- INITIALIZE SCREEN LOG ---
  const initScreenLog = useCallback(() => {
    if (isInitializedRef.current && logElementRef.current) {
      logElementRef.current.style.display = isVisible ? "block" : "none";
      return;
    }
    const existingLoggers = document.getElementsByClassName("screenlog");
    Array.from(existingLoggers).forEach((el) => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });

    const _console: Record<string, any> = {};
    const _options = {
      bgColor: bgColor,
      logColor: color,
      infoColor: "#63B3ED", // Blue - match Leva version
      warnColor: "#F6AD55", // Orange - match Leva version
      errorColor: "#FC8181", // Red - match Leva version
      fontSize: fontSize,
      freeConsole: false,
      css: "",
      autoScroll: true,
      position: position,
      width: width,
      height: height,
      opacity: opacity,
    };

    function createElement(tag: string, css: string) {
      const element = document.createElement(tag);
      element.style.cssText = css;
      return element;
    }

    function createPanel() {
      let positionCSS = "";
      let sizeCSS = "";
      const responsiveWidth = getResponsiveWidth(loggerPosition);
      switch (loggerPosition) {
        case "top":
          positionCSS = `top:0;left:calc((100% - ${responsiveWidth}) / 2);right:calc((100% - ${responsiveWidth}) / 2);bottom:auto;`;
          sizeCSS = `width:${responsiveWidth};max-height:40vh;`;
          break;
        case "top-left":
          positionCSS = "top:0;left:0;right:auto;bottom:auto;";
          sizeCSS = `width:${responsiveWidth};max-height:40vh;`;
          break;
        case "top-right":
          positionCSS = "top:0;right:0;left:auto;bottom:auto;";
          sizeCSS = `width:${responsiveWidth};max-height:40vh;`;
          break;
        case "left":
          positionCSS = "top:0;left:0;right:auto;bottom:0;";
          sizeCSS = `width:${responsiveWidth};max-height:100vh;`;
          break;
        case "right":
          positionCSS = "top:0;right:0;left:auto;bottom:0;";
          sizeCSS = `width:${responsiveWidth};max-height:100vh;`;
          break;
        case "bottom":
          positionCSS = `bottom:0;left:calc((100% - ${responsiveWidth}) / 2);right:calc((100% - ${responsiveWidth}) / 2);top:auto;`;
          sizeCSS = `width:${responsiveWidth};max-height:40vh;`;
          break;
        case "bottom-left":
          positionCSS = "bottom:0;left:0;right:auto;top:auto;";
          sizeCSS = `width:${responsiveWidth};max-height:40vh;`;
          break;
        case "bottom-right":
          positionCSS = "bottom:0;right:0;left:auto;top:auto;";
          sizeCSS = `width:${responsiveWidth};max-height:40vh;`;
          break;
        case "center":
          const offset = (100 - parseInt(responsiveWidth)) / 2;
          positionCSS = `top:20%;left:${offset}%;right:${offset}%;bottom:auto;`;
          sizeCSS = `width:${responsiveWidth};max-height:60vh;`;
          break;
        default:
          positionCSS = "bottom:0;left:0;right:0;top:auto;";
          sizeCSS = `width:${responsiveWidth};max-height:40vh;`;
      }
      const div = createElement(
        "div",
        "z-index:2147483647;font-family:Helvetica,Arial,sans-serif;font-size:" +
          _options.fontSize +
          ";padding:0;text-align:left;opacity:" +
          _options.opacity +
          ";position:fixed;" +
          positionCSS +
          sizeCSS +
          "overflow:hidden;background:" +
          _options.bgColor +
          ";display:flex;flex-direction:column;" +
          _options.css
      );

      div.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";
      div.style.transition = "all 0.15s ease";
      div.style.width = div.style.width || "auto";
      div.style.borderRadius = "6px"; // Add rounded corners like Leva version
      div.style.height = div.style.maxHeight; // Ensure height is set to maxHeight

      if (loggerPosition.includes("bottom")) {
        div.style.borderTop = "1px solid rgba(255,255,255,0.1)";
      } else if (loggerPosition.includes("top")) {
        div.style.borderBottom = "1px solid rgba(255,255,255,0.1)";
      }
      if (loggerPosition === "left") {
        div.style.borderRight = "1px solid rgba(255,255,255,0.1)";
      } else if (loggerPosition === "right") {
        div.style.borderLeft = "1px solid rgba(255,255,255,0.1)";
      }
      div.className = "screenlog";

      // Create log header that will be sticky
      const headerDiv = document.createElement("div");
      headerDiv.id = "screenlog-header";
      headerDiv.style.fontWeight = "bold";
      headerDiv.style.margin = "0";
      headerDiv.style.position = "sticky";
      headerDiv.style.top = "0";
      headerDiv.style.zIndex = "10";
      headerDiv.style.background = _options.bgColor;
      headerDiv.style.padding = "15px 15px 10px 15px";
      headerDiv.style.borderBottom = "1px solid rgba(255, 255, 255, 0.1)";
      headerDiv.style.width = "100%";
      headerDiv.textContent = "Log Output (0 entries)";

      // Create content container for logs
      const contentDiv = document.createElement("div");
      contentDiv.id = "screenlog-content";
      contentDiv.style.overflow = "auto";
      contentDiv.style.padding = "5px 15px";
      contentDiv.style.flex = "1";
      contentDiv.style.height = "calc(100% - 50px)"; // Account for header height
      contentDiv.style.overflowY = "scroll"; // Explicitly enable vertical scrolling
      contentDiv.style.overscrollBehavior = "contain"; // Prevent scroll chaining

      // Add header and content to the div
      div.appendChild(headerDiv);
      div.appendChild(contentDiv);

      return div;
    }

    // Create the logger panel first
    const logEl = createPanel() as HTMLDivElement;
    logEl.style.display = isVisible ? "block" : "none";
    document.body.appendChild(logEl);
    logElementRef.current = logEl;

    _console.log = console.log;
    _console.clear = console.clear;
    _console.info = console.info;
    _console.warn = console.warn;
    _console.error = console.error;

    function clear() {
      if (logElementRef.current) {
        // Find the content container
        const contentEl = document.getElementById("screenlog-content");
        const header = document.getElementById("screenlog-header");

        if (contentEl) {
          // Clear only the content container's children instead of removing it completely
          contentEl.innerHTML = "";
        }

        if (header) {
          // Reset the header text
          header.textContent = "Log Output (0 entries)";
        }
      }

      pendingLogsRef.current = [];
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
        throttleTimeoutRef.current = null;
      }
    }

    function genericLogger(color: string) {
      return function (...args: any[]) {
        if (!logElementRef.current || throttleConfigRef.current.paused) return;
        const contentEl = document.getElementById("screenlog-content");
        if (!contentEl) return;

        if (throttleConfigRef.current.throttled) {
          const now = Date.now();
          if (now - lastLogTimeRef.current >= throttleConfigRef.current.delay) {
            // Determine log type based on color
            const logType =
              color === _options.errorColor
                ? "error"
                : color === _options.warnColor
                ? "warn"
                : color === _options.infoColor
                ? "info"
                : "log";

            const borderColor =
              logType === "error"
                ? "#FC8181"
                : logType === "warn"
                ? "#F6AD55"
                : logType === "info"
                ? "#63B3ED"
                : "#A0AEC0";

            const el = createElement(
              "div",
              "line-height:1.7em;min-height:1.7em;white-space:pre-wrap;" +
                "background:" +
                (contentEl.children.length % 2
                  ? "rgba(0,0,0,0.2)"
                  : "transparent") +
                ";color:" +
                color +
                ";padding:4px 8px;margin:4px 0;border-radius:3px;" +
                "border-left:3px solid " +
                borderColor +
                ";"
            );

            // Add timestamp in the right corner
            const header = document.createElement("div");
            header.style.display = "flex";
            header.style.justifyContent = "space-between";

            const timestamp = document.createElement("span");
            timestamp.style.fontSize = "0.8em";
            timestamp.style.opacity = "0.7";
            timestamp.textContent = new Date().toLocaleTimeString();
            header.appendChild(timestamp);

            el.appendChild(header);

            // Create content container
            const content = document.createElement("div");

            // Process each argument with improved object display
            args.forEach((arg) => {
              if (typeof arg === "object" && arg !== null) {
                const details = document.createElement("details");
                details.style.marginTop = "5px";

                const summary = document.createElement("summary");
                summary.style.cursor = "pointer";
                summary.textContent = "Object data";
                details.appendChild(summary);

                const pre = document.createElement("pre");
                pre.style.background = "rgba(0,0,0,0.3)";
                pre.style.padding = "5px";
                pre.style.borderRadius = "3px";
                pre.style.fontSize = "0.9em";
                pre.style.overflow = "auto";
                pre.style.maxHeight = "200px";

                try {
                  pre.textContent = JSON.stringify(arg, null, 2);
                } catch (e) {
                  pre.textContent = "[Circular]";
                }

                details.appendChild(pre);
                content.appendChild(details);
              } else {
                content.appendChild(document.createTextNode(String(arg) + " "));
              }
            });

            el.appendChild(content);
            contentEl.appendChild(el);

            updateThrottlingIndicator();
            updateLogCount();

            if (_options.autoScroll) {
              setTimeout(() => {
                if (contentEl) {
                  contentEl.scrollTop = contentEl.scrollHeight;
                }
              }, 0);
            }
            lastLogTimeRef.current = now;
          }
          return;
        }

        // Normal logging when not throttled
        // Determine log type based on color
        const logType =
          color === _options.errorColor
            ? "error"
            : color === _options.warnColor
            ? "warn"
            : color === _options.infoColor
            ? "info"
            : "log";

        const borderColor =
          logType === "error"
            ? "#FC8181"
            : logType === "warn"
            ? "#F6AD55"
            : logType === "info"
            ? "#63B3ED"
            : "#A0AEC0";

        const el = createElement(
          "div",
          "line-height:1.7em;min-height:1.7em;white-space:pre-wrap;" +
            "background:" +
            (contentEl.children.length % 2
              ? "rgba(0,0,0,0.2)"
              : "transparent") +
            ";color:" +
            color +
            ";padding:4px 8px;margin:4px 0;border-radius:3px;" +
            "border-left:3px solid " +
            borderColor +
            ";"
        );

        // Add timestamp in the right corner
        const header = document.createElement("div");
        header.style.display = "flex";
        header.style.justifyContent = "space-between";

        const timestamp = document.createElement("span");
        timestamp.style.fontSize = "0.8em";
        timestamp.style.opacity = "0.7";
        timestamp.textContent = new Date().toLocaleTimeString();
        header.appendChild(timestamp);

        el.appendChild(header);

        // Create content container
        const content = document.createElement("div");

        // Process each argument with improved object display
        args.forEach((arg) => {
          if (typeof arg === "object" && arg !== null) {
            const details = document.createElement("details");
            details.style.marginTop = "5px";

            const summary = document.createElement("summary");
            summary.style.cursor = "pointer";
            summary.textContent = "Object data";
            details.appendChild(summary);

            const pre = document.createElement("pre");
            pre.style.background = "rgba(0,0,0,0.3)";
            pre.style.padding = "5px";
            pre.style.borderRadius = "3px";
            pre.style.fontSize = "0.9em";
            pre.style.overflow = "auto";
            pre.style.maxHeight = "200px";

            try {
              pre.textContent = JSON.stringify(arg, null, 2);
            } catch (e) {
              pre.textContent = "[Circular]";
            }

            details.appendChild(pre);
            content.appendChild(details);
          } else {
            content.appendChild(document.createTextNode(String(arg) + " "));
          }
        });

        el.appendChild(content);
        contentEl.appendChild(el);
        updateLogCount();

        if (_options.autoScroll) {
          setTimeout(() => {
            if (contentEl) {
              contentEl.scrollTop = contentEl.scrollHeight;
            }
          }, 0);
        }
      };
    }

    const log = genericLogger(_options.logColor);
    const info = genericLogger(_options.infoColor);
    const warn = genericLogger(_options.warnColor);
    const error = genericLogger(_options.errorColor);

    function originalFnCallDecorator(fn: Function, fnName: string) {
      return function (...args: any[]) {
        fn.apply(null, args);
        if (typeof _console[fnName] === "function") {
          _console[fnName].apply(console, args);
        }
      };
    }

    function destroy() {
      console.log = _console.log;
      console.clear = _console.clear;
      console.info = _console.info;
      console.warn = _console.warn;
      console.error = _console.error;
      const screenlogElements = document.getElementsByClassName("screenlog");
      Array.from(screenlogElements).forEach((el) => {
        if (el.parentNode) el.parentNode.removeChild(el);
      });
      isInitializedRef.current = false;
      logElementRef.current = null;
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
        throttleTimeoutRef.current = null;
      }
    }

    console.log = originalFnCallDecorator(log, "log");
    console.clear = originalFnCallDecorator(clear, "clear");
    console.info = originalFnCallDecorator(info, "info");
    console.warn = originalFnCallDecorator(warn, "warn");
    console.error = originalFnCallDecorator(error, "error");

    window.screenLog = {
      log: originalFnCallDecorator(log, "log"),
      clear: originalFnCallDecorator(clear, "clear"),
      info: originalFnCallDecorator(info, "info"),
      warn: originalFnCallDecorator(warn, "warn"),
      error: originalFnCallDecorator(error, "error"),
      destroy: destroy,
    };

    isInitializedRef.current = true;
    log(`Screen logger initialized.`);
    if (
      throttleConfigRef.current.throttled ||
      throttleConfigRef.current.paused
    ) {
      updateThrottlingIndicator();
    }
    if (enableTesting && initiallyVisible) {
      startContinuousTestSignals();
    }
  }, [
    bgColor,
    color,
    fontSize,
    position,
    width,
    height,
    opacity,
    loggerPosition,
    isVisible,
    enableTesting,
    getResponsiveWidth,
    updateThrottlingIndicator,
    startContinuousTestSignals,
    initiallyVisible,
  ]);

  const toggleVisibility = useCallback(
    (show: boolean) => {
      setIsVisible(show);
      if (logElementRef.current) {
        logElementRef.current.style.display = show ? "block" : "none";
        if (show && enableTesting && !testSignalIntervalRef.current) {
          startContinuousTestSignals();
        }
        if (!show && testSignalIntervalRef.current) {
          stopContinuousTestSignals();
        }
      }
    },
    [enableTesting, startContinuousTestSignals, stopContinuousTestSignals]
  );

  useEffect(() => {
    if (!isInitializedRef.current) {
      const initScreenLogTimer = setTimeout(() => {
        setIsVisible(initiallyVisible);
        initScreenLog();
        isInitializedRef.current = true;
      }, 0);
      return () => {
        clearTimeout(initScreenLogTimer);
      };
    }
  }, [initScreenLog, initiallyVisible]);

  useEffect(() => {
    if (!isInitializedRef.current) return;
    if (logElementRef.current) {
      logElementRef.current.style.display = isVisible ? "block" : "none";
      if (!isVisible) {
        if (throttleTimeoutRef.current) {
          clearTimeout(throttleTimeoutRef.current);
          throttleTimeoutRef.current = null;
        }
        stopContinuousTestSignals();
        pendingLogsRef.current = [];
      } else {
        handleWindowResize();
        if (enableTesting) {
          if (
            !logElementRef.current.children.length ||
            (logElementRef.current.children.length === 1 &&
              logElementRef.current.children[0].textContent ===
                "Screen logger initialized.")
          ) {
            startContinuousTestSignals();
          }
        }
      }
    }
  }, [
    isVisible,
    enableTesting,
    handleWindowResize,
    stopContinuousTestSignals,
    startContinuousTestSignals,
  ]);

  useEffect(() => {
    if (!listenToKeystrokes) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle visibility with Ctrl+K (or Cmd+K)
      if (
        (e.ctrlKey && e.metaKey && !e.altKey) ||
        (e.ctrlKey && e.altKey && !e.metaKey) ||
        (e.ctrlKey && e.key.toLowerCase() === shortcutKey.toLowerCase())
      ) {
        e.preventDefault();
        toggleVisibility(!isVisible);
        return;
      }
      if (!isVisible) return;

      // Focus search with Ctrl+F (or Cmd+F)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Toggle throttling with Ctrl+T (or Cmd+T)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "t") {
        e.preventDefault();
        toggleThrottling();
        return;
      }
      // Clear logs with Ctrl+X
      if (e.ctrlKey && e.key.toLowerCase() === "x") {
        e.preventDefault();
        if (window.screenLog) {
          window.screenLog.clear();
          window.screenLog.log("Logs cleared with Ctrl+X");
        }
        return;
      }
      // Copy logs with Ctrl+Shift+C
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copyLogs();
        return;
      }
      // Pause logs with Ctrl+P
      if (e.ctrlKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setIsLoggingPaused(!isLoggingPaused);
        throttleConfigRef.current.paused = !throttleConfigRef.current.paused;
        updateThrottlingIndicator();
        return;
      }
      if (e.ctrlKey && !e.altKey && !e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "i":
            e.preventDefault();
            updateLoggerPosition("top");
            break;
          case "u":
            e.preventDefault();
            updateLoggerPosition("top-left");
            break;
          case "o":
            e.preventDefault();
            updateLoggerPosition("top-right");
            break;
          case "j":
            e.preventDefault();
            updateLoggerPosition("left");
            break;
          case "l":
            e.preventDefault();
            updateLoggerPosition("right");
            break;
          case ".":
            e.preventDefault();
            updateLoggerPosition("bottom-right");
            break;
          case "m":
            e.preventDefault();
            updateLoggerPosition("bottom-left");
            break;
          case ",":
            e.preventDefault();
            updateLoggerPosition("bottom");
            break;
          case "0":
            e.preventDefault();
            updateLoggerPosition("center");
            break;
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    shortcutKey,
    isVisible,
    toggleThrottling,
    updateLoggerPosition,
    toggleVisibility,
    listenToKeystrokes,
    copyLogs,
  ]);

  useEffect(() => {
    return () => {
      if (window.screenLog && isInitializedRef.current) {
        window.screenLog.destroy();
      }
      stopContinuousTestSignals();
    };
  }, [stopContinuousTestSignals]);

  if (!showButton) {
    return null;
  }

  const getButtonPositionStyles = () => {
    switch (buttonPosition) {
      case "top-left":
        return { top: "10px", left: "10px" };
      case "top-right":
        return { top: "10px", right: "10px" };
      case "bottom-left":
        return { bottom: "10px", left: "10px" };
      case "bottom-right":
      default:
        return { bottom: "10px", right: "10px" };
    }
  };

  const getThrottleButtonText = () => {
    if (isLoggingPaused) return "Throttle: Paused";
    if (isLoggingThrottled) return `Throttle: ${throttleDelay}ms`;
    return "Throttle: Off";
  };

  return (
    <div
      className="fixed z-[2147483647] flex gap-2"
      style={{
        ...getButtonPositionStyles(),
      }}
    >
      <button
        onClick={() => toggleVisibility(!isVisible)}
        className="rounded px-2 py-1 text-xs cursor-pointer shadow-md hover:bg-zinc-700 transition-colors bg-zinc-800 text-white whitespace-nowrap"
      >
        {isVisible ? "Hide" : "Show"} Logs
      </button>
      {isVisible && (
        <>
          <button
            onClick={toggleThrottling}
            className="rounded px-2 py-1 text-xs cursor-pointer shadow-md hover:bg-zinc-700 transition-colors bg-zinc-800 text-white whitespace-nowrap"
          >
            {getThrottleButtonText()}
          </button>
          <button
            onClick={() => {
              const current = throttleConfigRef.current;
              throttleConfigRef.current = {
                ...current,
                paused: !current.paused,
              };
              setIsLoggingPaused(!isLoggingPaused);
              updateThrottlingIndicator();
            }}
            className="rounded px-2 py-1 text-xs cursor-pointer shadow-md hover:bg-zinc-700 transition-colors bg-zinc-800 text-white"
          >
            {isLoggingPaused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={() => {
              copyLogs();
            }}
            className="rounded px-2 py-1 text-xs cursor-pointer shadow-md hover:bg-zinc-700 transition-colors bg-zinc-800 text-white"
          >
            Copy
          </button>
          <button
            onClick={() => {
              if (window.screenLog) {
                window.screenLog.clear();
              }
            }}
            className="rounded px-2 py-1 text-xs cursor-pointer shadow-md hover:bg-zinc-700 transition-colors bg-zinc-800 text-white"
          >
            Clear
          </button>
        </>
      )}
      {isVisible && (
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            handleSearchChange(e.target.value);
          }}
          onKeyUp={filterLogs}
          placeholder={
            searchQuery ? "🔍 Searching (paused)" : "Search logs... (Ctrl+F)"
          }
          data-searching={searchQuery.length > 0}
          className="w-[200px] rounded px-2 py-1 text-xs 
            bg-zinc-800 text-zinc-100
            border border-zinc-700 
            placeholder:text-zinc-400
            focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600
            data-[searching=true]:bg-zinc-800/90
            data-[searching=true]:placeholder:text-zinc-300"
        />
      )}
    </div>
  );
}

// Fix the TypeScript declaration for window.screenLog
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
    toggleScreenLog?: () => void;
  }
}
