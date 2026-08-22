import * as DocumentPicker from "expo-document-picker"
import { File, Paths } from "expo-file-system"
import * as Sharing from "expo-sharing"

const MAX_BACKUP_BYTES = 20 * 1024 * 1024

export async function shareDataFile(input: {
  content: string
  dialogTitle: string
  filename: string
  mimeType: string
}): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("이 기기에서는 파일 공유 기능을 사용할 수 없습니다.")
  }
  const file = new File(Paths.cache, input.filename)
  file.create({ overwrite: true })
  file.write(input.content)
  try {
    await Sharing.shareAsync(file.uri, {
      dialogTitle: input.dialogTitle,
      mimeType: input.mimeType,
    })
  } finally {
    if (file.exists) file.delete()
  }
}

export async function pickBackupJson(): Promise<string | undefined> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: ["application/json", "text/json"],
  })
  if (result.canceled) return undefined
  const asset = result.assets[0]
  if (!asset) return undefined
  if (asset.size !== undefined && asset.size > MAX_BACKUP_BYTES) {
    throw new Error("백업 파일은 20MB 이하만 복원할 수 있습니다.")
  }
  const file = new File(asset.uri)
  if (file.size > MAX_BACKUP_BYTES) {
    throw new Error("백업 파일은 20MB 이하만 복원할 수 있습니다.")
  }
  return file.text()
}
