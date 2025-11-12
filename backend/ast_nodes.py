"""
AST Nodes for Logic Interpretation
로직 트리 구조를 표현하는 AST 노드들
"""
from abc import ABC, abstractmethod
from typing import Union, List, Callable, Optional
import pandas as pd
import ta


class ASTNode(ABC):
    """AST 노드 베이스 클래스"""
    
    @abstractmethod
    async def evaluate(self) -> Union[float, bool]:
        """노드 평가"""
        pass
    
    @abstractmethod
    async def evaluate_detailed(self, log: Callable[[str], None]) -> Union[float, bool]:
        """상세 로그와 함께 노드 평가"""
        pass


class DataManager:
    """시장 데이터 관리자"""
    
    def __init__(self, upbit_api, stock: str = "KRW-BTC"):
        self.upbit_api = upbit_api
        self.stock = stock
        self.price_data: List[float] = []
        self.time_data: List[int] = []
        self.volume_data: List[float] = []
        self.highest_price_cache: dict = {}
        self.is_ready = False
    
    async def initialize(self):
        """초기 데이터 로드"""
        result = await self.upbit_api.fetch_candles(self.stock, interval=1, count=200)
        
        if result['success'] and result['data']:
            for candle in result['data']:
                self.time_data.append(candle['timestamp'])
                self.price_data.append(candle['price'])
                self.volume_data.append(candle['volume'])
        
        self.is_ready = True
    
    async def update_data(self):
        """데이터 업데이트 (최신 캔들 추가)"""
        result = await self.upbit_api.fetch_candles(self.stock, interval=1, count=1)
        
        if result['success'] and result['data']:
            candle = result['data'][0]
            self.time_data.append(candle['timestamp'])
            self.price_data.append(candle['price'])
            self.volume_data.append(candle['volume'])
    
    async def set_ready_highest_price(self, period_unit: str, period: int):
        """최고가 캐시 준비"""
        result = await self.upbit_api.get_highest_price(self.stock, period_unit, period)
        if result['success']:
            self.highest_price_cache[f"{period_unit}-{period}"] = result['price']
    
    def get_latest_price(self) -> float:
        """최신 가격 반환"""
        return self.price_data[-1] if self.price_data else 0.0
    
    def get_highest_price(self, period: str) -> float:
        """캐시된 최고가 반환"""
        return self.highest_price_cache.get(period, 0.0)
    
    def get_price_data_array(self) -> List[float]:
        """가격 데이터 배열 반환"""
        return self.price_data.copy()


class ConstantAST(ASTNode):
    """상수 노드"""
    
    def __init__(self, value: float):
        self.value = value
    
    async def evaluate(self) -> float:
        return self.value
    
    async def evaluate_detailed(self, log: Callable[[str], None]) -> float:
        log(f"Constant value: {self.value}")
        return self.value


class CurrentPriceAST(ASTNode):
    """현재가 노드"""
    
    def __init__(self, data_manager: DataManager):
        self.data_manager = data_manager
    
    async def evaluate(self) -> float:
        return self.data_manager.get_latest_price()
    
    async def evaluate_detailed(self, log: Callable[[str], None]) -> float:
        value = self.data_manager.get_latest_price()
        log(f"CurrentPrice value: {value:.2f}")
        return value


class HighestPriceAST(ASTNode):
    """최고가 노드"""
    
    def __init__(self, data_manager: DataManager, period_length: int, period_unit: str):
        self.data_manager = data_manager
        self.period_length = period_length
        self.period_unit = period_unit
        self.period_key = f"{period_unit}-{period_length}"
    
    async def evaluate(self) -> float:
        return self.data_manager.get_highest_price(self.period_key)
    
    async def evaluate_detailed(self, log: Callable[[str], None]) -> float:
        value = self.data_manager.get_highest_price(self.period_key)
        log(f"HighestPrice value: {value:.2f}")
        return value


class RsiAST(ASTNode):
    """RSI (Relative Strength Index) 노드"""
    
    def __init__(self, data_manager: DataManager, period: int = 14):
        self.data_manager = data_manager
        self.period = period
    
    async def evaluate(self) -> float:
        prices = self.data_manager.get_price_data_array()
        if len(prices) < self.period:
            return 50.0  # 기본값
        
        df = pd.DataFrame({'close': prices})
        rsi = ta.momentum.RSIIndicator(close=df['close'], window=self.period)
        result = rsi.rsi()
        
        return float(result.iloc[-1])
    
    async def evaluate_detailed(self, log: Callable[[str], None]) -> float:
        value = await self.evaluate()
        log(f"RSI value: {value:.2f}")
        return value


