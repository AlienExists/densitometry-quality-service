import axios, { AxiosError } from 'axios';

// Базовый URL берём из .env (VITE_API_BASE_URL). В деве по умолчанию идёт
// через vite-прокси на /api -> http://localhost:8000 (см. vite.config.ts).
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL,
  timeout: 30000, // общий запрос; для батчей используем отдельный поллинг, не таймаут
});

const MAX_RETRIES = 3;

apiClient.interceptors.request.use((config) => {
  // сюда можно добавить auth-токен, если появится
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as (typeof error.config & { __retryCount?: number }) | undefined;

    // логируем всё, что прилетело с backend, чтобы не терять контекст ошибок
    // eslint-disable-next-line no-console
    console.error('[API ERROR]', {
      url: config?.url,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });

    // Retry только на сетевые проблемы / таймауты / 503 — не на 400/413 (это ошибки данных)
    const shouldRetry =
      config &&
      (!error.response || error.response.status === 503) &&
      (config.__retryCount ?? 0) < MAX_RETRIES;

    if (shouldRetry) {
      config.__retryCount = (config.__retryCount ?? 0) + 1;
      const delayMs = 500 * config.__retryCount; // простой backoff
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return apiClient(config);
    }

    return Promise.reject(error);
  },
);

/** Человекочитаемое сообщение об ошибке по HTTP-коду — раздел 2.7 ТЗ фронтендера */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'Сервер недоступен. Проверьте подключение и повторите попытку.';
    }
    switch (error.response.status) {
      case 400:
        return 'Невалидный файл. Проверьте, что это корректный DICOM-файл.';
      case 413:
        return 'Файл слишком большой.';
      case 500:
        return 'Ошибка на сервере при обработке исследования.';
      case 503:
        return 'Сервер временно недоступен, повторите попытку позже.';
      default:
        return `Ошибка запроса (код ${error.response.status}).`;
    }
  }
  return 'Неизвестная ошибка.';
}
