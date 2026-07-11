import React, { useState } from 'react';
import { CalorieEntry } from '../types';
import { Plus, Trash2, Calendar, Clock, Flame, Apple, Search, Tag, AlertTriangle } from 'lucide-react';

interface CaloriesJournalProps {
  calories: CalorieEntry[];
  onAddCalorie: (entry: Omit<CalorieEntry, 'Record_ID' | 'Timestamp'>) => Promise<void>;
  onDeleteCalorie: (recordId: string) => Promise<void>;
}

export default function CaloriesJournal({ calories, onAddCalorie, onDeleteCalorie }: CaloriesJournalProps) {
  const todayStr = new Date().toISOString().slice(0, 10);

  // Form State
  const [date, setDate] = useState(todayStr);
  const [itemName, setItemName] = useState('');
  const [type, setType] = useState<'Intake' | 'Burn'>('Intake');
  const [caloriesVal, setCaloriesVal] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!itemName.trim()) {
      setErrorMsg('請輸入項目名稱。');
      return;
    }

    if (!caloriesVal || isNaN(Number(caloriesVal)) || Number(caloriesVal) <= 0) {
      setErrorMsg('請輸入大於 0 的有效卡路里值。');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddCalorie({
        Date: date,
        Type: type,
        Item_Name: itemName.trim(),
        Calories: Math.round(Number(caloriesVal))
      });
      
      // Reset form (except date for faster multi-entry)
      setItemName('');
      setCaloriesVal('');
      setSuccessMsg('卡路里紀錄新增成功！已寫入 Google Sheet。');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || '新增失敗，請檢查權限。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (recordId: string, itemName: string) => {
    // Destructive operation confirmation (MANDATORY)
    const confirmed = window.confirm(`警告：確定要刪除紀錄「${itemName}」嗎？\n\n此動作無法還原，且會直接從 Google Sheet 中移除資料。`);
    if (!confirmed) return;

    setDeletingId(recordId);
    try {
      await onDeleteCalorie(recordId);
      setSuccessMsg('紀錄刪除成功！');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      alert(`刪除失敗: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  // Filter calorie records
  const filteredCalories = calories.filter(c => {
    if (!searchQuery) return true;
    return c.Item_Name.toLowerCase().includes(searchQuery.toLowerCase()) || c.Date.includes(searchQuery);
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="calories-journal-section">
      {/* 卡路里輸入表單 (Form) */}
      <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 h-fit">
        <div>
          <h3 className="text-base font-semibold text-slate-800">新增卡路里收支</h3>
          <p className="text-xs text-slate-400">紀錄食物攝取或運動消耗。資料將存於 Calories_Log 中。</p>
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

        <form onSubmit={handleSubmit} className="space-y-4" id="calorie-form">
          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">紀錄日期</label>
            <input
              type="date"
              required
              value={date}
              max={todayStr}
              onChange={(e) => setDate(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Type Toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">收支類型</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('Intake')}
                className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all duration-200 flex items-center justify-center gap-2 ${
                  type === 'Intake'
                    ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Apple className="w-4 h-4" />
                熱量攝取 (吃)
              </button>
              <button
                type="button"
                onClick={() => setType('Burn')}
                className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all duration-200 flex items-center justify-center gap-2 ${
                  type === 'Burn'
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Flame className="w-4 h-4" />
                熱量消耗 (動)
              </button>
            </div>
          </div>

          {/* Item Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">項目名稱</label>
            <input
              type="text"
              required
              value={itemName}
              placeholder={type === 'Intake' ? '例如：排骨便當、無糖拿鐵' : '例如：慢跑30分鐘、重量訓練'}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Calories (KCAL) */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">熱量 (KCAL)</label>
            <input
              type="number"
              required
              value={caloriesVal}
              placeholder="e.g. 650"
              onChange={(e) => setCaloriesVal(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium text-sm rounded-xl transition shadow-sm flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {isSubmitting ? '正在寫入資料庫...' : '新增此筆紀錄'}
          </button>
        </form>
      </div>

      {/* 流水帳明細 (Journal Entries list) */}
      <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-800">卡路里流水帳清單</h3>
            <p className="text-xs text-slate-400">當日吃下或燃燒的熱量明細 (最新最上)</p>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="搜尋項目或日期..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 w-full sm:w-60 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 bg-slate-50"
            />
          </div>
        </div>

        <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1" id="calorie-list">
          {filteredCalories.length > 0 ? (
            filteredCalories.map((item) => (
              <div
                key={item.Record_ID}
                className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/75 rounded-xl border border-slate-100 transition duration-150"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`p-2.5 rounded-xl ${
                      item.Type === 'Intake' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                    }`}
                  >
                    {item.Type === 'Intake' ? <Apple className="w-4 h-4" /> : <Flame className="w-4 h-4" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800">{item.Item_Name}</h4>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-medium">
                      <span className="flex items-center gap-0.5">
                        <Calendar className="w-3 h-3" />
                        {item.Date}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        {item.Timestamp.slice(11, 16)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <span
                    className={`text-sm font-bold ${
                      item.Type === 'Intake' ? 'text-amber-600' : 'text-emerald-600'
                    }`}
                  >
                    {item.Type === 'Intake' ? '+' : '-'}{item.Calories} kcal
                  </span>
                  <button
                    onClick={() => handleDelete(item.Record_ID, item.Item_Name)}
                    disabled={deletingId === item.Record_ID}
                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                    title="刪除此筆紀錄"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs">
              目前無卡路里紀錄。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