class SmaAST(ASTNode):
    """SMA (Simple Moving Average) 노드"""
    
    def __init__(self, data_manager: DataManager, period: int):
        self.data_manager = data_manager
        self.period = period
    
    async def evaluate(self) -> float:
        prices = self.data_manager.get_price_data_array()
        if len(prices) < self.period:
            return prices[-1] if prices else 0.0
        
        recent_prices = prices[-self.period:]
        return sum(recent_prices) / len(recent_prices)
    
    async def evaluate_detailed(self, log: Callable[[str], None]) -> float:
        value = await self.evaluate()
        log(f"SMA({self.period}) value: {value:.2f}")
        return value


class RoiAST(ASTNode):
    """ROI (Return on Investment) 노드"""
    
    def __init__(self, data_manager: DataManager):
        self.data_manager = data_manager
    
    async def evaluate(self) -> float:
        # 간단한 ROI 계산: (현재가 - 시작가) / 시작가 * 100
        prices = self.data_manager.get_price_data_array()
        if len(prices) < 2:
            return 0.0
        
        start_price = prices[0]
        current_price = prices[-1]
        
        if start_price == 0:
            return 0.0
        
        roi = ((current_price - start_price) / start_price) * 100
        return roi
    
    async def evaluate_detailed(self, log: Callable[[str], None]) -> float:
        value = await self.evaluate()
        log(f"ROI value: {value:.2f}%")
        return value


class CompareAST(ASTNode):
    """비교 연산 노드"""
    
    def __init__(self, operator: str, child_a: ASTNode, child_b: ASTNode):
        self.operator = operator
        self.child_a = child_a
        self.child_b = child_b
    
    async def evaluate(self) -> bool:
        a = await self.child_a.evaluate()
        b = await self.child_b.evaluate()
        
        if self.operator == '>':
            return float(a) > float(b)
        elif self.operator == '<':
            return float(a) < float(b)
        elif self.operator == '≥':
            return float(a) >= float(b)
        elif self.operator == '≤':
            return float(a) <= float(b)
        elif self.operator == '=':
            return float(a) == float(b)
        elif self.operator == '≠':
            return float(a) != float(b)
        else:
            return False
    
    async def evaluate_detailed(self, log: Callable[[str], None]) -> bool:
        a = await self.child_a.evaluate_detailed(log)
        b = await self.child_b.evaluate_detailed(log)
        
        result = False
        if self.operator == '>':
            result = float(a) > float(b)
        elif self.operator == '<':
            result = float(a) < float(b)
        elif self.operator == '≥':
            result = float(a) >= float(b)
        elif self.operator == '≤':
            result = float(a) <= float(b)
        elif self.operator == '=':
            result = float(a) == float(b)
        elif self.operator == '≠':
            result = float(a) != float(b)
        
        log(f"Compare expr: {float(a):.2f} {self.operator} {float(b):.2f} => {result}")
        return result


class LogicOpAST(ASTNode):
    """논리 연산 노드 (AND, OR)"""
    
    def __init__(self, operator: str, child_a: ASTNode, child_b: ASTNode):
        self.operator = operator
        self.child_a = child_a
        self.child_b = child_b
    
    async def evaluate(self) -> bool:
        a = await self.child_a.evaluate()
        b = await self.child_b.evaluate()
        
        if self.operator == 'and':
            return bool(a) and bool(b)
        elif self.operator == 'or':
            return bool(a) or bool(b)
        else:
            return False
    
    async def evaluate_detailed(self, log: Callable[[str], None]) -> bool:
        a = await self.child_a.evaluate_detailed(log)
        b = await self.child_b.evaluate_detailed(log)
        
        result = False
        if self.operator == 'and':
            result = bool(a) and bool(b)
        elif self.operator == 'or':
            result = bool(a) or bool(b)
        
        log(f"LogicOp expr: {a} {self.operator} {b} => {result}")
        return result
