import { isValidElement, type ReactNode } from "react"

interface TestElementProps {
  children?: ReactNode
  [key: string]: unknown
}

export function renderTestElement(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(renderTestElement).join("")
  if (isValidElement<TestElementProps>(node)) {
    if (typeof node.type === "function") {
      const component = node.type as (props: TestElementProps) => ReactNode
      return renderTestElement(component(node.props))
    }
    return renderTestElement(node.props.children)
  }
  return typeof node === "string" || typeof node === "number"
    ? String(node)
    : ""
}
