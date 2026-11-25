import { type RefObject, useEffect, useState } from 'react';
import { Keyboard, Platform, type View } from 'react-native';

/**
 * How much of `ref`'s view the on-screen keyboard covers, in px.
 *
 * Android apps are edge-to-edge now, so the window no longer shrinks when
 * the keyboard opens and an input at the bottom stays hidden under it.
 * We measure the overlap ourselves and the screen pads its bottom by it
 * (padding is inside the view, so its frame and the math stay stable).
 * If the window does shrink (older setups) the overlap is simply 0.
 */
export function useKeyboardOverlap(ref: RefObject<View | null>) {
  const [overlap, setOverlap] = useState(0);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => {
      const keyboardTop = e.endCoordinates.screenY;
      ref.current?.measureInWindow((_x, y, _w, h) =>
        setOverlap(Math.max(0, Math.round(y + h - keyboardTop))),
      );
    });
    const hide = Keyboard.addListener(hideEvent, () => setOverlap(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [ref]);

  return overlap;
}
