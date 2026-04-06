import { ScriptCategory } from "../types/index.js";

function escapeForAppleScript(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Screenshot-related scripts.
 * * capture_screen: Capture full screen screenshot and return as base64
 * * capture_region: Capture a specific screen region and return as base64
 * * screen_info: Get screen resolution and display information
 */
export const screenshotCategory: ScriptCategory = {
  name: "screenshot",
  description: "Take screenshots and return them as base64",
  scripts: [
    {
      name: "capture_screen",
      description: "Capture full screen screenshot and return as base64 PNG",
      schema: {
        type: "object",
        properties: {
          save_path: {
            type: "string",
            description: "Optional file path to save the screenshot. If not provided, the screenshot is returned as base64 only.",
          },
        },
      },
      script: (args) => {
        if (args.save_path) {
          const escapedPath = escapeForAppleScript(args.save_path as string);
          return `
try
  set savePath to "${escapedPath}"
  set tmpFile to do shell script "mktemp /tmp/mcp_screenshot_XXXXXX.png"
  do shell script "screencapture -x " & quoted form of tmpFile
  do shell script "cp " & quoted form of tmpFile & " " & quoted form of savePath
  set b64 to do shell script "base64 -i " & quoted form of tmpFile
  do shell script "rm " & quoted form of tmpFile
  return "data:image/png;base64," & b64
on error errMsg
  return "Error: " & errMsg
end try
          `.trim();
        }
        return `
try
  set tmpFile to do shell script "mktemp /tmp/mcp_screenshot_XXXXXX.png"
  do shell script "screencapture -x " & quoted form of tmpFile
  set b64 to do shell script "base64 -i " & quoted form of tmpFile
  do shell script "rm " & quoted form of tmpFile
  return "data:image/png;base64," & b64
on error errMsg
  return "Error: " & errMsg
end try
        `.trim();
      },
    },
    {
      name: "capture_region",
      description: "Capture a specific region of the screen and return as base64 PNG",
      schema: {
        type: "object",
        properties: {
          x: {
            type: "number",
            description: "X coordinate of the top-left corner of the region",
          },
          y: {
            type: "number",
            description: "Y coordinate of the top-left corner of the region",
          },
          width: {
            type: "number",
            description: "Width of the region in pixels",
          },
          height: {
            type: "number",
            description: "Height of the region in pixels",
          },
          save_path: {
            type: "string",
            description: "Optional file path to save the screenshot. If not provided, the screenshot is returned as base64 only.",
          },
        },
        required: ["x", "y", "width", "height"],
      },
      script: (args) => {
        const x = Math.round(args.x as number);
        const y = Math.round(args.y as number);
        const width = Math.round(args.width as number);
        const height = Math.round(args.height as number);
        const region = `${x},${y},${width},${height}`;

        if (args.save_path) {
          const escapedPath = escapeForAppleScript(args.save_path as string);
          return `
try
  set savePath to "${escapedPath}"
  set tmpFile to do shell script "mktemp /tmp/mcp_screenshot_XXXXXX.png"
  do shell script "screencapture -x -R ${region} " & quoted form of tmpFile
  do shell script "cp " & quoted form of tmpFile & " " & quoted form of savePath
  set b64 to do shell script "base64 -i " & quoted form of tmpFile
  do shell script "rm " & quoted form of tmpFile
  return "data:image/png;base64," & b64
on error errMsg
  return "Error: " & errMsg
end try
          `.trim();
        }
        return `
try
  set tmpFile to do shell script "mktemp /tmp/mcp_screenshot_XXXXXX.png"
  do shell script "screencapture -x -R ${region} " & quoted form of tmpFile
  set b64 to do shell script "base64 -i " & quoted form of tmpFile
  do shell script "rm " & quoted form of tmpFile
  return "data:image/png;base64," & b64
on error errMsg
  return "Error: " & errMsg
end try
        `.trim();
      },
    },
    {
      name: "screen_info",
      description: "Get screen resolution and display information",
      script: `
try
  set displayInfo to do shell script "system_profiler SPDisplaysDataType"
  return displayInfo
on error errMsg
  return "Error: " & errMsg
end try
      `.trim(),
    },
  ],
};
