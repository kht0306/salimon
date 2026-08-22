import { getCurrentAccessToken } from "@salimon/api-client"
import type { ReceiptParseResult } from "@salimon/types"
import { ImageManipulator, SaveFormat } from "expo-image-manipulator"
import * as ImagePicker from "expo-image-picker"
import { requireSupabaseMobileClient } from "../../infrastructure/supabase"
import { parseReceiptResult, receiptErrorMessage } from "./receiptResponse"

export type ReceiptImageSource = "camera" | "library"

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_IMAGE_SIDE = 2_048

export async function selectAndParseReceipt(
  source: ReceiptImageSource,
): Promise<ReceiptParseResult | undefined> {
  const permitted = await requestImagePermission(source)
  if (!permitted) {
    throw new Error(
      source === "camera"
        ? "카메라 권한을 허용해 주세요."
        : "사진 접근 권한을 허용해 주세요.",
    )
  }

  const selection =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(imagePickerOptions)
      : await ImagePicker.launchImageLibraryAsync(imagePickerOptions)
  if (selection.canceled) return undefined

  const asset = selection.assets[0]
  if (!asset || asset.type === "video" || asset.type === "livePhoto") {
    throw new Error("JPG, PNG, WEBP 영수증 이미지를 선택해 주세요.")
  }

  const prepared = await prepareReceiptImage(
    asset.uri,
    asset.width,
    asset.height,
  )
  const response = await fetch(prepared.uri)
  const image = await response.blob()
  if (image.size === 0 || image.size > MAX_IMAGE_BYTES) {
    throw new Error("처리된 영수증 이미지가 8MB를 넘습니다.")
  }

  const webUrl = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, "")
  if (!webUrl) {
    throw new Error("모바일 웹 주소가 설정되지 않았습니다.")
  }
  const token = await getCurrentAccessToken(requireSupabaseMobileClient())
  if (!token) throw new Error("로그인이 필요합니다.")

  const parseResponse = await fetch(webUrl + "/api/receipts/parse", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "image/jpeg",
      "x-receipt-free-tier-consent": "true",
    },
    body: image,
  })
  const payload: unknown = await parseResponse.json()
  if (!parseResponse.ok) {
    throw new Error(receiptErrorMessage(payload))
  }
  return parseReceiptResult(payload)
}

const imagePickerOptions: ImagePicker.ImagePickerOptions = {
  allowsEditing: false,
  allowsMultipleSelection: false,
  base64: false,
  exif: false,
  mediaTypes: ["images"],
  quality: 1,
}

async function requestImagePermission(
  source: ReceiptImageSource,
): Promise<boolean> {
  const permission =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
  return permission.granted
}

async function prepareReceiptImage(
  uri: string,
  width: number,
  height: number,
): Promise<{ uri: string }> {
  const context = ImageManipulator.manipulate(uri)
  const longestSide = Math.max(width, height)
  if (longestSide > MAX_IMAGE_SIDE) {
    if (width >= height) context.resize({ width: MAX_IMAGE_SIDE })
    else context.resize({ height: MAX_IMAGE_SIDE })
  }
  const image = await context.renderAsync()
  return image.saveAsync({
    compress: 0.9,
    format: SaveFormat.JPEG,
  })
}
