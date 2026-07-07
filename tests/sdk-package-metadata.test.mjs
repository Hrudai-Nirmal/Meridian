import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"

const repositoryUrl = "https://github.com/Hrudai-Nirmal/Meridian"

async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"))
}

test("JavaScript SDK package metadata is publish-ready", async () => {
  const packageJson = await readJsonFile("sdk/js/package.json")
  const readme = await readFile("sdk/js/README.md", "utf8")

  assert.equal(packageJson.name, "@meridian-workflows/sdk")
  assert.equal(packageJson.private, undefined)
  assert.equal(packageJson.license, "MIT")
  assert.equal(packageJson.repository.url, `git+${repositoryUrl}.git`)
  assert.equal(packageJson.homepage, `${repositoryUrl}#readme`)
  assert.deepEqual(packageJson.keywords.includes("meridian"), true)
  assert.deepEqual(packageJson.files.includes("dist"), true)
  assert.deepEqual(packageJson.files.includes("examples"), true)
  assert.equal(packageJson.exports["."].import, "./dist/index.js")
  assert.equal(packageJson.exports["."].types, "./dist/index.d.ts")
  assert.equal(packageJson.scripts.packcheck, "npm run build && npm test && npm pack --dry-run --json")
  assert.match(readme, /npm install @meridian-workflows\/sdk/)
  assert.match(readme, /MERIDIAN_INGESTION_TOKEN/)
})

test("Python SDK package metadata is publish-ready", async () => {
  const pyproject = await readFile("sdk/python/pyproject.toml", "utf8")
  const readme = await readFile("sdk/python/README.md", "utf8")

  assert.match(pyproject, /name = "meridian"/)
  assert.match(pyproject, /license = "MIT"/)
  assert.match(pyproject, /readme = "README.md"/)
  assert.match(pyproject, /"Programming Language :: Python :: 3"/)
  assert.match(pyproject, /Repository = "https:\/\/github.com\/Hrudai-Nirmal\/Meridian"/)
  assert.match(pyproject, /meridian = \["py.typed"\]/)
  assert.match(pyproject, /include = \["meridian", "argusgrid"\]/)
  assert.match(readme, /pip install meridian/)
  assert.match(readme, /MERIDIAN_INGESTION_TOKEN/)
})

test("root CI runs SDK package verification", async () => {
  const workflow = await readFile(".github/workflows/ci.yml", "utf8")
  const packageJson = await readJsonFile("package.json")

  assert.match(workflow, /Verify SDK packages/)
  assert.match(workflow, /npm run sdk:verify/)
  assert.equal(packageJson.scripts["sdk:verify"], "node scripts/verify-sdk-packages.mjs")
})
