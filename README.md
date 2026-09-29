# Сервис контроля качества денситометрии

Определяет по DICOM-снимку анатомическую область, относит снимок к корректным или некорректным и определяет тип нарушения. Результат — таблица xlsx с колонками из ТЗ.

## Структура

| Папка | Что внутри |
| --- | --- |
| `api/` | бэкенд на FastAPI: эндпоинты, схема ответа, выгрузка xlsx, проверка zip-архивов |
| `qc/` | ML-часть, которую вызывает бэкенд: анализатор, препроцессинг DICOM, модели, геометрия оси, визуализация |
| `qc/weights/` | веса моделей `spine.pt`, `femur.pt`, `region.pt` (в git не хранятся, см. README в папке) |
| `ml/` | обучение и исследование: ноутбук обучения для Kaggle, подготовка выборки, проверочные скрипты |
| `frontend/` | веб-интерфейс |

Бэкенд не делает препроцессинг сам: он передаёт путь к DICOM анализатору `qc/analyzer.py`, а тот использует тот же код препроцессинга, на котором обучались модели.

## Запуск локально

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate    Mac/Linux: source .venv/bin/activate
pip install -r api/requirements.txt
```

Положите веса в `qc/weights/` и запустите:

```bash
uvicorn api.main:app --reload
```

Сервер: http://localhost:8000, документация API: http://localhost:8000/docs.

Фронтенд для разработки:

```bash
cd frontend
npm install
npm run dev
```

Без весов можно запустить в режиме заглушки (весь путь работает, вероятности нулевые):

```bash
# Windows (cmd):  set QC_DUMMY=1 && uvicorn api.main:app --reload
QC_DUMMY=1 uvicorn api.main:app --reload
```

## Запуск в Docker

```bash
cd frontend
docker compose up --build
```

Фронтенд: http://localhost:8080, бэкенд: http://localhost:8000. Веса подключаются в контейнер из `qc/weights/`.

## API

| Эндпоинт | Вход | Ответ |
| --- | --- | --- |
| `POST /predict` | один `.dcm` | xlsx с одной строкой |
| `POST /predict/batch` | zip с исследованиями | xlsx, строка на каждый уникальный снимок |
| `POST /predict/batch/archive` | zip с исследованиями | zip: `report.xlsx`, `warnings.xlsx`, `visual/*.png` (тепловые карты и ось) |
| `GET /health` | — | статус и режим модели |

Колонки отчёта: `path_to_study`, `study_uid`, `image_uid`, `anatomical_region`, `quality_class`, `quality_prob`, `violation_type`, `processing_status`, `time_of_processing`.
