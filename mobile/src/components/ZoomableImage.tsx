import { useMemo, useRef } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  StyleSheet,
  type GestureResponderEvent,
} from 'react-native';

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 280;

function distance(e: GestureResponderEvent): number {
  const [a, b] = e.nativeEvent.touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

/**
 * Pinch to zoom, drag when zoomed, double tap to zoom in/out. Built on
 * PanResponder, so no gesture library is needed. `onZoomChange` lets
 * the gallery stop paging while the photo is zoomed in.
 */
export function ZoomableImage({
  uri,
  width,
  height,
  onZoomChange,
}: {
  uri: string;
  width: number;
  height: number;
  onZoomChange: (zoomed: boolean) => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  // plain numbers mirror the animated values for the gesture maths
  const cur = useRef({ scale: 1, x: 0, y: 0 });
  const start = useRef({ scale: 1, x: 0, y: 0, dist: 0 });
  const lastTap = useRef(0);
  const lastPoint = useRef({ x: 0, y: 0 });
  const zoomChange = useRef(onZoomChange);
  zoomChange.current = onZoomChange;

  const responder = useMemo(() => {
    const clamp = (x: number, y: number, s: number) => {
      const maxX = ((s - 1) * width) / 2;
      const maxY = ((s - 1) * height) / 2;
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      };
    };
    const apply = (s: number, x: number, y: number, animate = false) => {
      const p = clamp(x, y, s);
      const wasZoomed = cur.current.scale > 1;
      cur.current = { scale: s, x: p.x, y: p.y };
      if (animate) {
        Animated.parallel([
          Animated.timing(scale, { toValue: s, duration: 180, useNativeDriver: true }),
          Animated.timing(tx, { toValue: p.x, duration: 180, useNativeDriver: true }),
          Animated.timing(ty, { toValue: p.y, duration: 180, useNativeDriver: true }),
        ]).start();
      } else {
        scale.setValue(s);
        tx.setValue(p.x);
        ty.setValue(p.y);
      }
      if (wasZoomed !== s > 1) zoomChange.current(s > 1);
    };
    const begin = (e: GestureResponderEvent) => {
      const touches = e.nativeEvent.touches;
      start.current = {
        ...cur.current,
        dist: touches.length >= 2 ? distance(e) : 0,
      };
      if (touches[0]) {
        lastPoint.current = { x: touches[0].pageX, y: touches[0].pageY };
      }
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: (e) => {
        if (e.nativeEvent.touches.length !== 1) return false;
        const now = Date.now();
        if (now - lastTap.current < DOUBLE_TAP_MS) {
          lastTap.current = 0;
          const zoomIn = cur.current.scale === 1;
          apply(zoomIn ? DOUBLE_TAP_SCALE : 1, 0, 0, true);
        } else {
          lastTap.current = now;
        }
        return false;
      },
      // take over (from the gallery's paging) for a pinch, or any drag
      // while zoomed in
      onMoveShouldSetPanResponderCapture: (e) =>
        e.nativeEvent.touches.length >= 2 || cur.current.scale > 1,
      onPanResponderGrant: begin,
      onPanResponderMove: (e) => {
        const touches = e.nativeEvent.touches;
        if (touches.length >= 2) {
          if (!start.current.dist) begin(e); // second finger came later
          const ratio = distance(e) / (start.current.dist || 1);
          const s = Math.min(
            MAX_SCALE,
            Math.max(1, start.current.scale * ratio),
          );
          apply(s, start.current.x, start.current.y);
        } else if (touches.length === 1 && cur.current.scale > 1) {
          if (start.current.dist) {
            begin(e); // went from 2 fingers to 1: restart the drag here
            return;
          }
          const t = touches[0];
          const dx = t.pageX - lastPoint.current.x;
          const dy = t.pageY - lastPoint.current.y;
          lastPoint.current = { x: t.pageX, y: t.pageY };
          apply(cur.current.scale, cur.current.x + dx, cur.current.y + dy);
        }
      },
      onPanResponderRelease: () => {
        if (cur.current.scale < 1.05) apply(1, 0, 0, true);
      },
      onPanResponderTerminationRequest: () => false,
    });
  }, [width, height, scale, tx, ty]);

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[
        { width, height },
        { transform: [{ translateX: tx }, { translateY: ty }, { scale }] },
      ]}
    >
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode="contain"
        accessibilityLabel="Zdjęcie z treningu"
      />
    </Animated.View>
  );
}
