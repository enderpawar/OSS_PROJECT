import React, { useEffect, useState } from 'react';
import { unifiedAPI } from '../communicator/unified_api';

/**
 * API 키 설정 컴포넌트
 * - Upbit Access Key와 Secret Key를 입력받아 암호화 저장
 * - 저장된 키로 자동으로 자산 정보를 불러옴
 */
const ApiKeySettings = ({ onKeysSaved, logicId }) => {
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'
  const [isValid, setIsValid] = useState(null); // null | true | false

  // 저장된 키 프리필 + 최초 유효성 검사
  useEffect(() => {
    (async () => {
      try {
        const saved = unifiedAPI.loadApiKeys();
        if (saved && saved.accessKey && saved.secretKey) {
          setAccessKey(saved.accessKey);
          setSecretKey(saved.secretKey);
          await validateKeys(saved.accessKey, saved.secretKey);
        }
      } catch (e) {
        console.error('API 키 로드 실패:', e);
      }
    })();
  }, [logicId]);

  const validateKeys = async (aKey = accessKey, sKey = secretKey) => {
    if (!aKey?.trim() || !sKey?.trim()) {
      setIsValid(false);
      return false;
    }
    try {
      setValidating(true);
      setMessage('');
      
      // API 키 설정
      await unifiedAPI.setApiKeys(aKey, sKey);
      
      // 계좌 조회로 유효성 검증
      const result = await unifiedAPI.getAccounts();
      if (result.success) {
        setIsValid(true);
        return true;
      } else {
        setIsValid(false);
        return false;
      }
    } catch (e) {
      setIsValid(false);
      return false;
    } finally {
      setValidating(false);
    }
  };

  /**
   * API 키 저장 핸들러
   * - 입력 검증 후 Electron Main Process에 저장 요청
   */
  const handleSaveKeys = async () => {
    // 입력 검증
    if (!accessKey.trim() || !secretKey.trim()) {
      setMessage('Access Key와 Secret Key를 모두 입력해주세요.');
      setMessageType('error');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      // 로컬 스토리지에 저장
      unifiedAPI.saveApiKeys(accessKey, secretKey);
      
      // 백엔드에 API 키 설정
      const result = await unifiedAPI.setApiKeys(accessKey, secretKey);
      
      if (!result.success) {
        throw new Error(result.error || 'API 키 설정 실패');
      }

      setMessage('API 키가 안전하게 저장되었습니다!');
      setMessageType('success');

      // 저장 후 유효성 재검사
      await validateKeys(accessKey, secretKey);

      // 부모 컴포넌트에 저장 완료 알림
      if (onKeysSaved) {
        onKeysSaved(accessKey, secretKey, logicId || null);
      }
    } catch (error) {
      console.error('API 키 저장 실패:', error);
      setMessage('API 키 저장에 실패했습니다: ' + error.message);
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="api-key-settings w-[min(92vw,520px)] max-w-xl rounded-2xl shadow-2xl border border-neutral-800/70 bg-neutral-900/70 p-6 text-gray-200">
      <h2 className="text-xl font-bold mb-5 text-gray-100 flex items-center gap-2">
        ⚙️ Upbit API 키 설정
      </h2>

      {/* 상태 배지 */}
      <div className="mb-4 flex items-center gap-2 text-sm">
        <span className="text-gray-400">상태:</span>
        {isValid === null && (
          <span className="inline-flex items-center gap-2 px-2 py-1 rounded border border-neutral-700 bg-neutral-800 text-gray-300">Unknown</span>
        )}
        {isValid === true && (
          <span className="inline-flex items-center gap-2 px-2 py-1 rounded border border-cyan-600/40 bg-cyan-500/10 text-cyan-300">
            <span className="inline-block h-2 w-2 rounded-full bg-cyan-400"></span>
            Active
          </span>
        )}
        {isValid === false && (
          <span className="inline-flex items-center gap-2 px-2 py-1 rounded border border-red-600/40 bg-red-500/10 text-red-300">
            <span className="inline-block h-2 w-2 rounded-full bg-red-400"></span>
            Inactive
          </span>
        )}
      </div>

      <div className="mb-4">
        <label className="block mb-2 text-sm font-semibold text-gray-400">Access Key</label>
        <input
          type="text"
          value={accessKey}
          onChange={(e) => setAccessKey(e.target.value)}
          placeholder="Access Key를 입력하세요"
          className="w-full px-3 py-2 text-sm rounded-md bg-neutral-900 border border-neutral-700 text-gray-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400/50"
          disabled={isLoading}
        />
      </div>

      <div className="mb-4">
        <label className="block mb-2 text-sm font-semibold text-gray-400">Secret Key</label>
        <input
          type="password"
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          placeholder="Secret Key를 입력하세요"
          className="w-full px-3 py-2 text-sm rounded-md bg-neutral-900 border border-neutral-700 text-gray-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400/50"
          disabled={isLoading}
        />
      </div>

      <div className="flex gap-2 mt-1">
        <button
          onClick={handleSaveKeys}
          disabled={isLoading}
          className={`flex-1 py-3 rounded-md font-bold text-white transition-colors border border-transparent shadow-sm ${isLoading ? 'bg-neutral-700 cursor-not-allowed' : 'bg-cyan-600 hover:bg-cyan-500'}`}
        >
          {isLoading ? '저장 중...' : '저장하기'}
        </button>
        <button
          onClick={() => validateKeys()}
          disabled={validating}
          className={`w-[140px] py-3 rounded-md font-bold text-gray-100 transition-colors border border-neutral-700 shadow-sm ${validating ? 'bg-neutral-800 cursor-not-allowed' : 'bg-neutral-900 hover:bg-neutral-800'}`}
        >
          {validating ? '확인 중…' : '새로고침'}
        </button>
      </div>

      {message && (
        <div
          className={`mt-4 px-3 py-3 rounded-md text-sm border ${messageType === 'success' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-red-500/10 text-red-300 border-red-500/30'}`}
        >
          {message}
        </div>
      )}

      <div className="mt-5 px-3 py-3 rounded-lg bg-neutral-900 border border-neutral-800/70 flex items-start gap-3">
     
        <div className="text-[13px] text-gray-400 leading-relaxed">
          <p className="mb-1">💡 API 키는 암호화되어 안전하게 저장됩니다.</p>
          <p>📍 Upbit에서 API 키 생성 시 이 PC의 IP 주소를 등록해주세요.</p>
        </div>
      </div>
    </div>
  );
};

export default ApiKeySettings;
