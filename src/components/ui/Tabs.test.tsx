import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { TabList, TabPanel } from './Tabs';

type Fruit = 'apple' | 'pear' | 'plum';

function Fruits() {
  const [fruit, setFruit] = useState<Fruit>('apple');
  return (
    <>
      <TabList
        label="Fruit"
        idPrefix="f"
        tabs={[
          { value: 'apple', label: 'Apple' },
          { value: 'pear', label: 'Pear' },
          { value: 'plum', label: 'Plum' },
        ]}
        value={fruit}
        onChange={setFruit}
      />
      <TabPanel idPrefix="f" value={fruit}>
        <p>About the {fruit}</p>
      </TabPanel>
    </>
  );
}

describe('Tabs', () => {
  it('shows the panel of the current tab, labelled by it', () => {
    render(<Fruits />);
    expect(screen.getByRole('tablist', { name: 'Fruit' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Apple' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Apple' })).toHaveTextContent('About the apple');

    fireEvent.click(screen.getByRole('tab', { name: 'Plum' }));
    expect(screen.getByRole('tabpanel', { name: 'Plum' })).toHaveTextContent('About the plum');
    expect(screen.getByRole('tab', { name: 'Plum' })).toHaveAttribute(
      'aria-controls',
      screen.getByRole('tabpanel').id,
    );
    expect(screen.getByRole('tab', { name: 'Apple' })).not.toHaveAttribute('aria-controls');
  });

  it('is reached with Tab on the current tab, and moves with the arrows, Home and End', () => {
    render(<Fruits />);
    const tab = (name: string) => screen.getByRole('tab', { name });
    expect(tab('Apple')).toHaveAttribute('tabindex', '0');
    expect(tab('Pear')).toHaveAttribute('tabindex', '-1');

    tab('Apple').focus();
    fireEvent.keyDown(tab('Apple'), { key: 'ArrowRight' });
    expect(tab('Pear')).toHaveFocus();
    expect(tab('Pear')).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(tab('Pear'), { key: 'End' });
    expect(tab('Plum')).toHaveFocus();
    fireEvent.keyDown(tab('Plum'), { key: 'ArrowRight' });
    expect(tab('Apple')).toHaveFocus();
    fireEvent.keyDown(tab('Apple'), { key: 'ArrowLeft' });
    expect(tab('Plum')).toHaveFocus();
    fireEvent.keyDown(tab('Plum'), { key: 'Home' });
    expect(tab('Apple')).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('About the apple');
  });
});
