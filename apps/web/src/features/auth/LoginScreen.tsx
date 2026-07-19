"use client"

import styled from "@emotion/styled"
import { colors, radii, shadows, spacing } from "@salimon/ui-tokens"
import { MessageCircle, WalletCards } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useEffect } from "react"
import { StoreProvider, useAppStore } from "../dashboard/StoreProvider"

export function LoginScreen() {
  return (
    <StoreProvider>
      <LoginContent />
    </StoreProvider>
  )
}

const LoginContent = observer(function LoginContent() {
  const store = useAppStore()
  const router = useRouter()

  useEffect(() => {
    if (store.authUser) router.replace("/")
  }, [router, store.authUser])

  return (
    <LoginPage>
      <LoginCard>
        <Logo aria-hidden="true">
          <WalletCards size={25} />
        </Logo>
        <Header>
          <Eyebrow>Salimon · 살림온</Eyebrow>
          <h1>내 가계부를 시작하세요</h1>
          <p>
            카카오 계정으로 로그인하면 거래 내역이 안전하게 저장되고 여러
            기기에서 동기화됩니다.
          </p>
        </Header>
        <KakaoButton
          onClick={store.loginWithKakao}
          disabled={store.authState === "loading" || Boolean(store.authUser)}
        >
          <MessageCircle size={18} fill="currentColor" />
          {store.authState === "loading"
            ? "로그인 상태 확인 중"
            : "카카오로 로그인"}
        </KakaoButton>
        <LegalNotice>
          로그인 후 <Link href="/terms">이용약관</Link>과{" "}
          <Link href="/privacy">개인정보 처리방침</Link>을 확인하고 필수 동의
          절차를 진행합니다.
        </LegalNotice>
        {store.authError ? (
          <ErrorMessage role="alert">{store.authError}</ErrorMessage>
        ) : null}
      </LoginCard>
    </LoginPage>
  )
})

const LoginPage = styled.main`
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: ${spacing[5]};
  background: ${colors.canvas};
`

const LoginCard = styled.section`
  width: min(100%, 420px);
  display: grid;
  gap: ${spacing[6]};
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  background: ${colors.panel};
  box-shadow: ${shadows.floating};
  padding: ${spacing[8]};
`

const Logo = styled.div`
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: ${radii.md};
  background: ${colors.ink};
  color: ${colors.panel};
`

const Header = styled.header`
  display: grid;
  gap: ${spacing[2]};

  h1,
  p {
    margin: 0;
  }
  h1 {
    font-size: 25px;
    line-height: 1.25;
  }
  p {
    color: ${colors.muted};
    font-size: 14px;
  }
`

const Eyebrow = styled.span`
  color: ${colors.teal};
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`

const KakaoButton = styled.button`
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${spacing[2]};
  border: 0;
  border-radius: ${radii.sm};
  background: #fee500;
  color: #191919;
  font-weight: 700;

  &:hover:not(:disabled) {
    background: #f4dc00;
  }
  &:disabled {
    cursor: wait;
    opacity: 0.66;
  }
`

const ErrorMessage = styled.p`
  margin: 0;
  color: ${colors.coral};
  font-size: 13px;
`

const LegalNotice = styled.p`
  margin: -12px 0 0;
  color: ${colors.muted};
  font-size: 11px;
  text-align: center;

  a {
    color: ${colors.teal};
  }
`
