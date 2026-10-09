import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Task = {
  id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  created_at: string;
};

export type TaskInsert = {
  title: string;
  description?: string | null;
  deadline?: string | null;
  priority?: 'low' | 'medium' | 'high';
};
