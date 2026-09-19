type SupabaseTimeStamp = "at time zone 'utc'";

type Tables = 
  | "profiles"
  | "classes"
  | "words"
  | "sentences"
  | "categories"
  | "hsk_levels"
  | "review_items"
  | "review_history"
  | "favorites"
  | "study_sessions"
  | "quiz_questions"
  | "quiz_attempts"
  | "quiz_notifications"
  | "quizzes"
  | "quiz_items"
  | "quiz_options"
  | "quiz_submissions"
  | "quiz_submission_answers";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name?: string;
          native_language?: string;
          target_language?: string;
          avatar_url?: string;
          role?: "student" | "teacher" | "admin";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string;
          native_language?: string;
          target_language?: string;
          avatar_url?: string;
          role?: "student" | "teacher" | "admin";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          native_language?: string;
          target_language?: string;
          avatar_url?: string;
          role?: "student" | "teacher" | "admin";
          updated_at?: string;
        };
      };
      classes: {
        Row: {
          id: string;
          name: string;
          description?: string;
          teacher?: string;
          lesson_number?: number;
          date: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          teacher?: string;
          lesson_number?: number;
          date: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          teacher?: string;
          lesson_number?: number;
          date?: string;
          updated_at?: string;
        };
      };
      words: {
        Row: {
          id: string;
          chinese: string;
          pinyin?: string;
          khmer?: string;
          english?: string;
          part_of_speech?: string;
          example_sentence?: string;
          example_pinyin?: string;
          example_khmer?: string;
          hsk_level?: number;
          category?: string;
          image_url?: string;
          audio_url?: string;
          writing_character?: string;
          audio_provider?: string;
          audio_voice?: string;
          class_id?: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          chinese: string;
          pinyin?: string;
          khmer?: string;
          english?: string;
          part_of_speech?: string;
          example_sentence?: string;
          example_pinyin?: string;
          example_khmer?: string;
          hsk_level?: number;
          category?: string;
          image_url?: string;
          audio_url?: string;
          writing_character?: string;
          audio_provider?: string;
          audio_voice?: string;
          class_id?: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          chinese?: string;
          pinyin?: string;
          khmer?: string;
          english?: string;
          part_of_speech?: string;
          example_sentence?: string;
          example_pinyin?: string;
          example_khmer?: string;
          hsk_level?: number;
          category?: string;
          image_url?: string;
          audio_url?: string;
          writing_character?: string;
          audio_provider?: string;
          audio_voice?: string;
          class_id?: string;
          updated_at?: string;
        };
      };
      sentences: {
        Row: {
          id: string;
          chinese_sentence: string;
          pinyin?: string;
          khmer_translation?: string;
          english_translation?: string;
          audio_url?: string;
          audio_provider?: string;
          audio_voice?: string;
          class_id?: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          chinese_sentence: string;
          pinyin?: string;
          khmer_translation?: string;
          english_translation?: string;
          audio_url?: string;
          audio_provider?: string;
          audio_voice?: string;
          class_id?: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          chinese_sentence?: string;
          pinyin?: string;
          khmer_translation?: string;
          english_translation?: string;
          audio_url?: string;
          audio_provider?: string;
          audio_voice?: string;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          updated_at?: string;
        };
      };
      hsk_levels: {
        Row: {
          id: string;
          level: number;
          name: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          level: number;
          name: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          level?: number;
          name?: string;
          updated_at?: string;
        };
      };
      review_items: {
        Row: {
          id: string;
          user_id: string;
          word_id?: string;
          sentence_id?: string;
          item_type: "word" | "sentence";
          chinese: string;
          pinyin?: string;
          khmer?: string;
          english?: string;
          due_date: string;
          last_reviewed?: string;
          next_review: string;
          review_count: number;
          correct_count: number;
          wrong_count: number;
          difficulty: "easy" | "good" | "hard";
        };
        Insert: {
          id?: string;
          user_id: string;
          word_id?: string;
          sentence_id?: string;
          item_type: "word" | "sentence";
          chinese: string;
          pinyin?: string;
          khmer?: string;
          english?: string;
          due_date: string;
          last_reviewed?: string;
          next_review: string;
          review_count?: number;
          correct_count?: number;
          wrong_count?: number;
          difficulty?: "easy" | "good" | "hard";
        };
        Update: {
          id?: string;
          word_id?: string;
          sentence_id?: string;
          item_type?: "word" | "sentence";
          chinese?: string;
          pinyin?: string;
          khmer?: string;
          english?: string;
          due_date?: string;
          last_reviewed?: string;
          next_review?: string;
          review_count?: number;
          correct_count?: number;
          wrong_count?: number;
          difficulty?: "easy" | "good" | "hard";
        };
      };
      review_history: {
        Row: {
          id: string;
          user_id: string;
          item_id: string;
          item_type: "word" | "sentence";
          correct: boolean;
          difficulty: "easy" | "good" | "hard";
          completed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          item_id: string;
          item_type: "word" | "sentence";
          correct: boolean;
          difficulty: "easy" | "good" | "hard";
          completed_at?: string;
        };
        Update: {
          id?: string;
        };
      };
      favorites: {
        Row: {
          id: string;
          user_id: string;
          word_id?: string;
          sentence_id?: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          word_id?: string;
          sentence_id?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
        };
      };
      study_sessions: {
        Row: {
          id: string;
          user_id: string;
          started_at: string;
          completed_at?: string;
          items_count: number;
          correct_count: number;
          wrong_count: number;
          accuracy: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          started_at: string;
          completed_at?: string;
          items_count: number;
          correct_count: number;
          wrong_count: number;
          accuracy: number;
        };
        Update: {
          id?: string;
          completed_at?: string;
        };
      };
      quiz_questions: {
        Row: {
          id: string;
          question_type: "chinese-to-meaning" | "meaning-to-chinese" | "pinyin" | "listening" | "sentence" | "translation";
          chinese: string;
          pinyin?: string;
          khmer?: string;
          english?: string;
          correct_answer: string;
          options?: string[];
          class_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          question_type: "chinese-to-meaning" | "meaning-to-chinese" | "pinyin" | "listening" | "sentence" | "translation";
          chinese: string;
          pinyin?: string;
          khmer?: string;
          english?: string;
          correct_answer: string;
          options?: string[];
          class_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          question_type?: "chinese-to-meaning" | "meaning-to-chinese" | "pinyin" | "listening" | "sentence" | "translation";
          chinese?: string;
          pinyin?: string | null;
          khmer?: string | null;
          english?: string | null;
          correct_answer?: string;
          options?: string[];
          class_id?: string | null;
          user_id?: string;
          created_at?: string;
        };
      };
      quiz_attempts: {
        Row: {
          id: string;
          user_id: string;
          quiz_id: string;
          question_id: string;
          selected_answer?: string;
          is_correct: boolean;
          time_spent: number;
          completed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          quiz_id: string;
          question_id: string;
          selected_answer?: string;
          is_correct: boolean;
          time_spent: number;
          completed_at?: string;
        };
        Update: {
          id?: string;
        };
      };
      quiz_notifications: {
        Row: {
          id: string;
          user_id: string;
          display_name: string | null;
          type: string;
          message: string;
          title: string | null;
          quiz_id: string | null;
          link: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          display_name?: string | null;
          type?: string;
          message: string;
          title?: string | null;
          quiz_id?: string | null;
          link?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
        };
      };
      quizzes: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          category: string | null;
          hsk_level: number | null;
          status: "draft" | "active" | "inactive" | "expired" | "archived";
          start_at: string | null;
          deadline: string | null;
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          category?: string | null;
          hsk_level?: number | null;
          status?: "draft" | "active" | "inactive" | "expired" | "archived";
          start_at?: string | null;
          deadline?: string | null;
          user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          category?: string | null;
          hsk_level?: number | null;
          status?: "draft" | "active" | "inactive" | "expired" | "archived";
          start_at?: string | null;
          deadline?: string | null;
          user_id?: string;
          updated_at?: string;
        };
      };
      quiz_items: {
        Row: {
          id: string;
          quiz_id: string;
          question: string;
          question_type: "single" | "multiple" | "true-false";
          explanation: string | null;
          hint: string | null;
          word_id: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          question: string;
          question_type?: "single" | "multiple" | "true-false";
          explanation?: string | null;
          hint?: string | null;
          word_id?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          quiz_id?: string;
          question?: string;
          question_type?: "single" | "multiple" | "true-false";
          explanation?: string | null;
          hint?: string | null;
          word_id?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
      };
      quiz_options: {
        Row: {
          id: string;
          question_id: string;
          option_text: string;
          is_correct: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          option_text: string;
          is_correct?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          question_id?: string;
          option_text?: string;
          is_correct?: boolean;
          sort_order?: number;
        };
      };
      quiz_submissions: {
        Row: {
          id: string;
          quiz_id: string;
          user_id: string;
          started_at: string | null;
          submitted_at: string | null;
          score: number;
          total_questions: number;
          correct_answers: number;
          wrong_answers: number;
          percentage: number;
          status: "in_progress" | "submitted" | "expired";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          user_id: string;
          started_at?: string | null;
          submitted_at?: string | null;
          score?: number;
          total_questions?: number;
          correct_answers?: number;
          wrong_answers?: number;
          percentage?: number;
          status?: "in_progress" | "submitted" | "expired";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          submitted_at?: string | null;
          score?: number;
          total_questions?: number;
          correct_answers?: number;
          wrong_answers?: number;
          percentage?: number;
          status?: "in_progress" | "submitted" | "expired";
          updated_at?: string;
        };
      };
      quiz_submission_answers: {
        Row: {
          id: string;
          attempt_id: string;
          question_id: string;
          selected_option_id: string | null;
          correct_option_id: string | null;
          is_correct: boolean;
          answered_at: string | null;
        };
        Insert: {
          id?: string;
          attempt_id: string;
          question_id: string;
          selected_option_id?: string | null;
          correct_option_id?: string | null;
          is_correct?: boolean;
          answered_at?: string | null;
        };
        Update: {
          id?: string;
          selected_option_id?: string | null;
          correct_option_id?: string | null;
          is_correct?: boolean;
          answered_at?: string | null;
        };
      };
    };
    Views: {
      [key: string]: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
    };
    Functions: {
      save_quiz: {
        Args: {
          p_quiz_id: string | null;
          p_title: string;
          p_description: string | null;
          p_category: string | null;
          p_hsk_level: number | null;
          p_status: string | null;
          p_start_at: string | null;
          p_deadline: string | null;
          p_questions: unknown[];
        };
        Returns: string;
      };
      get_student_quiz: {
        Args: { p_quiz_id: string };
        Returns: any;
      };
      start_quiz_attempt: {
        Args: { p_quiz_id: string };
        Returns: any;
      };
      submit_quiz_attempt: {
        Args: { p_quiz_id: string; p_answers: unknown[] };
        Returns: any;
      };
      get_student_result: {
        Args: { p_quiz_id: string };
        Returns: any;
      };
      has_quiz_attempt: {
        Args: { p_quiz_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      [key: string]: string[];
    };
    CompositeTypes: {
      [key: string]: any;
    };
  };
}