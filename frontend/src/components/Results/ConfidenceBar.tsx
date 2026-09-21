import { Progress } from 'antd';

interface Props {
  value: number; // 0..1
}

export function ConfidenceBar({ value }: Props) {
  const percent = Math.round(value * 100);
  const status = percent >= 80 ? 'exception' : percent >= 50 ? 'active' : 'normal';
  return (
    <Progress
      percent={percent}
      size="small"
      status={status}
      strokeColor={percent >= 80 ? '#ff4d4f' : percent >= 50 ? '#faad14' : '#52c41a'}
    />
  );
}
