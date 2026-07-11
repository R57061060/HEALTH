import React, { useState } from 'react';
import { BodyMetricEntry, UserProfile } from '../types';
import { Calendar, Save, Trash, Plus, Search, HelpCircle, Activity, Info } from 'lucide-react';

interface MetricsLogProps {
  metrics: BodyMetricEntry[];
  profile: UserProfile | null;
  onSaveMetric: (entry: BodyMetricEntry) => Promise<void>;
}

export default function MetricsLog({ metrics, profile, onSaveMetric }: MetricsLogProps) {
  const todayStr = new Date().toISOString().slice(0, 10);
  
  // Form State
  const [date, setDate] = useState(todayStr);
  const [weight, setWeight] = useState('');
  const [bpSystolic, setBpSystolic] = useState('');
  const [bpDiastolic, setBpDiastolic] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [waist, setWaist] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [muscle, setMuscle] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Auto-fill values if selecting a date that already has records
  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    const existing = metrics.find(m => m.Date === newDate);
    if (existing) {
      setWeight(existing.Weight_kg.toString());
      setBpSystolic(existing.BP_Systolic?.toString() || '');
      setBpDiastolic(existing.BP_Diastolic?.toString() || '');
      setHeartRate(existing.HeartRate_bpm?.toString() || '');
      setWaist(existing.Waist_cm?.toString() || '');
      setBodyFat(existing.BodyFat_pct?.toString() || '');
      setMuscle(existing.Muscle_pct?.toString() || '');
      setSuccessMsg('已載入該日期現有的紀錄。儲存時將自動覆寫。');
      setTimeout(() => setSuccessMsg(''), 4000);
    } else {
      // Clear fields if no existing records except weight which can stay as previous default
      setBpSystolic('');
      setBpDiastolic('');
      setHeartRate('');
      setWaist('');
      setBodyFat('');
      setMuscle('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!weight || isNaN(Number(weight)) || Number(weight) <= 0) {
      setErrorMsg('請輸入有效的體重數字（公斤）。');
      return;
    }

    const heightCm = profile?.Height_cm || 170;
    const weightKg = Number(weight);
    const bmi = weightKg / Math.pow(heightCm / 100, 2);

    // Prepare entry
    const entry: BodyMetricEntry = {
      Date: date,
      Weight_kg: weightKg,
      BP_Systolic: bpSystolic ? Number(bpSystolic) : undefined,
      BP_Diastolic: bpDiastolic ? Number(bpDiastolic) : undefined,
      HeartRate_bpm: heartRate ? Number(heartRate) : undefined,
      Waist_cm: waist ? Number(waist) : undefined,
      BodyFat_pct: bodyFat ? Number(bodyFat) : undefined,
      Muscle_pct: muscle ? Number(muscle) : undefined,
      Calculated_BMI: Number(bmi.toFixed(2))
    };

    // Upsert confirmation dialog as requested
    const existingIndex = metrics.findIndex(m => m.Date === date);
    if (existingIndex !== -1) {
      const confirmed = window.confirm(`警告：該日期 (${date}) 已有身體數據紀錄。\n\n您確定要覆寫（覆蓋）先前的紀錄嗎？此動作將同步更新資料庫。`);
      if (!confirmed) return;
    }

    setIsSubmitting(true);
    try {
      await onSaveMetric(entry);
      setSuccessMsg(`身體數據 (${date}) 儲存成功！`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || '儲存失敗，請檢查網路或 Google Sheets 權限。');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter logs based on search query (Date, or matches numeric values)
  const filteredMetrics = metrics.filter(m => {
    if (!searchQuery) return true;
    return m.Date.includes(searchQuery) || m.Weight_kg.toString().includes(searchQuery);
  }).sort((a, b) => b.Date.localeCompare(a.Date)); // Newest first for log list

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="metrics-log-section">
      {/* 數據填寫表單 (Form) */}
      <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 h-fit">
        <div>
          <h3 className="text-base font-semibold text-slate-800">紀錄每日身體數據</h3>
          <p className="text-xs text-slate-400">填寫當日測量值。相同日期將自動更新（Upsert）。</p>
        </div>

        {!profile && (
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2.5 text-amber-800 text-xs">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">尚未設定個人基本資料</p>
              <p className="mt-0.5">請先前往「個人資料設定」輸入身高，以便精確計算 BMR 與 BMI。</p>
            </div>
          </div>
        )}

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

        <form onSubmit={handleSubmit} className="space-y-4" id="metric-form">
          {/* Date Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">紀錄日期 *</label>
            <div className="relative">
              <input
                type="date"
                required
                value={date}
                max={todayStr}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Weight */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">體重 (kg) *</label>
            <input
              type="number"
              step="0.01"
              required
              value={weight}
              placeholder="e.g. 68.5"
              onChange={(e) => setWeight(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* BP Systolic */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">收縮壓 (高壓 mmHg)</label>
              <input
                type="number"
                value={bpSystolic}
                placeholder="e.g. 120"
                onChange={(e) => setBpSystolic(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* BP Diastolic */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">舒張壓 (低壓 mmHg)</label>
              <input
                type="number"
                value={bpDiastolic}
                placeholder="e.g. 80"
                onChange={(e) => setBpDiastolic(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Heart Rate */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">心率 (bpm)</label>
              <input
                type="number"
                value={heartRate}
                placeholder="e.g. 72"
                onChange={(e) => setHeartRate(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Waist */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">腰圍 (cm)</label>
              <input
                type="number"
                step="0.1"
                value={waist}
                placeholder="e.g. 82.5"
                onChange={(e) => setWaist(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Body Fat */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">體脂肪率 (%)</label>
              <input
                type="number"
                step="0.1"
                value={bodyFat}
                placeholder="e.g. 18.5"
                onChange={(e) => setBodyFat(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Muscle % */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">肌肉量 (%)</label>
              <input
                type="number"
                step="0.1"
                value={muscle}
                placeholder="e.g. 33.2"
                onChange={(e) => setMuscle(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium text-sm rounded-xl transition shadow-sm flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? '正在寫入資料庫...' : '儲存紀錄'}
          </button>
        </form>
      </div>

      {/* 歷史數據列表 (Table/List) */}
      <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-800">歷史身體數據日誌</h3>
            <p className="text-xs text-slate-400">所有儲存於 Google Sheet 的身體素質紀錄</p>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="搜尋日期或體重..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 w-full sm:w-60 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 bg-slate-50"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-100" id="metrics-table-wrapper">
          <table className="w-full text-left border-collapse" id="metrics-table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">日期</th>
                <th className="py-3 px-4">體重 (kg)</th>
                <th className="py-3 px-4">BMI</th>
                <th className="py-3 px-4">血壓 (mmHg)</th>
                <th className="py-3 px-4">心率 (bpm)</th>
                <th className="py-3 px-4">腰圍 (cm)</th>
                <th className="py-3 px-4">體脂率</th>
                <th className="py-3 px-4">肌肉量</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredMetrics.length > 0 ? (
                filteredMetrics.map((item) => (
                  <tr key={item.Date} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">{item.Date}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{item.Weight_kg}</td>
                    <td className="py-3 px-4">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                        {item.Calculated_BMI}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {item.BP_Systolic && item.BP_Diastolic
                        ? `${item.BP_Systolic}/${item.BP_Diastolic}`
                        : '--'}
                    </td>
                    <td className="py-3 px-4">{item.HeartRate_bpm || '--'}</td>
                    <td className="py-3 px-4">{item.Waist_cm || '--'}</td>
                    <td className="py-3 px-4 text-rose-600 font-medium">{item.BodyFat_pct ? `${item.BodyFat_pct}%` : '--'}</td>
                    <td className="py-3 px-4 text-blue-600 font-medium">{item.Muscle_pct ? `${item.Muscle_pct}%` : '--'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    目前沒有符合搜尋或已儲存的身體數據。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
