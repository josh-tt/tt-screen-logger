"use client";

import { ScreenLogger } from "@/components/dev-screen-logger";
import { Inter } from "next/font/google";
import { useEffect } from "react";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // This is a hack to prevent memory issues running the screen logger
  // in production in case user leaves the page open for a long time
  // and the page is idle we refresh the page to prevent killing their browser
  useEffect(() => {
    const REFRESH_INTERVAL = 1 * 60 * 1000; // 1 minute

    // Simple refresh timer that runs every minute
    const refreshTimer = setInterval(() => {
      console.log("Refreshing page to prevent memory issues...");
      window.location.reload();
    }, REFRESH_INTERVAL);

    // Cleanup
    return () => {
      clearInterval(refreshTimer);
    };
  }, []);

  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="antialiased dark:bg-zinc-900 bg-zinc-50">
        {children}
        {/* You prob only want this in development in most cases */}
        {process.env.NODE_ENV === "development" && <ScreenLogger />}
        {process.env.NODE_ENV === "production" && <ScreenLogger />}
      </body>
    </html>
  );
}
