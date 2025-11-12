"""
Logic Interpreter
로직 파싱 및 실행을 담당하는 인터프리터
"""
from typing import Dict, Any, Optional, Callable
from ast_nodes import (
    ASTNode, DataManager, ConstantAST, CurrentPriceAST, 
    HighestPriceAST, RsiAST, SmaAST, RoiAST,
    CompareAST, LogicOpAST
)


class OrderData:
    """주문 데이터"""
    
    def __init__(self):
        self.order_type: str = "market"
        self.limit_price: float = 0.0
        self.quantity: float = 0.0
    
    def init_from_controls(self, controls: Dict[str, Any]):
        """컨트롤 데이터로부터 초기화"""
        self.order_type = controls.get('orderType', 'market')
        self.limit_price = float(controls.get('limitPrice', 0))
        self.quantity = float(controls.get('sellPercent', 0))


class Interpreter:
    """로직 인터프리터"""
    
    def __init__(self, upbit_api, log_func: Optional[Callable[[str, str], None]] = None):
        self.upbit_api = upbit_api
        self.log_func = log_func or (lambda title, msg: None)
        
        self.parse_complete = False
        self.logic_id: Optional[str] = None
        self.stock = "KRW-BTC"
        
        self.buy_root: Optional[ASTNode] = None
        self.sell_root: Optional[ASTNode] = None
        
        self.buy_order_data = OrderData()
        self.sell_order_data = OrderData()
        
        self.data_manager = DataManager(upbit_api, self.stock)
    
    async def initialize(self):
        """데이터 매니저 초기화"""
        await self.data_manager.initialize()
    
    def set_stock(self, stock: str):
        """거래 종목 설정"""
        if self.stock != stock:
            self.stock = stock
            self.data_manager = DataManager(self.upbit_api, stock)
    
    def set_log_func(self, log_func: Callable[[str, str], None]):
        """로그 함수 설정"""
        self.log_func = log_func
    
    def parse(self, data: Dict[str, Any]):
        """로직 데이터 파싱"""
        self.buy_root = None
        self.sell_root = None
        
        try:
            self._try_parse(data)
            self.parse_complete = True
        except Exception as e:
            self.log_func("Error", str(e))
            self.parse_complete = False
    
    def _try_parse(self, data: Dict[str, Any]):
        """파싱 시도"""
        buy_graph = data.get('buyGraph', {})
        sell_graph = data.get('sellGraph', {})
        
        buy_nodes = buy_graph.get('nodes', [])
        sell_nodes = sell_graph.get('nodes', [])
        
        buy_node = next((n for n in buy_nodes if n.get('kind') == 'buy'), None)
        sell_node = next((n for n in sell_nodes if n.get('kind') == 'sell'), None)
        
        if not buy_node and not sell_node:
            raise ValueError("매수/매도 노드가 모두 없습니다. 적어도 하나의 로직이 필요합니다.")
        
        if buy_node:
            self._parse_buy(buy_node, buy_graph)
        
        if sell_node:
            self._parse_sell(sell_node, sell_graph)
    
    def _parse_buy(self, buy_node: Dict[str, Any], buy_graph: Dict[str, Any]):
        """매수 로직 파싱"""
        self.buy_order_data.init_from_controls(buy_node.get('controls', {}))
        
        nodes = {n['id']: n for n in buy_graph.get('nodes', [])}
        connections = {}
        
        for conn in buy_graph.get('connections', []):
            target = conn['target']
            if target not in connections:
                connections[target] = []
            connections[target].append(conn['source'])
        
        buy_node_children = connections.get(buy_node['id'], [])
        if not buy_node_children:
            raise ValueError("매수 노드에 연결된 조건이 없습니다.")
        
        self.buy_root = self._parse_recursive(buy_node_children[0], nodes, connections, True)
    
    def _parse_sell(self, sell_node: Dict[str, Any], sell_graph: Dict[str, Any]):
        """매도 로직 파싱"""
        self.sell_order_data.init_from_controls(sell_node.get('controls', {}))
        
        nodes = {n['id']: n for n in sell_graph.get('nodes', [])}
        connections = {}
        
        for conn in sell_graph.get('connections', []):
            target = conn['target']
            if target not in connections:
                connections[target] = []
            connections[target].append(conn['source'])
        
        sell_node_children = connections.get(sell_node['id'], [])
        if not sell_node_children:
            raise ValueError("매도 노드에 연결된 조건이 없습니다.")
        
        self.sell_root = self._parse_recursive(sell_node_children[0], nodes, connections, False)
    
    def _parse_recursive(
        self, 
        node_id: str, 
        nodes: Dict[str, Any], 
        connections: Dict[str, list],
        is_buy_graph: bool
    ) -> ASTNode:
        """재귀적 AST 파싱"""
        node = nodes[node_id]
        kind = node.get('kind')
        controls = node.get('controls', {})
        
        if kind == 'const':
            value = self._try_parse_int(controls.get('value', 0))
            return ConstantAST(value)
        
        elif kind == 'currentPrice':
            return CurrentPriceAST(self.data_manager)
        
        elif kind == 'highestPrice':
            period_length = self._try_parse_int(controls.get('periodLength', 1))
            period_unit = controls.get('periodUnit', 'minutes')
            return HighestPriceAST(self.data_manager, period_length, period_unit)
        
        elif kind == 'rsi':
            return RsiAST(self.data_manager)
        
        elif kind == 'sma':
            period = self._try_parse_int(controls.get('period', 20))
            if period > 200:
                raise ValueError("SMA 기간은 최대 200까지 설정할 수 있습니다.")
            return SmaAST(self.data_manager, period)
        
        elif kind == 'roi':
            return RoiAST(self.data_manager)
        
        elif kind == 'logicOp':
            children = connections.get(node_id, [])
            if len(children) < 2:
                raise ValueError("논리 노드에 피연산자 노드가 부족합니다.")
            
            operator = controls.get('operator', 'and')
            child_a = self._parse_recursive(children[0], nodes, connections, is_buy_graph)
            child_b = self._parse_recursive(children[1], nodes, connections, is_buy_graph)
            
            return LogicOpAST(operator, child_a, child_b)
        
        elif kind == 'compare':
            children = connections.get(node_id, [])
            if len(children) < 2:
                raise ValueError("비교 노드에 피연산자 노드가 부족합니다.")
            
            operator = controls.get('operator', '>')
            child_a = self._parse_recursive(children[0], nodes, connections, is_buy_graph)
            child_b = self._parse_recursive(children[1], nodes, connections, is_buy_graph)
            
            return CompareAST(operator, child_a, child_b)
        
        else:
            raise ValueError(f"알 수 없는 노드 종류: {kind}")
    
    @staticmethod
    def _try_parse_int(value: Any) -> int:
        """정수 파싱"""
        try:
            return int(value)
        except (ValueError, TypeError):
            raise ValueError(f"숫자 형식이 올바르지 않습니다: {value}")
    
    async def run(self, log_details: bool = False):
        """로직 실행"""
        if not self.parse_complete:
            return
        
        # 데이터 준비 대기
        if not self.data_manager.is_ready:
            await self.data_manager.initialize()
        
        # 매수 로직 실행
        if self.buy_root:
            await self._run_buy(log_details)
        
        # 매도 로직 실행
        if self.sell_root:
            await self._run_sell(log_details)
    
    async def _run_buy(self, log_details: bool):
        """매수 로직 실행"""
        if log_details:
            result = await self.buy_root.evaluate_detailed(
                lambda msg: self.log_func("BuyGraph", msg)
            )
        else:
            result = await self.buy_root.evaluate()
        
        if result:
            await self._do_buy()
        else:
            self.log_func("BuyGraph", "매수 조건 미충족")
    
    async def _run_sell(self, log_details: bool):
        """매도 로직 실행"""
        if log_details:
            result = await self.sell_root.evaluate_detailed(
                lambda msg: self.log_func("SellGraph", msg)
            )
        else:
            result = await self.sell_root.evaluate()
        
        if result:
            await self._do_sell()
        else:
            self.log_func("SellGraph", "매도 조건 미충족")
    
    async def _do_buy(self):
        """매수 실행"""
        order_type = self.buy_order_data.order_type
        quantity = self.buy_order_data.quantity
        limit_price = self.buy_order_data.limit_price
        
        if order_type == 'market':
            self.log_func("BuyGraph", f"시장가 {quantity}₩어치 매수를 시도합니다.")
            result = await self.upbit_api.market_buy(self.stock, quantity)
            
            if result['success']:
                self.log_func("BuyGraph", f"시장가 {quantity}₩어치 매수 완료")
            else:
                self.log_func("BuyGraph", f"시장가 매수 실패: {result.get('error')}")
        
        else:  # limit order
            self.log_func("BuyGraph", f"지정가 {limit_price}₩에 {quantity}₩어치 매수를 시도합니다.")
            
            # 지정가는 수량을 계산해야 함
            volume = quantity / limit_price
            result = await self.upbit_api.limit_buy(self.stock, limit_price, volume)
            
            if result['success']:
                self.log_func("BuyGraph", f"지정가 {limit_price}₩에 {quantity}₩어치 매수 완료")
            else:
                self.log_func("BuyGraph", f"지정가 매수 실패: {result.get('error')}")
    
    async def _do_sell(self):
        """매도 실행"""
        order_type = self.sell_order_data.order_type
        quantity = self.sell_order_data.quantity
        limit_price = self.sell_order_data.limit_price
        
        if order_type == 'market':
            self.log_func("SellGraph", f"시장가 {quantity}₩어치 매도를 시도합니다.")
            
            # 시장가 매도는 수량 필요
            current_price = self.data_manager.get_latest_price()
            volume = quantity / current_price
            result = await self.upbit_api.market_sell(self.stock, volume)
            
            if result['success']:
                self.log_func("SellGraph", f"시장가 {quantity}₩어치 매도 완료")
            else:
                self.log_func("SellGraph", f"시장가 매도 실패: {result.get('error')}")
        
        else:  # limit order
            self.log_func("SellGraph", f"지정가 {limit_price}₩에 {quantity}₩어치 매도 시도")
            
            volume = quantity / limit_price
            result = await self.upbit_api.limit_sell(self.stock, limit_price, volume)
            
            if result['success']:
                self.log_func("SellGraph", f"지정가 {limit_price}₩에 {quantity}₩어치 매도 완료")
            else:
                self.log_func("SellGraph", f"지정가 매도 실패: {result.get('error')}")
