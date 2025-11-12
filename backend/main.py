"""
FastAPI Backend Server
Trade Builder Python Backend
"""
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import asyncio
from datetime import datetime

from upbit_api import UpbitAPI
from logic_runner import LogicRunner

# FastAPI 앱 생성
app = FastAPI(title="Trade Builder Backend", version="1.0.0")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프론트엔드 주소
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 전역 상태
upbit_api: Optional[UpbitAPI] = None
logic_runner: Optional[LogicRunner] = None
websocket_connections: Dict[str, WebSocket] = {}


# Pydantic 모델들
class ApiKeyConfig(BaseModel):
    accessKey: str
    secretKey: str


class LogicStartRequest(BaseModel):
    logicId: str
    stock: str
    logicData: Dict[str, Any]
    logDetails: bool = False
    interval: float = 5.0


class LogicStopRequest(BaseModel):
    logicId: str


class CandleRequest(BaseModel):
    market: str = "KRW-BTC"
    interval: int = 1
    count: int = 200


class HighestPriceRequest(BaseModel):
    market: str
    periodUnit: str
    period: int


class MarketOrderRequest(BaseModel):
    market: str
    price: float


class LimitOrderRequest(BaseModel):
    market: str
    price: float
    volume: float


# API 엔드포인트들

@app.on_event("startup")
async def startup_event():
    """서버 시작 시 초기화"""
    global upbit_api, logic_runner
    upbit_api = UpbitAPI()
    logic_runner = LogicRunner(upbit_api)
    print("🚀 Trade Builder Backend starting...")


@app.on_event("shutdown")
async def shutdown_event():
    """서버 종료 시 정리"""
    global logic_runner, upbit_api
    if logic_runner:
        logic_runner.stop_all_logics()
    if upbit_api:
        await upbit_api.close()
    print("👋 Trade Builder Backend shutting down...")


@app.get("/")
async def root():
    """헬스 체크"""
    return {
        "status": "ok",
        "message": "Trade Builder Backend API",
        "version": "1.0.0"
    }


@app.post("/api/config/keys")
async def set_api_keys(config: ApiKeyConfig):
    """API 키 설정"""
    global upbit_api
    
    try:
        # 새로운 API 인스턴스 생성
        upbit_api = UpbitAPI(config.accessKey, config.secretKey)
        
        return {
            "success": True,
            "message": "API keys configured successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/candles")
async def fetch_candles(request: CandleRequest):
    """캔들 데이터 조회"""
    if not upbit_api:
        raise HTTPException(status_code=500, detail="Upbit API not initialized")
    
    result = await upbit_api.fetch_candles(
        request.market,
        request.interval,
        request.count
    )
    
    return result


@app.post("/api/highest-price")
async def get_highest_price(request: HighestPriceRequest):
    """최고가 조회"""
    if not upbit_api:
        raise HTTPException(status_code=500, detail="Upbit API not initialized")
    
    result = await upbit_api.get_highest_price(
        request.market,
        request.periodUnit,
        request.period
    )
    
    return result


@app.get("/api/accounts")
async def get_accounts():
    """계좌 정보 조회"""
    if not upbit_api:
        raise HTTPException(status_code=500, detail="Upbit API not initialized")
    
    result = await upbit_api.get_accounts()
    return result


@app.post("/api/order/market-buy")
async def market_buy(request: MarketOrderRequest):
    """시장가 매수"""
    if not upbit_api:
        raise HTTPException(status_code=500, detail="Upbit API not initialized")
    
    result = await upbit_api.market_buy(request.market, request.price)
    return result


@app.post("/api/order/market-sell")
async def market_sell(request: MarketOrderRequest):
    """시장가 매도"""
    if not upbit_api:
        raise HTTPException(status_code=500, detail="Upbit API not initialized")
    
    # price는 실제로는 매도할 금액어치의 코인 수량으로 변환 필요
    # 여기서는 간단히 처리
    result = await upbit_api.market_sell(request.market, request.price)
    return result


@app.post("/api/order/limit-buy")
async def limit_buy(request: LimitOrderRequest):
    """지정가 매수"""
    if not upbit_api:
        raise HTTPException(status_code=500, detail="Upbit API not initialized")
    
    result = await upbit_api.limit_buy(
        request.market,
        request.price,
        request.volume
    )
    return result


@app.post("/api/order/limit-sell")
async def limit_sell(request: LimitOrderRequest):
    """지정가 매도"""
    if not upbit_api:
        raise HTTPException(status_code=500, detail="Upbit API not initialized")
    
    result = await upbit_api.limit_sell(
        request.market,
        request.price,
        request.volume
    )
    return result


@app.post("/api/logic/start")
async def start_logic(request: LogicStartRequest):
    """로직 실행 시작"""
    if not logic_runner:
        raise HTTPException(status_code=500, detail="Logic runner not initialized")
    
    # WebSocket 연결에서 로그 함수 가져오기
    ws = websocket_connections.get(request.logicId)
    
    async def log_func(title: str, msg: str):
        """로그 전송 함수"""
        if ws:
            try:
                await ws.send_json({
                    "type": "log",
                    "logicId": request.logicId,
                    "title": title,
                    "message": msg,
                    "timestamp": datetime.now().isoformat()
                })
            except Exception:
                pass
    
    success = await logic_runner.start_logic(
        logic_id=request.logicId,
        stock=request.stock,
        logic_data=request.logicData,
        log_func=log_func,
        log_details=request.logDetails,
        interval=request.interval
    )
    
    return {
        "success": success,
        "logicId": request.logicId
    }


@app.post("/api/logic/stop")
async def stop_logic(request: LogicStopRequest):
    """로직 실행 중지"""
    if not logic_runner:
        raise HTTPException(status_code=500, detail="Logic runner not initialized")
    
    success = logic_runner.stop_logic(request.logicId)
    
    return {
        "success": success,
        "logicId": request.logicId
    }


@app.get("/api/logic/running")
async def get_running_logics():
    """실행 중인 로직 목록 조회"""
    if not logic_runner:
        raise HTTPException(status_code=500, detail="Logic runner not initialized")
    
    logics = logic_runner.get_all_running_logics()
    
    return {
        "success": True,
        "logics": logics
    }


@app.get("/api/logic/running/{logic_id}")
async def get_running_logic(logic_id: str):
    """특정 로직 정보 조회"""
    if not logic_runner:
        raise HTTPException(status_code=500, detail="Logic runner not initialized")
    
    logic = logic_runner.get_running_logic(logic_id)
    
    if not logic:
        raise HTTPException(status_code=404, detail="Logic not found")
    
    return {
        "success": True,
        "logic": logic
    }


@app.websocket("/ws/{logic_id}")
async def websocket_endpoint(websocket: WebSocket, logic_id: str):
    """WebSocket 연결 (로그 스트리밍)"""
    await websocket.accept()
    websocket_connections[logic_id] = websocket
    
    try:
        while True:
            # 클라이언트로부터 메시지 대기 (연결 유지용)
            data = await websocket.receive_text()
            
            # ping/pong 처리
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    
    except WebSocketDisconnect:
        # 연결 종료
        if logic_id in websocket_connections:
            del websocket_connections[logic_id]
    
    except Exception as e:
        print(f"WebSocket error for {logic_id}: {e}")
        if logic_id in websocket_connections:
            del websocket_connections[logic_id]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
