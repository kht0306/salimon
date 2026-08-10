import styled from "@emotion/native"
import { mobileTheme } from "../theme"

interface StatusRowProps {
  label: string
  detail: string
}

export function StatusRow({ label, detail }: StatusRowProps) {
  return (
    <Row accessible accessibilityLabel={`${label}, 준비됨, ${detail}`}>
      <StatusDot />
      <StatusCopy>
        <StatusLabel>{label}</StatusLabel>
        <StatusDetail>{detail}</StatusDetail>
      </StatusCopy>
      <ReadyLabel>준비됨</ReadyLabel>
    </Row>
  )
}

const Row = styled.View`
  min-height: 72px;
  flex-direction: row;
  align-items: center;
  gap: ${mobileTheme.spacing[3]}px;
  border-bottom-width: 1px;
  border-bottom-color: ${mobileTheme.colors.border};
  padding: ${mobileTheme.spacing[3]}px ${mobileTheme.spacing[4]}px;
`

const StatusDot = styled.View`
  width: 8px;
  height: 8px;
  border-radius: 4px;
  background-color: ${mobileTheme.colors.green};
`

const StatusCopy = styled.View`
  min-width: 0;
  flex: 1;
`

const StatusLabel = styled.Text`
  color: ${mobileTheme.colors.ink};
  font-size: 14px;
  font-weight: 600;
`

const StatusDetail = styled.Text`
  margin-top: 3px;
  color: ${mobileTheme.colors.muted};
  font-size: 12px;
  line-height: 17px;
`

const ReadyLabel = styled.Text`
  color: ${mobileTheme.colors.green};
  font-size: 11px;
  font-weight: 700;
`
