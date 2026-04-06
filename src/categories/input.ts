import { ScriptCategory } from "../types/index.js";

function escapeForAppleScript(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Input simulation scripts using System Events and Python Quartz.
 * * type_text: Type text using System Events keystroke
 * * key_press: Press specific key with optional modifiers
 * * keyboard_shortcut: Execute a keyboard shortcut by name
 * * mouse_click: Click at screen coordinates
 * * mouse_move: Move mouse to coordinates
 * * mouse_drag: Drag from one point to another
 */
export const inputCategory: ScriptCategory = {
  name: "input",
  description: "Keyboard and mouse simulation using System Events",
  scripts: [
    {
      name: "type_text",
      description: "Type text using System Events keystroke",
      schema: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "The text to type",
          },
          delay_between_keys: {
            type: "number",
            description: "Delay in seconds between keystrokes (optional)",
          },
        },
        required: ["text"],
      },
      script: (args) => {
        const escapedText = escapeForAppleScript(args.text as string);
        if (typeof args.delay_between_keys === "number") {
          // Type character by character with delay
          const delay = args.delay_between_keys as number;
          const chars = (args.text as string).split("");
          const keystrokes = chars
            .map((ch) => {
              const escapedChar = escapeForAppleScript(ch);
              return `keystroke "${escapedChar}"\ndelay ${delay}`;
            })
            .join("\n");
          return `
tell application "System Events"
${keystrokes}
end tell
          `.trim();
        }
        return `
tell application "System Events"
  keystroke "${escapedText}"
end tell
        `.trim();
      },
    },
    {
      name: "key_press",
      description: "Press a specific key code with optional modifiers",
      schema: {
        type: "object",
        properties: {
          key_code: {
            type: "number",
            description: "The key code to press",
          },
          modifiers: {
            type: "array",
            items: {
              type: "string",
              enum: ["command", "option", "control", "shift"],
            },
            description: 'Optional modifier keys: "command", "option", "control", "shift"',
          },
        },
        required: ["key_code"],
      },
      script: (args) => {
        const keyCode = args.key_code as number;
        const modifiers = (args.modifiers as string[] | undefined) ?? [];
        if (modifiers.length > 0) {
          const modList = modifiers.map((m) => `${m} down`).join(", ");
          return `
tell application "System Events"
  key code ${keyCode} using {${modList}}
end tell
          `.trim();
        }
        return `
tell application "System Events"
  key code ${keyCode}
end tell
        `.trim();
      },
    },
    {
      name: "keyboard_shortcut",
      description:
        'Execute a keyboard shortcut by name (e.g. key="c" modifiers=["command"] for Copy)',
      schema: {
        type: "object",
        properties: {
          key: {
            type: "string",
            description:
              'The key to press: a character like "c", "v", "a", "z", "s", "w", "q", or a special key name: "space", "return", "tab", "escape", "delete", "up", "down", "left", "right", "f1"–"f6"',
          },
          modifiers: {
            type: "array",
            items: {
              type: "string",
              enum: ["command", "option", "control", "shift"],
            },
            description: 'Modifier keys to hold: "command", "option", "control", "shift"',
          },
        },
        required: ["key", "modifiers"],
      },
      script: (args) => {
        const key = args.key as string;
        const modifiers = (args.modifiers as string[]) ?? [];
        const modList = modifiers.map((m) => `${m} down`).join(", ");
        const usingClause = modList.length > 0 ? ` using {${modList}}` : "";

        // Map special key names to key codes
        const specialKeyCodes: Record<string, number> = {
          space: 49,
          return: 36,
          tab: 48,
          escape: 53,
          delete: 51,
          up: 126,
          down: 125,
          left: 123,
          right: 124,
          f1: 122,
          f2: 120,
          f3: 99,
          f4: 118,
          f5: 96,
          f6: 97,
        };

        const keyLower = key.toLowerCase();
        if (keyLower in specialKeyCodes) {
          const code = specialKeyCodes[keyLower];
          return `
tell application "System Events"
  key code ${code}${usingClause}
end tell
          `.trim();
        }

        // Regular character key — use keystroke
        const escapedKey = escapeForAppleScript(key);
        return `
tell application "System Events"
  keystroke "${escapedKey}"${usingClause}
end tell
        `.trim();
      },
    },
    {
      name: "mouse_click",
      description: "Click at specific screen coordinates",
      schema: {
        type: "object",
        properties: {
          x: {
            type: "number",
            description: "X coordinate on screen",
          },
          y: {
            type: "number",
            description: "Y coordinate on screen",
          },
          button: {
            type: "string",
            enum: ["left", "right"],
            description: 'Mouse button to click: "left" (default) or "right"',
            default: "left",
          },
          clicks: {
            type: "number",
            description: "Number of clicks: 1 for single (default), 2 for double",
            default: 1,
          },
        },
        required: ["x", "y"],
      },
      script: (args) => {
        const x = args.x as number;
        const y = args.y as number;
        const button = (args.button as string | undefined) ?? "left";
        const clicks = (args.clicks as number | undefined) ?? 1;

        const isRight = button === "right";
        const downEvent = isRight ? "kCGEventRightMouseDown" : "kCGEventLeftMouseDown";
        const upEvent = isRight ? "kCGEventRightMouseUp" : "kCGEventLeftMouseUp";
        const mouseButton = isRight ? "kCGMouseButtonRight" : "kCGMouseButtonLeft";

        // Build Python Quartz script for mouse click
        const pythonLines: string[] = [
          "import Quartz",
          `pos = (${x}, ${y})`,
          `btn = Quartz.${mouseButton}`,
          `down = Quartz.CGEventCreateMouseEvent(None, Quartz.${downEvent}, pos, btn)`,
          `up = Quartz.CGEventCreateMouseEvent(None, Quartz.${upEvent}, pos, btn)`,
          `Quartz.CGEventSetIntegerValueField(down, Quartz.kCGMouseEventClickState, ${clicks})`,
          `Quartz.CGEventSetIntegerValueField(up, Quartz.kCGMouseEventClickState, ${clicks})`,
          `Quartz.CGEventPost(Quartz.kCGHIDEventTap, down)`,
          `Quartz.CGEventPost(Quartz.kCGHIDEventTap, up)`,
        ];

        // For double-click, send the events twice
        if (clicks === 2) {
          pythonLines.push(
            `Quartz.CGEventPost(Quartz.kCGHIDEventTap, down)`,
            `Quartz.CGEventPost(Quartz.kCGHIDEventTap, up)`
          );
        }

        const pythonScript = pythonLines.join("; ");
        const escapedPython = escapeForAppleScript(pythonScript);
        return `
try
  do shell script "python3 -c \\"${escapedPython}\\""
  return "Clicked at (${x}, ${y})"
on error errMsg
  return "Error: " & errMsg
end try
        `.trim();
      },
    },
    {
      name: "mouse_move",
      description: "Move the mouse cursor to specific screen coordinates",
      schema: {
        type: "object",
        properties: {
          x: {
            type: "number",
            description: "X coordinate on screen",
          },
          y: {
            type: "number",
            description: "Y coordinate on screen",
          },
        },
        required: ["x", "y"],
      },
      script: (args) => {
        const x = args.x as number;
        const y = args.y as number;

        const pythonLines: string[] = [
          "import Quartz",
          `pos = (${x}, ${y})`,
          `event = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventMouseMoved, pos, 0)`,
          `Quartz.CGEventPost(Quartz.kCGHIDEventTap, event)`,
        ];

        const pythonScript = pythonLines.join("; ");
        const escapedPython = escapeForAppleScript(pythonScript);
        return `
try
  do shell script "python3 -c \\"${escapedPython}\\""
  return "Mouse moved to (${x}, ${y})"
on error errMsg
  return "Error: " & errMsg
end try
        `.trim();
      },
    },
    {
      name: "mouse_drag",
      description: "Drag the mouse from one point to another",
      schema: {
        type: "object",
        properties: {
          from_x: {
            type: "number",
            description: "Starting X coordinate",
          },
          from_y: {
            type: "number",
            description: "Starting Y coordinate",
          },
          to_x: {
            type: "number",
            description: "Ending X coordinate",
          },
          to_y: {
            type: "number",
            description: "Ending Y coordinate",
          },
        },
        required: ["from_x", "from_y", "to_x", "to_y"],
      },
      script: (args) => {
        const fromX = args.from_x as number;
        const fromY = args.from_y as number;
        const toX = args.to_x as number;
        const toY = args.to_y as number;

        const pythonLines: string[] = [
          "import Quartz",
          `src = (${fromX}, ${fromY})`,
          `dst = (${toX}, ${toY})`,
          `btn = Quartz.kCGMouseButtonLeft`,
          `mouse_down = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseDown, src, btn)`,
          `mouse_drag = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseDragged, dst, btn)`,
          `mouse_up = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseUp, dst, btn)`,
          `Quartz.CGEventPost(Quartz.kCGHIDEventTap, mouse_down)`,
          `Quartz.CGEventPost(Quartz.kCGHIDEventTap, mouse_drag)`,
          `Quartz.CGEventPost(Quartz.kCGHIDEventTap, mouse_up)`,
        ];

        const pythonScript = pythonLines.join("; ");
        const escapedPython = escapeForAppleScript(pythonScript);
        return `
try
  do shell script "python3 -c \\"${escapedPython}\\""
  return "Dragged from (${fromX}, ${fromY}) to (${toX}, ${toY})"
on error errMsg
  return "Error: " & errMsg
end try
        `.trim();
      },
    },
  ],
};
