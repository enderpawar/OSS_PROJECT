/**
 * Unified API
 * Electron과 Python Backend API를 통합하는 래퍼
 * 
 * USE_PYTHON_BACKEND 플래그로 어느 백엔드를 사용할지 결정
 */

import { backendAPI } from './backend_api';

// Python 백엔드 사용 여부 설정
export const USE_PYTHON_BACKEND = true;

/**
 * 통합 API 인터페이스
 */
export const unifiedAPI = {
    /**
     * API 키 설정
     */
    async setApiKeys(accessKey: string, secretKey: string) {
        if (USE_PYTHON_BACKEND) {
            return await backendAPI.setApiKeys(accessKey, secretKey);
        } else {
            // Electron API 사용
            return await (window as any).electronAPI.setApiKeys(accessKey, secretKey);
        }
    },

    /**
     * 캔들 데이터 조회
     */
    async fetchCandles(stock: string, interval?: number, count?: number) {
        if (USE_PYTHON_BACKEND) {
            return await backendAPI.fetchCandles(stock, interval, count);
        } else {
            return await (window as any).electronAPI.fetchCandles(stock, interval, count);
        }
    },

    /**
     * 최고가 조회
     */
    async getHighestPrice(stock: string, periodUnit: string, period: number) {
        if (USE_PYTHON_BACKEND) {
            const result = await backendAPI.getHighestPrice(stock, periodUnit, period);
            return result.data || 0;
        } else {
            return await (window as any).electronAPI.getHighestPrice(stock, periodUnit, period);
        }
    },

    /**
     * 계좌 정보 조회
     */
    async getAccounts() {
        if (USE_PYTHON_BACKEND) {
            return await backendAPI.getAccounts();
        } else {
            return await (window as any).electronAPI.getAccounts();
        }
    },

    /**
     * 시장가 매수
     */
    async marketBuy(stock: string, price: number) {
        if (USE_PYTHON_BACKEND) {
            return await backendAPI.marketBuy(stock, price);
        } else {
            return await (window as any).electronAPI.marketBuy(stock, price);
        }
    },

    /**
     * 시장가 매도
     */
    async marketSell(stock: string, price: number) {
        if (USE_PYTHON_BACKEND) {
            return await backendAPI.marketSell(stock, price);
        } else {
            return await (window as any).electronAPI.marketSell(stock, price);
        }
    },

    /**
     * 지정가 매수 (KRW 기준)
     */
    async limitBuyWithKRW(stock: string, price: number, krwAmount: number) {
        if (USE_PYTHON_BACKEND) {
            return await backendAPI.limitBuyWithKRW(stock, price, krwAmount);
        } else {
            return await (window as any).electronAPI.limitBuyWithKRW(stock, price, krwAmount);
        }
    },

    /**
     * 지정가 매도 (KRW 기준)
     */
    async limitSellWithKRW(stock: string, price: number, krwAmount: number) {
        if (USE_PYTHON_BACKEND) {
            return await backendAPI.limitSellWithKRW(stock, price, krwAmount);
        } else {
            return await (window as any).electronAPI.limitSellWithKRW(stock, price, krwAmount);
        }
    },

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
    ) {
        if (USE_PYTHON_BACKEND) {
            return await backendAPI.startLogic(logicId, stock, logicData, logFunc, logDetails, interval);
        } else {
            // Electron Worker 기반 실행은 별도 처리 필요
            throw new Error('Electron backend logic execution not implemented in unified API');
        }
    },

    /**
     * 로직 실행 중지
     */
    async stopLogic(logicId: string) {
        if (USE_PYTHON_BACKEND) {
            return await backendAPI.stopLogic(logicId);
        } else {
            throw new Error('Electron backend logic execution not implemented in unified API');
        }
    },

    /**
     * 실행 중인 로직 목록 조회
     */
    async getRunningLogics() {
        if (USE_PYTHON_BACKEND) {
            return await backendAPI.getRunningLogics();
        } else {
            throw new Error('Electron backend logic execution not implemented in unified API');
        }
    },

    /**
     * API 키 로드 (로컬 스토리지에서)
     */
    loadApiKeys() {
        const keys = localStorage.getItem('upbitApiKeys');
        if (keys) {
            return JSON.parse(keys);
        }
        return { accessKey: '', secretKey: '' };
    },

    /**
     * API 키 저장 (로컬 스토리지에)
     */
    saveApiKeys(accessKey: string, secretKey: string) {
        localStorage.setItem('upbitApiKeys', JSON.stringify({ accessKey, secretKey }));
    }
};
