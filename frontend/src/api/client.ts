import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
});

function readDetail(data: unknown): string | null {
  let payload: unknown = data;

  if (data instanceof ArrayBuffer) {
    try {
      payload = JSON.parse(new TextDecoder().decode(data));
    } catch {
      return null;
    }
  } else if (typeof data === 'string') {
    try {
      payload = JSON.parse(data);
    } catch {
      return null;
    }
  }

  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as { detail: unknown }).detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
  }
  return null;
}

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'Сервер анализа недоступен. Проверьте, что backend запущен, и повторите попытку.';
    }

    const { status, data } = error.response;
    const detail = readDetail(data);

    switch (status) {
      case 400:
      case 422:
        return detail ?? 'Файл не удалось прочитать. Проверьте, что это корректный DICOM.';
      case 413:
        return 'Файл слишком большой для загрузки.';
      case 500:
        return 'Сервер не смог обработать файл. Повторите попытку или загрузите другой файл.';
      case 502:
      case 503:
      case 504:
        return 'Сервер анализа временно недоступен. Повторите попытку через минуту.';
      default:
        return detail ?? `Сервер вернул ошибку ${status}.`;
    }
  }

  if (error instanceof Error && error.message) return error.message;
  return 'Не удалось выполнить запрос.';
}
