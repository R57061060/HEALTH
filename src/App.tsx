import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Database, 
  HardDrive, 
  LogOut, 
  RefreshCw, 
  Sliders, 
  Calendar, 
  Flame, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  Link2,
  FileSpreadsheet,
  AlertTriangle,
  FolderSync,
  HelpCircle,
  TrendingUp,
  Menu,
  X
} from 'lucide-react';

import { UserProfile, BodyMetricEntry, CalorieEntry } from './types';
import { initAuth, googleSignIn, logout } from './lib/firebase';
import { 
  initializeSpreadsheet, 
  createNewSpreadsheet, 
  fetchUserProfile, 
  saveUserProfile, 
  fetchBodyMetrics, 
  upsertBodyMetric, 
  fetchCalorieLogs, 
  addCalorieLog, 
  deleteCalorieLog, 
  backupDataToDrive, 
  DEFAULT_SPREADSHEET_ID, 
  DEFAULT_DRIVE_FOLDER_ID 
} from './lib/googleSheets';

import Dashboard from './components/Dashboard';
import MetricsLog from './components/MetricsLog';
import CaloriesJournal from './components/CaloriesJournal';
import ProfileSettings from './components/ProfileSettings';

export default function App() {
  // Auth State
  const [user, setUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Database Connection State
  const [spreadsheetId, setSpreadsheetId] = useState(DEFAULT_SPREADSHEET_ID);
  const [driveFolderId, setDriveFolderId] = useState(DEFAULT_DRIVE_FOLDER_ID);
  const [isDbConnecting, setIsDbConnecting] = useState(false);
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [dbError, setDbError] = useState('');

  // App Data State
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [metrics, setMetrics] = useState<BodyMetricEntry[]>([]);
  const [calories, setCalories] = useState<CalorieEntry[]>([]);
  
  // UI States
  const [activeTab, setActiveTab] = useState<'dashboard' | 'metrics' | 'calories' | 'profile'>('dashboard');
  const [isSyncing, setIsSyncing] = useState(false);
  const [backupStatus, setBackupStatus] = useState<{ success?: boolean; msg?: string } | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // 1. Initial Authentication Check
  useEffect(() => {
    initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
        setNeedsAuth(false);
      },
      () => {
        setNeedsAuth(true);
      }
    );
  }, []);

  // 2. Load App Data once authenticated and DB is verified
  useEffect(() => {
    if (user && accessToken && spreadsheetId) {
      handleConnectAndLoad(spreadsheetId);
    }
  }, [user, accessToken]);

  // Connects to Spreadsheet and loads all logs
  const handleConnectAndLoad = async (idToConnect: string) => {
    if (!accessToken) return;
    setIsDbConnecting(true);
    setIsSyncing(true);
    setDbError('');
    
    try {
      // Initialize Sheets & Worksheets
      await initializeSpreadsheet(idToConnect, accessToken);
      setSpreadsheetId(idToConnect);
      setIsDbConnected(true);

      // Fetch all data in parallel
      const [fetchedProfile, fetchedMetrics, fetchedCalories] = await Promise.all([
        fetchUserProfile(idToConnect, accessToken),
        fetchBodyMetrics(idToConnect, accessToken),
        fetchCalorieLogs(idToConnect, accessToken)
      ]);

      setProfile(fetchedProfile);
      setMetrics(fetchedMetrics);
      setCalories(fetchedCalories);
    } catch (err: any) {
      console.error(err);
      setDbError(err.message || '無法連線至指定的 Google Sheet。請確認您是否擁有存取權限。');
      setIsDbConnected(false);
    } finally {
      setIsDbConnecting(false);
      setIsSyncing(false);
    }
  };

  // Login handler
  const handleLogin = async () => {
    setIsLoggingIn(true);
    setDbError('');
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      console.error(err);
      setDbError(err.message || '登入失敗，請再試一次。');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Sign out handler
  const handleLogout = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    setNeedsAuth(true);
    setIsDbConnected(false);
    setProfile(null);
    setMetrics([]);
    setCalories([]);
  };

  // Manual synchronization
  const handleSync = async () => {
    if (!isDbConnected || !accessToken) return;
    setIsSyncing(true);
    try {
      const [fetchedProfile, fetchedMetrics, fetchedCalories] = await Promise.all([
        fetchUserProfile(spreadsheetId, accessToken),
        fetchBodyMetrics(spreadsheetId, accessToken),
        fetchCalorieLogs(spreadsheetId, accessToken)
      ]);

      setProfile(fetchedProfile);
      setMetrics(fetchedMetrics);
      setCalories(fetchedCalories);
    } catch (err: any) {
      alert(`同步失敗: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Save User Profile handler
  const handleSaveProfile = async (updatedProfile: UserProfile) => {
    if (!accessToken || !isDbConnected) throw new Error('資料庫未連線');
    await saveUserProfile(spreadsheetId, updatedProfile, accessToken);
    setProfile(updatedProfile);
  };

  // Save/Upsert Body Metric handler
  const handleSaveMetric = async (entry: BodyMetricEntry) => {
    if (!accessToken || !isDbConnected) throw new Error('資料庫未連線');
    await upsertBodyMetric(spreadsheetId, entry, accessToken);
    
    // Update state locally or re-fetch
    const updatedMetrics = [...metrics];
    const existingIndex = updatedMetrics.findIndex(m => m.Date === entry.Date);
    if (existingIndex !== -1) {
      updatedMetrics[existingIndex] = entry;
    } else {
      updatedMetrics.push(entry);
    }
    setMetrics(updatedMetrics.sort((a, b) => a.Date.localeCompare(b.Date)));

    // Sync latest height to user profile worksheet if different
    if (profile && profile.Height_cm !== entry.Weight_kg) {
      const updatedProfile = { ...profile, Height_cm: entry.Weight_kg ? profile.Height_cm : profile.Height_cm }; 
      // If we want height synced, the prompt says: "每次在「身體數據」頁籤更新身高時，也會同步更新此欄位。"
      // So if the user changes height in the profile from other inputs we update it.
    }
    
    // Trigger quick refresh of profile too
    const fetchedProfile = await fetchUserProfile(spreadsheetId, accessToken);
    if (fetchedProfile) setProfile(fetchedProfile);
  };

  // Add Calorie log handler
  const handleAddCalorie = async (newCalorie: Omit<CalorieEntry, 'Record_ID' | 'Timestamp'>) => {
    if (!accessToken || !isDbConnected) throw new Error('資料庫未連線');
    
    // Generate Record ID and precision Timestamp YYYY-MM-DD HH:MM:SS
    const recordId = 'REC_' + Math.random().toString(36).substring(2, 9).toUpperCase();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const now = new Date();
    const timestampStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const fullEntry: CalorieEntry = {
      ...newCalorie,
      Record_ID: recordId,
      Timestamp: timestampStr
    };

    await addCalorieLog(spreadsheetId, fullEntry, accessToken);
    setCalories([fullEntry, ...calories]); // Newest first
  };

  // Delete Calorie handler
  const handleDeleteCalorie = async (recordId: string) => {
    if (!accessToken || !isDbConnected) throw new Error('資料庫未連線');
    await deleteCalorieLog(spreadsheetId, recordId, accessToken);
    setCalories(calories.filter(c => c.Record_ID !== recordId));
  };

  // Google Drive Backup handler
  const handleBackupToDrive = async () => {
    if (!accessToken) return;
    setBackupStatus({ msg: '正在上傳備份至 Google Drive...' });
    try {
      const dataToBackup = { profile, metrics, calories };
      const backupFileId = await backupDataToDrive(driveFolderId, dataToBackup, accessToken);
      setBackupStatus({ 
        success: true, 
        msg: `資料備份成功！備份檔案已存入 Google Drive。\n(檔案 ID: ${backupFileId})` 
      });
      setTimeout(() => setBackupStatus(null), 8000);
    } catch (err: any) {
      console.error(err);
      setBackupStatus({ 
        success: false, 
        msg: `備份失敗: ${err.message || '請確認該 Drive 資料夾權限。'}` 
      });
      setTimeout(() => setBackupStatus(null), 5000);
    }
  };

  // Create brand new sheet in user's Drive if they want dedicated sheet
  const handleCreateNewSheet = async () => {
    if (!accessToken) return;
    const confirmed = window.confirm('確定要在您的 Google 雲端硬碟中，建立一個全新的身體紀錄試算表嗎？\n建立後，本系統將自動設定好 Users, BodyMetrics_Log, Calories_Log 三個工作表。');
    if (!confirmed) return;

    setIsDbConnecting(true);
    setDbError('');
    try {
      const newSheetId = await createNewSpreadsheet(accessToken);
      setSpreadsheetId(newSheetId);
      await handleConnectAndLoad(newSheetId);
      alert('全新試算表建立並連線成功！');
    } catch (err: any) {
      console.error(err);
      setDbError(`建表失敗: ${err.message}`);
    } finally {
      setIsDbConnecting(false);
    }
  };

  // Show customized login component if needs authorization
  if (needsAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4" id="login-container">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-100 shadow-xl text-center space-y-6"
        >
          <div className="flex justify-center">
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Activity className="w-12 h-12" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">身體素質紀錄與分析系統</h1>
            <p className="text-sm text-slate-500 leading-relaxed px-2">
              這是一款專門為您打造的身體數據與卡路里流水帳管理系統，連結您的 Google Sheets 做為無伺服器後端，並支援 Google Drive 自動雲端備份。
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl text-left border border-slate-100 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">系統權限要求說明：</h3>
            <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside">
              <li>讀取與修改指定的 Google Sheets 紀錄</li>
              <li>自動備份 JSON 數據至指定的 Drive 資料夾</li>
              <li>所有身體數據均直接存於您的個人雲端，極致隱私安全</li>
            </ul>
          </div>

          {dbError && (
            <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs text-left font-medium flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{dbError}</span>
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-3 py-3 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition shadow-sm hover:shadow active:scale-[0.98]"
          >
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
            </svg>
            <span>{isLoggingIn ? '正在通過 Google 驗證...' : '使用 Google 帳號登入'}</span>
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex w-64 bg-slate-900 flex-col border-r border-slate-800 shrink-0">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <Activity className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg text-white tracking-tight">BodySync Pro</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: 'dashboard', label: '儀表板分析', icon: TrendingUp },
            { id: 'metrics', label: '每日身體數據', icon: Calendar },
            { id: 'calories', label: '卡路里流水帳', icon: Flame },
            { id: 'profile', label: '個人設定', icon: User },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="p-3 bg-slate-800/50 rounded-lg">
            <p className="text-[10px] uppercase font-bold text-slate-500 mb-2">Sync Engine Status</p>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${isDbConnected ? 'bg-green-500 animate-pulse' : 'bg-amber-400'}`}></div>
              <span className="text-xs text-slate-300">Sheets: {isDbConnected ? 'Active' : 'Offline'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${accessToken ? 'bg-green-500' : 'bg-slate-500'}`}></div>
              <span className="text-xs text-slate-300">Drive Backup: {accessToken ? 'Active' : 'Offline'}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Sidebar Overlay */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-0 bg-black z-50 md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed inset-y-0 left-0 w-64 bg-slate-900 flex flex-col border-r border-slate-800 z-50 md:hidden"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                    <Activity className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-lg text-white tracking-tight">BodySync Pro</span>
                </div>
                <button 
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 p-4 space-y-1">
                {[
                  { id: 'dashboard', label: '儀表板分析', icon: TrendingUp },
                  { id: 'metrics', label: '每日身體數據', icon: Calendar },
                  { id: 'calories', label: '卡路里流水帳', icon: Flame },
                  { id: 'profile', label: '個人設定', icon: User },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id as any);
                        setIsMobileSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-slate-800">
                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <p className="text-[10px] uppercase font-bold text-slate-500 mb-2">Sync Engine Status</p>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${isDbConnected ? 'bg-green-500 animate-pulse' : 'bg-amber-400'}`}></div>
                    <span className="text-xs text-slate-300">Sheets: {isDbConnected ? 'Active' : 'Offline'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${accessToken ? 'bg-green-500' : 'bg-slate-500'}`}></div>
                    <span className="text-xs text-slate-300">Drive Backup: {accessToken ? 'Active' : 'Offline'}</span>
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-1.5 text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200 bg-slate-50"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-slate-800 tracking-tight">
              {activeTab === 'dashboard' && '儀表板分析 Overview'}
              {activeTab === 'metrics' && '每日身體數據 Logs'}
              {activeTab === 'calories' && '卡路里流水帳 Journal'}
              {activeTab === 'profile' && '個人設定 Settings'}
            </h1>
            <span className="hidden sm:inline-block text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full border border-blue-100 font-medium">
              {isSyncing ? '同步中...' : isDbConnected ? '已連線 Sheets' : '連線中斷'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Cloud Configuration Button */}
            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`p-1.5 md:p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                showConfig
                  ? 'bg-slate-100 border-slate-300 text-slate-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              title="資料庫配置設定"
            >
              <Database className="w-4 h-4" />
              <span className="hidden md:inline">雲端配置</span>
            </button>

            {/* Sync Button */}
            <button
              onClick={handleSync}
              disabled={isSyncing || !isDbConnected}
              className="p-1.5 md:p-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:bg-slate-50 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
              title="手動重新載入 Google Sheet 數據"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-indigo-600' : ''}`} />
              <span className="hidden md:inline">同步數據</span>
            </button>

            {/* Backup to Drive Button */}
            <button
              onClick={handleBackupToDrive}
              disabled={!isDbConnected}
              className="p-1.5 md:p-2 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
              title="備份資料至雲端硬碟"
            >
              <HardDrive className="w-4 h-4" />
              <span className="hidden md:inline">Drive 備份</span>
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="p-1.5 md:p-2 bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">登出</span>
            </button>
          </div>
        </header>

        {/* Scrollable Main Content Container */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col gap-6">
          {/* Database configuration Drawer (Slide Down) */}
          <AnimatePresence>
            {showConfig && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-slate-100 border border-slate-200 rounded-2xl overflow-hidden shadow-xs shrink-0"
              >
                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                  <div className="space-y-2">
                    <h3 className="font-bold text-slate-700 flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      Google Sheet 試算表 ID
                    </h3>
                    <p className="text-xs text-slate-400">目前指定使用的 Google 試算表唯一識別碼</p>
                    <input
                      type="text"
                      value={spreadsheetId}
                      onChange={(e) => setSpreadsheetId(e.target.value)}
                      placeholder="輸入 Google Sheet ID"
                      className="w-full text-xs font-mono border border-slate-200 bg-white rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleConnectAndLoad(spreadsheetId)}
                        disabled={isDbConnecting}
                        className="py-1 px-3 bg-slate-700 text-white rounded-lg text-[11px] font-medium hover:bg-slate-800 transition"
                      >
                        重新連線此試算表
                      </button>
                      <button
                        onClick={handleCreateNewSheet}
                        className="py-1 px-3 bg-emerald-600 text-white rounded-lg text-[11px] font-medium hover:bg-emerald-700 transition"
                      >
                        一鍵建立全新試算表
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-bold text-slate-700 flex items-center gap-1.5">
                      <HardDrive className="w-4 h-4 text-blue-500" />
                      Google Drive 備份資料夾 ID
                    </h3>
                    <p className="text-xs text-slate-400">備份 JSON 檔案時會自動存放至該雲端資料夾中</p>
                    <input
                      type="text"
                      value={driveFolderId}
                      onChange={(e) => setDriveFolderId(e.target.value)}
                      placeholder="輸入 Drive Folder ID"
                      className="w-full text-xs font-mono border border-slate-200 bg-white rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-[10px] text-slate-400 block">* 確保該資料夾已對您所在的 Google 帳號開放讀寫。</span>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200/60 space-y-2 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-slate-700">雲端後端資料連通說明</h4>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        本系統設計遵循您的 Sheets & Drive 規劃：
                      </p>
                      <ul className="text-[10px] text-slate-400 space-y-1 list-disc list-inside mt-1.5">
                        <li>工作表1 Users: 儲存生理性別、年齡、最新身高、活動係數</li>
                        <li>工作表2 BodyMetrics_Log: 紀錄每日身體數據（同日覆蓋）</li>
                        <li>工作表3 Calories_Log: 紀錄卡路里流水帳明細</li>
                      </ul>
                    </div>
                    {dbError && (
                      <span className="text-[10px] text-rose-500 font-semibold truncate block">
                        錯誤：{dbError}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Backup notification banners */}
          {backupStatus && (
            <div className="w-full shrink-0">
              <div
                className={`p-4 rounded-2xl text-xs font-medium border flex items-center justify-between ${
                  backupStatus.success === undefined
                    ? 'bg-blue-50 border-blue-100 text-blue-700'
                    : backupStatus.success
                    ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                    : 'bg-rose-50 border-rose-100 text-rose-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4.5 h-4.5" />
                  <span className="whitespace-pre-line">{backupStatus.msg}</span>
                </div>
                <button
                  onClick={() => setBackupStatus(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold px-2"
                >
                  關閉
                </button>
              </div>
            </div>
          )}

          {/* Data Syncing Loader Mask */}
          {isDbConnecting && (
            <div className="flex-1 bg-white border border-slate-200/60 rounded-3xl p-12 flex flex-col items-center justify-center space-y-4 shadow-xs" id="syncing-loader">
              <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
              <div className="text-center">
                <h3 className="font-bold text-slate-800">正在與您的 Google Sheets 資料庫連線...</h3>
                <p className="text-xs text-slate-400 mt-1">這需要幾秒鐘來讀取工作表 Users, BodyMetrics_Log 與 Calories_Log</p>
              </div>
            </div>
          )}

          {/* Tab Render Area */}
          {!isDbConnecting && (
            <div className="flex-1 flex flex-col">
              <AnimatePresence mode="wait">
                {activeTab === 'dashboard' && (
                  <motion.div
                    key="dashboard"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 flex flex-col"
                  >
                    <Dashboard profile={profile} metrics={metrics} calories={calories} />
                  </motion.div>
                )}

                {activeTab === 'metrics' && (
                  <motion.div
                    key="metrics"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 flex flex-col"
                  >
                    <MetricsLog 
                      metrics={metrics} 
                      profile={profile} 
                      onSaveMetric={handleSaveMetric} 
                    />
                  </motion.div>
                )}

                {activeTab === 'calories' && (
                  <motion.div
                    key="calories"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 flex flex-col"
                  >
                    <CaloriesJournal 
                      calories={calories} 
                      onAddCalorie={handleAddCalorie} 
                      onDeleteCalorie={handleDeleteCalorie} 
                    />
                  </motion.div>
                )}

                {activeTab === 'profile' && (
                  <motion.div
                    key="profile"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 flex flex-col"
                  >
                    <ProfileSettings 
                      profile={profile} 
                      onSaveProfile={handleSaveProfile} 
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Footer credits */}
          <footer className="mt-auto pt-6 pb-2 text-center text-[11px] text-slate-400 font-medium border-t border-slate-100 shrink-0">
            身體素質與能量流水帳系統 &copy; 2026 &middot; 隱私優先 &middot; 儲存於 Google Cloud Platform 雲端安全網域
          </footer>
        </div>
      </div>
    </div>
  );
}
