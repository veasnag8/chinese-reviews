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
  | "quiz_attempts";

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
    };
    Enums: {
      [key: string]: string[];
    };
    CompositeTypes: {
      [key: string]: any;
    };
  };
}