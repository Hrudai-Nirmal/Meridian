/**
 * SDK package verification gate.
 *
 * The script validates package metadata, builds/tests both preview SDKs, runs a
 * JavaScript npm pack dry-run, and builds/inspects the Python wheel without
 * publishing anything.
 */
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawn } from "node:child_process"

const repositoryRoot = process.cwd()
const javascriptSdkDirectory = path.join(repositoryRoot, "sdk/js")
const pythonSdkDirectory = path.join(repositoryRoot, "sdk/python")

/**
 * Runs a command and rejects with a readable package-check error on failure.
 *
 * @param {string} commandName
 * @param {string[]} commandArgs
 * @param {{ cwd?: string }} options
 * @returns {Promise<void>}
 */
function runCommand(commandName, commandArgs, { cwd = repositoryRoot } = {}) {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(commandName, commandArgs, {
      cwd,
      env: process.env,
      stdio: "inherit",
    })

    childProcess.on("error", (error) => {
      reject(error)
    })
    childProcess.on("exit", (exitCode) => {
      if (exitCode === 0) {
        resolve()
        return
      }
      reject(new Error(`${commandName} ${commandArgs.join(" ")} exited with ${exitCode}.`))
    })
  })
}

/**
 * Runs a command and returns captured stdout.
 *
 * @param {string} commandName
 * @param {string[]} commandArgs
 * @param {{ cwd?: string }} options
 * @returns {Promise<string>}
 */
function readCommand(commandName, commandArgs, { cwd = repositoryRoot } = {}) {
  return new Promise((resolve, reject) => {
    let stdout = ""
    let stderr = ""
    const childProcess = spawn(commandName, commandArgs, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    })

    childProcess.stdout.on("data", (chunk) => {
      stdout += chunk
    })
    childProcess.stderr.on("data", (chunk) => {
      stderr += chunk
    })
    childProcess.on("error", (error) => {
      reject(error)
    })
    childProcess.on("exit", (exitCode) => {
      if (exitCode === 0) {
        resolve(stdout)
        return
      }
      reject(new Error(`${commandName} ${commandArgs.join(" ")} exited with ${exitCode}.\n${stderr}`))
    })
  })
}

/**
 * Verifies npm package dry-run contents include the publish-critical files.
 *
 * @returns {Promise<void>}
 */
async function verifyJavaScriptPackage() {
  await runCommand("npm", ["install", "--package-lock=false"], { cwd: javascriptSdkDirectory })
  await runCommand("npm", ["run", "build"], { cwd: javascriptSdkDirectory })
  await runCommand("npm", ["test"], { cwd: javascriptSdkDirectory })

  const packOutput = await readCommand("npm", ["pack", "--dry-run", "--json"], { cwd: javascriptSdkDirectory })
  const [packageSummary] = JSON.parse(packOutput)
  const packageFiles = new Set(packageSummary.files.map((packageFile) => packageFile.path))
  const requiredFiles = ["dist/index.js", "dist/index.d.ts", "examples/send-test-run.mjs", "README.md", "package.json"]

  for (const requiredFile of requiredFiles) {
    if (!packageFiles.has(requiredFile)) {
      throw new Error(`JavaScript SDK package is missing ${requiredFile}.`)
    }
  }
}

/**
 * Builds the Python wheel and verifies import/package marker files are present.
 *
 * @returns {Promise<void>}
 */
async function verifyPythonPackage() {
  await runCommand("python3", ["-m", "unittest", "discover", "-s", "tests"], { cwd: pythonSdkDirectory })

  const wheelDirectory = await mkdtemp(path.join(tmpdir(), "meridian-python-wheel-"))
  try {
    await runCommand("python3", ["-m", "pip", "wheel", ".", "--no-deps", "--wheel-dir", wheelDirectory], {
      cwd: pythonSdkDirectory,
    })
    const wheelInspectionCode = [
      "import pathlib",
      "import zipfile",
      `wheel_dir = pathlib.Path(${JSON.stringify(wheelDirectory)})`,
      "wheel = next(wheel_dir.glob('meridian-*.whl'))",
      "with zipfile.ZipFile(wheel) as archive:",
      "    print('\\n'.join(sorted(archive.namelist())))",
    ].join("\n")
    const wheelListing = await readCommand("python3", ["-c", wheelInspectionCode])

    for (const requiredFile of ["meridian/__init__.py", "meridian/py.typed"]) {
      if (!wheelListing.includes(requiredFile)) {
        throw new Error(`Python SDK wheel is missing ${requiredFile}.`)
      }
    }
  } finally {
    await rm(wheelDirectory, { recursive: true, force: true })
  }
}

try {
  await verifyJavaScriptPackage()
  await verifyPythonPackage()
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
