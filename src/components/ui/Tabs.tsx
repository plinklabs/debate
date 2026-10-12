import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import styles from './Tabs.module.css';

export interface TabItem<T extends string> {
  readonly value: T;
  readonly label: string;
}

const tabId = (prefix: string, value: string) => `${prefix}-tab-${value}`;
const panelId = (prefix: string, value: string) => `${prefix}-panel-${value}`;

interface TabListProps<T extends string> {
  /** What the tabs are, for a screen reader. */
  readonly label: string;
  /** Prefix of the tab and panel ids; the same in the `TabPanel`. */
  readonly idPrefix: string;
  readonly tabs: readonly TabItem<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
}

/**
 * Mono labels on a hairline, the current one underlined in ink. Keyboard as
 * in the ARIA tabs pattern: Tab reaches the current tab, the arrow keys, Home
 * and End move between tabs and show the one they land on.
 */
export function TabList<T extends string>({
  label,
  idPrefix,
  tabs,
  value,
  onChange,
}: TabListProps<T>) {
  const buttons = useRef(new Map<string, HTMLButtonElement>());

  const go = (index: number) => {
    const tab = tabs[(index + tabs.length) % tabs.length];
    onChange(tab.value);
    buttons.current.get(tab.value)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.value === value);
    switch (event.key) {
      case 'ArrowRight':
        go(index + 1);
        break;
      case 'ArrowLeft':
        go(index - 1);
        break;
      case 'Home':
        go(0);
        break;
      case 'End':
        go(tabs.length - 1);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <div role="tablist" aria-label={label} className={styles.list} onKeyDown={onKeyDown}>
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            ref={(element) => {
              if (element === null) buttons.current.delete(tab.value);
              else buttons.current.set(tab.value, element);
            }}
            type="button"
            role="tab"
            id={tabId(idPrefix, tab.value)}
            aria-selected={selected}
            // Only the current panel is in the page.
            aria-controls={selected ? panelId(idPrefix, tab.value) : undefined}
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            onClick={() => onChange(tab.value)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

interface TabPanelProps {
  readonly idPrefix: string;
  /** The tab this panel belongs to. */
  readonly value: string;
  readonly className?: string;
  readonly children: ReactNode;
}

export function TabPanel({ idPrefix, value, className, children }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      id={panelId(idPrefix, value)}
      aria-labelledby={tabId(idPrefix, value)}
      className={className}
    >
      {children}
    </div>
  );
}
