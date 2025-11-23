import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!; 
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface DefectType {
  id: string
  code: string
  label: string
  description: string | null
  severity: number
  created_at: string
}

export interface Batch {
  id: string
  name: string
  description: string | null
  total_captures: number
  valid_captures: number
  invalid_captures: number
  total_defects: number
  quality_score: number | null
  created_at: string
}

export interface Capture {
  id: string
  batch_id: string
  filename: string | null
  sha256: string
  original_uri: string
  processed_uri: string | null
  processed_areas_uri: string | null
  processed_pins_uri: string | null
  processed_shaft_uri: string | null
  is_valid: boolean | null
  areas_detected: number | null
  pins_detected: number | null
  defects_count: number | null
  has_missing_pins: boolean | null
  has_extra_pins: boolean | null
  has_damaged_pins: boolean | null
  has_wrong_color_pins: boolean | null
  has_structure_damage: boolean | null
  has_shaft_defects: boolean | null
  created_at: string
}

export interface Compartment {
  id: string
  capture_id: string
  grid_row: number
  grid_col: number
  bbox_x: number
  bbox_y: number
  bbox_width: number
  bbox_height: number
  pins_count: number
  is_valid: boolean | null
  has_defect: boolean | null
  created_at: string
}

export interface Defect {
  id: string
  capture_id: string
  defect_type_id: string
  compartment_id: string | null
  created_at: string
}