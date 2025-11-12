import { Indicators } from '@ixjb94/indicators';

const ta = new Indicators();

/**
 * 간단한 데이터 관리 클래스
 * API 호출을 통해 가격 데이터를 관리
 */
export class DataManager {
    stock: string;
    private priceData: number[] = [];
    private highestPrices: Map<string, number> = new Map();

    constructor(stock: string) {
        this.stock = stock;
    }

    async waitUntilReady() {
        // 캔들 데이터 초기 로드
        const { unifiedAPI } = await import('../communicator/unified_api');
        const candles = await unifiedAPI.fetchCandles(this.stock, 1, 200);
        if (candles.data) {
            this.priceData = candles.data.map((c: any) => c.trade_price);
        }
    }

    async setReadyHighestPrice(periodUnit: string, periodLength: number) {
        const { unifiedAPI } = await import('../communicator/unified_api');
        const highest = await unifiedAPI.getHighestPrice(this.stock, periodUnit, periodLength);
        this.highestPrices.set(`${periodUnit}-${periodLength}`, highest);
    }

    getLatestPrice(): number {
        return this.priceData[this.priceData.length - 1] || 0;
    }

    getHighestPrice(key: string): number {
        return this.highestPrices.get(key) || 0;
    }

    getPriceDataArray(): number[] {
        return this.priceData;
    }
}

export interface AST {
    evaluate(): Promise<number | boolean>;
    evaluateDetailed(log: (msg: string) => void): Promise<number | boolean>;
}

export abstract class SupplierAST implements AST {
    manager: DataManager;

    constructor(manager: DataManager) {
        this.manager = manager;
    }

    abstract evaluate(): Promise<number | boolean>;
    abstract evaluateDetailed(log: (msg: string) => void): Promise<number | boolean>;
}

export class ConstantAST implements AST {
    value: number;
    constructor(value: number) {
        this.value = value;
    }

    async evaluate() {
        return this.value;
    }

    async evaluateDetailed(log: (msg: string) => void) {
        log(`Constant value: ${this.value}`);
        return this.value;
    }
}

export class CurrentPriceAST extends SupplierAST {
    constructor(manager: DataManager) {
        super(manager);
    }
    async calcValue() {
        return this.manager.getLatestPrice();
    }

    async evaluate() {
        return await this.calcValue();
    }

    async evaluateDetailed(log: (msg: string) => void) {
        const value = await this.calcValue();
        log(`CurrentPrice value: ${value.toFixed(2)}`);
        return value;
    }
}

export class HighestPriceAST extends SupplierAST {
    periodLength: number;
    periodUnit: string;
    private isReady: boolean = false;

    constructor(manager: DataManager, periodLength: number, periodUnit: string) {
        super(manager);
        this.periodLength = periodLength;
        this.periodUnit = periodUnit;
        manager.setReadyHighestPrice(periodUnit, periodLength).then(() => {
            this.isReady = true;
        });
    }

    async calcValue() {
        // TODO: 나중에 적절히 기다리도록 수정 필요
        if (!this.isReady) {
            throw new Error(`HighestPrice data not ready yet for ${this.periodUnit}-${this.periodLength}`);
        }
        return this.manager.getHighestPrice(`${this.periodUnit}-${this.periodLength}`);
    }

    async evaluate() {
        return await this.calcValue();
    }

    async evaluateDetailed(log: (msg: string) => void) {
        const value = await this.calcValue();
        log(`HighestPrice value: ${value.toFixed(2)}`);
        return value;
    }
}

export class RsiAST extends SupplierAST {
    constructor(manager: DataManager) {
        super(manager);
    }
    async calcValue() {
        const data = this.manager.getPriceDataArray();
        const result = await ta.rsi(data, 14);
        return result[result.length - 1];
    }

    async evaluate() {
        return await this.calcValue();
    }

    async evaluateDetailed(log: (msg: string) => void) {
        const value = await this.calcValue();
        log(`RSI value: ${value.toFixed(2)}`);
        return value;
    }
}

export class RoiAST extends SupplierAST {
    constructor(manager: DataManager) {
        super(manager);
    }
    async calcValue() {
        return -5 + Math.random() * 10;
    }

    async evaluate() {
        return await this.calcValue();
    }

    async evaluateDetailed(log: (msg: string) => void) {
        const value = await this.calcValue();
        log(`ROI value: ${value.toFixed(2)}`);
        return value;
    }
}

export class SmaAST extends SupplierAST {
    period: number;

    constructor(manager: DataManager, period: number) {
        super(manager);
        this.period = period;
    }

    async calcValue() {
        const data = this.manager.getPriceDataArray().slice(-this.period);
        const result = await ta.sma(data, this.period);
        return result[result.length - 1];
    }

    async evaluate() {
        return await this.calcValue();
    }

    async evaluateDetailed(log: (msg: string) => void) {
        const value = await this.calcValue();
        log(`SMA(${this.period}) value: ${value.toFixed(2)}`);
        return value;
    }
}

export class LogicOpAST implements AST {
    operator: string;
    childA: AST;
    childB: AST
    constructor(operator: string, childA: AST, childB: AST) {
        this.operator = operator;
        this.childA = childA;
        this.childB = childB;
    }
    async evaluate() {
        const [a, b] = await Promise.all([
            this.childA.evaluate(),
            this.childB.evaluate()
        ]);
        switch (this.operator) {
            case 'and': return a && b;
            case 'or': return a || b;
            default: return false;
        }
    }

    async evaluateDetailed(log: (msg: string) => void) {
        const [a, b] = await Promise.all([
            this.childA.evaluateDetailed((msg:string) => log(msg)),
            this.childB.evaluateDetailed((msg:string) => log(msg))
        ]);
        let result: boolean;
        switch (this.operator) {
            case 'and': result = (a as boolean) && (b as boolean); break;
            case 'or': result = (a as boolean) || (b as boolean); break;
            default: result = false;
        }
        log(`LogicOp expr: ${a} ${this.operator} ${b} => ${result}`);
        return result;
    }
}

export class CompareAST implements AST {
    operator: string;
    childA: AST;
    childB: AST;
    constructor(operator: string, childA: AST, childB: AST) {
        this.operator = operator;
        this.childA = childA;
        this.childB = childB;
    }
    async evaluate() {
        const [a, b] = await Promise.all([
            this.childA.evaluate(),
            this.childB.evaluate()
        ]);
        switch (this.operator) {
            case '>': return (a as number) > (b as number);
            case '<': return (a as number) < (b as number);
            case '≥': return (a as number) >= (b as number);
            case '≤': return (a as number) <= (b as number);
            case '=': return (a as number) === (b as number);
            case '≠': return (a as number) !== (b as number);
            default: return false;
        }
    }

    async evaluateDetailed(log: (msg: string) => void) {
        const [a, b] = await Promise.all([
            this.childA.evaluateDetailed(log),
            this.childB.evaluateDetailed(log)
        ]);
        let result: boolean;
        switch (this.operator) {
            case '>': result = (a as number) > (b as number); break;
            case '<': result = (a as number) < (b as number); break;
            case '≥': result = (a as number) >= (b as number); break;
            case '≤': result = (a as number) <= (b as number); break;
            case '=': result = (a as number) === (b as number); break;
            case '≠': result = (a as number) !== (b as number); break;
            default: result = false;
        }
        log(`Compare expr: ${(a as number).toFixed(2)} ${this.operator} ${(b as number).toFixed(2)} => ${result}`);
        return result;
    }
}
