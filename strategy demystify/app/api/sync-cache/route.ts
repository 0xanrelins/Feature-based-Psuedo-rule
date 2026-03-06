import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

const PYTHON_BIN = process.env.MOTOR_PYTHON_BIN || "python3";
const DEFAULT_TEXT_TO_QUERY_PATH = process.env.TEXT_TO_QUERY_PATH || "/Users/0xanrelins/Desktop/Feature-based Psuedo-rule/TEXT TO QUERY";
const SCRIPT_RELATIVE_PATH = "scripts/sync_15m_local_cache.py";
const MARKET_HISTORY_RELATIVE_PATH = "data/15m-btc-markets-history.json";
const SNAPSHOT_DIR_RELATIVE_PATH = "data/15m_30d_snapshots";

function resolveTextToQueryApiKey(textToQueryPath: string): string | undefined {
  const envPath = path.resolve(textToQueryPath, ".env");
  if (!fs.existsSync(envPath)) return undefined;
  try {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      if (line.startsWith("POLYBACKTEST_API_KEY=")) {
        return line.split("=", 2)[1]?.trim().replace(/^['"]|['"]$/g, "");
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function runPython(
  scriptPath: string,
  args: string[] = [],
  timeout = 300000
): Promise<{ stdout: string; stderr: string; status: number }> {
  const textToQueryPath = DEFAULT_TEXT_TO_QUERY_PATH;
  const absScript = path.resolve(textToQueryPath, scriptPath);
  if (!fs.existsSync(absScript)) {
    throw new Error(`Script not found: ${absScript}`);
  }
  const resolvedApiKey = resolveTextToQueryApiKey(textToQueryPath);
  const effectiveApiKey = resolvedApiKey || process.env.POLYBACKTEST_API_KEY;
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_BIN, [absScript, ...args], {
      cwd: textToQueryPath,
      env: {
        ...process.env,
        ...(effectiveApiKey ? { POLYBACKTEST_API_KEY: effectiveApiKey } : {}),
        PYTHONPATH: [path.resolve(textToQueryPath, "src"), process.env.PYTHONPATH || ""].filter(Boolean).join(":"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const maxBuffer = 10 * 1024 * 1024;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeout);

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
      if (stdout.length > maxBuffer) {
        stderr += "\n[truncated stdout: exceeded max buffer]";
        child.kill("SIGTERM");
      }
    });

    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
      if (stderr.length > maxBuffer) {
        stderr += "\n[truncated stderr: exceeded max buffer]";
        child.kill("SIGTERM");
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        resolve({
          stdout,
          stderr: `${stderr}\nProcess timeout after ${timeout}ms`,
          status: -1,
        });
        return;
      }
      resolve({
        stdout,
        stderr,
        status: code ?? -1,
      });
    });
  });
}

function parseSyncSummary(stdout: string): {
  valid: number | null;
  fetched_repaired: number | null;
  failures: number | null;
  unusable_after_fetch: number | null;
  total: number | null;
  coverage_days: number | null;
  coverage_start: string | null;
  coverage_end: string | null;
  snapshots_complete: number | null;
  snapshots_total: number | null;
} {
  const stats = {
    valid: null as number | null,
    fetched_repaired: null as number | null,
    failures: null as number | null,
    unusable_after_fetch: null as number | null,
    total: null as number | null,
    coverage_days: null as number | null,
    coverage_start: null as string | null,
    coverage_end: null as string | null,
    snapshots_complete: null as number | null,
    snapshots_total: null as number | null,
  };

  const lines = stdout.split("\n");
  for (const line of lines) {
    const validMatch = line.match(/Snapshots already valid:\s*(\d+)/i);
    if (validMatch) stats.valid = Number(validMatch[1]);
    const fetchedMatch = line.match(/Snapshots fetched\/repaired:\s*(\d+)/i);
    if (fetchedMatch) stats.fetched_repaired = Number(fetchedMatch[1]);
    const failMatch = line.match(/Snapshot fetch failures:\s*(\d+)/i);
    if (failMatch) stats.failures = Number(failMatch[1]);
    const unusableMatch = line.match(/Snapshot unusable after fetch:\s*(\d+)/i);
    if (unusableMatch) stats.unusable_after_fetch = Number(unusableMatch[1]);
    const rangeStartMatch = line.match(/Coverage start:\s*([0-9\-]+)/i);
    if (rangeStartMatch) stats.coverage_start = rangeStartMatch[1];
    const rangeEndMatch = line.match(/Coverage end:\s*([0-9\-]+)/i);
    if (rangeEndMatch) stats.coverage_end = rangeEndMatch[1];
    const daysMatch = line.match(/Coverage days:\s*(\d+)/i);
    if (daysMatch) stats.coverage_days = Number(daysMatch[1]);
    const totalMatch = line.match(/Markets in current sync window:\s*(\d+)/i);
    if (totalMatch) stats.total = Number(totalMatch[1]);
    const snapshotsMatch = line.match(/Snapshots complete in current sync window:\s*(\d+)\s*\/\s*(\d+)/i);
    if (snapshotsMatch) {
      stats.snapshots_complete = Number(snapshotsMatch[1]);
      stats.snapshots_total = Number(snapshotsMatch[2]);
    }
    const fallbackRangeMatch = line.match(/Current sync window:\s*([0-9\-]+)\s*->\s*([0-9\-]+)\s*\((\d+)\s+days\)/i);
    if (fallbackRangeMatch) {
      stats.coverage_start = fallbackRangeMatch[1];
      stats.coverage_end = fallbackRangeMatch[2];
      stats.coverage_days = Number(fallbackRangeMatch[3]);
    }
  }
  return stats;
}

function getLocalCacheStats() {
  const textToQueryPath = DEFAULT_TEXT_TO_QUERY_PATH;
  const historyPath = path.resolve(textToQueryPath, MARKET_HISTORY_RELATIVE_PATH);
  const snapshotDirPath = path.resolve(textToQueryPath, SNAPSHOT_DIR_RELATIVE_PATH);

  let totalMarkets: number | null = null;
  let coverageStart: string | null = null;
  let coverageEnd: string | null = null;
  let coverageDays: number | null = null;

  try {
    if (fs.existsSync(historyPath)) {
      const payload = JSON.parse(fs.readFileSync(historyPath, "utf-8")) as {
        markets?: Array<{ start_time?: string }>;
      };
      const markets = Array.isArray(payload.markets) ? payload.markets : [];
      totalMarkets = markets.length;
      const starts = markets
        .map((m) => (typeof m.start_time === "string" ? m.start_time : ""))
        .filter(Boolean)
        .map((s) => new Date(s))
        .filter((d) => !Number.isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());
      if (starts.length > 0) {
        const first = starts[0];
        const last = starts[starts.length - 1];
        coverageStart = first.toISOString().slice(0, 10);
        coverageEnd = last.toISOString().slice(0, 10);
        coverageDays = Math.floor((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }
    }
  } catch {
    // best-effort stats only
  }

  let snapshotFiles = 0;
  try {
    if (fs.existsSync(snapshotDirPath)) {
      snapshotFiles = fs.readdirSync(snapshotDirPath).filter((name) => name.endsWith(".json")).length;
    }
  } catch {
    // best-effort stats only
  }

  return {
    valid: snapshotFiles,
    total: totalMarkets ?? snapshotFiles,
    coverage_start: coverageStart,
    coverage_end: coverageEnd,
    coverage_days: coverageDays,
    snapshots_complete: snapshotFiles,
    snapshots_total: totalMarkets ?? snapshotFiles,
    fetched_repaired: 0,
    failures: 0,
    unusable_after_fetch: null as number | null,
  };
}

export async function POST() {
  try {
    const sync = await runPython(SCRIPT_RELATIVE_PATH, [], 900000);
    if (sync.status !== 0) {
      const errorText = (sync.stderr || sync.stdout || "").trim();
      const headerBlocked =
        (errorText.includes("X-API-Key") && (errorText.includes("422") || errorText.includes("HTTPStatusError"))) ||
        (errorText.includes("HTTPStatusError: Client error '422") && errorText.includes("/v1/markets"));
      if (headerBlocked) {
        const localStats = getLocalCacheStats();
        return NextResponse.json({
          success: true,
          degraded: true,
          message:
            "Remote sync unavailable (PolyBackTest API rejected auth header). Showing local cache stats only.",
          stats: {
            valid: localStats.valid,
            stale: null,
            missing: null,
            total: localStats.total,
            coverage_days: localStats.coverage_days,
            coverage_start: localStats.coverage_start,
            coverage_end: localStats.coverage_end,
            snapshots_complete: localStats.snapshots_complete,
            snapshots_total: localStats.snapshots_total,
            fetched_repaired: localStats.fetched_repaired,
            failures: localStats.failures,
            unusable_after_fetch: localStats.unusable_after_fetch,
          },
        });
      }
      return NextResponse.json(
        {
          success: false,
          error: "sync_failed",
          message: errorText || "sync script failed",
        },
        { status: 500 }
      );
    }

    const stats = parseSyncSummary(sync.stdout);
    if (stats.snapshots_total !== null && stats.valid !== null && stats.fetched_repaired !== null && stats.total === null) {
      stats.total = stats.snapshots_total;
    }

    return NextResponse.json({
      success: true,
      message: "Cache sync completed",
      stats: {
        valid: stats.valid,
        stale: null,
        missing: null,
        total: stats.total,
        coverage_days: stats.coverage_days,
        coverage_start: stats.coverage_start,
        coverage_end: stats.coverage_end,
        snapshots_complete: stats.snapshots_complete,
        snapshots_total: stats.snapshots_total,
        fetched_repaired: stats.fetched_repaired,
        failures: stats.failures,
        unusable_after_fetch: stats.unusable_after_fetch,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected sync error";
    return NextResponse.json(
      { success: false, error: "server_error", message },
      { status: 500 }
    );
  }
}
