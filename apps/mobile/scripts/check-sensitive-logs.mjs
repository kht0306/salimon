import { readdir, readFile } from "node:fs/promises"
import { extname, join, relative } from "node:path"

const sourceRoots = [
  "src",
  "modules/salimon-notification-listener/android/src/main",
]
const sourceExtensions = new Set([".kt", ".ts", ".tsx"])
const forbiddenLogPatterns = [
  /\bconsole\.(?:debug|error|info|log|trace|warn)\s*\(/,
  /\b(?:android\.util\.)?Log\.(?:d|e|i|v|w|wtf)\s*\(/,
]

const violations = []

for (const sourceRoot of sourceRoots) {
  await scanDirectory(sourceRoot)
}

if (violations.length > 0) {
  console.error("민감정보가 로그로 유출될 수 있는 호출을 발견했습니다.")
  for (const violation of violations) console.error(`- ${violation}`)
  process.exitCode = 1
} else {
  console.log("모바일 런타임 소스에 직접 로그 출력 호출이 없습니다.")
}

async function scanDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      await scanDirectory(entryPath)
      continue
    }
    if (!sourceExtensions.has(extname(entry.name))) continue

    const contents = await readFile(entryPath, "utf8")
    const lines = contents.split("\n")
    lines.forEach((line, index) => {
      if (forbiddenLogPatterns.some((pattern) => pattern.test(line))) {
        violations.push(`${relative(".", entryPath)}:${index + 1}`)
      }
    })
  }
}
