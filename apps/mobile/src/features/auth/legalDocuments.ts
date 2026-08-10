import * as WebBrowser from "expo-web-browser"

export type LegalDocumentPath = "/privacy" | "/terms"

export async function openLegalDocument(
  path: LegalDocumentPath,
): Promise<void> {
  const webUrl = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, "")
  if (!webUrl) {
    throw new Error("모바일 웹 주소가 설정되지 않았습니다.")
  }

  await WebBrowser.openBrowserAsync(`${webUrl}${path}`)
}
