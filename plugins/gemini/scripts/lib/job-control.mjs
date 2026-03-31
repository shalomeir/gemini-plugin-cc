import fs from "node:fs";

import { listJobs, readJobFile, resolveJobFile } from "./state.mjs";
import { resolveWorkspaceRoot } from "./workspace.mjs";

export function sortJobsNewestFirst(jobs) {
  return [...jobs].sort((a, b) =>
    String(b.updatedAt ?? b.createdAt ?? "").localeCompare(String(a.updatedAt ?? a.createdAt ?? ""))
  );
}

export function readStoredJob(workspaceRoot, jobId) {
  const jobFile = resolveJobFile(workspaceRoot, jobId);
  if (!fs.existsSync(jobFile)) {
    return null;
  }
  try {
    return readJobFile(jobFile);
  } catch {
    return null;
  }
}

function formatElapsed(startedAt) {
  if (!startedAt) return "";
  const ms = Date.now() - new Date(startedAt).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatDuration(startedAt, completedAt) {
  if (!startedAt || !completedAt) return "";
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function enrichJob(job, storedJob) {
  const isActive = job.status === "queued" || job.status === "running";
  return {
    ...job,
    elapsed: isActive ? formatElapsed(storedJob?.startedAt ?? job.createdAt) : undefined,
    duration: !isActive ? formatDuration(storedJob?.startedAt ?? job.createdAt, job.completedAt) : undefined
  };
}

function readTailLines(logFile, maxLines = 5) {
  if (!logFile || !fs.existsSync(logFile)) {
    return [];
  }
  try {
    const content = fs.readFileSync(logFile, "utf8");
    const lines = content.split("\n").filter(Boolean);
    return lines.slice(-maxLines);
  } catch {
    return [];
  }
}

export function buildSingleJobSnapshot(cwd, reference) {
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  const jobs = listJobs(workspaceRoot);
  const job = jobs.find((j) => j.id === reference);
  if (!job) {
    throw new Error(`Job not found: ${reference}`);
  }

  const storedJob = readStoredJob(workspaceRoot, job.id);
  const enriched = enrichJob(job, storedJob);
  enriched.progressPreview = readTailLines(storedJob?.logFile ?? job.logFile);

  return {
    workspaceRoot,
    job: enriched,
    storedJob
  };
}

export function buildStatusSnapshot(cwd, options = {}) {
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  const jobs = sortJobsNewestFirst(listJobs(workspaceRoot));

  const running = [];
  const recent = [];
  let latestFinished = null;

  for (const job of jobs) {
    const storedJob = readStoredJob(workspaceRoot, job.id);
    const enriched = enrichJob(job, storedJob);
    enriched.progressPreview = readTailLines(storedJob?.logFile ?? job.logFile);

    if (job.status === "queued" || job.status === "running") {
      running.push(enriched);
    } else if (!latestFinished) {
      latestFinished = enriched;
    } else if (options.all) {
      recent.push(enriched);
    }
  }

  return {
    running,
    latestFinished,
    recent
  };
}

export function resolveCancelableJob(cwd, reference) {
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  const jobs = sortJobsNewestFirst(listJobs(workspaceRoot));

  if (reference) {
    const job = jobs.find((j) => j.id === reference);
    if (!job) {
      throw new Error(`Job not found: ${reference}`);
    }
    if (job.status !== "queued" && job.status !== "running") {
      throw new Error(`Job ${reference} is already ${job.status}.`);
    }
    return { workspaceRoot, job };
  }

  const activeJob = jobs.find((j) => j.status === "queued" || j.status === "running");
  if (!activeJob) {
    throw new Error("No active job to cancel.");
  }
  return { workspaceRoot, job: activeJob };
}

export function resolveResultJob(cwd, reference) {
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  const jobs = sortJobsNewestFirst(listJobs(workspaceRoot));

  if (reference) {
    const job = jobs.find((j) => j.id === reference);
    if (!job) {
      throw new Error(`Job not found: ${reference}`);
    }
    return { workspaceRoot, job };
  }

  const finishedJob = jobs.find((j) => j.status !== "queued" && j.status !== "running");
  if (!finishedJob) {
    throw new Error("No completed job found. Run a task or review first.");
  }
  return { workspaceRoot, job: finishedJob };
}
