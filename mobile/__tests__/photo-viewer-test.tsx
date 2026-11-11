import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { PhotoStrip } from '@/components/WorkoutCard';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/auth/session', () => ({ useSession: () => ({ api: {} }) }));

const workout = {
  id: 'w1',
  category: { id: 1, name: 'Bieganie' },
  description: null,
  photos: [
    { id: 'p1', url: 'https://img/1.jpg' },
    { id: 'p2', url: 'https://img/2.jpg' },
    { id: 'p3', url: null },
  ],
};

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

test('tapping a thumbnail opens the viewer with a counter, ✕ closes it', async () => {
  await wrap(<PhotoStrip workout={workout} />);

  expect(screen.queryByText('1/2')).toBeNull();
  const thumbs = screen.getAllByLabelText('Powiększ zdjęcie');
  expect(thumbs).toHaveLength(2); // photo without url is skipped

  await fireEvent.press(thumbs[1]);
  expect(await screen.findByText('2/2')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Zamknij'));
  expect(screen.queryByText('2/2')).toBeNull();
});

test('no ✕ on thumbnails unless deleting is allowed', async () => {
  const onDelete = jest.fn();
  const { rerender } = await wrap(<PhotoStrip workout={workout} />);
  expect(screen.queryAllByLabelText('Usuń zdjęcie')).toHaveLength(0);

  const client = new QueryClient();
  await rerender(
    <QueryClientProvider client={client}>
      <PhotoStrip workout={workout} onDeletePhoto={onDelete} />
    </QueryClientProvider>,
  );
  const buttons = screen.getAllByLabelText('Usuń zdjęcie');
  expect(buttons).toHaveLength(2);
  await fireEvent.press(buttons[0]);
  expect(onDelete).toHaveBeenCalledWith('p1');
});
