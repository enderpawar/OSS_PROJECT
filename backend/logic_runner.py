"""
Logic Runner Manager
여러 로직을 동시에 실행하고 관리하는 매니저
"""
import asyncio
from typing import Dict, Optional, Callable, Any
from datetime import datetime
from interpreter import Interpreter


class RunningLogic:
    """실행 중인 로직 정보"""
    
    def __init__(
        self, 
        logic_id: str, 
        stock: str, 
        interpreter: Interpreter,
        interval: float,
        task: asyncio.Task
    ):
        self.logic_id = logic_id
        self.stock = stock
        self.interpreter = interpreter
        self.interval = interval
        self.task = task
        self.start_time = datetime.now()
        self.is_running = True
    
    def stop(self):
        """로직 실행 중지"""
        self.is_running = False
        if not self.task.cancelled():
            self.task.cancel()


class LogicRunner:
    """로직 실행 관리자"""
    
    def __init__(self, upbit_api):
        self.upbit_api = upbit_api
        self.running_logics: Dict[str, RunningLogic] = {}
        self.log_callbacks: Dict[str, Callable[[str, str], None]] = {}
    
    async def start_logic(
        self,
        logic_id: str,
        stock: str,
        logic_data: Dict[str, Any],
        log_func: Callable[[str, str], None],
        log_details: bool = False,
        interval: float = 5.0  # seconds
    ) -> bool:
        """
        로직 실행 시작
        
        Args:
            logic_id: 로직 고유 ID
            stock: 거래 종목 (예: KRW-BTC)
            logic_data: 로직 데이터 (buyGraph, sellGraph 포함)
            log_func: 로그 콜백 함수
            log_details: 상세 로그 여부
            interval: 실행 간격 (초)
        
        Returns:
            성공 여부
        """
        # 이미 실행 중인지 확인
        if logic_id in self.running_logics:
            log_func("Error", f"로직 ID '{logic_id}'는 이미 실행 중입니다.")
            return False
        
        try:
            # Interpreter 생성 및 초기화
            interpreter = Interpreter(self.upbit_api, log_func)
            interpreter.set_stock(stock)
            interpreter.parse(logic_data)
            
            if not interpreter.parse_complete:
                log_func("Error", "로직 파싱에 실패했습니다.")
                return False
            
            # 데이터 매니저 초기화
            await interpreter.initialize()
            
            # 로그 콜백 저장
            self.log_callbacks[logic_id] = log_func
            
            # 실행 태스크 생성
            task = asyncio.create_task(
                self._run_logic_loop(logic_id, interpreter, log_details, interval)
            )
            
            # 실행 정보 저장
            running_logic = RunningLogic(logic_id, stock, interpreter, interval, task)
            self.running_logics[logic_id] = running_logic
            
            log_func("System", f"로직 '{logic_id}' 실행 시작 ({interval}초 간격)")
            return True
        
        except Exception as e:
            log_func("Error", f"로직 시작 실패: {str(e)}")
            return False
    
    async def _run_logic_loop(
        self,
        logic_id: str,
        interpreter: Interpreter,
        log_details: bool,
        interval: float
    ):
        """로직 실행 루프"""
        running_logic = self.running_logics.get(logic_id)
        log_func = self.log_callbacks.get(logic_id)
        
        try:
            while running_logic and running_logic.is_running:
                try:
                    # 로직 실행
                    await interpreter.run(log_details)
                    
                    # 다음 실행까지 대기
                    await asyncio.sleep(interval)
                
                except asyncio.CancelledError:
                    if log_func:
                        log_func("System", f"로직 '{logic_id}' 실행 취소됨")
                    break
                
                except Exception as e:
                    if log_func:
                        log_func("Error", f"로직 실행 중 오류: {str(e)}")
                    # 오류 발생 시에도 계속 실행
                    await asyncio.sleep(interval)
        
        finally:
            # 정리
            if log_func:
                log_func("System", f"로직 '{logic_id}' 실행 종료")
    
    def stop_logic(self, logic_id: str) -> bool:
        """
        로직 실행 중지
        
        Args:
            logic_id: 중지할 로직 ID
        
        Returns:
            성공 여부
        """
        running_logic = self.running_logics.get(logic_id)
        
        if not running_logic:
            return False
        
        # 로직 중지
        running_logic.stop()
        
        # 정리
        del self.running_logics[logic_id]
        
        log_func = self.log_callbacks.get(logic_id)
        if log_func:
            log_func("System", f"로직 '{logic_id}' 실행 중지")
            del self.log_callbacks[logic_id]
        
        return True
    
    def stop_all_logics(self):
        """모든 로직 중지"""
        logic_ids = list(self.running_logics.keys())
        for logic_id in logic_ids:
            self.stop_logic(logic_id)
    
    def get_running_logic(self, logic_id: str) -> Optional[Dict[str, Any]]:
        """실행 중인 로직 정보 조회"""
        running_logic = self.running_logics.get(logic_id)
        
        if not running_logic:
            return None
        
        return {
            'logicId': running_logic.logic_id,
            'stock': running_logic.stock,
            'interval': running_logic.interval,
            'startTime': running_logic.start_time.isoformat(),
            'isRunning': running_logic.is_running
        }
    
    def get_all_running_logics(self) -> list:
        """모든 실행 중인 로직 목록 조회"""
        return [
            self.get_running_logic(logic_id)
            for logic_id in self.running_logics.keys()
        ]
    
    def is_running(self, logic_id: str) -> bool:
        """로직 실행 중 여부 확인"""
        return logic_id in self.running_logics
