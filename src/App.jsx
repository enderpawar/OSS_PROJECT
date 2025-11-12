import { useState, useEffect, useRef } from 'react';
import AssetPage from './components/AssetPage';
import LogicEditorPage from './components/LogicEditorPage';
import { getMyAssetsWithKeys } from './communicator/upbit_api';
import { unifiedAPI } from './communicator/unified_api';

// ----------------------------------------------------------------
// App: 페이지 라우팅을 담당하는 메인 컴포넌트
// ----------------------------------------------------------------
const App = () => {
  const [currentPage, setCurrentPage] = useState('asset'); // 'asset' or 'editor'
  const [selectedLogicId, setSelectedLogicId] = useState(null);
  const [newLogicName, setNewLogicName] = useState('');
  // logics는 요약 메타만 보관: {id,name,stock?,order}
  const [logics, setLogics] = useState([]);
  const [assets, setAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetsError, setAssetsError] = useState(null);

  // API 키 관련 상태
  const [hasApiKeys, setHasApiKeys] = useState(false);
  const [showApiKeySettings, setShowApiKeySettings] = useState(false);

  // 테마 관련 상태
  const [theme, setTheme] = useState('dark'); // 'dark' | 'light'

  // 전역 실행 중인 로직 상태
  const [runningLogics, setRunningLogics] = useState([]);
  const [runIntervalSeconds, setRunIntervalSeconds] = useState(5); // 기본 5초

  // 데이터 로딩 및 초기화
  useEffect(() => {
    // 초기 테마 설정
    const preferDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(preferDark ? 'dark' : 'light');

    // 로컬 스토리지에서 로직 목록 로드
    const bootstrapLogics = () => {
      try {
        const savedLogics = localStorage.getItem('userLogics');
        if (savedLogics) {
          const logicList = JSON.parse(savedLogics);
          setLogics(logicList.map(l => ({
            id: l.id,
            name: l.name,
            stock: l.stock,
            order: l.order || 0
          })));
        } else {
          setLogics([]);
        }
      } catch (e) {
        console.error('로직 목록 로드 실패:', e);
        setLogics([]);
      }
    };
    bootstrapLogics();

    const loadKeysAndFetchAssets = async () => {
      try {
        // 저장된 API 키 불러오기
        const savedKeys = unifiedAPI.loadApiKeys();

        if (savedKeys && savedKeys.accessKey && savedKeys.secretKey) {
          console.log("저장된 API 키를 찾았습니다. 자산 정보를 가져옵니다.");
          setHasApiKeys(true);

          try {
            const data = await getMyAssetsWithKeys(savedKeys.accessKey, savedKeys.secretKey);
            console.log("자산 정보 조회 성공!", data);
            setAssets(data);
            setAssetsError(null);
          } catch (error) {
            console.error("자산 정보 조회 실패:", error);
            setAssetsError('자산 정보를 불러오는 데 실패했습니다. API 키가 정확한지, IP 주소가 등록되었는지 확인해주세요.');
          }
        } else {
          console.log("저장된 API 키가 없습니다. 설정이 필요합니다.");
          setHasApiKeys(false);
          setShowApiKeySettings(true);
          setAssetsError('API 키가 설정되지 않았습니다. 설정 버튼을 눌러 키를 입력해주세요.');
        }
      } catch (error) {
        console.error("API 키 불러오기 실패:", error);
        setAssetsError('API 키를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setAssetsLoading(false);
      }
    };

    loadKeysAndFetchAssets();
  }, []);

  // 실행 중인 로직 상태를 주기적으로 동기화 (Python 백엔드)
  useEffect(() => {
    const syncInterval = setInterval(async () => {
      try {
        const result = await unifiedAPI.getRunningLogics();
        if (result.success && result.data) {
          setRunningLogics(result.data);
        }
      } catch (error) {
        console.error('실행 중인 로직 조회 실패:', error);
      }
    }, 1000);

    return () => clearInterval(syncInterval);
  }, []);

  // 테마를 documentElement에 반영
  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
      // localStorage에 테마 저장
      localStorage.setItem('theme', theme);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  }, [theme]);

  const handleLogicClick = (logicId) => {
    setSelectedLogicId(logicId);
    setCurrentPage('editor');
  };

  const handleAddNewLogic = (name) => {
    setSelectedLogicId(null);
    setNewLogicName(name || '');
    setCurrentPage('editor');
  };

  const handleBackToAssetPage = () => {
    setCurrentPage('asset');
    setSelectedLogicId(null);
    setNewLogicName('');
  };
    
  const handleSaveLogic = async (updatedLogic) => {
    try {
      // 로컬 스토리지에 로직 저장
      const savedLogics = localStorage.getItem('userLogics');
      const logicList = savedLogics ? JSON.parse(savedLogics) : [];
      
      const existingIndex = logicList.findIndex(l => l.id === updatedLogic.id);
      
      if (existingIndex >= 0) {
        // 기존 로직 업데이트
        logicList[existingIndex] = updatedLogic;
      } else {
        // 새 로직 추가
        logicList.push(updatedLogic);
      }
      
      localStorage.setItem('userLogics', JSON.stringify(logicList));
      
      // 메타 정보 업데이트
      setLogics((prev) =>
        prev.map((l) =>
          l.id === updatedLogic.id
            ? { ...l, name: updatedLogic.name || l.name, stock: updatedLogic.stock }
            : l
        )
      );
      
      // 새 로직인 경우 목록에 추가
      if (existingIndex < 0) {
        setLogics((prev) => [
          ...prev,
          {
            id: updatedLogic.id,
            name: updatedLogic.name,
            stock: updatedLogic.stock,
            order: updatedLogic.order || prev.length
          }
        ]);
      }
    } catch (error) {
      console.error('로직 저장 실패:', error);
    }
  };

  const handleDeleteLogic = async (logicIdToDelete) => {
    try {
      // 로컬 스토리지에서 로직 삭제
      const savedLogics = localStorage.getItem('userLogics');
      if (savedLogics) {
        const logicList = JSON.parse(savedLogics);
        const updatedList = logicList.filter(l => l.id !== logicIdToDelete);
        localStorage.setItem('userLogics', JSON.stringify(updatedList));
      }
      
      // UI 업데이트
      setLogics((prev) => prev.filter((l) => l.id !== logicIdToDelete));
      console.log('로직이 삭제되었습니다.');
    } catch (error) {
      console.error('로직 삭제 실패:', error);
    }
  };

  /**
   * API 키 저장 후 호출되는 핸들러
   * - 저장된 키로 자산 정보를 다시 불러옴
   */
  const handleApiKeysSaved = async (accessKey, secretKey) => {
    setAssetsLoading(true);
    setShowApiKeySettings(false);

    try {
      const data = await getMyAssetsWithKeys(accessKey, secretKey);
      console.log("API 키 저장 후 자산 정보 조회 성공:", data);
      setAssets(data);
      setAssetsError(null);
      setHasApiKeys(true);
    } catch (error) {
      console.error("자산 정보 조회 실패:", error);
      setAssetsError('자산 정보를 불러오는 데 실패했습니다. API 키가 정확한지 확인해주세요.');
    } finally {
      setAssetsLoading(false);
    }
  };

  /**
   * 자산 정보 새로고침 핸들러
   * - 저장된 API 키로 자산 정보를 다시 불러옴
   */
  const handleRefreshAssets = async () => {
    setAssetsLoading(true);
    setAssetsError(null);

    try {
      // 저장된 API 키 불러오기
      const savedKeys = await unifiedAPI.loadApiKeys();

      if (!savedKeys || !savedKeys.accessKey || !savedKeys.secretKey) {
        setAssetsError('저장된 API 키가 없습니다. API 키를 먼저 설정해주세요.');
        setShowApiKeySettings(true);
        return;
      }

      // 자산 정보 다시 불러오기
      const data = await getMyAssetsWithKeys(savedKeys.accessKey, savedKeys.secretKey);
      console.log("자산 정보 새로고침 성공:", data);
      setAssets(data);
      setAssetsError(null);
    } catch (error) {
      console.error("자산 정보 새로고침 실패:", error);
      setAssetsError('자산 정보를 새로고침하는 데 실패했습니다. API 키를 확인해주세요.');
    } finally {
      setAssetsLoading(false);
    }
  };

  /**
   * 로직 실행 중지 핸들러
   */
  const handleStopLogic = async (logicId) => {
    try {
      await unifiedAPI.stopLogic(logicId);
      // 중지 후 running logics 상태 동기화
      const running = await unifiedAPI.getRunningLogics();
      setRunningLogics(running);
    } catch (error) {
      console.error('Failed to stop logic:', error);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen font-sans bg-transparent">

      {/* Theme Toggle */}
      {currentPage === 'asset' && (
        <div style={{ position: 'fixed', top: 14, right: 14, zIndex: 1000 }}>
          <button
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid var(--panel-border)',
              background: 'var(--panel-bg)',
              color: 'var(--text-primary)',
              boxShadow: '0 6px 20px rgba(0,0,0,0.12)'
            }}
            title="테마 전환 (Dark/Light)"
          >
            {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>
      )}
      {currentPage === 'asset' ? (
        <AssetPage
          logics={logics}
          assets={assets}
          assetsLoading={assetsLoading}
          assetsError={assetsError}
          runningLogics={runningLogics}
          runIntervalSeconds={runIntervalSeconds}
          onRunIntervalChange={setRunIntervalSeconds}
          onStopLogic={handleStopLogic}
          onLogicClick={handleLogicClick}
          onAddNewLogic={handleAddNewLogic}
          onDeleteLogic={handleDeleteLogic}
          onReorderLogics={async (items)=>{
            // items: [{id,name,stock?,order?, _temp?}]
            setLogics(items);
            // 임시 항목이 있으면 저장하지 않음
            if (items.some((i)=> i && i._temp)) return;
            try {
              // localStorage에 재정렬된 순서 저장
              localStorage.setItem('userLogics', JSON.stringify(items));
            } catch (error) {
              console.error('Failed to save reordered logics:', error);
            }
          }}
          onCreateLogic={async (name)=>{
            try {
              // 새 로직 생성
              const newLogic = {
                id: `logic_${Date.now()}`,
                name: name,
                createdAt: new Date().toISOString(),
                data: null
              };
              
              // 로직 목록에 추가
              const updatedLogics = [...logics, newLogic];
              setLogics(updatedLogics);
              
              // localStorage에 저장
              localStorage.setItem('userLogics', JSON.stringify(updatedLogics));
            } catch (error) {
              console.error('Failed to create logic:', error);
            }
          }}
          onRefreshAssets={handleRefreshAssets}
          onOpenApiKeySettings={() => setShowApiKeySettings(true)}
          showApiKeySettings={showApiKeySettings}
          onCloseApiKeySettings={() => setShowApiKeySettings(false)}
          onApiKeysSaved={handleApiKeysSaved}
        />
      ) : (
        <LogicEditorPage
          selectedLogicId={selectedLogicId}
          runningLogics={runningLogics}
          runIntervalSeconds={runIntervalSeconds}
          onRunIntervalChange={setRunIntervalSeconds}
          onStopLogic={handleStopLogic}
          onBack={handleBackToAssetPage}
          onSave={handleSaveLogic}
          defaultNewLogicName={newLogicName}
        />
      )}
    </div>
  );
};

export default App;