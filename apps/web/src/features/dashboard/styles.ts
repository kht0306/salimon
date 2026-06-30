import styled from "@emotion/styled"
import { colors, radii, shadows } from "@salimon/ui-tokens"

export const Shell = styled.main`
  min-height: 100vh;
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr) 360px;
  gap: 1px;
  background: ${colors.border};

  @media (max-width: 1180px) {
    grid-template-columns: 220px minmax(0, 1fr);
  }

  @media (max-width: 820px) {
    display: block;
  }
`

export const Sidebar = styled.aside`
  background: #fbfcf8;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 18px;

  @media (max-width: 820px) {
    position: sticky;
    top: 0;
    z-index: 10;
    border-bottom: 1px solid ${colors.border};
  }
`

export const Workspace = styled.section`
  min-width: 0;
  background: ${colors.canvas};
  padding: 22px;

  @media (max-width: 820px) {
    padding: 14px;
  }
`

export const SidePanel = styled.aside`
  background: #fbfcf8;
  padding: 22px 18px;
  overflow: auto;

  @media (max-width: 1180px) {
    grid-column: 1 / -1;
  }
`

export const Panel = styled.section`
  background: ${colors.panel};
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  box-shadow: ${shadows.panel};
`

export const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid ${colors.border};
`

export const PanelTitle = styled.h2`
  margin: 0;
  font-size: 16px;
  line-height: 1.25;
`

export const Button = styled.button<{ $variant?: "primary" | "ghost" | "danger" | "soft" }>`
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: ${radii.sm};
  border: 1px solid
    ${({ $variant }) => ($variant === "danger" ? "rgba(228, 87, 46, 0.35)" : "rgba(23, 32, 26, 0.16)")};
  background: ${({ $variant }) => {
    if ($variant === "primary") return colors.ink
    if ($variant === "danger") return "#fff5f0"
    if ($variant === "soft") return "#eef7f4"
    return "#ffffff"
  }};
  color: ${({ $variant }) => {
    if ($variant === "primary") return "#ffffff"
    if ($variant === "danger") return colors.coral
    if ($variant === "soft") return colors.green
    return colors.ink
  }};
  padding: 0 12px;
  white-space: nowrap;
  transition:
    transform 150ms ease,
    border-color 150ms ease,
    background 150ms ease;

  &:hover {
    transform: translateY(-1px);
    border-color: rgba(23, 32, 26, 0.32);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
    transform: none;
  }
`

export const IconButton = styled(Button)`
  width: 38px;
  padding: 0;
`

export const Field = styled.label`
  display: grid;
  gap: 6px;
  color: ${colors.muted};
  font-size: 12px;
  font-weight: 650;
`

export const Input = styled.input`
  min-width: 0;
  width: 100%;
  min-height: 38px;
  border-radius: ${radii.sm};
  border: 1px solid ${colors.border};
  background: #fff;
  color: ${colors.ink};
  padding: 8px 10px;
`

export const Select = styled.select`
  min-width: 0;
  width: 100%;
  min-height: 38px;
  border-radius: ${radii.sm};
  border: 1px solid ${colors.border};
  background: #fff;
  color: ${colors.ink};
  padding: 8px 10px;
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
`

export const MetricRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
`

export const Metric = styled.div`
  min-width: 0;
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  background: #fff;
  padding: 12px;
`

export const MetricLabel = styled.div`
  color: ${colors.muted};
  font-size: 12px;
`

export const MetricValue = styled.div<{ $tone?: "expense" | "income" }>`
  margin-top: 4px;
  color: ${({ $tone }) => ($tone === "income" ? colors.green : $tone === "expense" ? colors.coral : colors.ink)};
  font-size: clamp(15px, 1.35vw, 20px);
  font-weight: 800;
  line-height: 1.12;
  overflow-wrap: anywhere;
`
