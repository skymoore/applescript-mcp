export interface ScriptDefinition {
  /**
   * The name of the script.
   */
  name: string;

  /**
   * A brief description of what the script does.
   */
  description: string;

  /**
   * The script content, which can be a string or a function that returns a string.
   */
  script: string | ((args: any) => string);

  /**
   * Optional schema defining the structure of the script's input parameters.
   */
  schema?: {
    type: "object";
    properties: Record<string, any>;

    /**
     * Optional list of required properties in the schema.
     */
    required?: string[];
  };
}

export interface ScriptCategory {
  /**
   * The name of the script category.
   */
  name: string;

  /**
   * A brief description of the script category.
   */
  description: string;

  /**
   * A list of scripts that belong to this category.
   */
  scripts: ScriptDefinition[];
}

/**
 * Standard log levels for the framework's logging system.
 * Follows the RFC 5424 syslog severity levels.
 */
export type LogLevel = 
  | "emergency" // System is unusable
  | "alert"     // Action must be taken immediately
  | "critical"  // Critical conditions
  | "error"     // Error conditions
  | "warning"   // Warning conditions
  | "notice"    // Normal but significant condition
  | "info"      // Informational messages
  | "debug";    // Debug-level messages

export interface FrameworkOptions {
  /**
   * Optional name of the framework.
   */
  name?: string;

  /**
   * Optional version of the framework.
   */
  version?: string;

  /**
   * Optional flag to enable or disable debug mode.
   */
  debug?: boolean;

  /**
   * Which transport to use for the MCP server.
   * Defaults to "stdio" if not specified.
   */
  transport?: "stdio" | "http";

  /**
   * Port number for the HTTP transport.
   * Only used when `transport` is set to "http". Defaults to 3001.
   */
  port?: number;
}
