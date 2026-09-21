import type { Visualization } from '@/types/api';

interface Props {
  visualization: Visualization;
  width: number;
  height: number;
}

/**
 * SVG-оверлей поверх снимка: bounding box'ы, линия оси, ключевые точки —
 * раздел 2.6 ТЗ ("Визуализация нарушений на снимке").
 * Если backend позже начнёт отдавать маску/тепловую карту как PNG (mask_url /
 * heatmap_url), их проще всего наложить отдельным <img> с opacity, см. ниже.
 */
export function ViolationOverlay({ visualization, width, height }: Props) {
  const { bboxes, axis_line, keypoints, axis_angle_deg, mask_url, heatmap_url } = visualization;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {mask_url && (
        <img
          src={mask_url}
          alt="Маска сегментации"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.4 }}
        />
      )}
      {heatmap_url && (
        <img
          src={heatmap_url}
          alt="Тепловая карта"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.5 }}
        />
      )}

      <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
        {bboxes?.map((box, i) => (
          <g key={i}>
            <rect
              x={box.x}
              y={box.y}
              width={box.width}
              height={box.height}
              fill="none"
              stroke="#ff4d4f"
              strokeWidth={2}
            />
            {box.label && (
              <text x={box.x} y={box.y - 6} fill="#ff4d4f" fontSize={12} fontWeight={600}>
                {box.label}
              </text>
            )}
          </g>
        ))}

        {axis_line && (
          <g>
            <line
              x1={axis_line[0].x}
              y1={axis_line[0].y}
              x2={axis_line[1].x}
              y2={axis_line[1].y}
              stroke="#faad14"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
            {axis_angle_deg !== undefined && (
              <text x={axis_line[1].x + 8} y={axis_line[1].y} fill="#faad14" fontSize={13} fontWeight={600}>
                {axis_angle_deg.toFixed(1)}° {axis_angle_deg > 5 ? '(некорректно)' : '(корректно)'}
              </text>
            )}
          </g>
        )}

        {keypoints?.map((kp, i) => (
          <g key={i}>
            <circle cx={kp.x} cy={kp.y} r={4} fill="#52c41a" />
            {kp.label && (
              <text x={kp.x + 6} y={kp.y - 6} fill="#52c41a" fontSize={11}>
                {kp.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
