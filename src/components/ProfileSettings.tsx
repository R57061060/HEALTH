import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { Save, User, UserCheck, Heart, Sparkles, Scale, Info, Zap } from 'lucide-react';

interface ProfileSettingsProps {
  profile: UserProfile | null;
  onSaveProfile: (profile: UserProfile) => Promise<void>;
}

export default function ProfileSettings({ profile, onSaveProfile }: ProfileSettingsProps) {
  // Local Form State
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');
  const [age, setAge] = useState('30');
  const [height, setHeight] = useState('170');
  const [activityLevel, setActivityLevel] = useState('1.2');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Load existing profile values when available
  useEffect(() => {
    if (profile) {
      setGender(profile.Gender);
      setAge(profile.Age.toString());
      setHeight(profile.Height_cm.toString());
      setActivityLevel(profile.Activity_Level.toString());
    }
  }, [profile]);

  // Live calculations
  const parsedAge = Number(age) || 0;
  const parsedHeight = Number(height) || 0;
  const parsedActivity = Number(activityLevel) || 1.2;
  
  // Default weight to compute mock live BMR/TDEE preview
  const referenceWeight = 65; 

  let liveBmr = 0;
  if (parsedHeight && parsedAge) {
    if (gender === 'Male') {
      liveBmr = 10 * referenceWeight + 6.25 * parsedHeight - 5 * parsedAge + 5;
    } else {
      liveBmr = 10 * referenceWeight + 6.25 * parsedHeight - 5 * parsedAge - 161;
    }
  }
  const liveTdee = liveBmr * parsedActivity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!age || isNaN(Number(age)) || Number(age) <= 0) {
      setErrorMsg('請輸入有效的年齡。');
      return;
    }
    if (!height || isNaN(Number(height)) || Number(height) <= 0) {
      setErrorMsg('請輸入有效的身高（公分）。');
      return;
    }

    const updatedProfile: UserProfile = {
      User_ID: 'User01', // defaults as specified in schema Users
      Gender: gender,
      Age: Math.round(Number(age)),
      Height_cm: Number(height),
      Activity_Level: Number(activityLevel)
    };

    setIsSubmitting(true);
    try {
      await onSaveProfile(updatedProfile);
      setSuccessMsg('個人基本資料設定儲存成功！已同步至 Users 工作表。');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || '儲存設定失敗，請確認網路或 Google Sheets 連線狀態。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="profile-settings-section">
      {/* 填寫表單 */}
      <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
        <div>
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-600" />
            設定使用者基本資料 (Users)
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            用來計算您的每日基礎代謝率 (BMR) 與每日能量消耗 (TDEE)。每次在填寫身體數據時，最新身高也會同步到這裡。
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs font-medium">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" id="profile-form">
          {/* Gender */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">生理性別</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setGender('Male')}
                className={`py-2.5 px-4 text-xs font-semibold rounded-xl border transition-all duration-200 flex items-center justify-center gap-2 ${
                  gender === 'Male'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                男性 (Male)
              </button>
              <button
                type="button"
                onClick={() => setGender('Female')}
                className={`py-2.5 px-4 text-xs font-semibold rounded-xl border transition-all duration-200 flex items-center justify-center gap-2 ${
                  gender === 'Female'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                女性 (Female)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Age */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">年齡 (Age)</label>
              <input
                type="number"
                required
                value={age}
                placeholder="e.g. 28"
                onChange={(e) => setAge(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Height */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">身高 (cm)</label>
              <input
                type="number"
                step="0.1"
                required
                value={height}
                placeholder="e.g. 175"
                onChange={(e) => setHeight(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Activity Level */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">日常活動量乘數 (Activity Level)</label>
            <select
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="1.2">久坐 (如：辦公室久坐不運動，係數為 1.2)</option>
              <option value="1.375">輕度活動 (如：每週散步或做 1~3 天輕量運動，係數為 1.375)</option>
              <option value="1.55">中度活動 (如：每週規律進行中等強度運動 3~5 天，係數為 1.55)</option>
              <option value="1.725">重度活動 (如：每週進行重度訓練或體力勞動 6~7 天，係數為 1.725)</option>
              <option value="1.9">極重度活動 (如：每天高強度運動/訓練、雙重活動量，係數為 1.9)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium text-sm rounded-xl transition shadow-sm flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? '儲存中...' : '儲存設定'}
          </button>
        </form>
      </div>

      {/* 預估參考看板 */}
      <div className="bg-gradient-to-br from-indigo-900 to-indigo-800 text-white p-6 rounded-2xl flex flex-col justify-between shadow-md" id="live-calculator-preview">
        <div className="space-y-4">
          <span className="text-[10px] font-bold tracking-widest text-indigo-200 uppercase flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" />
            即時試算預覽 (Live BMR/TDEE)
          </span>
          <div>
            <h4 className="text-lg font-bold text-white">基礎代謝試算預測</h4>
            <p className="text-xs text-indigo-100/70 mt-1 leading-relaxed">
              根據 Mifflin-St Jeor 公式，以基準體重 <span className="font-bold text-amber-300">65 kg</span> 做為參考基準時：
            </p>
          </div>

          <div className="space-y-3 pt-3 border-t border-indigo-700/50">
            <div>
              <span className="text-xs text-indigo-200 block">基礎代謝率 (BMR)</span>
              <p className="text-2xl font-bold text-white mt-0.5">
                {liveBmr > 0 ? `${Math.round(liveBmr)}` : '--'}{' '}
                <span className="text-xs font-normal text-indigo-300">kcal / 天</span>
              </p>
            </div>
            <div>
              <span className="text-xs text-indigo-200 block">每日熱量消耗 (TDEE)</span>
              <p className="text-2xl font-bold text-amber-300 mt-0.5">
                {liveTdee > 0 ? `${Math.round(liveTdee)}` : '--'}{' '}
                <span className="text-xs font-normal text-indigo-300">kcal / 天</span>
              </p>
            </div>
          </div>
        </div>

        <div className="text-[10px] text-indigo-200/60 leading-relaxed pt-6 mt-6 border-t border-indigo-700/50">
          * 提示：這只是以 65 公斤作為參考。首頁儀表板將自動套用您在「每日數據紀錄」中所寫入的最新真實體重。
        </div>
      </div>
    </div>
  );
}
