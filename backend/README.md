# Trade Builder Python Backend

## 설치

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 실행

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python main.py
```

또는

```powershell
cd backend
.\run.ps1
```

서버는 `http://127.0.0.1:8000`에서 실행됩니다.

## API 문서

서버 실행 후 `http://127.0.0.1:8000/docs`에서 Swagger UI를 확인할 수 있습니다.

## 주요 엔드포인트

- `POST /api/config/keys` - API 키 설정
- `POST /api/candles` - 캔들 데이터 조회
- `POST /api/logic/start` - 로직 실행 시작
- `POST /api/logic/stop` - 로직 실행 중지
- `GET /api/logic/running` - 실행 중인 로직 목록
- `WS /ws/{logic_id}` - 로그 스트리밍 WebSocket

## 구조

- `main.py` - FastAPI 서버
- `upbit_api.py` - Upbit API 클라이언트
- `interpreter.py` - 로직 인터프리터
- `ast_nodes.py` - AST 노드 정의
- `logic_runner.py` - 로직 실행 매니저
