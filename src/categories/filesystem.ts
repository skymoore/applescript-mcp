import { ScriptCategory } from "../types/index.js";

function escapeForAppleScript(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * File system operation scripts.
 * * read_file: Read file contents (with optional offset/limit)
 * * write_file: Write content to a file (create or overwrite)
 * * list_directory: List directory contents with details
 * * delete_file: Delete a file or directory
 * * move_file: Move or rename a file
 * * copy_file: Copy a file or directory
 * * file_info: Get file metadata
 * * find_files: Search for files by name pattern
 */
export const filesystemCategory: ScriptCategory = {
  name: "filesystem",
  description: "Full file system operations",
  scripts: [
    {
      name: "read_file",
      description: "Read file contents",
      schema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the file to read",
          },
          offset: {
            type: "number",
            description: "Line number to start reading from (1-indexed)",
          },
          limit: {
            type: "number",
            description: "Maximum number of lines to read",
          },
        },
        required: ["path"],
      },
      script: (args) => {
        const escapedPath = escapeForAppleScript(args.path as string);
        let shellCmd: string;
        if (typeof args.offset === "number" && typeof args.limit === "number") {
          const start = args.offset;
          const end = args.offset + args.limit - 1;
          shellCmd = `sed -n '${start},${end}p' "${escapedPath}"`;
        } else if (typeof args.offset === "number") {
          shellCmd = `sed -n '${args.offset},$p' "${escapedPath}"`;
        } else if (typeof args.limit === "number") {
          shellCmd = `head -n ${args.limit} "${escapedPath}"`;
        } else {
          shellCmd = `cat "${escapedPath}"`;
        }
        return `
try
  set fileContents to do shell script "${escapeForAppleScript(shellCmd)}"
  return fileContents
on error errMsg
  return "Error reading file: " & errMsg
end try
        `.trim();
      },
    },
    {
      name: "write_file",
      description: "Write content to a file (create or overwrite)",
      schema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the file to write",
          },
          content: {
            type: "string",
            description: "Content to write to the file",
          },
          append: {
            type: "boolean",
            description: "If true, append to the file instead of overwriting (default: false)",
            default: false,
          },
        },
        required: ["path", "content"],
      },
      script: (args) => {
        const escapedPath = escapeForAppleScript(args.path as string);
        const escapedContent = escapeForAppleScript(args.content as string);
        const redirect = args.append === true ? ">>" : ">";
        return `
try
  set thePath to "${escapedPath}"
  set theContent to "${escapedContent}"
  do shell script "printf '%s' " & quoted form of theContent & " ${redirect} " & quoted form of thePath
  return "File written successfully: ${escapedPath}"
on error errMsg
  return "Error writing file: " & errMsg
end try
        `.trim();
      },
    },
    {
      name: "list_directory",
      description: "List directory contents with details",
      schema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the directory to list",
          },
          show_hidden: {
            type: "boolean",
            description: "Show hidden files (default: false)",
            default: false,
          },
          long_format: {
            type: "boolean",
            description: "Use long listing format with details (default: true)",
            default: true,
          },
        },
        required: ["path"],
      },
      script: (args) => {
        const escapedPath = escapeForAppleScript(args.path as string);
        const showHidden = args.show_hidden === true;
        const longFormat = args.long_format !== false;
        let flags = "-";
        if (longFormat) flags += "l";
        if (showHidden) flags += "a";
        if (flags === "-") flags = "";
        const lsCmd = flags
          ? `ls ${flags} "${escapedPath}"`
          : `ls "${escapedPath}"`;
        return `
try
  set dirContents to do shell script "${escapeForAppleScript(lsCmd)}"
  return dirContents
on error errMsg
  return "Error listing directory: " & errMsg
end try
        `.trim();
      },
    },
    {
      name: "delete_file",
      description: "Delete a file or directory",
      schema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the file or directory to delete",
          },
          recursive: {
            type: "boolean",
            description: "If true, delete directories and their contents recursively (default: false)",
            default: false,
          },
        },
        required: ["path"],
      },
      script: (args) => {
        const targetPath = args.path as string;
        // Safety check: refuse to delete "/" or paths with only 1-2 components
        const parts = targetPath.replace(/^\/+/, "").split("/").filter(Boolean);
        if (parts.length < 2) {
          return `return "Error: Refusing to delete dangerous path: ${escapeForAppleScript(targetPath)}"`;
        }
        const escapedPath = escapeForAppleScript(targetPath);
        const rmCmd = args.recursive === true
          ? `rm -rf "${escapedPath}"`
          : `rm "${escapedPath}"`;
        return `
try
  do shell script "${escapeForAppleScript(rmCmd)}"
  return "Deleted successfully: ${escapedPath}"
on error errMsg
  return "Error deleting file: " & errMsg
end try
        `.trim();
      },
    },
    {
      name: "move_file",
      description: "Move or rename a file",
      schema: {
        type: "object",
        properties: {
          source: {
            type: "string",
            description: "Source path of the file or directory to move",
          },
          destination: {
            type: "string",
            description: "Destination path",
          },
        },
        required: ["source", "destination"],
      },
      script: (args) => {
        const escapedSource = escapeForAppleScript(args.source as string);
        const escapedDest = escapeForAppleScript(args.destination as string);
        const mvCmd = `mv "${escapedSource}" "${escapedDest}"`;
        return `
try
  do shell script "${escapeForAppleScript(mvCmd)}"
  return "Moved successfully: ${escapedSource} -> ${escapedDest}"
on error errMsg
  return "Error moving file: " & errMsg
end try
        `.trim();
      },
    },
    {
      name: "copy_file",
      description: "Copy a file or directory",
      schema: {
        type: "object",
        properties: {
          source: {
            type: "string",
            description: "Source path of the file or directory to copy",
          },
          destination: {
            type: "string",
            description: "Destination path",
          },
          recursive: {
            type: "boolean",
            description: "If true, copy directories recursively (default: false)",
            default: false,
          },
        },
        required: ["source", "destination"],
      },
      script: (args) => {
        const escapedSource = escapeForAppleScript(args.source as string);
        const escapedDest = escapeForAppleScript(args.destination as string);
        const cpCmd = args.recursive === true
          ? `cp -R "${escapedSource}" "${escapedDest}"`
          : `cp "${escapedSource}" "${escapedDest}"`;
        return `
try
  do shell script "${escapeForAppleScript(cpCmd)}"
  return "Copied successfully: ${escapedSource} -> ${escapedDest}"
on error errMsg
  return "Error copying file: " & errMsg
end try
        `.trim();
      },
    },
    {
      name: "file_info",
      description: "Get file metadata (size, dates, permissions, type)",
      schema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the file or directory",
          },
        },
        required: ["path"],
      },
      script: (args) => {
        const escapedPath = escapeForAppleScript(args.path as string);
        const statCmd = `stat -f "Size: %z bytes\\nModified: %Sm\\nAccessed: %Sa\\nPermissions: %Sp\\nType: %HT" "${escapedPath}"`;
        return `
try
  set fileInfo to do shell script "${escapeForAppleScript(statCmd)}"
  return fileInfo
on error errMsg
  return "Error getting file info: " & errMsg
end try
        `.trim();
      },
    },
    {
      name: "find_files",
      description: "Search for files by name pattern",
      schema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Directory path to search in",
          },
          pattern: {
            type: "string",
            description: "Name pattern to search for (e.g. '*.ts')",
          },
          type: {
            type: "string",
            description: "Restrict results to 'file' or 'directory'",
            enum: ["file", "directory"],
          },
          max_depth: {
            type: "number",
            description: "Maximum directory depth to search",
          },
        },
        required: ["path", "pattern"],
      },
      script: (args) => {
        const escapedPath = escapeForAppleScript(args.path as string);
        const escapedPattern = escapeForAppleScript(args.pattern as string);
        let findCmd = `find "${escapedPath}"`;
        if (typeof args.max_depth === "number") {
          findCmd += ` -maxdepth ${Math.floor(args.max_depth)}`;
        }
        if (args.type === "file") {
          findCmd += ` -type f`;
        } else if (args.type === "directory") {
          findCmd += ` -type d`;
        }
        findCmd += ` -name "${escapedPattern}"`;
        return `
try
  set findResults to do shell script "${escapeForAppleScript(findCmd)}"
  if findResults is "" then
    return "No files found matching pattern: ${escapedPattern}"
  end if
  return findResults
on error errMsg
  return "Error finding files: " & errMsg
end try
        `.trim();
      },
    },
  ],
};
