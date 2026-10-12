// A setup that arrives from outside: from a link (`#c=…` in the page's hash,
// on load and whenever the hash changes) or from a file the teacher opens.
// It is only read and checked here; the preview (SharedSetupScreen) shows it,
// and nothing changes until the teacher chooses to use it.

import { useCallback, useEffect, useRef, useState } from 'react';
import { decodeConfig, readConfigFile, readLinkHash } from '../model/share';
import type { ConfigResult } from '../model/validate';

export type IncomingSource =
  { readonly kind: 'link' } | { readonly kind: 'file'; readonly name: string };

export interface Incoming {
  readonly source: IncomingSource;
  /** `null` while the setup is still being read. */
  readonly result: ConfigResult | null;
}

export interface IncomingSetup {
  /** The setup to show before it is used, or `null` when there is none. */
  readonly incoming: Incoming | null;
  readonly openFile: (file: File) => void;
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
  const [incoming, setIncoming] = useState<Incoming | null>(() =>
    hashLink() === null ? null : { source: LINK, result: null },
  );
  // Each read gets a number; a result that is no longer the latest is dropped.
  const latest = useRef(0);
  // Where the latest read came from: what a hash change may take away.
  const latestKind = useRef<IncomingSource['kind'] | null>(null);

  const read = useCallback((source: IncomingSource, reading: Promise<ConfigResult>) => {
    latest.current += 1;
    latestKind.current = source.kind;
    const ticket = latest.current;
    setIncoming({ source, result: null });
    void reading.then((result) => {
      if (ticket === latest.current) setIncoming({ source, result });
    });
  }, []);

  useEffect(() => {
    const follow = () => {
      const encoded = hashLink();
      if (encoded !== null) {
        read(LINK, decodeConfig(encoded));
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
    (file: File) => read({ kind: 'file', name: file.name }, readConfigFile(file)),
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

  return { incoming, openFile, close };
}
