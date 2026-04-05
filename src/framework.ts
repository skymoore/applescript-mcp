import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";
import { randomUUID } from "node:crypto";
import express from "express";
import cors from "cors";
import type { Request, Response } from "express";
import type { Server as HttpServer } from "node:http";
import {
  ScriptCategory,
  ScriptDefinition,
  FrameworkOptions,
  LogLevel,
} from "./types/index.js";

const execAsync = promisify(exec);

// Get system information for logging
const systemInfo = {
  platform: os.platform(),
  release: os.release(),
  hostname: os.hostname(),
  arch: os.arch(),
  nodeVersion: process.version
};



export class AppleScriptFramework {
  private server: Server;
  private categories: ScriptCategory[] = [];
  private _initInfo: Record<string, any> = {};
  private _isConnected: boolean = false;
  private _pendingCategories: Array<Record<string, any>> = [];
  private transportType: "stdio" | "http";
  private port: number;
  private _httpServer: HttpServer | null = null;
  private _httpTransports: Map<string, StreamableHTTPServerTransport> = new Map();

  /**
   * Constructs an instance of AppleScriptFramework.
   * @param options - Configuration options for the framework.
   */
  constructor(options: FrameworkOptions = {}) {
    const serverName = options.name || "applescript-server";
    const serverVersion = options.version || "1.0.0";
    this.transportType = options.transport ?? "stdio";
    this.port = options.port ?? 3001;

    this.server = new Server(
      {
        name: serverName,
        version: serverVersion,
      },
      {
        capabilities: {
          tools: {},
          logging: {}, // Enable logging capability
        },
      },
    );

    if (options.debug) {
      this.enableDebugLogging();
    }
    
    // Log server initialization with stderr (server isn't connected yet)
    console.error(`[INFO] AppleScript MCP server initialized - ${serverName} v${serverVersion}`);
    
    // Store initialization info for later logging after connection
    this._initInfo = {
      name: serverName,
      version: serverVersion,
      debug: !!options.debug,
      system: systemInfo
    };
  }

  /**
   * Enables debug logging for the server.
   * Sets up error handlers and configures detailed logging.
   */
  private enableDebugLogging(): void {
    console.error("[INFO] Debug logging enabled");
    
    this.server.onerror = (error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[MCP Error]", error);
      
      // Only use MCP logging if connected
      if (this._isConnected) {
        this.log("error", "MCP server error", { error: errorMessage });
      }
    };
    
    // Set up additional debug event handlers if needed
    this.server.oninitialized = () => {
      this._isConnected = true;
      console.error("[DEBUG] Connection initialized");
      
      // We'll log initialization info in the run method after connection is fully established
      console.error("[DEBUG] Connection initialized");
    };
    
    this.server.onclose = () => {
      this._isConnected = false;
      console.error("[DEBUG] Connection closed");
      
      // No MCP logging here since we're disconnected
    };
  }

  /**
   * Adds a new script category to the framework.
   * @param category - The script category to add.
   */
  addCategory(category: ScriptCategory): void {
    this.categories.push(category);
    
    // Use console logging since this is called before server connection
    console.error(`[DEBUG] Added category: ${category.name} (${category.scripts.length} scripts)`);
    
    // Store category info to log via MCP after connection
    if (!this._pendingCategories) {
      this._pendingCategories = [];
    }
    this._pendingCategories.push({
      categoryName: category.name,
      scriptCount: category.scripts.length,
      description: category.description
    });
  }

  /**
   * Logs a message with the specified severity level.
   * Uses the MCP server's logging system to record events if available.
   * Always logs to console for visibility.
   * 
   * @param level - The severity level of the log message following RFC 5424 syslog levels
   * @param message - The message to log
   * @param data - Optional additional data to include with the log message
   * 
   * @example
   * // Log a debug message
   * framework.log("debug", "Processing request", { requestId: "123" });
   * 
   * @example
   * // Log an error
   * framework.log("error", "Failed to execute script", { scriptName: "calendar_add" });
   */
  log(level: LogLevel, message: string, data?: Record<string, any>): void {
    // Format for console output
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    
    // Always log to stderr for visibility
    console.error(`[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}`);
    
    // Only try to use MCP logging if we're connected
    if (this._isConnected) {
      try {
        this.server.sendLoggingMessage({
          level: level,
          data: { message, ...(data || {}) },
        });
      } catch (error) {
        // Silently ignore logging errors - we've already logged to console
      }
    }
  }

