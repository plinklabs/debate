// What arrives from outside, shown before it is used: a setup from a link
// (`#c=…` in the page's hash, on load and whenever the hash changes) or from a
// setup file the teacher opens, or a whole session from a report file (#7).
// It is only read and checked here; a preview (SharedSetupScreen,
// ReportPreviewScreen) shows it, and nothing changes until the teacher
// chooses to use it.

import { useCallback, useEffect, useRef, useState } from 'react';
import { readReportFile, type SavedResult } from '../model/reportFile';
import { decodeConfig, readConfigFile, readLinkHash } from '../model/share';
import type { ConfigResult } from '../model/validate';

export type IncomingSource =
  { readonly kind: 'link' } | { readonly kind: 'file'; readonly name: string };

/** A setup from a link or a setup file. */
export interface Incoming {
  readonly source: IncomingSource;
  /** `null` while the setup is still being read. */
  readonly result: ConfigResult | null;
}

/** A report file: the setup and the session saved in it. */
export interface IncomingReport {
  readonly source: { readonly kind: 'report'; readonly name: string };
  /** `null` while the report is still being read. */
  readonly result: SavedResult | null;
}

export type Arrival = Incoming | IncomingReport;

export function isReport(arrival: Arrival): arrival is IncomingReport {
  return arrival.source.kind === 'report';
}

export interface IncomingSetup {
  /** What to show before it is used, or `null` when there is nothing. */
  readonly incoming: Arrival | null;
  readonly openFile: (file: File) => void;
  readonly openReport: (file: File) => void;
  /**
   * Done with it, used or not. A link's hash goes too, without a new history
   * entry, so a reload does not show the setup again.
   */
  readonly close: () => void;
}

const LINK: IncomingSource = { kind: 'link' };

function hashLink(): string | null {
  return readLinkHash(window.location.hash);
}

export function useIncomingSetup(): IncomingSetup {
  // Known at once on a page opened from a link, so the setup screen does not flash first.
  const [incoming, setIncoming] = useState<Arrival | null>(() =>
    hashLink() === null ? null : { source: LINK, result: null },
  );
  // Each read gets a number; a result that is no longer the latest is dropped.
  const latest = useRef(0);
  // Where the latest read came from: what a hash change may take away.
  const latestKind = useRef<Arrival['source']['kind'] | null>(null);

  /** Show `arrive(null)` while reading, then `arrive(result)`. */
  const read = useCallback(
    <R>(kind: Arrival['source']['kind'], reading: Promise<R>, arrive: (r: R | null) => Arrival) => {
      latest.current += 1;
      latestKind.current = kind;
      const ticket = latest.current;
      setIncoming(arrive(null));
      void reading.then((result) => {
        if (ticket === latest.current) setIncoming(arrive(result));
      });
    },
    [],
  );

  useEffect(() => {
    const follow = () => {
      const encoded = hashLink();
      if (encoded !== null) {
        read('link', decodeConfig(encoded), (result) => ({ source: LINK, result }));
        return;
      }
      // Away from the link, with Back in the browser: its preview goes too.
      if (latestKind.current !== 'link') return;
      latest.current += 1;
      latestKind.current = null;
      setIncoming(null);
    };
    follow();
    window.addEventListener('hashchange', follow);
    return () => {
      window.removeEventListener('hashchange', follow);
      latest.current += 1;
    };
  }, [read]);

  const openFile = useCallback(
    (file: File) => {
      const source: IncomingSource = { kind: 'file', name: file.name };
      read('file', readConfigFile(file), (result) => ({ source, result }));
    },
    [read],
  );

  const openReport = useCallback(
    (file: File) => {
      const source = { kind: 'report', name: file.name } as const;
      read('report', readReportFile(file), (result) => ({ source, result }));
    },
    [read],
  );

  const close = useCallback(() => {
    latest.current += 1;
    latestKind.current = null;
    setIncoming(null);
    if (hashLink() !== null) {
      const { pathname, search } = window.location;
      window.history.replaceState(window.history.state, '', `${pathname}${search}`);
    }
  }, []);

  return { incoming, openFile, openReport, close };
}
