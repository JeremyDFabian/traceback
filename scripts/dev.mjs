import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { join } from "node:path";

const isWindows = platform() === "win32";
const python = isWindows
  ? "apps/api/.venv/Scripts/python.exe"
  : "apps/api/.venv/bin/python";
const nextCli = join(process.cwd(), "apps", "web", "node_modules", "next", "dist", "bin", "next");
const apiOnly = process.argv.includes("--api-only");

if (!existsSync(python)) {
  console.error(
    "Traceback API virtual environment not found. Create it in apps/api/.venv before running the app.",
  );
  process.exit(1);
}

if (!apiOnly && !existsSync(nextCli)) {
  console.error("Web dependencies not found. Run corepack pnpm install before starting Traceback.");
  process.exit(1);
}

const commands = [
  ...(apiOnly
    ? []
    : [
        spawn(process.execPath, [nextCli, "dev"], { cwd: "apps/web", stdio: "inherit" }),
      ]),
  spawn(
    python,
    ["-m", "uvicorn", "app.main:app", "--app-dir", "apps/api", "--reload", "--port", "8000"],
    { stdio: "inherit" },
  ),
];

const stop = () => {
  for (const command of commands) {
    command.kill();
  }
};

process.once("SIGINT", stop);
process.once("SIGTERM", stop);

for (const command of commands) {
  command.once("exit", (code) => {
    if (code && code !== 0) {
      stop();
      process.exitCode = code;
    }
  });
}
