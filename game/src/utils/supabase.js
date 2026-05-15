import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

export const supabase = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

/** 닉네임 정제: 제어문자 제거, 1~12자 제한 */
function sanitizeNickname(raw) {
  return String(raw ?? '')
    .replace(/[\x00-\x1f\x7f]/g, '') // 제어문자 제거
    .trim()
    .slice(0, 12);
}

/** 점수 등록 — 클라이언트 측 범위 검증 포함 */
export async function submitScore(nickname, score, stageId, stageName) {
  if (!supabase) return false;

  const cleanNick = sanitizeNickname(nickname);
  if (!cleanNick) return false;

  // 점수 범위: 0 ~ 9,999,999 (스테이지당 현실적 최대치 이상)
  const cleanScore    = Math.floor(Math.max(0, Math.min(Number(score) || 0, 9_999_999)));
  const cleanStageId  = Math.floor(Math.abs(Number(stageId) || 0));
  const cleanStageName = String(stageName ?? '').replace(/[\x00-\x1f]/g, '').slice(0, 50);

  const { error } = await supabase
    .from('leaderboard')
    .insert({ nickname: cleanNick, score: cleanScore, stage_id: cleanStageId, stage_name: cleanStageName });
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
