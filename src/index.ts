import { AppleScriptFramework } from "./framework.js";
import { systemCategory } from "./categories/system.js";
import { calendarCategory } from "./categories/calendar.js";
import { finderCategory } from "./categories/finder.js";
import { clipboardCategory } from "./categories/clipboard.js";
import { notificationsCategory } from "./categories/notifications.js";
import { itermCategory } from "./categories/iterm.js";
import { mailCategory } from "./categories/mail.js";
import { shortcutsCategory } from "./categories/shortcuts.js";
import { messagesCategory } from "./categories/messages.js";
import { notesCategory } from "./categories/notes.js";
import { shellCategory } from "./categories/shell.js";
import { filesystemCategory } from "./categories/filesystem.js";
import { screenshotCategory } from "./categories/screenshot.js";
import { inputCategory } from "./categories/input.js";
import { safariCategory } from "./categories/safari.js";
import { windowsCategory } from "./categories/windows.js";

// --- Transport configuration via CLI args and environment variables ---
// CLI args take priority over env vars; env vars fall back to defaults.

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index !== -1 && index + 1 < args.length ? args[index + 1] : undefined;
}

const rawTransport = getArg("transport") ?? process.env["TRANSPORT"];
const rawPort     = getArg("port")      ?? process.env["PORT"];

const transport: "stdio" | "http" =
  rawTransport === "http" ? "http" : "stdio";

const port: number | undefined =
  rawPort !== undefined ? parseInt(rawPort, 10) : undefined;

// --- End transport configuration ---

const server = new AppleScriptFramework({
  name: "applescript-server",
  version: "1.0.4",
  debug: false,
  transport,
  ...(port !== undefined ? { port } : {}),
});

// Log startup information using stderr (server isn't connected yet)
console.error(`[INFO] Starting AppleScript MCP server - PID: ${process.pid} - transport: ${transport}${transport === "http" ? ` - port: ${port ?? 3001}` : ""}`);

// Add all categories
console.error("[INFO] Registering categories...");
server.addCategory(systemCategory);
server.addCategory(calendarCategory);
server.addCategory(finderCategory);
server.addCategory(clipboardCategory);
server.addCategory(notificationsCategory);
server.addCategory(itermCategory);
server.addCategory(mailCategory);
server.addCategory(shortcutsCategory);
server.addCategory(messagesCategory);
server.addCategory(notesCategory);
server.addCategory(shellCategory);
server.addCategory(filesystemCategory);
server.addCategory(screenshotCategory);
server.addCategory(inputCategory);
server.addCategory(safariCategory);
server.addCategory(windowsCategory);
console.error(`[INFO] Registered ${16} categories successfully`);

// Start the server
console.error("[INFO] Starting server...");
server.run()
  .then(() => {
    console.error("[NOTICE] Server started successfully");
  })
  .catch(error => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[EMERGENCY] Failed to start server: ${errorMessage}`);
    console.error(error);
  });
