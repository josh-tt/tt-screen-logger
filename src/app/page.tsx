import Link from "next/link";
export default function Home() {
  return (
    <div className="text-zinc-900 dark:text-zinc-50 grid grid-rows-[20px_1fr_20px] items-start justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <div className="text-zinc-500 dark:text-zinc-400 text-center space-y-4 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-center text-zinc-900 dark:text-zinc-50">
          Screen Logger
        </h1>
        <Link
          className="text-zinc-500 dark:text-zinc-400 underline font-bold"
          href="https://github.com/josh-tt/tt-screen-logger.git"
        >
          Github
        </Link>

        <p className="my-4 text-sm text-zinc-500 dark:text-zinc-50">
          Forked and inspired by{" "}
          <Link href="https://github.com/chinchang/screenlog.js">
            screenlog.js
          </Link>
        </p>

        <p className="text-base max-w-xl mx-auto mb-12">
          Screen Logger is a tool that allows you to log messages to the console
          in a floating window. Why? Because its handy sometimes as the dev
          tools can get in the way.
        </p>
        <p className="text-xs max-w-xl mx-auto mb-8">
          This page will refresh every minute to prevent memory issues in
          production if left open or idle.
        </p>

        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm max-w-4xl mx-auto">
          <li className="flex items-center p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 transition-colors">
            <kbd className="px-2 py-1 mr-2 bg-zinc-200 dark:bg-zinc-800 rounded text-xs font-mono">
              Ctrl+K
            </kbd>
            <span>Toggle visibility</span>
          </li>
          <li className="flex items-center p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 transition-colors">
            <kbd className="px-2 py-1 mr-2 bg-zinc-200 dark:bg-zinc-800 rounded text-xs font-mono">
              Ctrl+T
            </kbd>
            <span>Toggle throttling</span>
          </li>
          <li className="flex items-center p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 transition-colors">
            <kbd className="px-2 py-1 mr-2 bg-zinc-200 dark:bg-zinc-800 rounded text-xs font-mono">
              Ctrl+X
            </kbd>
            <span>Clear logs</span>
          </li>
          <li className="flex items-center p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 transition-colors">
            <kbd className="px-2 py-1 mr-2 bg-zinc-200 dark:bg-zinc-800 rounded text-xs font-mono">
              Ctrl+C
            </kbd>
            <span>Copy logs to clipboard</span>
          </li>
          <li className="flex flex-col p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 transition-colors md:col-span-2">
            <div className="flex items-center mb-1">
              <span>Change panel position</span>
            </div>
            <div className="flex items-start mt-1 text-left text-sm text-zinc-900 dark:text-zinc-50">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-1 text-xs">
                <div>
                  <kbd className="px-1 bg-zinc-200 dark:bg-zinc-800 rounded font-mono">
                    u
                  </kbd>
                  : top-left
                </div>
                <div>
                  <kbd className="px-1 bg-zinc-200 dark:bg-zinc-800 rounded font-mono">
                    i
                  </kbd>
                  : top
                </div>
                <div>
                  <kbd className="px-1 bg-zinc-200 dark:bg-zinc-800 rounded font-mono">
                    o
                  </kbd>
                  : top-right
                </div>
                <div>
                  <kbd className="px-1 bg-zinc-200 dark:bg-zinc-800 rounded font-mono">
                    j
                  </kbd>
                  : left
                </div>
                <div>
                  <kbd className="px-1 bg-zinc-200 dark:bg-zinc-800 rounded font-mono">
                    l
                  </kbd>
                  : right
                </div>
                <div>
                  <kbd className="px-1 bg-zinc-200 dark:bg-zinc-800 rounded font-mono">
                    m
                  </kbd>
                  : bottom-left
                </div>
                <div>
                  <kbd className="px-1 bg-zinc-200 dark:bg-zinc-800 rounded font-mono">
                    ,
                  </kbd>
                  : bottom
                </div>
                <div>
                  <kbd className="px-1 bg-zinc-200 dark:bg-zinc-800 rounded font-mono">
                    0
                  </kbd>
                  : center
                </div>
              </div>
            </div>
          </li>
          <li className="text-center italic text-zinc-400 dark:text-zinc-500 md:col-span-2 mt-2">
            or use the buttons in lower right
          </li>
        </ul>
      </div>
    </div>
  );
}
