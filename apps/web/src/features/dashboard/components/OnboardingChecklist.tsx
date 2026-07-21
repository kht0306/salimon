"use client"

import styled from "@emotion/styled"
import { colors, radii } from "@salimon/ui-tokens"
import { Check, Circle, X } from "lucide-react"
import { useEffect, useState } from "react"
import { observer } from "mobx-react-lite"
import { useAppStore } from "../StoreProvider"

interface PersistentDismissalState {
  key: string
  dismissed: boolean
}

export const OnboardingChecklist = observer(function OnboardingChecklist() {
  const store = useAppStore()
  const [temporarilyDismissedLedgerId, setTemporarilyDismissedLedgerId] =
    useState<string | null>(null)
  const [persistentDismissal, setPersistentDismissal] =
    useState<PersistentDismissalState | null>(null)
  const dismissalKey =
    store.authUser && store.selectedLedgerId
      ? `salimon:onboarding-checklist-dismissed:${store.authUser.id}:${store.selectedLedgerId}`
      : null

  useEffect(() => {
    if (!dismissalKey) {
      setPersistentDismissal(null)
      return
    }

    setPersistentDismissal({
      key: dismissalKey,
      dismissed: window.localStorage.getItem(dismissalKey) === "true",
    })
  }, [dismissalKey])

  if (
    store.dataState !== "ready" ||
    !store.currentLedger ||
    temporarilyDismissedLedgerId === store.selectedLedgerId ||
    (dismissalKey && persistentDismissal?.key !== dismissalKey) ||
    persistentDismissal?.dismissed
  ) {
    return null
  }

  const steps = [
    {
      label:
        store.currentLedger.type === "personal"
          ? "공동 가계부로 전환"
          : "공동 가계부 준비",
      done: store.currentLedger.type === "shared",
      view: "ledger" as const,
    },
    {
      label: "생활 멤버 초대",
      done:
        store.currentLedger.type === "shared" &&
        store.currentMembers.length > 1,
      view: "ledger" as const,
    },
    {
      label: "내 카드·계좌 연결",
      done: store.currentPaymentMethods.some(
        (method) => method.ownerUserId === store.authUser?.id,
      ),
      view: "cards" as const,
    },
    {
      label: "첫 생활비 기록",
      done: store.data.transactions.some(
        (item) => item.ledgerId === store.selectedLedgerId && !item.deletedAt,
      ),
      view: "calendar" as const,
    },
    {
      label: "월 예산 또는 정산 확인",
      done:
        store.selectedMonthBudgets.length > 0 ||
        store.data.transactions.some(
          (item) => item.ledgerId === store.selectedLedgerId && !item.deletedAt,
        ),
      view: "settlement" as const,
    },
  ]
  const completed = steps.filter((step) => step.done).length
  if (completed === steps.length) return null

  return (
    <Checklist aria-label="공동생활비 시작 체크리스트">
      <ChecklistHeader>
        <div>
          <strong>공동생활비 시작하기</strong>
          <span>{completed}/{steps.length} 완료</span>
        </div>
        <HeaderActions>
          <KeepClosedButton
            type="button"
            onClick={() => {
              if (!dismissalKey) return
              window.localStorage.setItem(dismissalKey, "true")
              setPersistentDismissal({ key: dismissalKey, dismissed: true })
            }}
          >
            계속 닫기
          </KeepClosedButton>
          <CloseButton
            type="button"
            onClick={() =>
              setTemporarilyDismissedLedgerId(store.selectedLedgerId)
            }
            aria-label="체크리스트 닫기"
          >
            <X size={15} />
          </CloseButton>
        </HeaderActions>
      </ChecklistHeader>
      <Progress><i style={{ width: `${(completed / steps.length) * 100}%` }} /></Progress>
      <StepList>
        {steps.map((step) => (
          <button
            type="button"
            key={step.label}
            data-done={step.done}
            onClick={() => store.setView(step.view)}
          >
            {step.done ? <Check size={14} /> : <Circle size={14} />}
            {step.label}
          </button>
        ))}
      </StepList>
    </Checklist>
  )
})

const Checklist = styled.section`
  display: grid;
  gap: 10px;
  margin-bottom: 16px;
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  background: ${colors.panel};
  padding: 13px;
`
const ChecklistHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  > div { display: flex; align-items: baseline; gap: 8px; }
  span { color: ${colors.muted}; font-size: 11px; }
`
const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`
const KeepClosedButton = styled.button`
  min-height: 28px;
  border: 0;
  background: transparent;
  color: ${colors.muted};
  padding: 0 6px;
  font-size: 11px;
`
const CloseButton = styled.button`
  width: 28px;
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: ${colors.muted};
  padding: 0;
`
const Progress = styled.div`
  height: 4px;
  overflow: hidden;
  border-radius: ${radii.round};
  background: ${colors.panelSubtle};
  i { display: block; height: 100%; background: ${colors.teal}; }
`
const StepList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  button {
    min-height: 30px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: 1px solid ${colors.border};
    border-radius: ${radii.round};
    background: ${colors.panel};
    color: ${colors.ink};
    padding: 0 10px;
    font-size: 11px;
  }
  button[data-done="true"] { color: ${colors.teal}; text-decoration: line-through; }
`
