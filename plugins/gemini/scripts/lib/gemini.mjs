/**
 * Gemini CLI wrapper — spawns `gemini` in headless mode and parses output.
 *
 * Unlike Codex's app-server (JSON-RPC over stdio), Gemini CLI uses a simpler
 * invocation model: `gemini -p "prompt" --output-format json -y`
 */

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

import { binaryAvailable, runCommand } from "./process.mjs";

/** Default timeout: 5 minutes. Override with GEMINI_TIMEOUT env var (in ms). */
const DEFAULT_TIMEOUT_MS = 300_000;

function resolveTimeout(optionsTimeout) {
  if (optionsTimeout != null) return optionsTimeout;
  const envVal = process.env.GEMINI_TIMEOUT;
  if (envVal && Number.isFinite(Number(envVal))) return Number(envVal);
  return DEFAULT_TIMEOUT_MS;
}

/**
 * Check if Gemini CLI is installed and return availability info.
 */
export function getGeminiAvailability(cwd) {
  const result = binaryAvailable("gemini", ["--version"], { cwd });
  if (!result.available) {
    return { available: false, detail: "Gemini CLI not found. Install with `npm install -g @google/gemini-cli`." };
  }
  return { available: true, detail: result.detail };
}

/**
 * Check if Gemini CLI has valid authentication.
 * Gemini auth is either via GEMINI_API_KEY env var or cached Google login.
 */
export function getGeminiAuthStatus(cwd) {
  if (process.env.GEMINI_API_KEY) {
    return { authenticated: true, method: "api-key", detail: "GEMINI_API_KEY is set" };
  }

  if (process.env.GOOGLE_API_KEY) {
    return { authenticated: true, method: "google-api-key", detail: "GOOGLE_API_KEY is set" };
  }

  // Try a minimal headless call to see if cached auth works
  const result = runCommand("gemini", ["-p", "ping", "--output-format", "json"], {
    cwd,
    env: { ...process.env }
  });

  if (result.status === 0) {
    return { authenticated: true, method: "cached", detail: "Cached authentication available" };
  }

  if (result.status === 41) {
    return { authenticated: false, method: "none", detail: "Not authenticated. Run `!gemini` interactively to log in, or set GEMINI_API_KEY." };
  }

  return { authenticated: false, method: "unknown", detail: result.stderr.trim() || "Authentication check failed" };
}

/**
 * Run Gemini CLI in headless mode with JSON output.
 * Returns the parsed JSON response.
 */
export function runGeminiSync(cwd, prompt, options = {}) {
  const args = ["-p", prompt, "--output-format", "json"];

  if (options.model) {
    args.push("-m", options.model);
  }

  if (options.yolo !== false) {
    args.push("-y");
  }

  if (options.sandbox) {
    args.push("--sandbox");
  }

  if (options.includeDirectories) {
    args.push("--include-directories", options.includeDirectories);
  }

  const timeoutMs = resolveTimeout(options.timeout);

  const result = runCommand("gemini", args, {
    cwd,
    env: { ...process.env, ...(options.env ?? {}) },
    timeout: timeoutMs
  });

  if (result.signal === "SIGTERM") {
    return {
      status: 1,
      response: "",
      stats: null,
      error: { message: `Gemini CLI timed out after ${Math.round(timeoutMs / 1000)}s` },
      stderr: "timeout"
    };
  }

  if (result.error) {
    throw new Error(`Failed to run Gemini CLI: ${result.error.message}`);
  }

  // Gemini outputs JSON on stdout
  const stdout = result.stdout.trim();
  if (!stdout) {
    return {
      status: result.status,
      response: "",
      stats: null,
      error: result.status !== 0 ? { message: result.stderr.trim() || `Exit code ${result.status}` } : null,
      stderr: result.stderr.trim()
    };
  }

  try {
    const parsed = JSON.parse(stdout);
    return {
      status: result.status,
      response: parsed.response ?? "",
      stats: parsed.stats ?? null,
      sessionId: parsed.session_id ?? null,
      error: parsed.error ?? null,
      stderr: result.stderr.trim()
    };
  } catch {
    // If JSON parsing fails, return raw output
    return {
      status: result.status,
      response: stdout,
      stats: null,
      error: null,
      stderr: result.stderr.trim()
    };
  }
}

