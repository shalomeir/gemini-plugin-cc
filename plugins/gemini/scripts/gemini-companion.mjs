#!/usr/bin/env node

/**
 * Gemini Companion — main CLI entry point.
 *
 * Subcommands:
 *   setup     — check Gemini CLI readiness
 *   review    — run a Gemini code review
 *   task      — delegate a task to Gemini
 *   ui-review — review UI screenshots against code
 *   media     — analyze image, audio, or video files
 *   analyze   — analyze codebase with large context window
 *   task-worker — background task runner
 *   status    — show job status
 *   result    — show job result
 *   cancel    — cancel a running job
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { parseArgs, splitRawArgumentString } from "./lib/args.mjs";
import { readStdinIfPiped } from "./lib/fs.mjs";
import {
  getGeminiAvailability,
  getGeminiAuthStatus,
  runGeminiSync,
  runGeminiStream
} from "./lib/gemini.mjs";
import { collectReviewContext, ensureGitRepository, resolveReviewTarget } from "./lib/git.mjs";
import { binaryAvailable, terminateProcessTree } from "./lib/process.mjs";
import { loadPromptTemplate, interpolateTemplate } from "./lib/prompts.mjs";
import {
  generateJobId,
  listJobs,
  upsertJob,
  writeJobFile
} from "./lib/state.mjs";
import {
  buildSingleJobSnapshot,
  buildStatusSnapshot,
  readStoredJob,
  resolveCancelableJob,
  resolveResultJob,
  sortJobsNewestFirst
} from "./lib/job-control.mjs";
import {
  appendLogLine,
  createJobLogFile,
  createJobProgressUpdater,
  createJobRecord,
  createProgressReporter,
  nowIso,
  runTrackedJob
} from "./lib/tracked-jobs.mjs";
import { resolveWorkspaceRoot } from "./lib/workspace.mjs";
import {
  renderReviewResult,
  renderStoredJobResult,
  renderCancelReport,
  renderJobStatusReport,
  renderSetupReport,
  renderStatusReport,
  renderTaskResult,
  renderUiReviewResult,
  renderMediaResult,
  renderAnalyzeResult
} from "./lib/render.mjs";

const ROOT_DIR = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

function printUsage() {
  console.log(
    [
      "Usage:",
      "  gemini-companion setup [--json]",
      "  gemini-companion review [--wait|--background] [--base <ref>] [--scope <auto|working-tree|branch>]",
      "  gemini-companion task [--background] [--model <model>] [--sandbox] [prompt]",
      "  gemini-companion ui-review [--background] [--model <model>] <@screenshot.png> [instructions]",
      "  gemini-companion media [--model <model>] <@file.png|mp3|mp4> [question]",
      "  gemini-companion analyze [--background] [--scope <path>] [focus area or question]",
      "  gemini-companion status [job-id] [--all]",
      "  gemini-companion result [job-id] [--json]",
      "  gemini-companion cancel [job-id] [--json]"
    ].join("\n")
  );
}

function outputResult(value, asJson) {
  if (asJson) {
    console.log(JSON.stringify(value, null, 2));
  } else {
    process.stdout.write(typeof value === "string" ? value : JSON.stringify(value, null, 2));
  }
}

function outputCommandResult(payload, rendered, asJson) {
  outputResult(asJson ? payload : rendered, asJson);
}

function normalizeArgv(argv) {
  if (argv.length === 1) {
    const [raw] = argv;
    if (!raw || !raw.trim()) {
      return [];
    }
    return splitRawArgumentString(raw);
  }
  return argv;
}

function parseCommandInput(argv, config = {}) {
  return parseArgs(normalizeArgv(argv), {
    ...config,
    aliasMap: {
      C: "cwd",
      ...(config.aliasMap ?? {})
    }
  });
}

function resolveCommandCwd(options = {}) {
  return options.cwd ? path.resolve(process.cwd(), options.cwd) : process.cwd();
}

function resolveCommandWorkspace(options = {}) {
  return resolveWorkspaceRoot(resolveCommandCwd(options));
}

function shorten(text, limit = 96) {
  const normalized = String(text ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 3)}...`;
}

function firstMeaningfulLine(text, fallback) {
  const line = String(text ?? "")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find(Boolean);
  return line ?? fallback;
}

// ── Setup ────────────────────────────────────────────────────────────

function buildSetupReport(cwd, actionsTaken = []) {
  const nodeStatus = binaryAvailable("node", ["--version"], { cwd });
  const npmStatus = binaryAvailable("npm", ["--version"], { cwd });
  const geminiStatus = getGeminiAvailability(cwd);
  const authStatus = geminiStatus.available
    ? getGeminiAuthStatus(cwd)
    : { authenticated: false, method: "none", detail: "Gemini CLI not installed" };

  const nextSteps = [];
  if (!geminiStatus.available) {
    nextSteps.push("Install Gemini CLI with `npm install -g @google/gemini-cli`.");
  }
  if (geminiStatus.available && !authStatus.authenticated) {
    nextSteps.push("Run `!gemini` interactively to authenticate, or set `GEMINI_API_KEY` env var.");
  }

  return {
    ready: nodeStatus.available && geminiStatus.available && authStatus.authenticated,
    node: nodeStatus,
    npm: npmStatus,
    gemini: geminiStatus,
    auth: { available: geminiStatus.available, ...authStatus },
    actionsTaken,
    nextSteps
  };
}

function handleSetup(argv) {
  const { options } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"]
  });

  const cwd = resolveCommandCwd(options);
  const finalReport = buildSetupReport(cwd);
  outputResult(options.json ? finalReport : renderSetupReport(finalReport), options.json);
}

// ── Review ───────────────────────────────────────────────────────────

function ensureGeminiReady(cwd) {
  const geminiStatus = getGeminiAvailability(cwd);
  if (!geminiStatus.available) {
    throw new Error("Gemini CLI is not installed. Install it with `npm install -g @google/gemini-cli`, then rerun `/gemini:setup`.");
  }
}

function buildReviewPrompt(context) {
  const template = loadPromptTemplate(ROOT_DIR, "code-review");
  return interpolateTemplate(template, {
    TARGET_LABEL: context.target.label,
    REVIEW_INPUT: context.content
  });
}

async function executeReviewRun(request) {
  ensureGeminiReady(request.cwd);
  ensureGitRepository(request.cwd);

  const target = resolveReviewTarget(request.cwd, {
    base: request.base,
    scope: request.scope
  });
  const context = collectReviewContext(request.cwd, target);
  const prompt = buildReviewPrompt(context);

  if (request.onProgress) {
    request.onProgress({ message: "Running Gemini review...", phase: "starting" });
  }

  const result = await runGeminiStream(context.repoRoot, prompt, {
    model: request.model,
    onProgress: request.onProgress
  });

  const payload = {
    review: "Review",
    target,
    context: {
      repoRoot: context.repoRoot,
      branch: context.branch,
      summary: context.summary
    },
    gemini: {
      status: result.status,
      response: result.response,
      stderr: result.stderr,
      stats: result.stats
    },
    sessionId: result.sessionId
  };

  const rendered = renderReviewResult(result, {
    reviewLabel: "Review",
    targetLabel: context.target.label
  });

  return {
    exitStatus: result.status,
    payload,
    rendered,
    summary: firstMeaningfulLine(result.response, "Review completed."),
    jobTitle: "Gemini Review",
    jobClass: "review",
    targetLabel: context.target.label
  };
}

async function handleReview(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["base", "scope", "model", "cwd"],
    booleanOptions: ["json", "background", "wait"],
    aliasMap: { m: "model" }
  });

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveCommandWorkspace(options);
  const job = createCompanionJob({
    prefix: "review",
    kind: "review",
    title: "Gemini Review",
    workspaceRoot,
    jobClass: "review",
    summary: `Review ${options.scope ?? "auto"}`
  });

  const { logFile, progress } = createTrackedProgress(job, { stderr: !options.json });
  const execution = await runTrackedJob(job, () =>
    executeReviewRun({
      cwd,
      base: options.base,
      scope: options.scope,
      model: options.model,
      onProgress: progress
    }),
    { logFile }
  );

  outputResult(options.json ? execution.payload : execution.rendered, options.json);
  if (execution.exitStatus !== 0) {
    process.exitCode = execution.exitStatus;
  }
}

// ── UI Review ───────────────────────────────────────────────────────

function buildUiReviewPrompt(fileRefs, diffContext, extraInstructions) {
  const template = loadPromptTemplate(ROOT_DIR, "ui-review");
  return interpolateTemplate(template, {
    FILE_REFERENCES: fileRefs || "",
    DIFF_CONTEXT: diffContext || "",
    EXTRA_INSTRUCTIONS: extraInstructions || ""
  });
}

async function executeUiReviewRun(request) {
  ensureGeminiReady(request.cwd);

  if (!request.prompt) {
    throw new Error("Provide screenshot file(s) and optional instructions. Example: @screenshot.png review this component");
  }

  if (request.onProgress) {
    request.onProgress({ message: "Running Gemini UI review...", phase: "starting" });
  }

  // Build prompt with the ui-review template, embedding user's file refs and instructions
  const fileRefs = request.fileRefs || "";
  const diffContext = request.diffContext || "";
  const fullPrompt = buildUiReviewPrompt(fileRefs, diffContext, request.prompt);

  const result = await runGeminiStream(request.cwd, fullPrompt, {
    model: request.model,
    onProgress: request.onProgress
  });

  const payload = {
    status: result.status,
    response: result.response,
    stats: result.stats,
    sessionId: result.sessionId
  };

  const rendered = renderUiReviewResult(result);

  return {
    exitStatus: result.status,
    payload,
    rendered,
    summary: firstMeaningfulLine(result.response, "UI review completed."),
    jobTitle: "Gemini UI Review",
    jobClass: "ui-review"
  };
}

async function handleUiReview(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["model", "cwd", "scope"],
    booleanOptions: ["json", "background"],
    aliasMap: { m: "model" }
  });

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveCommandWorkspace(options);
  const rawPrompt = positionals.join(" ");

  if (options.background) {
    // Reuse the task-worker mechanism for background execution
    const job = createCompanionJob({
      prefix: "uireview",
      kind: "ui-review",
      title: "Gemini UI Review",
      workspaceRoot,
      jobClass: "ui-review",
      summary: shorten(rawPrompt)
    });

    const logFile = createJobLogFile(workspaceRoot, job.id, job.title);
    appendLogLine(logFile, "Queued for background execution.");

    const child = spawnDetachedTaskWorker(cwd, job.id);
    const queuedRecord = {
      ...job,
      status: "queued",
      phase: "queued",
      pid: child.pid ?? null,
      logFile,
      request: { cwd, model: options.model, prompt: rawPrompt, kind: "ui-review" }
    };
    writeJobFile(workspaceRoot, job.id, queuedRecord);
    upsertJob(workspaceRoot, queuedRecord);

    const payload = { jobId: job.id, status: "queued", title: job.title };
    const rendered = `Gemini UI review started in the background as ${job.id}. Check \`/gemini:status ${job.id}\` for progress.\n`;
    outputCommandResult(payload, rendered, options.json);
    return;
  }

  const job = createCompanionJob({
    prefix: "uireview",
    kind: "ui-review",
    title: "Gemini UI Review",
    workspaceRoot,
    jobClass: "ui-review",
    summary: shorten(rawPrompt)
  });

  const { logFile, progress } = createTrackedProgress(job, { stderr: !options.json });
  const execution = await runTrackedJob(job, () =>
    executeUiReviewRun({
      cwd,
      model: options.model,
      prompt: rawPrompt,
      onProgress: progress
    }),
    { logFile }
  );

  outputResult(options.json ? execution.payload : execution.rendered, options.json);
  if (execution.exitStatus !== 0) {
    process.exitCode = execution.exitStatus;
  }
}

// ── Media ───────────────────────────────────────────────────────────

async function executeMediaRun(request) {
  ensureGeminiReady(request.cwd);

  if (!request.prompt) {
    throw new Error("Provide a media file reference and optional instructions. Example: @photo.jpg describe this image");
  }

  if (request.onProgress) {
    request.onProgress({ message: "Running Gemini media analysis...", phase: "starting" });
  }

  const result = await runGeminiStream(request.cwd, request.prompt, {
    model: request.model,
    onProgress: request.onProgress
  });

  const payload = {
    status: result.status,
    response: result.response,
    stats: result.stats,
    sessionId: result.sessionId
  };

  const rendered = renderMediaResult(result);

  return {
    exitStatus: result.status,
    payload,
    rendered,
    summary: firstMeaningfulLine(result.response, "Media analysis completed."),
    jobTitle: "Gemini Media Analysis",
    jobClass: "media"
  };
}

async function handleMedia(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["model", "cwd"],
    booleanOptions: ["json"],
    aliasMap: { m: "model" }
  });

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveCommandWorkspace(options);
  const rawPrompt = positionals.join(" ");

  const job = createCompanionJob({
    prefix: "media",
    kind: "media",
    title: "Gemini Media Analysis",
    workspaceRoot,
    jobClass: "media",
    summary: shorten(rawPrompt)
  });

  const { logFile, progress } = createTrackedProgress(job, { stderr: !options.json });
  const execution = await runTrackedJob(job, () =>
    executeMediaRun({
      cwd,
      model: options.model,
      prompt: rawPrompt,
      onProgress: progress
    }),
    { logFile }
  );

  outputResult(options.json ? execution.payload : execution.rendered, options.json);
  if (execution.exitStatus !== 0) {
    process.exitCode = execution.exitStatus;
  }
}

// ── Analyze ─────────────────────────────────────────────────────────

function buildAnalyzePrompt(focusArea, extraInstructions) {
  const template = loadPromptTemplate(ROOT_DIR, "codebase-analyze");
  return interpolateTemplate(template, {
    FOCUS_AREA: focusArea || "",
    EXTRA_INSTRUCTIONS: extraInstructions || ""
  });
}

async function executeAnalyzeRun(request) {
  ensureGeminiReady(request.cwd);

  if (request.onProgress) {
    request.onProgress({ message: "Running Gemini codebase analysis...", phase: "starting" });
  }

  const fullPrompt = buildAnalyzePrompt(request.focusArea, request.extraInstructions);

  const geminiOptions = {
    model: request.model,
    onProgress: request.onProgress
  };

  if (request.scope) {
    geminiOptions.includeDirectories = request.scope;
  }

  const result = await runGeminiStream(request.cwd, fullPrompt, geminiOptions);

  const payload = {
    status: result.status,
    response: result.response,
    stats: result.stats,
    sessionId: result.sessionId
  };

  const rendered = renderAnalyzeResult(result);

  return {
    exitStatus: result.status,
    payload,
    rendered,
    summary: firstMeaningfulLine(result.response, "Codebase analysis completed."),
    jobTitle: "Gemini Codebase Analysis",
    jobClass: "analyze"
  };
}

async function handleAnalyze(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["model", "cwd", "scope"],
    booleanOptions: ["json", "background"],
    aliasMap: { m: "model" }
  });

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveCommandWorkspace(options);
  const rawPrompt = positionals.join(" ");

  if (options.background) {
    const job = createCompanionJob({
      prefix: "analyze",
      kind: "analyze",
      title: "Gemini Codebase Analysis",
      workspaceRoot,
      jobClass: "analyze",
      summary: shorten(rawPrompt || "Full codebase analysis")
    });

    const logFile = createJobLogFile(workspaceRoot, job.id, job.title);
    appendLogLine(logFile, "Queued for background execution.");

    const child = spawnDetachedTaskWorker(cwd, job.id);
    const queuedRecord = {
      ...job,
      status: "queued",
      phase: "queued",
      pid: child.pid ?? null,
      logFile,
      request: { cwd, model: options.model, prompt: rawPrompt, scope: options.scope, kind: "analyze" }
    };
    writeJobFile(workspaceRoot, job.id, queuedRecord);
    upsertJob(workspaceRoot, queuedRecord);

    const payload = { jobId: job.id, status: "queued", title: job.title };
    const rendered = `Gemini codebase analysis started in the background as ${job.id}. Check \`/gemini:status ${job.id}\` for progress.\n`;
    outputCommandResult(payload, rendered, options.json);
    return;
  }

  const job = createCompanionJob({
    prefix: "analyze",
    kind: "analyze",
    title: "Gemini Codebase Analysis",
    workspaceRoot,
    jobClass: "analyze",
    summary: shorten(rawPrompt || "Full codebase analysis")
  });

  const { logFile, progress } = createTrackedProgress(job, { stderr: !options.json });
  const execution = await runTrackedJob(job, () =>
    executeAnalyzeRun({
      cwd,
      model: options.model,
      focusArea: rawPrompt,
      scope: options.scope,
      onProgress: progress
    }),
    { logFile }
  );

  outputResult(options.json ? execution.payload : execution.rendered, options.json);
  if (execution.exitStatus !== 0) {
    process.exitCode = execution.exitStatus;
  }
}

// ── Task ─────────────────────────────────────────────────────────────

async function executeTaskRun(request) {
  ensureGeminiReady(request.cwd);

  if (!request.prompt) {
    throw new Error("Provide a prompt for the Gemini task.");
  }

  if (request.onProgress) {
    request.onProgress({ message: "Running Gemini task...", phase: "starting" });
  }

  const result = await runGeminiStream(request.cwd, request.prompt, {
    model: request.model,
    sandbox: request.sandbox,
    onProgress: request.onProgress
  });

  const rendered = renderTaskResult(result);
  const payload = {
    status: result.status,
    response: result.response,
    stats: result.stats,
    sessionId: result.sessionId
  };

  return {
    exitStatus: result.status,
    payload,
    rendered,
    summary: firstMeaningfulLine(result.response, "Task finished."),
    jobTitle: "Gemini Task",
    jobClass: "task"
  };
}

function spawnDetachedTaskWorker(cwd, jobId) {
  const scriptPath = path.join(ROOT_DIR, "scripts", "gemini-companion.mjs");
  const child = spawn(process.execPath, [scriptPath, "task-worker", "--cwd", cwd, "--job-id", jobId], {
    cwd,
    env: process.env,
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
  return child;
}

async function handleTask(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["model", "cwd", "prompt-file"],
    booleanOptions: ["json", "background", "sandbox"],
    aliasMap: { m: "model" }
  });

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveCommandWorkspace(options);

  let prompt;
  if (options["prompt-file"]) {
    prompt = fs.readFileSync(path.resolve(cwd, options["prompt-file"]), "utf8");
  } else {
    prompt = positionals.join(" ") || readStdinIfPiped();
  }

  if (!prompt) {
    throw new Error("Provide a prompt, a prompt file, or piped stdin.");
  }

  const job = createCompanionJob({
    prefix: "task",
    kind: "task",
    title: "Gemini Task",
    workspaceRoot,
    jobClass: "task",
    summary: shorten(prompt)
  });

  if (options.background) {
    const logFile = createJobLogFile(workspaceRoot, job.id, job.title);
    appendLogLine(logFile, "Queued for background execution.");

    const child = spawnDetachedTaskWorker(cwd, job.id);
    const queuedRecord = {
      ...job,
      status: "queued",
      phase: "queued",
      pid: child.pid ?? null,
      logFile,
      request: { cwd, model: options.model, prompt, sandbox: options.sandbox }
    };
    writeJobFile(workspaceRoot, job.id, queuedRecord);
    upsertJob(workspaceRoot, queuedRecord);

    const payload = {
      jobId: job.id,
      status: "queued",
      title: job.title,
      summary: job.summary,
      logFile
    };
    const rendered = `Gemini task started in the background as ${job.id}. Check \`/gemini:status ${job.id}\` for progress.\n`;
    outputCommandResult(payload, rendered, options.json);
    return;
  }

  const { logFile, progress } = createTrackedProgress(job, { stderr: !options.json });
  const execution = await runTrackedJob(job, () =>
    executeTaskRun({
      cwd,
      model: options.model,
      prompt,
      sandbox: options.sandbox,
      onProgress: progress
    }),
    { logFile }
  );

  outputResult(options.json ? execution.payload : execution.rendered, options.json);
  if (execution.exitStatus !== 0) {
    process.exitCode = execution.exitStatus;
  }
}

async function handleTaskWorker(argv) {
  const { options } = parseCommandInput(argv, {
    valueOptions: ["cwd", "job-id"]
  });

  if (!options["job-id"]) {
    throw new Error("Missing required --job-id for task-worker.");
  }

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveCommandWorkspace(options);
  const storedJob = readStoredJob(workspaceRoot, options["job-id"]);
  if (!storedJob) {
    throw new Error(`No stored job found for ${options["job-id"]}.`);
  }

  const request = storedJob.request;
  if (!request || typeof request !== "object") {
    throw new Error(`Stored job ${options["job-id"]} is missing its task request payload.`);
  }

  const { logFile, progress } = createTrackedProgress(
    { ...storedJob, workspaceRoot },
    { logFile: storedJob.logFile ?? null }
  );

  // Dispatch to the correct executor based on stored job kind
  const kind = request.kind ?? storedJob.kind ?? "task";
  const executorMap = {
    task: () => executeTaskRun({ ...request, onProgress: progress }),
    "ui-review": () => executeUiReviewRun({ ...request, onProgress: progress }),
    analyze: () => executeAnalyzeRun({
      ...request,
      focusArea: request.prompt,
      scope: request.scope,
      onProgress: progress
    })
  };

  const executor = executorMap[kind] ?? executorMap.task;

  await runTrackedJob(
    { ...storedJob, workspaceRoot, logFile },
    executor,
    { logFile }
  );
}

// ── Status / Result / Cancel ─────────────────────────────────────────

// Gemini CLI is one-shot — no persistent process to poll, so just show current state.
function handleStatus(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json", "all"]
  });

  const cwd = resolveCommandCwd(options);
  const reference = positionals[0] ?? "";

  if (reference) {
    const snapshot = buildSingleJobSnapshot(cwd, reference);
    outputCommandResult(snapshot, renderJobStatusReport(snapshot.job), options.json);
    return;
  }

  const report = buildStatusSnapshot(cwd, { all: options.all });
  outputResult(options.json ? report : renderStatusReport(report), options.json);
}

function handleResult(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"]
  });

  const cwd = resolveCommandCwd(options);
  const reference = positionals[0] ?? "";
  const { workspaceRoot, job } = resolveResultJob(cwd, reference);
  const storedJob = readStoredJob(workspaceRoot, job.id);
  const payload = { job, storedJob };
  outputCommandResult(payload, renderStoredJobResult(job, storedJob), options.json);
}

async function handleCancel(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"]
  });

  const cwd = resolveCommandCwd(options);
  const reference = positionals[0] ?? "";
  const { workspaceRoot, job } = resolveCancelableJob(cwd, reference);

  terminateProcessTree(job.pid ?? Number.NaN);
  appendLogLine(job.logFile, "Cancelled by user.");

  const completedAt = nowIso();
  const nextJob = {
    ...job,
    status: "cancelled",
    phase: "cancelled",
    pid: null,
    completedAt,
    errorMessage: "Cancelled by user."
  };

  const existing = readStoredJob(workspaceRoot, job.id) ?? {};
  writeJobFile(workspaceRoot, job.id, {
    ...existing,
    ...nextJob,
    cancelledAt: completedAt
  });
  upsertJob(workspaceRoot, {
    id: job.id,
    status: "cancelled",
    phase: "cancelled",
    pid: null,
    errorMessage: "Cancelled by user.",
    completedAt
  });

  const payload = { jobId: job.id, status: "cancelled", title: job.title };
  outputCommandResult(payload, renderCancelReport(nextJob), options.json);
}

// ── Helpers ──────────────────────────────────────────────────────────

function createCompanionJob({ prefix, kind, title, workspaceRoot, jobClass, summary }) {
  return createJobRecord({
    id: generateJobId(prefix),
    kind,
    kindLabel: kind,
    title,
    workspaceRoot,
    jobClass,
    summary
  });
}

function createTrackedProgress(job, options = {}) {
  const logFile = options.logFile ?? createJobLogFile(job.workspaceRoot, job.id, job.title);
  return {
    logFile,
    progress: createProgressReporter({
      stderr: Boolean(options.stderr),
      logFile,
      onEvent: createJobProgressUpdater(job.workspaceRoot, job.id)
    })
  };
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const [subcommand, ...argv] = process.argv.slice(2);
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    printUsage();
    return;
  }

  switch (subcommand) {
    case "setup":
      handleSetup(argv);
      break;
    case "review":
      await handleReview(argv);
      break;
    case "task":
      await handleTask(argv);
      break;
    case "ui-review":
      await handleUiReview(argv);
      break;
    case "media":
      await handleMedia(argv);
      break;
    case "analyze":
      await handleAnalyze(argv);
      break;
    case "task-worker":
      await handleTaskWorker(argv);
      break;
    case "status":
      handleStatus(argv);
      break;
    case "result":
      handleResult(argv);
      break;
    case "cancel":
      await handleCancel(argv);
      break;
    default:
      throw new Error(`Unknown subcommand: ${subcommand}`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
