import { StyleSheet, View } from "react-native"
import { mobileTheme } from "../theme"

interface AppTabIconProps {
  active: boolean
  name: "home" | "settings"
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
      {name === "home" ? (
        <HomeIcon color={color} />
      ) : (
        <SettingsIcon color={color} />
      )}
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
})
