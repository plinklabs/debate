import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { renderWithI18n } from './test/i18n';

afterEach(() => {
  localStorage.clear();
});

describe('App', () => {
  it('renders the app name as the page heading', () => {
    renderWithI18n(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Debate — by Plink Labs');
  });

  it('renders in Dutch', () => {
    renderWithI18n(<App />, { locale: 'nl' });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Debat — door Plink Labs');
    expect(screen.getByText('// In aanbouw')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Taal' })).toBeInTheDocument();
  });

  it('switches language from the header', () => {
    renderWithI18n(<App />);
    const english = screen.getByRole('button', { name: 'English' });
    const dutch = screen.getByRole('button', { name: 'Nederlands' });
    expect(screen.getByRole('banner')).toContainElement(dutch);
    expect(english).toHaveAttribute('aria-pressed', 'true');
    expect(dutch).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(dutch);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Debat — door Plink Labs');
    expect(screen.getByText(/^Stellingen, teams/)).toBeInTheDocument();
    expect(english).toHaveAttribute('aria-pressed', 'false');
    expect(dutch).toHaveAttribute('aria-pressed', 'true');
    // The buttons keep their own language's name.
    expect(english).toHaveAttribute('lang', 'en');
    expect(dutch).toHaveTextContent('NL');

    fireEvent.click(english);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Debate — by Plink Labs');
  });
});
