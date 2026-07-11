import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area } from 'recharts';
import { UserProfile, BodyMetricEntry, CalorieEntry } from '../types';
import { Activity, Heart, TrendingDown, Scale, Flame, RefreshCw, Calendar, Sparkles } from 'lucide-react';

interface DashboardProps {
  profile: UserProfile | null;
  metrics: BodyMetricEntry[];
  calories: CalorieEntry[];
}

export default function Dashboard({ profile, metrics, calories }: DashboardProps) {
  // 1. Calculations
  const latestMetric = metrics.length > 0 ? metrics[metrics.length - 1] : null;
  const currentWeight = latestMetric?.Weight_kg || (profile?.Height_cm ? 65 : 0); // default weight if missing
  const currentHeight = profile?.Height_cm || 170;
  const currentAge = profile?.Age || 30;
  const currentGender = profile?.Gender || 'Male';
  const activityLevel = profile?.Activity_Level || 1.2;

  // Mifflin-St Jeor formula
  let bmr = 0;
  if (currentWeight && currentHeight && currentAge) {
    if (currentGender === 'Male') {
      bmr = 10 * currentWeight + 6.25 * currentHeight - 5 * currentAge + 5;
    } else {
      bmr = 10 * currentWeight + 6.25 * currentHeight - 5 * currentAge - 161;
    }
  }

  const tdee = bmr * activityLevel;
  const bmi = currentWeight / Math.pow(currentHeight / 100, 2);

  // Calorie calculations
  const totalIntake = calories
    .filter((c) => c.Type === 'Intake')
    .reduce((sum, c) => sum + c.Calories, 0);

  const totalBurn = calories
    .filter((c) => c.Type === 'Burn')
    .reduce((sum, c) => sum + c.Calories, 0);

  // Total recorded days (unique dates in body metrics or calorie logs, minimum 1)
  const uniqueDates = Array.from(
    new Set([
      ...metrics.map((m) => m.Date),
      ...calories.map((c) => c.Date),
    ])
  ).filter(Boolean);
  
  const totalDays = uniqueDates.length || 1;

  // Historical BMR and activity consumption (Total TDEE across active tracking days)
  const totalTdeeConsumption = tdee * totalDays;

  // Cumulative Calorie Deficit = Total Intake - (Total Burn + Total TDEE)
  // Note: Deficit is typically negative if we consume less than we burn.
  // Cumulative calorie deficit is (Total Intake - Total Burn - Total TDEE)
  const cumulativeDeficit = totalIntake - (totalBurn + totalTdeeConsumption);
  
  // Weight loss projection: 1kg = 7000kcal
  // If cumulativeDeficit is -7000kcal, projected weight loss is 1kg
  const projectedWeightLossKg = -cumulativeDeficit / 7000;

  // Format dates for charts
  const chartData = metrics.map((m) => ({
    ...m,
    formattedDate: m.Date.slice(5), // MM-DD for cleaner labels
  }));

  // Activity level label mapping
  const getActivityLabel = (level: number) => {
    if (level <= 1.2) return '久坐 (1.2)';
    if (level <= 1.375) return '輕度活動 (1.375)';
    if (level <= 1.55) return '中度活動 (1.55)';
    if (level <= 1.725) return '重度活動 (1.725)';
    return '極重度活動 (1.9)';
  };

  return (
    <div className="space-y-6" id="dashboard-section">
      {/* 核心數據面板 (Metrics Overview) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="metric-cards-grid">
        {/* BMI Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4" id="bmi-card">
          <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">當前估算 BMI</p>
            <p className="text-2xl font-semibold tracking-tight text-slate-800">
              {bmi > 0 ? bmi.toFixed(1) : '--'}
            </p>
            <p className="text-xs mt-0.5 font-medium text-slate-400">
              {bmi > 0 ? (
                bmi < 18.5 ? '體重過輕' : bmi < 24 ? '正常範圍' : bmi < 27 ? '過重' : '肥胖'
              ) : '尚未記錄'}
            </p>
          </div>
        </div>

        {/* BMR Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4" id="bmr-card">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">當前基礎代謝率 (BMR)</p>
            <p className="text-2xl font-semibold tracking-tight text-slate-800">
              {bmr > 0 ? `${Math.round(bmr)} kcal` : '--'}
            </p>
            <p className="text-xs mt-0.5 text-slate-400 font-medium">
              Mifflin-St Jeor 公式
            </p>
          </div>
        </div>

        {/* TDEE Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4" id="tdee-card">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">每日總熱量消耗 (TDEE)</p>
            <p className="text-2xl font-semibold tracking-tight text-slate-800">
              {tdee > 0 ? `${Math.round(tdee)} kcal` : '--'}
            </p>
            <p className="text-xs mt-0.5 text-slate-400 font-medium truncate max-w-[150px]">
              {getActivityLabel(activityLevel)}
            </p>
          </div>
        </div>

        {/* Days Tracking Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4" id="days-card">
          <div className="p-3 rounded-xl bg-violet-50 text-violet-600">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">持續累積紀錄</p>
            <p className="text-2xl font-semibold tracking-tight text-slate-800">
              {totalDays} 天
            </p>
            <p className="text-xs mt-0.5 text-slate-400 font-medium">
              活動紀錄涵蓋時間
            </p>
          </div>
        </div>
      </div>

      {/* 熱量收支與減輕估算 (Calorie Budget & Loss Tracker) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6" id="calories-budget-box">
        <div className="md:col-span-2 space-y-4">
          <h3 className="text-base font-semibold text-slate-800 flex items-center">
            <Flame className="w-5 h-5 text-rose-500 mr-2" />
            卡路里收支平衡總覽 (7000大卡法則)
          </h3>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-xs text-slate-500 font-medium">累積總攝取 (+)</span>
              <p className="text-lg font-semibold text-amber-600 mt-1">{totalIntake} kcal</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-xs text-slate-500 font-medium">累積運動消耗 (-)</span>
              <p className="text-lg font-semibold text-emerald-600 mt-1">{totalBurn} kcal</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-xs text-slate-500 font-medium">累積代謝消耗 (-)</span>
              <p className="text-lg font-semibold text-blue-600 mt-1">{Math.round(totalTdeeConsumption)} kcal</p>
            </div>
          </div>

          <div className="pt-2">
            <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
              <span>累積熱量赤字 (Deficit)</span>
              <span className={cumulativeDeficit <= 0 ? 'text-emerald-600' : 'text-rose-500'}>
                {cumulativeDeficit > 0 ? '+' : ''}{Math.round(cumulativeDeficit)} kcal
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  cumulativeDeficit <= 0 ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
                style={{
                  width: `${Math.min(100, Math.max(10, (Math.abs(cumulativeDeficit) / Math.max(1, totalTdeeConsumption)) * 100))}%`,
                }}
              ></div>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              * 熱量赤字公式：(總攝取) - (總消耗 + 總基礎代謝與活動消耗)。當數值為負時代表成功消耗脂肪。
            </p>
          </div>
        </div>

        {/* Weight loss budget */}
        <div className="bg-gradient-to-br from-indigo-50 to-violet-50 p-6 rounded-2xl flex flex-col justify-between border border-indigo-100/50" id="weight-loss-card">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-indigo-600 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              減重成效估估看
            </span>
            <h4 className="text-lg font-bold text-slate-800">預估減輕體重</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              根據醫學 7000 大卡熱量赤字等於 1 公斤脂肪規律計算：
            </p>
          </div>
          <div className="my-4">
            <p className="text-4xl font-extrabold text-indigo-600 tracking-tight">
              {projectedWeightLossKg >= 0 ? projectedWeightLossKg.toFixed(2) : '0.00'}{' '}
              <span className="text-lg font-medium text-slate-600">kg</span>
            </p>
          </div>
          <div className="text-[11px] text-indigo-500 font-medium">
            {projectedWeightLossKg > 0 ? (
              <span>🎉 恭喜！持續保持熱量赤字，健康邁向理想身材！</span>
            ) : (
              <span>💡 目前熱量仍有盈餘，加油創造更多赤字喔！</span>
            )}
          </div>
        </div>
      </div>

      {/* 趨勢分析圖表 (Trend Charts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="dashboard-charts-grid">
        {/* Weight & BMI Trend */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">體重與 BMI 變化趨勢</h4>
            <p className="text-xs text-slate-400">追蹤體重 (kg) 與 BMI 的關聯進展</p>
          </div>
          <div className="h-72">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="formattedDate" stroke="#94a3b8" fontSize={11} />
                  <YAxis yAxisId="left" stroke="#6366f1" fontSize={11} domain={['dataMin - 2', 'dataMax + 2']} />
                  <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={11} domain={['dataMin - 1', 'dataMax + 1']} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: '8px' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line yAxisId="left" type="monotone" dataKey="Weight_kg" name="體重 (kg)" stroke="#6366f1" strokeWidth={2.5} activeDot={{ r: 6 }} />
                  <Line yAxisId="right" type="monotone" dataKey="Calculated_BMI" name="BMI" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <Scale className="w-10 h-10 mb-2 stroke-[1.5] text-slate-300" />
                無體重數據。請至「每日數據紀錄」填寫。
              </div>
            )}
          </div>
        </div>

        {/* Body Fat & Muscle % Trend */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">體脂與肌肉比例</h4>
            <p className="text-xs text-slate-400">體脂肪率 (%) 與 肌肉量百分比 (%) 雙軸趨勢</p>
          </div>
          <div className="h-72">
            {chartData.some((d) => d.BodyFat_pct || d.Muscle_pct) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorFat" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorMuscle" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="formattedDate" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} unit="%" />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: '8px' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="BodyFat_pct" name="體脂率 (%)" stroke="#f43f5e" fillOpacity={1} fill="url(#colorFat)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Muscle_pct" name="肌肉量 (%)" stroke="#3b82f6" fillOpacity={1} fill="url(#colorMuscle)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <Activity className="w-10 h-10 mb-2 stroke-[1.5] text-slate-300" />
                無體脂或肌肉量數據。請至「每日數據紀錄」填寫。
              </div>
            )}
          </div>
        </div>

        {/* Blood Pressure Trend */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">血壓變化趨勢</h4>
            <p className="text-xs text-slate-400">收縮壓與舒張壓追蹤 (mmHg)</p>
          </div>
          <div className="h-72">
            {chartData.some((d) => d.BP_Systolic || d.BP_Diastolic) ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="formattedDate" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} domain={['dataMin - 10', 'dataMax + 10']} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: '8px' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="BP_Systolic" name="收縮壓 (高壓)" stroke="#ef4444" strokeWidth={2} />
                  <Line type="monotone" dataKey="BP_Diastolic" name="舒張壓 (低壓)" stroke="#3b82f6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <Heart className="w-10 h-10 mb-2 stroke-[1.5] text-slate-300" />
                無血壓數據。請至「每日數據紀錄」填寫。
              </div>
            )}
          </div>
        </div>

        {/* Heart Rate & Waist Trend */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">心跳與腰圍追蹤</h4>
            <p className="text-xs text-slate-400">靜止心率 (bpm) 與腰圍 (cm)</p>
          </div>
          <div className="h-72">
            {chartData.some((d) => d.HeartRate_bpm || d.Waist_cm) ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="formattedDate" stroke="#94a3b8" fontSize={11} />
                  <YAxis yAxisId="left" stroke="#ec4899" fontSize={11} domain={['dataMin - 10', 'dataMax + 10']} />
                  <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" fontSize={11} domain={['dataMin - 5', 'dataMax + 5']} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: '8px' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line yAxisId="left" type="monotone" dataKey="HeartRate_bpm" name="心率 (bpm)" stroke="#ec4899" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="Waist_cm" name="腰圍 (cm)" stroke="#f59e0b" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <Heart className="w-10 h-10 mb-2 stroke-[1.5] text-slate-300" />
                無心率或腰圍紀錄。請至「每日數據紀錄」填寫。
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
