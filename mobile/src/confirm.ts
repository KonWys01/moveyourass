import { Alert } from 'react-native';

/** "Are you sure?" before anything that cannot be undone. */
export function confirmDelete(
  title: string,
  onConfirm: () => void,
  message?: string,
): void {
  Alert.alert(title, message, [
    { text: 'Anuluj', style: 'cancel' },
    { text: 'Usuń', style: 'destructive', onPress: onConfirm },
  ]);
}
