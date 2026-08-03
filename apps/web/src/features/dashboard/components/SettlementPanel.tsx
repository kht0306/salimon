"use client"

import styled from "@emotion/styled"
import { useState } from "react"
import { Panel } from "../styles"
import { SettlementOverview } from "./SettlementOverview"
import { SettlementReport } from "./SettlementReport"
import type { SettlementChart } from "./settlementPresentation"

export function SettlementPanel() {
  const [chart, setChart] = useState<SettlementChart>("bar")

  return (
    <PrintArea>
      <Panel>
        <SettlementOverview chart={chart} onChartChange={setChart} />
        <SettlementReport chart={chart} />
      </Panel>
    </PrintArea>
  )
}

const PrintArea = styled.div`
  @media print {
    .no-print {
      display: none;
    }
  }
`