/**
 * Run Gemini CLI with stream-json output for real-time progress.
 * Returns a promise that resolves with the final result.
 */
export function runGeminiStream(cwd, prompt, options = {}) {
  return new Promise((resolve, reject) => {
    const args = ["-p", prompt, "--output-format", "stream-json"];

    if (options.model) {
      args.push("-m", options.model);
    }

    if (options.yolo !== false) {
      args.push("-y");
    }

    if (options.sandbox) {
      args.push("--sandbox");
    }

    if (options.includeDirectories) {
      args.push("--include-directories", options.includeDirectories);
    }

    const child = spawn("gemini", args, {
      cwd,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: ["pipe", "pipe", "pipe"]
    });

    const timeoutMs = resolveTimeout(options.timeout);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    const events = [];
    let finalResponse = "";
    let finalStats = null;
    let sessionId = null;
    let stderrChunks = [];

    const rl = createInterface({ input: child.stdout });

    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        const event = JSON.parse(trimmed);
        events.push(event);

        // Gemini stream-json uses lowercase event types: init, message, result, error
        const eventType = (event.type ?? "").toLowerCase();

        // Track progress via onProgress callback
        if (options.onProgress) {
          if (eventType === "message" && event.role === "assistant") {
            options.onProgress({
              message: event.content?.substring(0, 80) ?? "",
              phase: "generating"
            });
          } else if (eventType === "tool_use" || eventType === "tool-use") {
            options.onProgress({
              message: `Tool: ${event.tool_name ?? "unknown"}`,
              phase: "tool-use"
            });
          } else if (eventType === "tool_result" || eventType === "tool-result") {
            options.onProgress({
              message: `Tool result: ${event.status ?? "done"}`,
              phase: "tool-result"
            });
          }
        }

        // Accumulate message content from assistant
        if (eventType === "message" && event.role === "assistant" && event.content) {
          if (event.delta) {
            finalResponse += event.content;
          } else {
            finalResponse = event.content;
          }
        }

        // Capture final stats and session ID
        if (eventType === "result") {
          if (event.stats) finalStats = event.stats;
          if (event.session_id) sessionId = event.session_id;
        }

        // session_id can also appear at top level of any event
        if (event.session_id && !sessionId) {
          sessionId = event.session_id;
        }

        // Handle errors
        if (eventType === "error") {
          if (options.onProgress) {
            options.onProgress({
              message: `Error: ${event.message ?? "unknown"}`,
              phase: "error"
            });
          }
        }
      } catch {
        // Non-JSON line — ignore
      }
    });

    child.stderr.on("data", (chunk) => {
      stderrChunks.push(chunk.toString());
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const stderr = stderrChunks.join("");
      const timeoutMsg = `Gemini CLI timed out after ${Math.round(timeoutMs / 1000)}s`;
      resolve({
        status: timedOut ? 1 : (code ?? 0),
        response: finalResponse,
        stats: finalStats,
        sessionId,
        events,
        error: timedOut
          ? { message: timeoutMsg }
          : code !== 0 ? { message: stderr.trim() || `Exit code ${code}` } : null,
        stderr: timedOut ? timeoutMsg : stderr.trim(),
        pid: child.pid
      });
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn Gemini CLI: ${error.message}`));
    });

    // Store the child process for potential cancellation
    if (options.onSpawn) {
      options.onSpawn(child);
    }
  });
}

/**
 * Spawn a detached Gemini process for background tasks.
 * Returns the child process (caller is responsible for unref).
 */
export function spawnGeminiDetached(cwd, prompt, options = {}) {
  const args = ["-p", prompt, "--output-format", "json"];

  if (options.model) {
    args.push("-m", options.model);
  }

  if (options.yolo !== false) {
    args.push("-y");
  }

  if (options.sandbox) {
    args.push("--sandbox");
  }

  const child = spawn("gemini", args, {
    cwd,
    env: { ...process.env, ...(options.env ?? {}) },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"]
  });

  return child;
}
