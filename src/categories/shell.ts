import { ScriptCategory } from "../types/index.js";

function escapeForAppleScript(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Shell-related scripts.
 * * run_command: Run a shell command and return output
 * * run_command_background: Run a command in the background (fire-and-forget)
 * * get_environment: Get environment variable values
 */
export const shellCategory: ScriptCategory = {
  name: "shell",
  description: "Run shell commands and interact with the system environment",
  scripts: [
    {
      name: "run_command",
      description: "Run a shell command and return its output",
      schema: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The shell command to run",
          },
          timeout: {
            type: "number",
            description: "Timeout in seconds (default: 30)",
            default: 30,
          },
          working_directory: {
            type: "string",
            description: "Optional working directory to run the command in",
          },
        },
        required: ["command"],
      },
      script: (args) => {
        const timeout = typeof args.timeout === "number" ? args.timeout : 30;
        let cmd = args.command as string;
        if (args.working_directory) {
          const dir = escapeForAppleScript(args.working_directory as string);
          cmd = `cd "${dir}" && ${cmd}`;
        }
        const escapedCmd = escapeForAppleScript(cmd);
        return `
try
  with timeout of ${timeout} seconds
    set output to do shell script "${escapedCmd}"
  end timeout
  return output
on error errMsg
  return "Error: " & errMsg
end try
        `.trim();
      },
    },
    {
      name: "run_command_background",
      description: "Run a shell command in the background (fire-and-forget)",
      schema: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The shell command to run in the background",
          },
        },
        required: ["command"],
      },
      script: (args) => {
        const escapedCmd = escapeForAppleScript(args.command as string);
        return `
try
  do shell script "nohup ${escapedCmd} &>/dev/null &"
  return "Command started in background: ${escapedCmd}"
on error errMsg
  return "Error: " & errMsg
end try
        `.trim();
      },
    },
    {
      name: "get_environment",
      description: "Get the value of an environment variable",
      schema: {
        type: "object",
        properties: {
          variable: {
            type: "string",
            description: "The name of the environment variable to retrieve",
          },
        },
        required: ["variable"],
      },
      script: (args) => {
        const escapedVar = escapeForAppleScript(args.variable as string);
        return `
try
  set envValue to do shell script "echo $${escapedVar}"
  return envValue
on error errMsg
  return "Error: " & errMsg
end try
        `.trim();
      },
    },
  ],
};
