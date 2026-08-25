const { spawn } = require("node:child_process");
const path = require("node:path");

const defaultRustBinaryPath = path.resolve(
  __dirname,
  "../../../audio-processor-rust/target/debug/audio-processor-rust",
);

function resolveRustBinaryPath() {
  return process.env.RUST_BINARY_PATH &&
    process.env.RUST_BINARY_PATH.trim().length > 0
    ? process.env.RUST_BINARY_PATH
    : defaultRustBinaryPath;
}

function runRustCommand(args) {
  return new Promise((resolve, reject) => {
    const rustBinaryPath = resolveRustBinaryPath();
    const timeoutMs = Number(process.env.RUST_PROCESS_TIMEOUT_MS || 120000);

    const child = spawn(rustBinaryPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let completed = false;

    const timer = setTimeout(() => {
      if (completed) {
        return;
      }
      child.kill("SIGKILL");
      reject(new Error(`Rust process timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      completed = true;
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      completed = true;

      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          `Rust process failed with code ${code}. stderr: ${stderr || "(empty)"}`,
        ),
      );
    });
  });
}

function runRustProcessor({ inputPath, outputPath }) {
  return runRustCommand([inputPath, outputPath]).then(({ stdout, stderr }) => ({
    stdout,
    stderr,
    outputPath,
  }));
}

function parseRustJsonOutput(stdout) {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      return JSON.parse(lines[i]);
    } catch (_error) {
      // Continue searching previous lines until a valid JSON object is found.
    }
  }

  throw new Error(
    `Rust transcription did not return valid JSON. stdout: ${stdout || "(empty)"}`,
  );
}

module.exports = {
  runRustProcessor,
};
