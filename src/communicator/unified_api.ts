/**
 * Unified API
 * Python Backend API 래퍼
 */

import { backendAPI } from './backend_api';

/**
 * 통합 API 인터페이스
 */
export const unifiedAPI = {
    /**
     * API 키 설정
     */
    async setApiKeys(accessKey: string, secretKey: string) {
        return await backendAPI.setApiKeys(accessKey, secretKey);
    },

    /**
     * 캔들 데이터 조회
     */
    async fetchCandles(stock: string, interval?: number, count?: number) {
        return await backendAPI.fetchCandles(stock, interval, count);
    },

    /**
     * 최고가 조회
     */
    async getHighestPrice(stock: string, periodUnit: string, period: number) {
        const result = await backendAPI.getHighestPrice(stock, periodUnit, period);
        return result.data || 0;
    },

    /**
     * 계좌 정보 조회
     */
    async getAccounts() {
        return await backendAPI.getAccounts();
    },

    /**
     * 시장가 매수
     */
    async marketBuy(stock: string, price: number) {
        return await backendAPI.marketBuy(stock, price);
    },

    /**
     * 시장가 매도
     */
    async marketSell(stock: string, price: number) {
        return await backendAPI.marketSell(stock, price);
    },

    /**
     * 지정가 매수 (KRW 기준)
     */
    async limitBuyWithKRW(stock: string, price: number, krwAmount: number) {
        return await backendAPI.limitBuyWithKRW(stock, price, krwAmount);
    },

    /**
     * 지정가 매도 (KRW 기준)
     */
    async limitSellWithKRW(stock: string, price: number, krwAmount: number) {
        return await backendAPI.limitSellWithKRW(stock, price, krwAmount);
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
        return await backendAPI.startLogic(logicId, stock, logicData, logFunc, logDetails, interval);
    },

    /**
     * 로직 실행 중지
     */
    async stopLogic(logicId: string) {
        return await backendAPI.stopLogic(logicId);
    },

    /**
     * 실행 중인 로직 목록 조회
     */
    async getRunningLogics() {
        return await backendAPI.getRunningLogics();
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
