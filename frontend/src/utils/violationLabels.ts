import type { ViolationType } from '@/types/api';

/** Человекочитаемые названия нарушений (раздел 2.3 ТЗ). Согласовать финальный
 *  список названий с Участником 3 (ML) — см. README, "Контракты". */
export const VIOLATION_LABELS: Record<string, string> = {
  incorrect_positioning: 'Некорректная укладка',
  axis_tilt: 'Наклон оси > 5°',
  foreign_object: 'Посторонние предметы',
  incorrect_roi: 'Некорректная ROI',
  limb_rotation: 'Ротация конечности',
};

export function violationLabel(type: ViolationType): string {
  return VIOLATION_LABELS[type] ?? type;
}

export const REGION_LABELS: Record<string, string> = {
  lumbar_spine: 'Поясничный отдел позвоночника',
  hip: 'Проксимальный отдел бедра',
  unknown: 'Область не определена',
};
