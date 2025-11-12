# Trade Builder - Python Backend Refactoring

## 개요

원래 4인 팀 프로젝트였던 Trade Builder에서 프론트엔드 UI만 가져와, 백엔드 기능을 Python으로 새롭게 구현한 프로젝트입니다.

## 주요 변경사항

### ✅ 완료된 작업

#### 1. Python 백엔드 구현
- **FastAPI** 기반 REST API 서버
- **WebSocket** 실시간 로그 스트리밍
- **asyncio** 비동기 로직 실행
- Upbit API 통합 (JWT 인증, 주문, 시장 데이터)

#### 2. 핵심 기능
- **로직 인터프리터**: AST 기반 트레이딩 로직 파싱 및 실행
- **기술 지표**: RSI, SMA, ROI, HighestPrice 계산
- **주문 실행**: 시장가/지정가 매수/매도
- **다중 로직 관리**: 여러 로직 동시 실행 및 모니터링

#### 3. RL/AI 모델 제거
- ❌ RLConnection.ts 삭제
- ❌ RLPredictionTest.jsx 삭제
- ❌ RLSignalAST 제거
- ❌ rl_launcher.js 삭제
- ✅ 순수 기술 지표 기반 트레이딩으로 전환

## 프로젝트 구조

```
Trade-Builder-Client/
├── backend/                    # Python 백엔드 (새로 구현)
│   ├── main.py                # FastAPI 서버
│   ├── upbit_api.py           # Upbit API 클라이언트
│   ├── ast_nodes.py           # AST 노드 정의
│   ├── interpreter.py         # 로직 인터프리터
│   ├── logic_runner.py        # 로직 실행 매니저
│   ├── requirements.txt       # Python 의존성
│   └── README.md              # 백엔드 문서
│
├── src/                        # React 프론트엔드
│   ├── communicator/
│   │   ├── backend_api.ts     # Python 백엔드 API 클라이언트 (신규)
│   │   ├── unified_api.ts     # 통합 API 래퍼 (신규)
│   │   ├── upbit_api.ts
│   │   └── upbit_candles.ts
│   ├── components/
│   │   ├── ApiKeySettings.jsx # API 키 설정 (수정)
│   │   ├── LogicEditorPage.jsx # 로직 편집기 (수정)
│   │   ├── AssetPage.jsx
│   │   └── RunningLogicsMonitor.jsx
│   └── logic_interpreter/      # 기존 TypeScript 인터프리터 (유지)
│
└── electron/                   # Electron 관련 (선택적)
    ├── main.js
    └── preload.cjs
```

## 기술 스택

### Backend (Python)
- **FastAPI** 0.115.5 - 웹 프레임워크
- **uvicorn** 0.32.1 - ASGI 서버
- **pandas** 2.2.3 - 데이터 처리
- **ta** 0.11.0 - 기술 분석
- **PyJWT** 2.10.1 - JWT 인증
- **httpx** 0.28.1 - 비동기 HTTP 클라이언트
- **websockets** 14.1 - WebSocket 지원

### Frontend (React)
- React 18 + Vite
- TypeScript
- Rete.js (비주얼 로직 에디터)
- TailwindCSS

## 설치 및 실행

### 1. Python 백엔드 설정

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. 백엔드 서버 실행

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python main.py
```

서버가 `http://127.0.0.1:8000`에서 실행됩니다.

### 3. 프론트엔드 실행

```powershell
npm install
npm run dev
```

## API 엔드포인트

### 설정
- `POST /api/config/keys` - API 키 설정

### 시장 데이터
- `POST /api/candles` - 캔들 데이터 조회
- `POST /api/highest-price` - 최고가 조회
- `GET /api/accounts` - 계좌 정보

### 주문
- `POST /api/order/market-buy` - 시장가 매수
- `POST /api/order/market-sell` - 시장가 매도
- `POST /api/order/limit-buy` - 지정가 매수
- `POST /api/order/limit-sell` - 지정가 매도

### 로직 실행
- `POST /api/logic/start` - 로직 시작
- `POST /api/logic/stop` - 로직 중지
- `GET /api/logic/running` - 실행 중인 로직 목록
- `WS /ws/{logic_id}` - 로그 스트리밍 (WebSocket)

## 주요 기능

### 1. 로직 편집기
- 드래그 앤 드롭 방식의 비주얼 로직 에디터
- 매수/매도 조건을 노드로 구성
- 실시간 로그 모니터링

### 2. 지원하는 기술 지표
- **RSI** (Relative Strength Index)
- **SMA** (Simple Moving Average)
- **ROI** (Return on Investment)
- **HighestPrice** (특정 기간 최고가)
- **CurrentPrice** (현재가)

### 3. 로직 연산자
- **비교 연산**: >, <, ≥, ≤, =, ≠
- **논리 연산**: AND, OR

## 개발 히스토리

### Phase 1: 분석
- 기존 Electron/TypeScript 코드 분석
- Python 백엔드 아키텍처 설계

### Phase 2: 백엔드 구현
- Upbit API 클라이언트 구현
- AST 노드 시스템 구현
- 인터프리터 및 로직 러너 구현
- FastAPI 서버 구축

### Phase 3: 통합
- 프론트엔드 API 클라이언트 작성
- 기존 컴포넌트를 Python 백엔드와 연동
- WebSocket 로그 스트리밍 구현

### Phase 4: 정리
- RL/AI 모델 관련 코드 제거
- 순수 기술 지표 기반으로 전환
- 문서화

## 향후 계획

- [ ] 백테스팅 기능 추가
- [ ] 더 많은 기술 지표 지원
- [ ] 성능 최적화
- [ ] 테스트 코드 작성

## 라이선스

이 프로젝트는 원래 팀 프로젝트의 프론트엔드 UI를 기반으로 하며, 팀원들의 허락을 받아 개인 프로젝트로 재구성되었습니다.

## 기여자

- 프론트엔드 UI: 원래 팀 프로젝트
- Python 백엔드: 개인 구현
