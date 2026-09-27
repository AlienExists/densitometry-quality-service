import { useEffect, useState } from 'react';
import { checkHealth } from '@/api/predict';

export type BackendStatus = 'unknown' | 'online' | 'offline';

const CHECK_INTERVAL_MS = 15000;

export function useBackendStatus(): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>('unknown');

  useEffect(() => {
    let active = true;

    const ping = async () => {
      const online = await checkHealth();
      if (active) setStatus(online ? 'online' : 'offline');
    };

    void ping();
    const id = window.setInterval(() => void ping(), CHECK_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  return status;
}
