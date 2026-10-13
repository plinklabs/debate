import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../test/i18n';
import { fakeServiceWorker } from '../test/serviceWorker';
import { UpdateNotice } from './UpdateNotice';
import { SKIP_WAITING, createUpdates } from './updates';

function setUp() {
  const reload = vi.fn();
  const updates = createUpdates(reload);
  const sw = fakeServiceWorker();
  updates.watch(sw.registration, sw.container);
  return { reload, updates, sw };
}

describe('UpdateNotice', () => {
  it('shows nothing while no new version waits', () => {
    const { updates, sw } = setUp();
    renderWithI18n(<UpdateNotice updates={updates} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    act(() => {
      sw.find();
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('offers a reload once a new version waits, and reloads only on the click', () => {
    const { updates, sw, reload } = setUp();
    renderWithI18n(<UpdateNotice updates={updates} />);

    act(() => {
      sw.deploy();
    });
    const worker = sw.registration.waiting!;
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('A new version is ready.');
    expect(worker.messages).toEqual([]);
    expect(reload).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(worker.messages).toEqual([{ type: SKIP_WAITING }]);
    expect(reload).not.toHaveBeenCalled();
    act(() => {
      sw.takeOver();
    });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('shows a version that was waiting before it rendered, in Dutch', () => {
    const { updates, sw } = setUp();
    const worker = sw.deploy();
    renderWithI18n(<UpdateNotice updates={updates} />, { locale: 'nl' });

    expect(screen.getByRole('status')).toHaveTextContent('Er staat een nieuwe versie klaar.');
    fireEvent.click(screen.getByRole('button', { name: 'Herladen' }));
    expect(worker.messages).toEqual([{ type: SKIP_WAITING }]);
  });
});
