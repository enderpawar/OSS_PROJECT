/**
 * Python Backend API Client
 * FastAPI 백엔드와 통신하는 클라이언트
 */

const API_BASE_URL = 'http://127.0.0.1:8000';

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface CandleData {
    timestamp: number;
    price: number;
    volume: number;
    high: number;
    low: number;
    open: number;
}

export interface LogicInfo {
    logicId: string;
    stock: string;
    interval: number;
    startTime: string;
    isRunning: boolean;
}

class BackendAPI {
    private wsConnections: Map<string, WebSocket> = new Map();
    private logCallbacks: Map<string, (title: string, msg: string) => void> = new Map();

    /**
     * API 키 설정
     */
    async setApiKeys(accessKey: string, secretKey: string): Promise<ApiResponse> {
        try {
            const response = await fetch(`${API_BASE_URL}/api/config/keys`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    accessKey,
                    secretKey
                })
            });

            return await response.json();
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 캔들 데이터 조회
     */
    async fetchCandles(
        market: string = 'KRW-BTC',
        interval: number = 1,
        count: number = 200
    ): Promise<ApiResponse<CandleData[]>> {
        try {
            const response = await fetch(`${API_BASE_URL}/api/candles`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    market,
                    interval,
                    count
                })
            });

            return await response.json();
        } catch (error: any) {
            return {
                success: false,
                data: [],
                error: error.message
            };
        }
    }

    /**
     * 최고가 조회
     */
    async getHighestPrice(
        market: string,
        periodUnit: string,
        period: number
    ): Promise<ApiResponse<number>> {
        try {
            const response = await fetch(`${API_BASE_URL}/api/highest-price`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    market,
                    periodUnit,
                    period
                })
            });

            const result = await response.json();
            return {
                success: result.success,
                data: result.price,
                error: result.error
            };
        } catch (error: any) {
            return {
                success: false,
                data: 0,
                error: error.message
            };
        }
    }

    /**
     * 계좌 정보 조회
     */
    async getAccounts(): Promise<ApiResponse> {
        try {
            const response = await fetch(`${API_BASE_URL}/api/accounts`);
            return await response.json();
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 시장가 매수
     */
    async marketBuy(market: string, price: number): Promise<ApiResponse> {
        try {
            const response = await fetch(`${API_BASE_URL}/api/order/market-buy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    market,
                    price
                })
            });

            return await response.json();
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 시장가 매도
     */
    async marketSell(market: string, price: number): Promise<ApiResponse> {
        try {
            const response = await fetch(`${API_BASE_URL}/api/order/market-sell`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    market,
                    price
                })
            });

            return await response.json();
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 지정가 매수 (KRW 금액 기준)
     */
    async limitBuyWithKRW(market: string, price: number, krwAmount: number): Promise<ApiResponse> {
        try {
            const volume = krwAmount / price;
            const response = await fetch(`${API_BASE_URL}/api/order/limit-buy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    market,
                    price,
                    volume
                })
            });

            return await response.json();
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 지정가 매도 (KRW 금액 기준)
     */
    async limitSellWithKRW(market: string, price: number, krwAmount: number): Promise<ApiResponse> {
        try {
            const volume = krwAmount / price;
            const response = await fetch(`${API_BASE_URL}/api/order/limit-sell`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    market,
                    price,
                    volume
                })
            });

            return await response.json();
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 로직 실행 시작
     */
    async startLogic(
        logicId: string,
        stock: string,
        logicData: any,
        logFunc: (title: string, msg: string) => void,
        logDetails: boolean = false,
        interval: number = 5000
    ): Promise<ApiResponse> {
        try {
            // WebSocket 연결 설정
            this.connectWebSocket(logicId, logFunc);

            // 로직 시작 요청
            const response = await fetch(`${API_BASE_URL}/api/logic/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    logicId,
                    stock,
                    logicData,
                    logDetails,
                    interval: interval / 1000  // ms -> seconds
                })
            });

            return await response.json();
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 로직 실행 중지
     */
    async stopLogic(logicId: string): Promise<ApiResponse> {
        try {
            // WebSocket 연결 종료
            this.disconnectWebSocket(logicId);

            const response = await fetch(`${API_BASE_URL}/api/logic/stop`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    logicId
                })
            });

            return await response.json();
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 실행 중인 로직 목록 조회
     */
    async getRunningLogics(): Promise<ApiResponse<LogicInfo[]>> {
        try {
            const response = await fetch(`${API_BASE_URL}/api/logic/running`);
            const result = await response.json();
            
            return {
                success: result.success,
                data: result.logics
            };
        } catch (error: any) {
            return {
                success: false,
                data: [],
                error: error.message
            };
        }
    }

    /**
     * WebSocket 연결
     */
    private connectWebSocket(logicId: string, logFunc: (title: string, msg: string) => void) {
        // 기존 연결이 있으면 종료
        this.disconnectWebSocket(logicId);

        const ws = new WebSocket(`ws://127.0.0.1:8000/ws/${logicId}`);

        ws.onopen = () => {
            console.log(`WebSocket connected for logic: ${logicId}`);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'log') {
                    logFunc(data.title, data.message);
                }
            } catch (error) {
                console.error('WebSocket message error:', error);
            }
        };

        ws.onerror = (error) => {
            console.error(`WebSocket error for logic ${logicId}:`, error);
        };

        ws.onclose = () => {
            console.log(`WebSocket closed for logic: ${logicId}`);
            this.wsConnections.delete(logicId);
            this.logCallbacks.delete(logicId);
        };

        this.wsConnections.set(logicId, ws);
        this.logCallbacks.set(logicId, logFunc);

        // Keep-alive ping
        const pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send('ping');
            } else {
                clearInterval(pingInterval);
            }
        }, 30000);
    }

    /**
     * WebSocket 연결 종료
     */
    private disconnectWebSocket(logicId: string) {
        const ws = this.wsConnections.get(logicId);
        if (ws) {
            ws.close();
            this.wsConnections.delete(logicId);
            this.logCallbacks.delete(logicId);
        }
    }

    /**
     * 모든 WebSocket 연결 종료
     */
    disconnectAll() {
        this.wsConnections.forEach((ws) => ws.close());
        this.wsConnections.clear();
        this.logCallbacks.clear();
    }
}

export const backendAPI = new BackendAPI();
