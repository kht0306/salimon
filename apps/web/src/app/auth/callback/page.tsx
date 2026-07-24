"use client"

import {
  completeAuthCallback,
  ensureAuthenticatedProfile,
} from "@salimon/api-client"
import { colors, radii, shadows } from "@salimon/ui-tokens"
import styled from "@emotion/styled"
import { CheckCircle2, LoaderCircle, TriangleAlert } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function AuthCallbackPage() {
  const router = useRouter()
  const [state, setState] = useState<"loading" | "error">("loading")
  const [message, setMessage] = useState("카카오 로그인 결과를 확인하고 있습니다.")

  useEffect(() => {
    let active = true
    let redirectTimer: number | undefined

    async function finishLogin() {
      try {
        await completeAuthCallback()
        await ensureAuthenticatedProfile()
        if (!active) return

        setMessage("로그인이 완료되었습니다. 살림온으로 이동합니다.")
        redirectTimer = window.setTimeout(() => router.replace("/"), 350)
      } catch (error) {
        if (!active) return
        setState("error")
        setMessage(error instanceof Error ? error.message : "로그인 처리 중 오류가 발생했습니다.")
      }
    }

    void finishLogin()
    return () => {
      active = false
      if (redirectTimer) {
        window.clearTimeout(redirectTimer)
      }
    }
  }, [router])

  return (
    <CallbackMain>
      <StatusPanel role={state === "error" ? "alert" : "status"}>
        {state === "loading" ? <LoaderCircle className="spinner" size={28} /> : <TriangleAlert size={28} />}
        <div>
          <h1>{state === "loading" ? "로그인 연결 중" : "로그인을 완료하지 못했습니다"}</h1>
          <p>{message}</p>
        </div>
        {state === "error" ? (
          <HomeLink href="/">가계부로 돌아가기</HomeLink>
        ) : (
          <CheckCircle2 className="complete" size={18} />
        )}
      </StatusPanel>
    </CallbackMain>
  )
}

const CallbackMain = styled.main`
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: ${colors.canvas};
  padding: 24px;
`

const StatusPanel = styled.section`
  width: min(100%, 460px);
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  background: ${colors.panel};
  box-shadow: ${shadows.panel};
  padding: 24px;

  h1 {
    margin: 0;
    font-size: 16px;
    font-weight: 650;
    line-height: 1.3;
  }

  p {
    margin: 6px 0 0;
    color: ${colors.muted};
    font-size: 13px;
    line-height: 1.5;
  }

  .spinner {
    animation: spin 900ms linear infinite;
  }

  .complete {
    color: ${colors.green};
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`

const HomeLink = styled.a`
  grid-column: 2;
  width: fit-content;
  color: ${colors.green};
  font-weight: 750;
`
