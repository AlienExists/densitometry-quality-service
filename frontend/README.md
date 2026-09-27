# BonAI — frontend

Веб-интерфейс сервиса контроля качества денситометрии: загрузка DICOM, просмотр результата анализа, таблица результатов и выгрузка в XLSX.

Стек: React 18, TypeScript, Vite, Zustand, React Router, axios, SheetJS.

## Запуск для разработки

```bash
npm install
npm run dev
```

Приложение откроется на http://localhost:5173. Запросы на `/api/*` проксируются на backend `http://localhost:8000` (адрес можно поменять переменной `VITE_API_TARGET`).

Backend запускается из корня репозитория:

```bash
uvicorn api.main:app --reload
```

## Сборка и Docker

```bash
npm run build
docker compose up --build
```

`docker compose` поднимает фронтенд на http://localhost:8080 и backend из папки `api` на порту 8000.

## Работа с API

| Эндпоинт | Назначение |
| --- | --- |
| `POST /predict` | один `.dcm`, ответ — XLSX с одной строкой |
| `POST /predict/batch` | ZIP с `.dcm`, ответ — XLSX со строкой на каждый файл |
| `GET /health` | проверка доступности сервера |

Фронтенд разбирает XLSX-ответ (`src/api/report.ts`) и показывает результаты в интерфейсе. Кнопка «Скачать .xlsx» на странице результатов формирует файл с теми же колонками, что и backend.

## Предпросмотр снимков

Изображение строится в браузере из загруженного DICOM (`src/lib/dicom.ts`): несжатые снимки 8/16 бит и JPEG Baseline. Для других типов сжатия и для файлов из ZIP-архива показывается пояснение вместо снимка.

## Мониторинг папки

Работает через File System Access API: Google Chrome, Microsoft Edge, Яндекс Браузер, страница открыта по `localhost` или `https`. Каждые 3 секунды проверяются новые `.dcm`-файлы; файл отправляется на анализ, когда его размер перестаёт меняться. Файлы, лежавшие в папке до подключения, не обрабатываются.

## Изображения

Иллюстрации главной страницы лежат в `public/images/`:

- `hero-spine.png`
- `hero-femur.png`
- `how-it-works.png`