  /**
   * Executes an AppleScript and returns the result.
   * @param script - The AppleScript to execute.
   * @returns The result of the script execution.
   * @throws Will throw an error if the script execution fails.
   */
  private async executeScript(script: string): Promise<string> {
    // Log script execution (truncate long scripts for readability)
    const scriptPreview = script.length > 100 ? script.substring(0, 100) + "..." : script;
    this.log("debug", "Executing AppleScript", { scriptPreview });
    
    try {
      const startTime = Date.now();
      const { stdout } = await execAsync(
        `osascript -e '${script.replace(/'/g, "'\"'\"'")}'`,
      );
      const executionTime = Date.now() - startTime;
      
      this.log("debug", "AppleScript executed successfully", { 
        executionTimeMs: executionTime,
        outputLength: stdout.length
      });
      
      return stdout.trim();
    } catch (error) {
      // Properly type check the error object
      let errorMessage = "Unknown error occurred";
      if (error && typeof error === "object") {
        if ("message" in error && typeof error.message === "string") {
          errorMessage = error.message;
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      
      this.log("error", "AppleScript execution failed", { 
        error: errorMessage,
        scriptPreview
      });
      
      throw new Error(`AppleScript execution failed: ${errorMessage}`);
    }
  }

  /**
   * Sets up request handlers for the given server (or this.server if none provided).
   * @param server - Optional Server instance to set up handlers on. Defaults to this.server.
   */
  private setupHandlers(server?: Server): void {
    const target = server ?? this.server;

    // List available tools
    target.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.categories.flatMap((category) =>
        category.scripts.map((script) => ({
          name: `${category.name}_${script.name}`, // Changed from dot to underscore
          description: `[${category.description}] ${script.description}`,
          inputSchema: script.schema || {
            type: "object",
            properties: {},
          },
        })),
      ),
    }));

    // Handle tool execution
    target.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      this.log("info", "Tool execution requested", { 
        tool: toolName,
        hasArguments: !!request.params.arguments
      });
      
      try {
        // Split on underscore instead of dot
        const [categoryName, ...scriptNameParts] =
          toolName.split("_");
        const scriptName = scriptNameParts.join("_"); // Rejoin in case script name has underscores

        const category = this.categories.find((c) => c.name === categoryName);
        if (!category) {
          this.log("warning", "Category not found", { categoryName });
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Category not found: ${categoryName}`,
          );
        }

        const script = category.scripts.find((s) => s.name === scriptName);
        if (!script) {
          this.log("warning", "Script not found", { 
            categoryName, 
            scriptName 
          });
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Script not found: ${scriptName}`,
          );
        }

        this.log("debug", "Generating script content", { 
          categoryName, 
          scriptName,
          isFunction: typeof script.script === "function"
        });
        
        const scriptContent =
          typeof script.script === "function"
            ? script.script(request.params.arguments)
            : script.script;

        const result = await this.executeScript(scriptContent);
        
        this.log("info", "Tool execution completed successfully", { 
          tool: toolName,
          resultLength: result.length
        });

