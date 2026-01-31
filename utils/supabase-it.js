// utils/supabase.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL_IT;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_IT;

export const supabase = createClient(supabaseUrl, supabaseKey);
