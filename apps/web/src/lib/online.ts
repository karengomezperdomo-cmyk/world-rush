'use client';

import { useEffect, useState } from 'react';

/**
 * Whether the browser believes it has a connection.
 *
 * The asymmetry matters and is the reason this is used only to show a warning, never to skip a request:
 * `navigator.onLine === false` is trustworthy — the device knows it has no network — while `true` only means
 * there is *an* interface up, which is also what a captive hotel wifi or a tunnel with no signal reports.
 * So "offline" is stated when the browser is sure, and nothing is claimed otherwise.
 *
 * It starts optimistic because `navigator` does not exist during the server render, and a screen that
 * flashed OFFLINE on every first paint would be wrong far more often than it was right.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
}