        return {
          content: [
            {
              type: "text",
              text: result,
            },
          ],
        };
      } catch (error) {
        if (error instanceof McpError) {
          this.log("error", "MCP error during tool execution", { 
            tool: toolName,
            errorCode: error.code,
            errorMessage: error.message
          });
          throw error;
        }

        let errorMessage = "Unknown error occurred";
        if (error && typeof error === "object") {
          if ("message" in error && typeof error.message === "string") {
            errorMessage = error.message;
          } else if (error instanceof Error) {
            errorMessage = error.message;
          }
        } else if (typeof error === "string") {
          errorMessage = error;
        }

        this.log("error", "Error during tool execution", { 
          tool: toolName,
          errorMessage
        });

        return {
          content: [
            {
              type: "text",
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Creates a new Server instance with the same capabilities as the main server.
   */
  private createServer(): Server {
    return new Server(
      {
        name: this._initInfo.name,
        version: this._initInfo.version,
      },
      {
        capabilities: {
          tools: {},
          logging: {},
        },
      },
    );
  }

  /**
   * Gracefully shuts down the framework.
   * For HTTP mode: closes all transports and the HTTP server.
   * For stdio mode: disconnects the server.
   */
  async close(): Promise<void> {
    if (this.transportType === "http") {
      // Close all active HTTP transports
      const closePromises = Array.from(this._httpTransports.values()).map(
        (transport) => transport.close()
      );
      await Promise.all(closePromises);
      this._httpTransports.clear();

      // Close the HTTP server
      if (this._httpServer) {
        await new Promise<void>((resolve, reject) => {
          this._httpServer!.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        this._httpServer = null;
      }
    } else {
      // stdio mode: close the main server
      await this.server.close();
      this._isConnected = false;
    }
  }

  /**
   * Runs the AppleScript framework server.
   */
  async run(): Promise<void> {
    if (this.transportType === "http") {
      await this._runHttp();
    } else {
      await this._runStdio();
    }
  }

  /**
   * Runs the server using stdio transport (default behavior).
   */
  private async _runStdio(): Promise<void> {
    console.error("[INFO] Setting up request handlers");
    this.setupHandlers();
    
    console.error("[INFO] Initializing StdioServerTransport");
    const transport = new StdioServerTransport();
    
    try {
      console.error("[INFO] Connecting server to transport");
      await this.server.connect(transport);
      this._isConnected = true;
      
      // Log server running status using console only
      const totalScripts = this.categories.reduce((count, category) => count + category.scripts.length, 0);
      console.error(`[NOTICE] AppleScript MCP server running with ${this.categories.length} categories and ${totalScripts} scripts`);
      
      console.error("AppleScript MCP server running");
    } catch (error) {
      let errorMessage = "Unknown error occurred";
      if (error && typeof error === "object" && error instanceof Error) {
        errorMessage = error.message;
      }
      
      console.error("Failed to start AppleScript MCP server:", errorMessage);
      throw error;
    }
  }

  /**
   * Runs the server using streamable HTTP transport.
   */
  private async _runHttp(): Promise<void> {
    const app = express();

    // Configure CORS (permissive for dev)
    app.use(cors({
      origin: "*",
      methods: "GET,POST,DELETE",
      exposedHeaders: ["mcp-session-id", "last-event-id", "mcp-protocol-version"],
    }));

    // Parse JSON bodies
    app.use(express.json());

    const totalScripts = this.categories.reduce((count, category) => count + category.scripts.length, 0);
    console.error(`[INFO] Starting HTTP transport on port ${this.port} with ${this.categories.length} categories and ${totalScripts} scripts`);

    // POST /mcp — main JSON-RPC endpoint
    app.post("/mcp", async (req: Request, res: Response) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (sessionId && this._httpTransports.has(sessionId)) {
        // Reuse existing transport for this session
        const transport = this._httpTransports.get(sessionId)!;
        await transport.handleRequest(req, res, req.body);
      } else if (!sessionId) {
        // New session initialization
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            this._httpTransports.set(newSessionId, transport);
            console.error(`[INFO] New MCP session initialized: ${newSessionId}`);
          },
        });

        // Create a fresh Server instance for this session
        const sessionServer = this.createServer();
        this.setupHandlers(sessionServer);
        await sessionServer.connect(transport);

        // Handle the initialization request
        await transport.handleRequest(req, res, req.body);
      } else {
        // Session ID provided but not found
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: No valid session ID provided",
          },
          id: req.body?.id ?? null,
        });
      }
    });

    // GET /mcp — SSE stream for server-to-client notifications
    app.get("/mcp", async (req: Request, res: Response) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (sessionId && this._httpTransports.has(sessionId)) {
        const transport = this._httpTransports.get(sessionId)!;
        await transport.handleRequest(req, res);
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: No valid session ID provided",
          },
          id: null,
        });
      }
    });

    // DELETE /mcp — session termination
    app.delete("/mcp", async (req: Request, res: Response) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (sessionId && this._httpTransports.has(sessionId)) {
        const transport = this._httpTransports.get(sessionId)!;
        await transport.handleRequest(req, res);
        // Clean up the session after deletion
        this._httpTransports.delete(sessionId);
        console.error(`[INFO] MCP session terminated: ${sessionId}`);
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: No valid session ID provided",
          },
          id: null,
        });
      }
    });

    // Start the HTTP server
    await new Promise<void>((resolve) => {
      this._httpServer = app.listen(this.port, () => {
        console.error(`[NOTICE] AppleScript MCP HTTP server listening on port ${this.port}`);
        resolve();
      });
    });

    // Graceful shutdown on SIGINT
    process.on("SIGINT", async () => {
      console.error("[INFO] Received SIGINT, shutting down HTTP server...");
      await this.close();
      process.exit(0);
    });
  }
}
