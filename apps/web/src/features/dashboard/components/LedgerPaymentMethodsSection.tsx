"use client"

import styled from "@emotion/styled"
import { colors, radii } from "@salimon/ui-tokens"
import { observer } from "mobx-react-lite"
import { useEffect, useState } from "react"
import { useAppStore } from "../StoreProvider"
import { Button, Panel, PanelHeader, PanelTitle, Select } from "../styles"
import { PaymentInstrumentSelector } from "./PaymentInstrumentSelector"

interface LedgerPaymentMethodsSectionProps {
  showJoinedSetup: boolean
  onSetupClose: () => void
}

export const LedgerPaymentMethodsSection = observer(
  function LedgerPaymentMethodsSection({
    showJoinedSetup,
    onSetupClose,
  }: LedgerPaymentMethodsSectionProps) {
    const store = useAppStore()
    const ledger = store.currentLedger
    const [connectedPaymentMethodIds, setConnectedPaymentMethodIds] = useState<
      string[]
    >([])
    const [visiblePaymentMethodIds, setVisiblePaymentMethodIds] = useState<
      string[]
    >([])
    const [primaryPaymentInstrumentId, setPrimaryPaymentInstrumentId] =
      useState("")
    const isArchived = Boolean(ledger?.archivedAt)
    const canLinkPaymentMethods = Boolean(
      ledger && !isArchived && ledger.role !== "viewer",
    )
    const isMutating = store.ledgerMutationState !== "idle"
    const activePaymentInstruments = store.myPaymentInstruments.filter(
      (method) => method.isActive,
    )
    const connectedCards = activePaymentInstruments.filter(
      (method) =>
        method.type === "card" && connectedPaymentMethodIds.includes(method.id),
    )

    useEffect(() => {
      const ownedLinks = store.data.paymentMethods.filter(
        (method) =>
          method.ledgerId === ledger?.id &&
          (method.type === "card" || method.type === "bank") &&
          !method.isDeleted &&
          method.ownerUserId === store.authUser?.id &&
          method.isActive,
      )
      setConnectedPaymentMethodIds(
        ownedLinks.map((method) => method.instrumentId),
      )
      setVisiblePaymentMethodIds(
        ownedLinks
          .filter((method) => method.visibility === "ledger")
          .map((method) => method.instrumentId),
      )
      setPrimaryPaymentInstrumentId(
        ownedLinks.find((method) => method.type === "card" && method.isPrimary)
          ?.instrumentId ?? "",
      )
    }, [
      ledger?.id,
      ledger?.name,
      store.authUser?.id,
      store.data.paymentMethods,
    ])

    return ledger && !isArchived ? (
      <Panel>
        <PanelHeader>
          <PanelTitle>
            {showJoinedSetup
              ? "참여 완료 · 내 카드·계좌 연결"
              : "이 가계부의 내 카드·계좌"}
          </PanelTitle>
        </PanelHeader>
        <PaymentSetupBody>
          <p>
            계정에 등록한 카드·계좌 중 이 가계부에서 사용할 항목을 선택하세요.
            연결을 해제해도 원본과 기존 거래는 삭제되지 않습니다.
          </p>
          {activePaymentInstruments.length > 0 ? (
            <PaymentInstrumentSelector
              instruments={activePaymentInstruments}
              selectedIds={connectedPaymentMethodIds}
              visibleIds={visiblePaymentMethodIds}
              allowVisibility={ledger.type === "shared"}
              disabled={isMutating || !canLinkPaymentMethods}
              onSelectedIdsChange={(ids) => {
                setConnectedPaymentMethodIds(ids)
                if (
                  primaryPaymentInstrumentId &&
                  !ids.includes(primaryPaymentInstrumentId)
                ) {
                  setPrimaryPaymentInstrumentId("")
                } else if (!primaryPaymentInstrumentId) {
                  const firstCard = activePaymentInstruments.find(
                    (method) =>
                      method.type === "card" && ids.includes(method.id),
                  )
                  setPrimaryPaymentInstrumentId(firstCard?.id ?? "")
                }
              }}
              onVisibleIdsChange={setVisiblePaymentMethodIds}
            />
          ) : (
            <EmptyPaymentMethods>
              먼저 카드 또는 계좌 메뉴에서 내 결제수단을 등록해 주세요.
            </EmptyPaymentMethods>
          )}
          {connectedCards.length > 0 ? (
            <PrimaryCardField>
              <span>이 가계부의 주 카드</span>
              <Select
                value={primaryPaymentInstrumentId}
                disabled={isMutating || !canLinkPaymentMethods}
                onChange={(event) =>
                  setPrimaryPaymentInstrumentId(event.target.value)
                }
              >
                <option value="">지정 안 함</option>
                {connectedCards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.issuer ? `${card.issuer} · ` : ""}
                    {card.name}
                  </option>
                ))}
              </Select>
              <small>주 카드는 가계부마다 다르게 지정할 수 있습니다.</small>
            </PrimaryCardField>
          ) : null}
          {!canLinkPaymentMethods ? (
            <LinkPermissionNotice>
              뷰어는 이 가계부에 카드·계좌를 연결할 수 없습니다.
            </LinkPermissionNotice>
          ) : null}
          <PaymentSetupActions>
            {showJoinedSetup ? (
              <Button type="button" onClick={onSetupClose}>
                나중에 하기
              </Button>
            ) : null}
            <Button
              type="button"
              $variant="primary"
              disabled={isMutating || !canLinkPaymentMethods}
              onClick={async () => {
                if (
                  await store.syncMyLedgerPaymentMethods(
                    connectedPaymentMethodIds,
                    visiblePaymentMethodIds,
                    primaryPaymentInstrumentId || undefined,
                  )
                ) {
                  onSetupClose()
                }
              }}
            >
              {store.ledgerMutationState === "syncing-payment-methods"
                ? "저장 중"
                : "연결 저장"}
            </Button>
          </PaymentSetupActions>
        </PaymentSetupBody>
      </Panel>
    ) : null
  },
)

const PaymentSetupBody = styled.div`
  display: grid;
  gap: 12px;
  padding: 16px 18px;

  > p {
    margin: 0;
    color: ${colors.muted};
    font-size: 12px;
  }
`

const PaymentSetupActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

const EmptyPaymentMethods = styled.div`
  padding: 12px;
  border: 1px dashed ${colors.border};
  border-radius: ${radii.md};
  color: ${colors.muted};
  font-size: 12px;
`

const PrimaryCardField = styled.label`
  display: grid;
  grid-template-columns: minmax(140px, 0.35fr) minmax(180px, 1fr);
  align-items: center;
  gap: 8px 12px;
  padding: 12px;
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  background: ${colors.panelSubtle};
  font-size: 12px;
  font-weight: 700;

  small {
    grid-column: 2;
    color: ${colors.muted};
    font-size: 10px;
    font-weight: 400;
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;

    small {
      grid-column: 1;
    }
  }
`

const LinkPermissionNotice = styled.p`
  margin: 0;
  color: ${colors.muted};
  font-size: 12px;
`
