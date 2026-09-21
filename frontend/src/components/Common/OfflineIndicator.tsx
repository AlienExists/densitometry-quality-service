import { useEffect } from 'react';
import { Badge, Tooltip } from 'antd';
import { useHealthStore } from '@/stores/useHealthStore';
import { checkHealth } from '@/api/analyze';

const CHECK_INTERVAL_MS = 15000;

/** Индикатор "сервер жив" в шапке — раздел 2.6 ТЗ (GET /health) */
export function OfflineIndicator() {
  const online = useHealthStore((s) => s.online);
  const setOnline = useHealthStore((s) => s.setOnline);

  useEffect(() => {
    let mounted = true;

    const ping = async () => {
      try {
        await checkHealth();
        if (mounted) setOnline(true);
      } catch {
        if (mounted) setOnline(false);
      }
    };

    ping();
    const id = setInterval(ping, CHECK_INTERVAL_MS);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [setOnline]);

  return (
    <Tooltip title={online ? 'Backend доступен' : 'Backend недоступен'}>
      <Badge status={online ? 'success' : 'error'} text={online ? 'Онлайн' : 'Офлайн'} />
    </Tooltip>
  );
}
