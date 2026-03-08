export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      attendance_records: {
        Row: {
          confidence_score: number | null
          course_id: string | null
          course_name: string
          created_at: string
          date: string
          id: string
          marked_by: string | null
          recognition_method: string | null
          status: string | null
          student_id: string | null
          week_number: number | null
        }
        Insert: {
          confidence_score?: number | null
          course_id?: string | null
          course_name: string
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          recognition_method?: string | null
          status?: string | null
          student_id?: string | null
          week_number?: number | null
        }
        Update: {
          confidence_score?: number | null
          course_id?: string | null
          course_name?: string
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          recognition_method?: string | null
          status?: string | null
          student_id?: string | null
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      behavior_records: {
        Row: {
          action_name: string
          action_type: string
          course_id: string | null
          created_at: string
          id: string
          notes: string | null
          recorded_by: string
          score_change: number
          student_id: string
          week_number: number | null
        }
        Insert: {
          action_name: string
          action_type: string
          course_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          recorded_by: string
          score_change: number
          student_id: string
          week_number?: number | null
        }
        Update: {
          action_name?: string
          action_type?: string
          course_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          recorded_by?: string
          score_change?: number
          student_id?: string
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "behavior_records_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "behavior_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      behavior_scores: {
        Row: {
          id: string
          score: number
          student_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          score?: number
          student_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          score?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "behavior_scores_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          course_code: string
          created_at: string
          credits: number
          department_id: string | null
          description: string | null
          doctor_id: string | null
          id: string
          max_students: number | null
          name: string
          semester: string
          status: string
        }
        Insert: {
          course_code: string
          created_at?: string
          credits?: number
          department_id?: string | null
          description?: string | null
          doctor_id?: string | null
          id?: string
          max_students?: number | null
          name: string
          semester?: string
          status?: string
        }
        Update: {
          course_code?: string
          created_at?: string
          credits?: number
          department_id?: string | null
          description?: string | null
          doctor_id?: string | null
          id?: string
          max_students?: number | null
          name?: string
          semester?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      doctor_attendance: {
        Row: {
          course_id: string | null
          created_at: string
          date: string
          doctor_id: string
          id: string
          marked_by: string | null
          status: string
          week_number: number | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          date?: string
          doctor_id: string
          id?: string
          marked_by?: string | null
          status?: string
          week_number?: number | null
        }
        Update: {
          course_id?: string | null
          created_at?: string
          date?: string
          doctor_id?: string
          id?: string
          marked_by?: string | null
          status?: string
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "doctor_attendance_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_behavior_records: {
        Row: {
          action_name: string
          action_type: string
          created_at: string
          doctor_id: string
          id: string
          notes: string | null
          recorded_by: string
          score_change: number
          week_number: number | null
        }
        Insert: {
          action_name: string
          action_type: string
          created_at?: string
          doctor_id: string
          id?: string
          notes?: string | null
          recorded_by: string
          score_change: number
          week_number?: number | null
        }
        Update: {
          action_name?: string
          action_type?: string
          created_at?: string
          doctor_id?: string
          id?: string
          notes?: string | null
          recorded_by?: string
          score_change?: number
          week_number?: number | null
        }
        Relationships: []
      }
      doctor_behavior_scores: {
        Row: {
          doctor_id: string
          id: string
          score: number
          updated_at: string
        }
        Insert: {
          doctor_id: string
          id?: string
          score?: number
          updated_at?: string
        }
        Update: {
          doctor_id?: string
          id?: string
          score?: number
          updated_at?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          course_id: string
          enrolled_at: string
          id: string
          status: string
          student_id: string
        }
        Insert: {
          course_id: string
          enrolled_at?: string
          id?: string
          status?: string
          student_id: string
        }
        Update: {
          course_id?: string
          enrolled_at?: string
          id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          course_id: string
          created_at: string
          grade_type: string
          grade_value: number | null
          graded_at: string
          id: string
          max_value: number | null
          notes: string | null
          student_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          grade_type?: string
          grade_value?: number | null
          graded_at?: string
          id?: string
          max_value?: number | null
          notes?: string | null
          student_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          grade_type?: string
          grade_value?: number | null
          graded_at?: string
          id?: string
          max_value?: number | null
          notes?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grades_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          created_at: string
          detected_at: string
          id: string
          incident_type: string
          room_number: string
          severity: string | null
          status: string | null
          student_id: string | null
          video_clip_url: string | null
        }
        Insert: {
          created_at?: string
          detected_at?: string
          id?: string
          incident_type: string
          room_number: string
          severity?: string | null
          status?: string | null
          student_id?: string | null
          video_clip_url?: string | null
        }
        Update: {
          created_at?: string
          detected_at?: string
          id?: string
          incident_type?: string
          room_number?: string
          severity?: string | null
          status?: string | null
          student_id?: string | null
          video_clip_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          sent_by: string
          student_id: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          sent_by: string
          student_id: string
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          sent_by?: string
          student_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recognition_log: {
        Row: {
          attempt_by: string
          confidence_score: number | null
          course_id: string | null
          created_at: string
          id: string
          recognized: boolean
          student_id: string | null
        }
        Insert: {
          attempt_by: string
          confidence_score?: number | null
          course_id?: string | null
          created_at?: string
          id?: string
          recognized?: boolean
          student_id?: string | null
        }
        Update: {
          attempt_by?: string
          confidence_score?: number | null
          course_id?: string | null
          created_at?: string
          id?: string
          recognized?: boolean
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recognition_log_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recognition_log_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          avatar_url: string | null
          created_at: string
          department_id: string | null
          email: string | null
          full_name: string
          id: string
          phone: string | null
          status: string
          student_code: string
          updated_at: string
          user_id: string | null
          year_level: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          status?: string
          student_code: string
          updated_at?: string
          user_id?: string | null
          year_level?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          status?: string
          student_code?: string
          updated_at?: string
          user_id?: string | null
          year_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "students_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_student_in_doctor_courses: {
        Args: { _doctor_id: string; _student_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "dean" | "doctor" | "student"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "dean", "doctor", "student"],
    },
  },
} as const
