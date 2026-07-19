"use client"

import styled from "@emotion/styled"
import { colors, radii } from "@salimon/ui-tokens"
import { LogOut, MessageCircle, UserRound } from "lucide-react"
import { observer } from "mobx-react-lite"
import Image from "next/image"
import { useAppStore } from "../StoreProvider"

export const AuthControls = observer(function AuthControls() {
  const store = useAppStore()
  const isLoading = store.authState === "loading"

  if (store.authUser) {
    return (
      <AuthSection>
        <Account>
          <Avatar aria-hidden="true">
            {store.authUser.avatarUrl ? (
              <AvatarImage src={store.authUser.avatarUrl} width={30} height={30} unoptimized alt="" />
            ) : (
              <UserRound size={17} />
            )}
          </Avatar>
          <AccountCopy>
            <strong>{store.authUser.nickname}</strong>
            <span>카카오 로그인</span>
          </AccountCopy>
          <IconAction onClick={store.logout} title="로그아웃" aria-label="로그아웃">
            <LogOut size={16} />
          </IconAction>
        </Account>
        {store.authError ? <AuthError role="alert">{store.authError}</AuthError> : null}
      </AuthSection>
    )
  }

  return (
    <AuthSection>
      <KakaoButton onClick={store.loginWithKakao} disabled={isLoading}>
        <MessageCircle size={17} fill="currentColor" />
        {isLoading ? "세션 확인 중" : "카카오로 시작하기"}
      </KakaoButton>
      {store.authError ? <AuthError role="alert">{store.authError}</AuthError> : null}
    </AuthSection>
  )
})

const AuthSection = styled.div`
  display: grid;
  gap: 8px;
`

const KakaoButton = styled.button`
  min-height: 36px;
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-radius: ${radii.sm};
  background: #fee500;
  color: #191919;
  font-size: 13px;
  font-weight: 600;

  &:hover:not(:disabled) {
    background: #f4dc00;
  }

  &:disabled {
    cursor: wait;
    opacity: 0.66;
  }
`

const Account = styled.div`
  min-width: 0;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) 30px;
  align-items: center;
  gap: 9px;
  border: 1px solid ${colors.border};
  border-radius: ${radii.sm};
  background: ${colors.panel};
  padding: 7px;
`

const Avatar = styled.div`
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: ${colors.tealSoft};
  color: ${colors.teal};
`

const AvatarImage = styled(Image)`
  width: 100%;
  height: 100%;
  object-fit: cover;
`

const AccountCopy = styled.div`
  min-width: 0;
  display: grid;

  strong,
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    font-size: 13px;
  }

  span {
    color: ${colors.muted};
    font-size: 11px;
  }
`

const IconAction = styled.button`
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 1px solid transparent;
  border-radius: ${radii.sm};
  background: transparent;
  color: ${colors.muted};

  &:hover {
    border-color: ${colors.border};
    background: ${colors.panelSubtle};
    color: ${colors.ink};
  }
`

const AuthError = styled.p`
  margin: 0;
  color: ${colors.coral};
  font-size: 12px;
  line-height: 1.4;
`
