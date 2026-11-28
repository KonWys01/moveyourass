import { type ColorValue, StyleSheet, View, type ViewStyle } from 'react-native';

/**
 * Minimal one-colour line icons for the bottom tabs, drawn with plain
 * Views (no icon font or SVG package to ship). 24x24, 2px strokes, in the
 * spirit of Material Symbols "outlined"; the colour comes from the tab bar
 * (active = primary, inactive = muted).
 */
export type TabIconName = 'dumbbell' | 'feed' | 'search' | 'calendar' | 'sliders';

const SIZE = 24;
const STROKE = 2;

function Box({ style }: { style: ViewStyle }) {
  return <View style={[s.abs, style]} />;
}

function Dumbbell({ c }: { c: ColorValue }) {
  return (
    <>
      <Box style={{ left: 5, top: 11, width: 14, height: STROKE, backgroundColor: c }} />
      <Box style={{ left: 4, top: 6, width: 4, height: 12, borderRadius: 1.5, backgroundColor: c }} />
      <Box style={{ left: 16, top: 6, width: 4, height: 12, borderRadius: 1.5, backgroundColor: c }} />
      <Box style={{ left: 1, top: 9, width: 2, height: 6, borderRadius: 1, backgroundColor: c }} />
      <Box style={{ left: 21, top: 9, width: 2, height: 6, borderRadius: 1, backgroundColor: c }} />
    </>
  );
}

function Feed({ c }: { c: ColorValue }) {
  return (
    <>
      <Box
        style={{
          left: 3, top: 4, width: 18, height: 16,
          borderRadius: 3, borderWidth: STROKE, borderColor: c,
        }}
      />
      <Box style={{ left: 7, top: 8, width: 10, height: STROKE, backgroundColor: c }} />
      <Box style={{ left: 7, top: 12, width: 10, height: STROKE, backgroundColor: c }} />
      <Box style={{ left: 7, top: 16, width: 6, height: STROKE, backgroundColor: c }} />
    </>
  );
}

function Search({ c }: { c: ColorValue }) {
  return (
    <>
      <Box
        style={{
          left: 3, top: 3, width: 14, height: 14,
          borderRadius: 7, borderWidth: STROKE, borderColor: c,
        }}
      />
      <Box
        style={{
          // centred on (17.5, 17.5), turned into a "\" handle
          left: 16.25, top: 13.5, width: STROKE + 0.5, height: 8,
          borderRadius: 1, backgroundColor: c,
          transform: [{ rotate: '-45deg' }],
        }}
      />
    </>
  );
}

function Calendar({ c }: { c: ColorValue }) {
  return (
    <>
      <Box
        style={{
          left: 3, top: 5, width: 18, height: 16,
          borderRadius: 3, borderWidth: STROKE, borderColor: c,
        }}
      />
      <Box style={{ left: 3, top: 9, width: 18, height: STROKE, backgroundColor: c }} />
      <Box style={{ left: 7, top: 2, width: STROKE, height: 5, borderRadius: 1, backgroundColor: c }} />
      <Box style={{ left: 15, top: 2, width: STROKE, height: 5, borderRadius: 1, backgroundColor: c }} />
      <Box style={{ left: 7, top: 14, width: 3, height: 3, borderRadius: 1, backgroundColor: c }} />
    </>
  );
}

function Sliders({ c, bg }: { c: ColorValue; bg: string }) {
  const knob = (left: number, top: number) => (
    <Box
      style={{
        left, top, width: 7, height: 7, borderRadius: 3.5,
        borderWidth: STROKE, borderColor: c, backgroundColor: bg,
      }}
    />
  );
  return (
    <>
      <Box style={{ left: 3, top: 5, width: 18, height: STROKE, backgroundColor: c }} />
      <Box style={{ left: 3, top: 11, width: 18, height: STROKE, backgroundColor: c }} />
      <Box style={{ left: 3, top: 17, width: 18, height: STROKE, backgroundColor: c }} />
      {knob(13, 2.5)}
      {knob(5, 8.5)}
      {knob(11, 14.5)}
    </>
  );
}

export function TabIcon({
  name,
  color,
  background,
}: {
  name: TabIconName;
  color: ColorValue;
  /** fills the slider knobs so the line does not show through */
  background: string;
}) {
  return (
    <View style={s.root} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {name === 'dumbbell' && <Dumbbell c={color} />}
      {name === 'feed' && <Feed c={color} />}
      {name === 'search' && <Search c={color} />}
      {name === 'calendar' && <Calendar c={color} />}
      {name === 'sliders' && <Sliders c={color} bg={background} />}
    </View>
  );
}

const s = StyleSheet.create({
  root: { width: SIZE, height: SIZE },
  abs: { position: 'absolute' },
});
