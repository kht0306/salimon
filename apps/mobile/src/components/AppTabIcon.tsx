import { StyleSheet, View } from "react-native"
import { mobileTheme } from "../theme"

interface AppTabIconProps {
  active: boolean
  name: "home" | "settings" | "settlement" | "transactions"
}

interface IconShapeProps {
  color: string
}

export function AppTabIcon({ active, name }: AppTabIconProps) {
  const color = active ? mobileTheme.colors.teal : mobileTheme.colors.muted

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.frame}
    >
      {name === "home" ? <HomeIcon color={color} /> : null}
      {name === "transactions" ? <TransactionsIcon color={color} /> : null}
      {name === "settlement" ? <SettlementIcon color={color} /> : null}
      {name === "settings" ? <SettingsIcon color={color} /> : null}
    </View>
  )
}

function SettlementIcon({ color }: IconShapeProps) {
  return (
    <View style={styles.shapeFrame}>
      <View
        style={[
          styles.settlementBase,
          styles.settlementBaseTop,
          { backgroundColor: color },
        ]}
      />
      <View
        style={[
          styles.settlementBase,
          styles.settlementBaseMiddle,
          { backgroundColor: color },
        ]}
      />
      <View
        style={[
          styles.settlementBase,
          styles.settlementBaseBottom,
          { backgroundColor: color },
        ]}
      />
    </View>
  )
}

function TransactionsIcon({ color }: IconShapeProps) {
  return (
    <View style={styles.shapeFrame}>
      <View
        style={[styles.listDot, styles.listDotTop, { backgroundColor: color }]}
      />
      <View
        style={[
          styles.listLine,
          styles.listLineTop,
          { backgroundColor: color },
        ]}
      />
      <View
        style={[
          styles.listDot,
          styles.listDotMiddle,
          { backgroundColor: color },
        ]}
      />
      <View
        style={[
          styles.listLine,
          styles.listLineMiddle,
          { backgroundColor: color },
        ]}
      />
      <View
        style={[
          styles.listDot,
          styles.listDotBottom,
          { backgroundColor: color },
        ]}
      />
      <View
        style={[
          styles.listLine,
          styles.listLineBottom,
          { backgroundColor: color },
        ]}
      />
    </View>
  )
}

function HomeIcon({ color }: IconShapeProps) {
  return (
    <View style={styles.shapeFrame}>
      <View style={[styles.homeRoof, { borderColor: color }]} />
      <View style={[styles.homeBody, { borderColor: color }]}>
        <View style={[styles.homeDoor, { backgroundColor: color }]} />
      </View>
    </View>
  )
}

function SettingsIcon({ color }: IconShapeProps) {
  return (
    <View style={styles.shapeFrame}>
      <View
        style={[
          styles.sliderLine,
          styles.sliderTop,
          { backgroundColor: color },
        ]}
      />
      <View
        style={[styles.sliderKnob, styles.knobTop, { backgroundColor: color }]}
      />
      <View
        style={[
          styles.sliderLine,
          styles.sliderMiddle,
          { backgroundColor: color },
        ]}
      />
      <View
        style={[
          styles.sliderKnob,
          styles.knobMiddle,
          { backgroundColor: color },
        ]}
      />
      <View
        style={[
          styles.sliderLine,
          styles.sliderBottom,
          { backgroundColor: color },
        ]}
      />
      <View
        style={[
          styles.sliderKnob,
          styles.knobBottom,
          { backgroundColor: color },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  frame: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  shapeFrame: {
    width: 20,
    height: 20,
    position: "relative",
  },
  homeRoof: {
    position: "absolute",
    top: 2,
    left: 5,
    width: 11,
    height: 11,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: 2,
    transform: [{ rotate: "45deg" }],
  },
  homeBody: {
    position: "absolute",
    left: 4,
    bottom: 1,
    width: 13,
    height: 10,
    alignItems: "center",
    justifyContent: "flex-end",
    borderWidth: 2,
    borderTopWidth: 0,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  homeDoor: {
    width: 3,
    height: 5,
  },
  listDot: {
    position: "absolute",
    left: 1,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  listDotTop: { top: 2 },
  listDotMiddle: { top: 8 },
  listDotBottom: { top: 14 },
  listLine: {
    position: "absolute",
    left: 7,
    width: 12,
    height: 2,
    borderRadius: 1,
  },
  listLineTop: { top: 3 },
  listLineMiddle: { top: 9 },
  listLineBottom: { top: 15 },
  sliderLine: {
    position: "absolute",
    left: 1,
    width: 18,
    height: 2,
    borderRadius: 1,
  },
  sliderTop: { top: 3 },
  sliderMiddle: { top: 9 },
  sliderBottom: { top: 15 },
  sliderKnob: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  knobTop: { top: 1, left: 4 },
  knobMiddle: { top: 7, right: 3 },
  knobBottom: { top: 13, left: 7 },
  settlementBase: {
    position: "absolute",
    left: 2,
    height: 4,
    borderRadius: 2,
  },
  settlementBaseTop: { top: 2, width: 8 },
  settlementBaseMiddle: { top: 8, width: 13 },
  settlementBaseBottom: { top: 14, width: 18 },
})
