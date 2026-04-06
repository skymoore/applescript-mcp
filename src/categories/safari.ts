import { ScriptCategory } from "../types/index.js";

/**
 * Escapes a string for safe embedding inside an AppleScript double-quoted string.
 * Backslashes must be escaped first, then double quotes.
 */
function escapeForAppleScript(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Safari browser control scripts.
 * * open_url: Open a URL in Safari
 * * get_current_url: Get the URL of the active tab
 * * get_current_tab_title: Get the title of the active tab
 * * get_page_text: Get the text content of the current page
 * * get_page_html: Get the HTML source of the current page
 * * list_tabs: List all open tabs across all windows
 * * close_tab: Close a specific tab
 * * execute_javascript: Run arbitrary JavaScript in the current tab
 * * navigate: Go back, forward, or reload
 */
export const safariCategory: ScriptCategory = {
  name: "safari",
  description: "Safari browser control",
  scripts: [
    {
      name: "open_url",
      description: "Open a URL in Safari",
      schema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The URL to open",
          },
          new_tab: {
            type: "boolean",
            description: "Open in a new tab (default: true)",
            default: true,
          },
        },
        required: ["url"],
      },
      script: (args) => {
        const escapedUrl = escapeForAppleScript(args.url as string);
        const newTab = args.new_tab !== false;
        return `
tell application "Safari"
  activate
  if ${newTab} then
    tell window 1 to set current tab to (make new tab with properties {URL:"${escapedUrl}"})
  else
    set URL of current tab of window 1 to "${escapedUrl}"
  end if
end tell
        `.trim();
      },
    },
    {
      name: "get_current_url",
      description: "Get the URL of the active tab",
      script: `tell application "Safari" to return URL of current tab of window 1`,
    },
    {
      name: "get_current_tab_title",
      description: "Get the title of the active tab",
      script: `tell application "Safari" to return name of current tab of window 1`,
    },
    {
      name: "get_page_text",
      description: "Get the text content of the current page",
      script: `
tell application "Safari"
  set pageText to do JavaScript "document.body.innerText" in current tab of window 1
  return pageText
end tell
      `.trim(),
    },
    {
      name: "get_page_html",
      description: "Get the HTML source of the current page",
      script: `
tell application "Safari"
  set pageHtml to do JavaScript "document.documentElement.outerHTML" in current tab of window 1
  return pageHtml
end tell
      `.trim(),
    },
    {
      name: "list_tabs",
      description: "List all open tabs across all windows",
      script: `
tell application "Safari"
  set tabList to ""
  set windowCount to count of windows
  repeat with w from 1 to windowCount
    set tabCount to count of tabs of window w
    repeat with t from 1 to tabCount
      set tabTitle to name of tab t of window w
      set tabURL to URL of tab t of window w
      set tabList to tabList & "Window " & w & ", Tab " & t & ": " & tabTitle & " - " & tabURL & linefeed
    end repeat
  end repeat
  return tabList
end tell
      `.trim(),
    },
    {
      name: "close_tab",
      description: "Close a specific tab",
      schema: {
        type: "object",
        properties: {
          window_index: {
            type: "number",
            description: "Window index (default: 1)",
            default: 1,
          },
          tab_index: {
            type: "number",
            description: "Tab index to close",
          },
        },
        required: ["tab_index"],
      },
      script: (args) => {
        const windowIndex = typeof args.window_index === "number" ? args.window_index : 1;
        const tabIndex = args.tab_index as number;
        return `
tell application "Safari"
  tell window ${windowIndex} to close tab ${tabIndex}
end tell
        `.trim();
      },
    },
    {
      name: "execute_javascript",
      description: "Run arbitrary JavaScript in the current tab",
      schema: {
        type: "object",
        properties: {
          script: {
            type: "string",
            description: "JavaScript code to execute",
          },
          window_index: {
            type: "number",
            description: "Window index (default: 1)",
            default: 1,
          },
          tab_index: {
            type: "number",
            description: "Tab index (default: current tab)",
          },
        },
        required: ["script"],
      },
      script: (args) => {
        const escapedScript = escapeForAppleScript(args.script as string);
        const windowIndex = typeof args.window_index === "number" ? args.window_index : 1;
        const tabRef =
          typeof args.tab_index === "number"
            ? `tab ${args.tab_index} of window ${windowIndex}`
            : `current tab of window ${windowIndex}`;
        return `
tell application "Safari"
  set jsResult to do JavaScript "${escapedScript}" in ${tabRef}
  return jsResult
end tell
        `.trim();
      },
    },
    {
      name: "navigate",
      description: "Go back, forward, or reload the current page",
      schema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            description: "Navigation action: back, forward, or reload",
            enum: ["back", "forward", "reload"],
          },
        },
        required: ["action"],
      },
      script: (args) => {
        const action = args.action as string;
        let jsCommand: string;
        if (action === "back") {
          jsCommand = "history.back()";
        } else if (action === "forward") {
          jsCommand = "history.forward()";
        } else {
          jsCommand = "location.reload()";
        }
        return `
tell application "Safari"
  do JavaScript "${jsCommand}" in current tab of window 1
end tell
        `.trim();
      },
    },
  ],
};
