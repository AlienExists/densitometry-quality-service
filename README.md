
**Mac / Linux:**
```bash
python -m venv .venv
source .venv/bin/activate
```

**Windows:**
```bash
python -m venv .venv
.venv\Scripts\activate
```

### 2. Установить зависимости

```bash
pip install -r requirements.txt
```

### 3. Запустить сервер

```bash
uvicorn api.main:app --reload
```

### 4. Frontend start
```bash
cd frontend
npm install
npm run dev
```

Сервер запустится на http://localhost:8000

Документация API (Swagger): http://localhost:8000/docs

