"""
Upbit API Client
업비트 API 통신을 담당하는 모듈
"""
import jwt
import hashlib
import uuid
from urllib.parse import urlencode, unquote
import httpx
from typing import Optional, Dict, Any, List
import time


class UpbitAPI:
    """Upbit API 클라이언트"""
    
    BASE_URL = "https://api.upbit.com/v1"
    
    def __init__(self, access_key: Optional[str] = None, secret_key: Optional[str] = None):
        """
        Args:
            access_key: Upbit API Access Key
            secret_key: Upbit API Secret Key
        """
        self.access_key = access_key
        self.secret_key = secret_key
        self.client = httpx.AsyncClient(timeout=30.0)
    
    def _generate_jwt_token(self, query_params: Optional[Dict] = None) -> str:
        """JWT 토큰 생성"""
        payload = {
            'access_key': self.access_key,
            'nonce': str(uuid.uuid4()),
        }
        
        if query_params:
            query_string = unquote(urlencode(query_params, doseq=True)).encode("utf-8")
            m = hashlib.sha512()
            m.update(query_string)
            query_hash = m.hexdigest()
            payload['query_hash'] = query_hash
            payload['query_hash_alg'] = 'SHA512'
        
        return jwt.encode(payload, self.secret_key, algorithm='HS256')
    
    async def fetch_candles(
        self, 
        market: str = "KRW-BTC", 
        interval: int = 1, 
        count: int = 200
    ) -> Dict[str, Any]:
        """
        캔들 데이터 조회
        
        Args:
            market: 마켓 코드 (예: KRW-BTC)
            interval: 분 단위 (1, 3, 5, 10, 15, 30, 60, 240)
            count: 조회할 캔들 개수
        
        Returns:
            {'success': bool, 'data': List[Dict], 'error': Optional[str]}
        """
        try:
            url = f"{self.BASE_URL}/candles/minutes/{interval}"
            params = {
                'market': market,
                'count': count
            }
            
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            
            candles_data = response.json()
            
            # 데이터 변환 (최신 -> 과거 순서를 과거 -> 최신으로 뒤집기)
            formatted_data = [
                {
                    'timestamp': candle['timestamp'],
                    'price': float(candle['trade_price']),
                    'volume': float(candle['candle_acc_trade_volume']),
                    'high': float(candle['high_price']),
                    'low': float(candle['low_price']),
                    'open': float(candle['opening_price'])
                }
                for candle in reversed(candles_data)
            ]
            
            return {
                'success': True,
                'data': formatted_data
            }
            
        except Exception as e:
            return {
                'success': False,
                'data': [],
                'error': str(e)
            }
    
    async def get_current_price(self, market: str = "KRW-BTC") -> Dict[str, Any]:
        """
        현재가 조회
        
        Args:
            market: 마켓 코드
        
        Returns:
            {'success': bool, 'price': float, 'error': Optional[str]}
        """
        try:
            url = f"{self.BASE_URL}/ticker"
            params = {'markets': market}
            
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            
            data = response.json()[0]
            
            return {
                'success': True,
                'price': float(data['trade_price'])
            }
            
        except Exception as e:
            return {
                'success': False,
                'price': 0,
                'error': str(e)
            }
    
    async def get_highest_price(
        self, 
        market: str, 
        period_unit: str, 
        period: int
    ) -> Dict[str, Any]:
        """
        특정 기간 내 최고가 조회
        
        Args:
            market: 마켓 코드
            period_unit: 기간 단위 ('minutes', 'hours', 'days')
            period: 기간 길이
        
        Returns:
            {'success': bool, 'price': float, 'error': Optional[str]}
        """
        try:
            # period_unit에 따라 interval 설정
            interval_map = {
                'minutes': 1,
                'hours': 60,
                'days': 1440  # 일봉은 별도 API 사용 필요
            }
            interval = interval_map.get(period_unit, 1)
            
            candles_result = await self.fetch_candles(market, interval, period)
            
            if not candles_result['success']:
                return candles_result
            
            candles = candles_result['data']
            if not candles:
                return {
                    'success': False,
                    'price': 0,
                    'error': 'No candle data available'
                }
            
            highest_price = max(candle['high'] for candle in candles)
            
            return {
                'success': True,
                'price': highest_price
            }
            
        except Exception as e:
            return {
                'success': False,
                'price': 0,
                'error': str(e)
            }
    
    async def market_buy(self, market: str, price: float) -> Dict[str, Any]:
        """
        시장가 매수
        
        Args:
            market: 마켓 코드
            price: 매수 금액 (KRW)
        
        Returns:
            {'success': bool, 'order_id': Optional[str], 'error': Optional[str]}
        """
        if not self.access_key or not self.secret_key:
            return {
                'success': False,
                'error': 'API keys not configured'
            }
        
        try:
            query = {
                'market': market,
                'side': 'bid',
                'price': str(price),
                'ord_type': 'price'
            }
            
            token = self._generate_jwt_token(query)
            headers = {'Authorization': f'Bearer {token}'}
            
            url = f"{self.BASE_URL}/orders"
            response = await self.client.post(url, json=query, headers=headers)
            response.raise_for_status()
            
            result = response.json()
            
            return {
                'success': True,
                'order_id': result.get('uuid'),
                'data': result
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    async def market_sell(self, market: str, volume: float) -> Dict[str, Any]:
        """
        시장가 매도
        
        Args:
            market: 마켓 코드
            volume: 매도 수량
        
        Returns:
            {'success': bool, 'order_id': Optional[str], 'error': Optional[str]}
        """
        if not self.access_key or not self.secret_key:
            return {
                'success': False,
                'error': 'API keys not configured'
            }
        
        try:
            query = {
                'market': market,
                'side': 'ask',
                'volume': str(volume),
                'ord_type': 'market'
            }
            
            token = self._generate_jwt_token(query)
            headers = {'Authorization': f'Bearer {token}'}
            
            url = f"{self.BASE_URL}/orders"
            response = await self.client.post(url, json=query, headers=headers)
            response.raise_for_status()
            
            result = response.json()
            
            return {
                'success': True,
                'order_id': result.get('uuid'),
                'data': result
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    async def limit_buy(
        self, 
        market: str, 
        price: float, 
        volume: float
    ) -> Dict[str, Any]:
        """
        지정가 매수
        
        Args:
            market: 마켓 코드
            price: 주문 가격
            volume: 주문 수량
        
        Returns:
            {'success': bool, 'order_id': Optional[str], 'error': Optional[str]}
        """
        if not self.access_key or not self.secret_key:
            return {
                'success': False,
                'error': 'API keys not configured'
            }
        
        try:
            query = {
                'market': market,
                'side': 'bid',
                'volume': str(volume),
                'price': str(price),
                'ord_type': 'limit'
            }
            
            token = self._generate_jwt_token(query)
            headers = {'Authorization': f'Bearer {token}'}
            
            url = f"{self.BASE_URL}/orders"
            response = await self.client.post(url, json=query, headers=headers)
            response.raise_for_status()
            
            result = response.json()
            
            return {
                'success': True,
                'order_id': result.get('uuid'),
                'data': result
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    async def limit_sell(
        self, 
        market: str, 
        price: float, 
        volume: float
    ) -> Dict[str, Any]:
        """
        지정가 매도
        
        Args:
            market: 마켓 코드
            price: 주문 가격
            volume: 주문 수량
        
        Returns:
            {'success': bool, 'order_id': Optional[str], 'error': Optional[str]}
        """
        if not self.access_key or not self.secret_key:
            return {
                'success': False,
                'error': 'API keys not configured'
            }
        
        try:
            query = {
                'market': market,
                'side': 'ask',
                'volume': str(volume),
                'price': str(price),
                'ord_type': 'limit'
            }
            
            token = self._generate_jwt_token(query)
            headers = {'Authorization': f'Bearer {token}'}
            
            url = f"{self.BASE_URL}/orders"
            response = await self.client.post(url, json=query, headers=headers)
            response.raise_for_status()
            
            result = response.json()
            
            return {
                'success': True,
                'order_id': result.get('uuid'),
                'data': result
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    async def get_accounts(self) -> Dict[str, Any]:
        """
        계좌 정보 조회
        
        Returns:
            {'success': bool, 'accounts': List[Dict], 'error': Optional[str]}
        """
        if not self.access_key or not self.secret_key:
            return {
                'success': False,
                'accounts': [],
                'error': 'API keys not configured'
            }
        
        try:
            token = self._generate_jwt_token()
            headers = {'Authorization': f'Bearer {token}'}
            
            url = f"{self.BASE_URL}/accounts"
            response = await self.client.get(url, headers=headers)
            response.raise_for_status()
            
            accounts = response.json()
            
            return {
                'success': True,
                'accounts': accounts
            }
            
        except Exception as e:
            return {
                'success': False,
                'accounts': [],
                'error': str(e)
            }
    
    async def close(self):
        """HTTP 클라이언트 종료"""
        await self.client.aclose()
