import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

export const supabase = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

/** 점수 등록 */
export async function submitScore(nickname, score, stageId, stageName) {
  if (!supabase) return false;
  const { error } = await supabase
    .from('leaderboard')
    .insert({ nickname, score, stage_id: stageId, stage_name: stageName });
  return !error;
}

/** 글로벌 상위 50개 조회 */
export async function fetchGlobalLeaderboard(limit = 50) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('leaderboard')
    .select('nickname, score, stage_id, stage_name, created_at')
    .order('score', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data;
}
