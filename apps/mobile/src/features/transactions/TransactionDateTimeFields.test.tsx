import type { ReactNode } from "react"
import { renderTestElement } from "../../test/renderTestElement"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { mobileTheme } from "../../theme"
import { TransactionDateTimeFields } from "./TransactionDateTimeFields"

interface TestButton {
  accessibilityLabel: string
  disabled: boolean
  onPress: () => void
}

interface StyledProps {
  accessibilityLabel?: string
  accessibilityRole?: string
  children?: ReactNode
  disabled?: boolean
  onPress?: () => void
}

const native = vi.hoisted(() => ({ pickDate: vi.fn(), pickTime: vi.fn() }))
const buttons = vi.hoisted(() => [] as TestButton[])
const themeState = vi.hoisted(() => ({ dark: false }))
const nativeUi = vi.hoisted(() => ({
  alert: vi.fn(),
  dismissKeyboard: vi.fn(),
}))

vi.mock("../../../modules/salimon-date-time-picker/src", () => ({
  default: native,
}))
vi.mock("@emotion/react", () => ({
  useTheme: () => ({ ...mobileTheme, isDark: themeState.dark }),
}))
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: (initial: unknown) => [initial, () => undefined],
  useRef: (initial: unknown) => ({ current: initial }),
}))
vi.mock("@emotion/native", async () => {
  const { createElement } = await import("react")
  const styled = () => (props: StyledProps) => {
    if (props.accessibilityRole === "button" && props.onPress) {
      buttons.push({
        accessibilityLabel: props.accessibilityLabel ?? "",
        disabled: props.disabled ?? false,
        onPress: props.onPress,
      })
    }
    return createElement("div", null, props.children)
  }
  return { default: new Proxy(styled, { get: () => styled }) }
})
vi.mock("../../components/AppText", () => ({ AppText: "span" }))
vi.mock("lucide-react-native", () => ({
  CalendarDays: () => null,
  Clock3: () => null,
}))
vi.mock("react-native", () => ({
  Alert: { alert: nativeUi.alert },
  Keyboard: { dismiss: nativeUi.dismissKeyboard },
}))

function renderFields(disabled = false) {
  const onDateChange = vi.fn()
  const onTimeChange = vi.fn()
  renderTestElement(
    <TransactionDateTimeFields
      accessibilityPrefix="거래"
      date="2028-02-28"
      time="12:30"
      disabled={disabled}
      onDateChange={onDateChange}
      onTimeChange={onTimeChange}
    />,
  )
  return { onDateChange, onTimeChange }
}

beforeEach(() => {
  vi.clearAllMocks()
  buttons.length = 0
  themeState.dark = false
  native.pickDate.mockResolvedValue(null)
  native.pickTime.mockResolvedValue(null)
})

describe("transaction date and time selection", () => {
  it("applies a leap-day selection without changing the time", async () => {
    native.pickDate.mockResolvedValue("2028-02-29")
    const { onDateChange, onTimeChange } = renderFields()
    buttons[0]!.onPress()
    await vi.waitFor(() =>
      expect(onDateChange).toHaveBeenCalledWith("2028-02-29"),
    )
    expect(native.pickDate).toHaveBeenCalledWith("2028-02-28", false)
    expect(onTimeChange).not.toHaveBeenCalled()
    expect(nativeUi.dismissKeyboard).toHaveBeenCalledOnce()
  })

  it("applies a selected time using the active dark theme", async () => {
    themeState.dark = true
    native.pickTime.mockResolvedValue("23:05")
    const { onDateChange, onTimeChange } = renderFields()
    buttons[1]!.onPress()
    await vi.waitFor(() => expect(onTimeChange).toHaveBeenCalledWith("23:05"))
    expect(native.pickTime).toHaveBeenCalledWith("12:30", true)
    expect(onDateChange).not.toHaveBeenCalled()
  })

  it("keeps the original values on cancellation and prevents repeated opens", async () => {
    const { onDateChange, onTimeChange } = renderFields()
    buttons[0]!.onPress()
    buttons[0]!.onPress()
    await vi.waitFor(() => expect(native.pickDate).toHaveBeenCalledOnce())
    expect(onDateChange).not.toHaveBeenCalled()
    expect(onTimeChange).not.toHaveBeenCalled()
  })

  it("does not open locked recurring or pending fields", () => {
    renderFields(true)
    for (const button of buttons) {
      expect(button.disabled).toBe(true)
      button.onPress()
    }
    expect(native.pickDate).not.toHaveBeenCalled()
    expect(native.pickTime).not.toHaveBeenCalled()
  })

  it("keeps the draft intact if the picker cannot open", async () => {
    native.pickDate.mockRejectedValue(new Error("activity unavailable"))
    const { onDateChange } = renderFields()
    buttons[0]!.onPress()
    await vi.waitFor(() => expect(nativeUi.alert).toHaveBeenCalledOnce())
    expect(onDateChange).not.toHaveBeenCalled()
  })
})
