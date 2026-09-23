import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const repositoryRoot = resolve(mobileRoot, "../..")
const androidRoot = join(mobileRoot, "android")
const { expo } = JSON.parse(
  await readFile(join(mobileRoot, "app.json"), "utf8"),
)
const baseName = `salimon-${expo.version}-${expo.android.versionCode}`
const outputDirectory = join(
  repositoryRoot,
  "dist/mobile",
  `play-${expo.version}-${expo.android.versionCode}`,
)
const javaHome = process.env.JAVA_HOME
if (!javaHome)
  throw new Error("JAVA_HOME에 Android 빌드용 JDK 경로를 설정하세요.")

run(
  "pnpm",
  ["exec", "expo", "prebuild", "--platform", "android", "--no-install"],
  mobileRoot,
)
run(
  join(androidRoot, "gradlew"),
  [":app:bundleRelease", "--console=plain"],
  androidRoot,
)

const bundle = join(
  androidRoot,
  "app/build/outputs/bundle/release/app-release.aab",
)
const verification = run(
  join(javaHome, "bin/jarsigner"),
  ["-J-Duser.language=en", "-verify", "-verbose", "-certs", bundle],
  androidRoot,
  true,
)
if (
  !/jar verified\./i.test(verification) ||
  /jar is unsigned|unsigned entries|Android Debug/i.test(verification)
) {
  throw new Error("AAB 서명 검증에 실패했거나 디버그 인증서가 사용되었습니다.")
}
const certificate = run(
  join(javaHome, "bin/keytool"),
  ["-J-Duser.language=en", "-printcert", "-jarfile", bundle],
  androidRoot,
  true,
)
if (/Android Debug/i.test(certificate))
  throw new Error("Play 배포에는 릴리스 서명이 필요합니다.")
const certificateSha256 = certificate.match(/SHA256:\s*([A-F0-9:]+)/i)?.[1]
if (!certificateSha256)
  throw new Error("업로드 인증서 SHA-256을 확인할 수 없습니다.")

await mkdir(outputDirectory, { recursive: true })
const outputBundle = join(outputDirectory, `${baseName}.aab`)
await copyFile(bundle, outputBundle)
const hash = createHash("sha256")
for await (const chunk of createReadStream(outputBundle)) hash.update(chunk)
const sha256 = hash.digest("hex")
await writeFile(
  join(outputDirectory, `${baseName}.aab.sha256`),
  `${sha256}  ${baseName}.aab\n`,
)
await writeFile(
  join(outputDirectory, "release-notes-ko-KR.txt"),
  [
    "<ko-KR>",
    "국민카드 승인 문자와 우리카드 승인 알림톡을 결제 후보함에서 확인할 수 있습니다.",
    "설정에서 삼성 메시지, Google 메시지 또는 카카오톡을 선택해 주세요.",
    "국민·우리카드는 정상 승인만 지원합니다. 전체취소·부분취소는 아직 지원하지 않습니다.",
    "알림을 검토하고 수정한 뒤 거래로 등록할 수 있습니다.",
    "</ko-KR>",
    "",
  ].join("\n"),
)
await writeFile(
  join(outputDirectory, "release-manifest.json"),
  JSON.stringify(
    {
      packageName: expo.android.package,
      versionName: expo.version,
      versionCode: expo.android.versionCode,
      bundle: `${baseName}.aab`,
      sha256,
      uploadCertificateSha256: certificateSha256,
      generatedAt: new Date().toISOString(),
      track: "closed testing",
      deviceValidation:
        "실제 국민카드 문자·우리카드 알림톡 수신은 사용자 기기에서 확인 필요",
    },
    null,
    2,
  ) + "\n",
)
await copyFile(
  join(repositoryRoot, "docs/mobile-play-closed-testing.md"),
  join(outputDirectory, "UPLOAD-AND-TEST.md"),
)
console.log(`Play 비공개 테스트 파일: ${outputDirectory}`)
console.log(`업로드 AAB: ${outputBundle}`)

function run(command, args, cwd, capture = false) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} 실행에 실패했습니다.`)
  return `${result.stdout ?? ""}${result.stderr ?? ""}`
}
