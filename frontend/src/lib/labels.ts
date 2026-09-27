interface RegionLabel {
  short: string;
  full: string;
}

const FEMUR: RegionLabel = { short: 'Бедро', full: 'Проксимальный отдел бедра' };

const REGIONS: Record<string, RegionLabel> = {
  lumbar_spine: { short: 'Поясничный', full: 'Поясничный отдел позвоночника' },
  proximal_femur: FEMUR,
  femur: FEMUR,
  hip: FEMUR,
};

const UNKNOWN_REGION: RegionLabel = { short: 'Не определена', full: 'Область не определена' };

export function regionLabel(region: string): RegionLabel {
  return REGIONS[region.toLowerCase()] ?? UNKNOWN_REGION;
}

const VIOLATIONS: Record<string, string> = {
  spine_tilt: 'Наклон оси > 5°',
  axis_tilt: 'Наклон оси > 5°',
  wrong_positioning: 'Некорректная укладка',
  incorrect_positioning: 'Некорректная укладка',
  artifacts: 'Посторонние предметы',
  artifact: 'Посторонние предметы',
  foreign_object: 'Посторонние предметы',
  wrong_hip_positioning: 'Неверное позиционирование бедра',
  rotation_error: 'Ротация области',
  limb_rotation: 'Ротация конечности',
  roi_error: 'Некорректная разметка ROI',
  incorrect_roi: 'Некорректная разметка ROI',
};

export function violationCodes(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function violationLabel(code: string): string {
  return VIOLATIONS[code.toLowerCase()] ?? code;
}

export function violationSummary(value: string | null): string {
  return violationCodes(value).map(violationLabel).join('; ');
}

export function pluralRu(count: number, forms: [string, string, string]): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

export function formatSeconds(value: number): string {
  if (value < 1) return `${value.toFixed(2).replace('.', ',')} с`;
  if (value < 60) return `${value.toFixed(1).replace('.', ',')} с`;
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes} мин ${seconds} с`;
}
