const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://htzckhfuozezgellhzpt.supabase.co";
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || 0;

const supabase = createClient(supabaseUrl, supabaseKey);

// Export using CommonJS module format
module.exports = { supabase };
