# Frontend — Сервис ИИ по оценке качества исследований плотности костей

Веб-интерфейс для загрузки DICOM-исследований, просмотра снимков и визуализации
результатов автоматического контроля качества (хакатон, раздел "Участник 4" плана).

## Стек

React + TypeScript + Vite, Ant Design, Zustand, axios, react-router-dom, SheetJS (xlsx).

## Структура проекта

```
frontend/
├── src/
│   ├── api/            # axios-клиент, вызовы /analyze, /batch, /health
│   ├── components/      # переиспользуемые компоненты по разделам UI
│   ├── pages/           # 3 страницы: загрузка / вьюер / таблица результатов
│   ├── stores/          # Zustand: результаты, статус загрузки, health
│   ├── types/api.ts      # ЕДИНЫЙ КОНТРАКТ с backend — см. ниже
│   └── utils/            # моки, экспорт xlsx/json, подписи нарушений
├── Dockerfile
├── nginx.conf
├── docker-compose.yml
└── .env.example
```

## Быстрый старт (локально, без Docker)

```bash
npm install
cp .env.example .env
npm run dev
```
Откроется на http://localhost:5173. По умолчанию `VITE_USE_MOCKS` не задан —
чтобы работать на моковых данных без готового backend, добавьте в `.env`:

```
VITE_USE_MOCKS=true
```

Тогда загрузка одиночного DICOM-файла всегда вернёт `mockAnalyzeResponse`
из `src/utils/mockData.ts` — можно верстать и показывать UI, пока backend
не готов.

## Запуск в Docker

```bash
docker build -t qc-frontend --build-arg VITE_API_BASE_URL=/api .
docker run -p 8080:80 qc-frontend
```
Откроется на http://localhost:8080.

Либо через docker-compose (фронт + заглушка backend для проверки):

```bash
docker compose up --build
```
Замените сервис `backend` в `docker-compose.yml` на реальный, когда он
появится у Участника 5, и объедините с общим docker-compose команды.

## КОНТРАКТ С BACKEND (согласовать с Участником 5)

Все типы ответов API — в `src/types/api.ts`. Если backend возвращает поля
с другими именами/структурой — правится **только этот файл**, остальной
код (компоненты, таблица, экспорт) продолжит работать, если сохранить
форму объектов.

Ожидаемые эндпоинты:
- `POST /analyze` — form-data с полем `file` (один .dcm) → `AnalyzeResponse`
- `POST /batch` — form-data с полем `file` (.zip) → `{ job_id: string }`
- `GET /batch/{job_id}/status` → `BatchStatusResponse`
- `GET /health` → `{ status: 'ok' | 'degraded' | 'down' }`

## Что уже готово

- [x] Каркас (Vite + TS + Ant Design + роутинг)
- [x] TS-типы под контракт API
- [x] Загрузка одного DICOM-файла (drag & drop, валидация, прогресс, ошибки)
- [x] Пакетная загрузка ZIP + polling статуса + отмена
- [x] Просмотр снимка: zoom, pan (через scale), яркость/контраст, инверсия,
      полноэкранный режим, сброс вида
- [x] Оверлей визуализации нарушений: bounding box, линия оси с углом,
      ключевые точки, маска/heatmap (если backend отдаёт как PNG)
- [x] Панель результатов: цветовая индикация качества, список нарушений
      с confidence-барами, угол наклона оси
- [x] Таблица результатов: сортировка, фильтры, поиск, подсветка нарушений
- [x] Экспорт в XLSX и JSON (клиентский, для отладки/демо)
- [x] ErrorBoundary + индикатор "сервер жив" (health-check) + понятные
      сообщения об ошибках по HTTP-кодам
- [x] Docker (multi-stage build + nginx + SPA-роутинг + проксирование /api)

## Что осталось / TODO по плану командира

- [ ] **Cornerstone.js** — полноценный DICOM-вьюер вместо PNG-превью.
      Сейчас используется простой `<img>` с CSS-трансформациями — рабочий
      fallback согласно самому плану ("Подводные камни": начните с img,
      Cornerstone подключайте позже). Если будет время — интеграция:
      `npm install @cornerstonejs/core @cornerstonejs/tools`, требует
      настройки web workers и WASM-модулей, см. официальную документацию.
- [ ] Подключить реальный backend вместо моков (`VITE_USE_MOCKS=false`)
- [ ] Тёмная тема (опционально, ConfigProvider в App.tsx уже готов к этому)
- [ ] E2E/unit тесты (Vitest/Playwright) — опционально, плюс к баллам
- [ ] Согласовать финальный список кодов `violation_type` с ML
      (сейчас в `src/utils/violationLabels.ts`)

## Известные ограничения

- Вьюер не поддерживает многослойные DICOM-серии (только показ превью на
  изображение, переключение между до 3 картинок через табы).
- Batch polling останавливается только по завершении/ошибке/явной отмене —
  нет лимита по времени ожидания (добавить при необходимости).
