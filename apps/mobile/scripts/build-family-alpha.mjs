import { createHash } from "node:crypto"
import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises"
import { createReadStream } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const repositoryRoot = resolve(mobileRoot, "../..")
const androidRoot = join(mobileRoot, "android")
const appConfig = JSON.parse(
  await readFile(join(mobileRoot, "app.json"), "utf8"),
)
const versionName = appConfig.expo.version
const versionCode = appConfig.expo.android.versionCode
const outputDirectory = join(repositoryRoot, "dist/mobile")
const outputBaseName = `salimon-${versionName}-${versionCode}`
const sourceApk = join(
  androidRoot,
  "app/build/outputs/apk/release/app-release.apk",
)
const outputApk = join(outputDirectory, `${outputBaseName}.apk`)

run(
  "pnpm",
  ["exec", "expo", "prebuild", "--platform", "android", "--no-install"],
  {
    cwd: mobileRoot,
  },
)
run(join(androidRoot, "gradlew"), [":app:assembleRelease", "--console=plain"], {
  cwd: androidRoot,
})

const apksigner = await findLatestBuildTool("apksigner")
const verification = run(
  apksigner,
  ["verify", "--verbose", "--print-certs", sourceApk],
  {
    capture: true,
  },
)
if (/Android Debug/i.test(verification)) {
  throw new Error("가족 알파 APK가 Android 디버그 인증서로 서명되었습니다.")
}

await mkdir(outputDirectory, { recursive: true })
await copyFile(sourceApk, outputApk)
const sha256 = await fileSha256(outputApk)
await writeFile(
  join(outputDirectory, `${outputBaseName}.sha256`),
  `${sha256}  ${outputBaseName}.apk\n`,
  "utf8",
)

console.log(`가족 알파 APK: ${outputApk}`)
console.log(
  `SHA-256 파일: ${join(outputDirectory, `${outputBaseName}.sha256`)}`,
)

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: process.env,
    stdio: options.capture ? "pipe" : "inherit",
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    if (options.capture) {
      process.stderr.write(result.stdout ?? "")
      process.stderr.write(result.stderr ?? "")
    }
    throw new Error(`${command} 실행에 실패했습니다.`)
  }
  if (options.capture) {
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
    process.stdout.write(output)
    return output
  }
  return ""
}

async function findLatestBuildTool(toolName) {
  const androidSdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT
  if (!androidSdk)
    throw new Error("ANDROID_HOME 또는 ANDROID_SDK_ROOT가 필요합니다.")

  const buildToolsRoot = join(androidSdk, "build-tools")
  const versions = (await readdir(buildToolsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) =>
      right.localeCompare(left, undefined, { numeric: true }),
    )

  for (const version of versions) {
    const candidate = join(buildToolsRoot, version, toolName)
    try {
      await access(candidate)
      return candidate
    } catch {
      // 다음 Android Build Tools 버전을 확인한다.
    }
  }
  throw new Error(`${toolName}을 Android Build Tools에서 찾지 못했습니다.`)
}

async function fileSha256(filePath) {
  const hash = createHash("sha256")
  for await (const chunk of createReadStream(filePath)) hash.update(chunk)
  return hash.digest("hex")
}
