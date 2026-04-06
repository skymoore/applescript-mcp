import { ScriptCategory } from "../types/index.js";

function escapeForAppleScript(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Window management scripts using System Events.
 * * list_windows: List all visible windows with their positions and sizes
 * * move_window: Move a window to specific coordinates
 * * resize_window: Resize a window
 * * minimize_window: Minimize a window
 * * maximize_window: Maximize/fullscreen a window
 * * focus_window: Bring a window to the front
 * * get_window_info: Get detailed info about a specific window
 */
export const windowsCategory: ScriptCategory = {
  name: "windows",
  description: "Window management using System Events",
  scripts: [
    {
      name: "list_windows",
      description: "List all visible windows with their positions and sizes",
      schema: {
        type: "object",
        properties: {
          app_name: {
            type: "string",
            description: "Optional application name to filter windows by",
          },
        },
      },
      script: (args) => {
        if (args.app_name) {
          const app = escapeForAppleScript(args.app_name);
          return `
            tell application "System Events"
              set windowList to ""
              repeat with proc in (every process whose visible is true and name is "${app}")
                set procName to name of proc
                repeat with win in (every window of proc)
                  set winName to name of win
                  set winPos to position of win
                  set winSize to size of win
                  set windowList to windowList & procName & " | " & winName & " | pos:" & (item 1 of winPos as text) & "," & (item 2 of winPos as text) & " | size:" & (item 1 of winSize as text) & "," & (item 2 of winSize as text) & linefeed
                end repeat
              end repeat
              return windowList
            end tell
          `;
        }
        return `
          tell application "System Events"
            set windowList to ""
            repeat with proc in (every process whose visible is true)
              set procName to name of proc
              repeat with win in (every window of proc)
                set winName to name of win
                set winPos to position of win
                set winSize to size of win
                set windowList to windowList & procName & " | " & winName & " | pos:" & (item 1 of winPos as text) & "," & (item 2 of winPos as text) & " | size:" & (item 1 of winSize as text) & "," & (item 2 of winSize as text) & linefeed
              end repeat
            end repeat
            return windowList
          end tell
        `;
      },
    },
    {
      name: "move_window",
      description: "Move a window to specific coordinates",
      schema: {
        type: "object",
        properties: {
          app_name: {
            type: "string",
            description: "Application name",
          },
          x: {
            type: "number",
            description: "X coordinate for the window position",
          },
          y: {
            type: "number",
            description: "Y coordinate for the window position",
          },
          window_index: {
            type: "number",
            description: "Window index (default: 1)",
            default: 1,
          },
        },
        required: ["app_name", "x", "y"],
      },
      script: (args) => {
        const app = escapeForAppleScript(args.app_name);
        const index = args.window_index ?? 1;
        return `
          tell application "System Events" to tell process "${app}"
            set position of window ${index} to {${args.x}, ${args.y}}
          end tell
        `;
      },
    },
    {
      name: "resize_window",
      description: "Resize a window",
      schema: {
        type: "object",
        properties: {
          app_name: {
            type: "string",
            description: "Application name",
          },
          width: {
            type: "number",
            description: "New width of the window",
          },
          height: {
            type: "number",
            description: "New height of the window",
          },
          window_index: {
            type: "number",
            description: "Window index (default: 1)",
            default: 1,
          },
        },
        required: ["app_name", "width", "height"],
      },
      script: (args) => {
        const app = escapeForAppleScript(args.app_name);
        const index = args.window_index ?? 1;
        return `
          tell application "System Events" to tell process "${app}"
            set size of window ${index} to {${args.width}, ${args.height}}
          end tell
        `;
      },
    },
    {
      name: "minimize_window",
      description: "Minimize a window",
      schema: {
        type: "object",
        properties: {
          app_name: {
            type: "string",
            description: "Application name",
          },
          window_index: {
            type: "number",
            description: "Window index (default: 1)",
            default: 1,
          },
        },
        required: ["app_name"],
      },
      script: (args) => {
        const app = escapeForAppleScript(args.app_name);
        const index = args.window_index ?? 1;
        return `
          tell application "System Events" to tell process "${app}"
            set value of attribute "AXMinimized" of window ${index} to true
          end tell
        `;
      },
    },
    {
      name: "maximize_window",
      description: "Maximize/fullscreen a window",
      schema: {
        type: "object",
        properties: {
          app_name: {
            type: "string",
            description: "Application name",
          },
          window_index: {
            type: "number",
            description: "Window index (default: 1)",
            default: 1,
          },
        },
        required: ["app_name"],
      },
      script: (args) => {
        const app = escapeForAppleScript(args.app_name);
        const index = args.window_index ?? 1;
        return `
          tell application "System Events" to tell process "${app}"
            set value of attribute "AXFullScreen" of window ${index} to true
          end tell
        `;
      },
    },
    {
      name: "focus_window",
      description: "Bring a window to the front",
      schema: {
        type: "object",
        properties: {
          app_name: {
            type: "string",
            description: "Application name",
          },
          window_index: {
            type: "number",
            description: "Window index (default: 1)",
            default: 1,
          },
        },
        required: ["app_name"],
      },
      script: (args) => {
        const app = escapeForAppleScript(args.app_name);
        const index = args.window_index ?? 1;
        return `
          tell application "${app}" to activate
          tell application "System Events" to tell process "${app}"
            perform action "AXRaise" of window ${index}
          end tell
        `;
      },
    },
    {
      name: "get_window_info",
      description: "Get detailed info about a specific window",
      schema: {
        type: "object",
        properties: {
          app_name: {
            type: "string",
            description: "Application name",
          },
          window_index: {
            type: "number",
            description: "Window index (default: 1)",
            default: 1,
          },
        },
        required: ["app_name"],
      },
      script: (args) => {
        const app = escapeForAppleScript(args.app_name);
        const index = args.window_index ?? 1;
        return `
          tell application "System Events" to tell process "${app}"
            set win to window ${index}
            set winName to name of win
            set winPos to position of win
            set winSize to size of win
            set winMinimized to value of attribute "AXMinimized" of win
            set winFullScreen to value of attribute "AXFullScreen" of win
            return "name:" & winName & linefeed & "position:" & (item 1 of winPos as text) & "," & (item 2 of winPos as text) & linefeed & "size:" & (item 1 of winSize as text) & "," & (item 2 of winSize as text) & linefeed & "minimized:" & (winMinimized as text) & linefeed & "fullscreen:" & (winFullScreen as text)
          end tell
        `;
      },
    },
  ],
};
