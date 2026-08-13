const { withAppBuildGradle } = require("expo/config-plugins")

const signingMarker = "// Salimon family alpha release signing"

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== "groovy") {
      throw new Error("살림온 릴리스 서명 설정은 Groovy Gradle만 지원합니다.")
    }

    let contents = gradleConfig.modResults.contents
    if (contents.includes(signingMarker)) return gradleConfig

    const androidAnchor = "android {"
    const androidIndex = contents.indexOf(androidAnchor)
    if (androidIndex < 0) {
      throw new Error("Android Gradle 설정 블록을 찾지 못했습니다.")
    }

    const signingConfiguration = `${androidAnchor}
    ${signingMarker}
    def salimonReleaseStoreFile = findProperty("SALIMON_RELEASE_STORE_FILE") ?: System.getenv("SALIMON_RELEASE_STORE_FILE")
    def salimonReleaseStorePassword = findProperty("SALIMON_RELEASE_STORE_PASSWORD") ?: System.getenv("SALIMON_RELEASE_STORE_PASSWORD")
    def salimonReleaseKeyAlias = findProperty("SALIMON_RELEASE_KEY_ALIAS") ?: System.getenv("SALIMON_RELEASE_KEY_ALIAS")
    def salimonReleaseKeyPassword = findProperty("SALIMON_RELEASE_KEY_PASSWORD") ?: System.getenv("SALIMON_RELEASE_KEY_PASSWORD")
    def salimonReleaseSigningConfigured = [
        salimonReleaseStoreFile,
        salimonReleaseStorePassword,
        salimonReleaseKeyAlias,
        salimonReleaseKeyPassword,
    ].every { value -> value != null && !value.toString().trim().isEmpty() }

    if (salimonReleaseSigningConfigured) {
        signingConfigs {
            release {
                storeFile file(salimonReleaseStoreFile)
                storePassword salimonReleaseStorePassword
                keyAlias salimonReleaseKeyAlias
                keyPassword salimonReleaseKeyPassword
            }
        }
    }`

    contents =
      contents.slice(0, androidIndex) +
      signingConfiguration +
      contents.slice(androidIndex + androidAnchor.length)

    const buildTypesIndex = contents.indexOf("buildTypes {")
    const releaseAnchor = "release {"
    const releaseIndex = contents.indexOf(releaseAnchor, buildTypesIndex)
    const debugSigningLine = "signingConfig signingConfigs.debug"
    const debugSigningIndex = contents.indexOf(debugSigningLine, releaseIndex)
    if (buildTypesIndex < 0 || releaseIndex < 0 || debugSigningIndex < 0) {
      throw new Error("Android 릴리스 빌드 설정을 찾지 못했습니다.")
    }

    const releaseSigningConfiguration = `if (salimonReleaseSigningConfigured) {
                signingConfig signingConfigs.release
            } else if (gradle.startParameter.taskNames.any { taskName -> taskName.toLowerCase().contains("release") }) {
                throw new GradleException("가족 알파 릴리스 서명 설정이 없습니다. docs/mobile-private-distribution.md를 확인하세요.")
            }`

    contents =
      contents.slice(0, debugSigningIndex) +
      releaseSigningConfiguration +
      contents.slice(debugSigningIndex + debugSigningLine.length)

    gradleConfig.modResults.contents = contents
    return gradleConfig
  })
}
