"use client"

import styled from "@emotion/styled"
import { spacing } from "@salimon/ui-tokens"
import { useState } from "react"
import { LedgerCreationSection } from "./LedgerCreationSection"
import { LedgerOverviewSection } from "./LedgerOverviewSection"
import { LedgerPaymentMethodsSection } from "./LedgerPaymentMethodsSection"
import { LedgerSharingSection } from "./LedgerSharingSection"

export function LedgerManagementPanel() {
  const [showJoinedSetup, setShowJoinedSetup] = useState(false)

  return (
    <PanelStack>
      <LedgerOverviewSection />
      <LedgerCreationSection onJoined={() => setShowJoinedSetup(true)} />
      <LedgerPaymentMethodsSection
        showJoinedSetup={showJoinedSetup}
        onSetupClose={() => setShowJoinedSetup(false)}
      />
      <LedgerSharingSection />
    </PanelStack>
  )
}

const PanelStack = styled.div`
  display: grid;
  gap: ${spacing[4]};
`
