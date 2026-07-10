import styled from "@emotion/styled"
import { colors, controls, radii, shadows, spacing } from "@salimon/ui-tokens"

export const Shell = styled.main`
  min-height: 100dvh;
  display: grid;
  grid-template-columns: 224px minmax(520px, 1fr) 328px;
  background: ${colors.panel};

  @media (max-width: 1160px) {
    grid-template-columns: 210px minmax(0, 1fr);
  }

  @media (max-width: 820px) {
    display: block;
  }
`

export const Sidebar = styled.aside`
  position: sticky;
  top: 0;
  height: 100dvh;
  overflow-y: auto;
  background: ${colors.sidebar};
  border-right: 1px solid ${colors.border};
  padding: ${spacing[4]} ${spacing[3]};
  display: flex;
  flex-direction: column;
  gap: ${spacing[4]};

  @media (max-width: 820px) {
    position: relative;
    height: auto;
    overflow: visible;
    border-bottom: 1px solid ${colors.border};
    border-right: 0;
  }
`

export const Workspace = styled.section`
  min-width: 0;
  background: ${colors.canvas};
  padding: ${spacing[6]} ${spacing[7]};

  @media (max-width: 820px) {
    padding: ${spacing[4]} ${spacing[3]};
  }
`

export const SidePanel = styled.aside`
  position: sticky;
  top: 0;
  height: 100dvh;
  overflow-y: auto;
  background: ${colors.panel};
  border-left: 1px solid ${colors.border};
  padding: ${spacing[5]} ${spacing[4]};

  @media (max-width: 1160px) {
    position: relative;
    height: auto;
    grid-column: 1 / -1;
    border-top: 1px solid ${colors.border};
    border-left: 0;
  }
`

export const Panel = styled.section`
  background: ${colors.panel};
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  box-shadow: ${shadows.panel};
  overflow: hidden;
`

export const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 52px;
  padding: 10px ${spacing[4]};
  border-bottom: 1px solid ${colors.border};
`

export const PanelTitle = styled.h2`
  margin: 0;
  color: ${colors.ink};
  font-size: 14px;
  font-weight: 650;
  line-height: 1.3;
`

export const Button = styled.button<{ $variant?: "primary" | "ghost" | "danger" | "soft" }>`
  min-height: ${controls.default};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: ${radii.sm};
  border: 1px solid ${({ $variant }) => ($variant === "danger" ? "#fecaca" : colors.borderStrong)};
  background: ${({ $variant }) => {
    if ($variant === "primary") return colors.ink
    if ($variant === "danger") return colors.coralSoft
    if ($variant === "soft") return colors.tealSoft
    return "#ffffff"
  }};
  color: ${({ $variant }) => {
    if ($variant === "primary") return "#ffffff"
    if ($variant === "danger") return colors.coral
    if ($variant === "soft") return colors.teal
    return colors.ink
  }};
  padding: 0 ${spacing[3]};
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  transition:
    border-color 150ms ease,
    background-color 150ms ease,
    color 150ms ease;

  &:hover {
    border-color: ${colors.borderStrong};
    background: ${({ $variant }) => ($variant === "primary" ? "#27272a" : colors.panelSubtle)};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`

export const IconButton = styled(Button)`
  width: ${controls.default};
  padding: 0;
`

export const Field = styled.label`
  display: grid;
  gap: ${spacing[2]};
  color: ${colors.muted};
  font-size: 12px;
  font-weight: 600;
`

export const Input = styled.input`
  min-width: 0;
  width: 100%;
  min-height: ${controls.default};
  border-radius: ${radii.sm};
  border: 1px solid ${colors.border};
  background: #fff;
  color: ${colors.ink};
  padding: 7px 10px;
  transition: border-color 150ms ease, box-shadow 150ms ease;

  &:focus {
    border-color: ${colors.focus};
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    outline: 0;
  }
`

export const Select = styled.select`
  min-width: 0;
  width: 100%;
  min-height: ${controls.default};
  border-radius: ${radii.sm};
  border: 1px solid ${colors.border};
  background: #fff;
  color: ${colors.ink};
  padding: 8px 10px;

  &:focus {
    border-color: ${colors.focus};
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    outline: 0;
  }
`

export const Textarea = styled.textarea`
  min-width: 0;
  width: 100%;
  min-height: 86px;
  resize: vertical;
  border-radius: ${radii.sm};
  border: 1px solid ${colors.border};
  background: #fff;
  color: ${colors.ink};
  padding: 8px 10px;

  &:focus {
    border-color: ${colors.focus};
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    outline: 0;
  }
`

export const MetricRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-top: 1px solid ${colors.border};
  border-bottom: 1px solid ${colors.border};
`

export const Metric = styled.div`
  min-width: 0;
  padding: ${spacing[3]} ${spacing[2]};

  & + & {
    border-left: 1px solid ${colors.border};
  }
`

export const MetricLabel = styled.div`
  color: ${colors.muted};
  font-size: 11px;
`

export const MetricValue = styled.div<{ $tone?: "expense" | "income" }>`
  margin-top: 3px;
  color: ${({ $tone }) => ($tone === "income" ? colors.green : $tone === "expense" ? colors.coral : colors.ink)};
  font-family: var(--font-geist-mono);
  font-size: 14px;
  font-weight: 650;
  line-height: 1.12;
  overflow-wrap: anywhere;
`
