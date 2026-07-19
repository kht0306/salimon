"use client"

import styled from "@emotion/styled"
import { getCurrentAccessToken } from "@salimon/api-client"
import type { ReceiptParseResult } from "@salimon/types"
import { colors, radii } from "@salimon/ui-tokens"
import { Camera, LoaderCircle } from "lucide-react"
import { useRef, useState } from "react"
import { Button } from "../styles"

interface ReceiptImporterProps {
  disabled?: boolean
  onApply: (result: ReceiptParseResult) => void
}

export function ReceiptImporter({ disabled, onApply }: ReceiptImporterProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [processing, setProcessing] = useState(false)
  const [consented, setConsented] = useState(false)
  const [error, setError] = useState("")

  async function parseReceipt(file: File) {
    setError("")
    if (!consented) {
      setError("AI 데이터 사용 안내를 확인해 주세요.")
      return
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("JPG, PNG, WEBP 영수증만 선택해 주세요.")
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("8MB 이하 JPG, PNG, WEBP 파일을 선택해 주세요.")
      return
    }

    setProcessing(true)
    try {
      const token = await getCurrentAccessToken()
      if (!token) throw new Error("로그인이 필요합니다.")
      const preparedImage = await prepareReceiptImage(file)
      const response = await fetch("/api/receipts/parse", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": preparedImage.type,
          "x-receipt-free-tier-consent": String(consented),
        },
        body: preparedImage,
      })
      const payload = (await response.json()) as ReceiptParseResult & {
        error?: string
      }
      if (!response.ok) throw new Error(payload.error || "영수증을 인식하지 못했습니다.")
      onApply(payload)
    } catch (parseError) {
      setError(
        parseError instanceof Error
          ? parseError.message
          : "영수증을 인식하지 못했습니다.",
      )
    } finally {
      setProcessing(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <ReceiptControl>
      <Button
        type="button"
        $variant="soft"
        disabled={disabled || processing || !consented}
        onClick={() => inputRef.current?.click()}
      >
        {processing ? (
          <LoaderCircle size={16} className="spin" />
        ) : (
          <Camera size={16} />
        )}
        {processing ? "인식 중" : "영수증 인식"}
      </Button>
      <input
        ref={inputRef}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void parseReceipt(file)
        }}
      />
      <Consent>
        <input
          type="checkbox"
          checked={consented}
          onChange={(event) => setConsented(event.target.checked)}
        />
        <span>
          이미지는 저장하지 않고 분석 후 폐기합니다. 무료 Gemini 키는 Google의
          제품 개선·사람 검토에 사용될 수 있습니다. 개인정보가 있는 영수증은
          첨부하지 않으며, 사진 메타데이터 제거 후 전송하는 데 동의합니다.
        </span>
      </Consent>
      {error ? <ErrorText role="alert">{error}</ErrorText> : null}
    </ReceiptControl>
  )
}

async function prepareReceiptImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  try {
    const maxSide = 2048
    const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * ratio))
    const height = Math.max(1, Math.round(bitmap.height * ratio))
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    if (!context) throw new Error("영수증 이미지를 처리하지 못했습니다.")
    context.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    )
    if (!blob) throw new Error("영수증 이미지를 처리하지 못했습니다.")
    return blob
  } finally {
    bitmap.close()
  }
}

const ReceiptControl = styled.div`
  display: grid;
  justify-items: end;
  gap: 5px;
  max-width: 280px;

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`
const Consent = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 6px;
  border-radius: ${radii.xs};
  color: ${colors.muted};
  font-size: 10px;
  line-height: 1.35;
  cursor: pointer;

  input { margin-top: 2px; }
`
const ErrorText = styled.span`
  color: ${colors.coral};
  font-size: 11px;
`
