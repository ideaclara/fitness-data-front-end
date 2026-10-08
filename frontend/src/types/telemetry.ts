export interface MeasurementSession {
  PK: string;
  SK: string;
  entity_type: string;
  timestamp: number;
  weight_kg?: number;
  fat_ratio_pct?: number;
  fat_mass_weight_kg?: number;
  fat_free_mass_kg?: number;
  muscle_mass_kg?: number;
  hydration_kg?: number;
  bone_mass_kg?: number;
  heart_pulse_bpm?: number;
  pulse_wave_velocity_raw_ms?: number;
  pulse_wave_velocity_normalized_ms?: number;
  vascular_age_yrs?: number;
  device_model?: string;
  measure_group_ids?: number[];
}

export interface TelemetryApiResponse {
  data: MeasurementSession[];
  count: number;
  next_cursor: string | null;
}