export interface UserProfile {
  User_ID: string;
  Gender: 'Male' | 'Female';
  Age: number;
  Height_cm: number;
  Activity_Level: number; // e.g., 1.2, 1.375, 1.55, 1.725, 1.9
}

export interface BodyMetricEntry {
  Date: string; // YYYY-MM-DD
  Weight_kg: number;
  BP_Systolic?: number;
  BP_Diastolic?: number;
  HeartRate_bpm?: number;
  Waist_cm?: number;
  BodyFat_pct?: number;
  Muscle_pct?: number;
  Calculated_BMI: number;
}

export interface CalorieEntry {
  Record_ID: string;
  Date: string; // YYYY-MM-DD
  Timestamp: string; // YYYY-MM-DD HH:MM:SS
  Type: 'Intake' | 'Burn';
  Item_Name: string;
  Calories: number;
}
