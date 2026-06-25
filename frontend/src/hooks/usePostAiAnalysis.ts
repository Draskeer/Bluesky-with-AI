/**
 * Hook qui pilote l'analyse IA (n8n) d'UN SEUL post, porté par le composant message
 * (PostCard) plutôt que par la page.
 *
 * - Au montage : vérification EN LECTURE SEULE (GET /analysis/results, ne déclenche
 *   pas n8n). Si le post est déjà analysé -> on expose directement l'analyse (badge).
 *   S'il est déjà en cours ailleurs -> on poll. Sinon -> rien, le composant affiche
 *   le bouton « Analyser ».
 * - `start()` : déclenche réellement l'analyse (POST /analysis/request) à la demande,
 *   puis poll tant que le post est "pending". Lancer tous les posts d'un coup au
 *   chargement était trop lourd, d'où ce déclenchement manuel.
 * - Abandonne après MAX_POLLS -> "failed" (bouton « Relancer »).
 * - Renvoie { analysis, start } consommé par PostCard.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import type { AiAnalysis, AiPostInput } from '../services/api';
import type { BlueskyPost } from '../types';

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 45; // ~135s : > TTL backend (120s) pour récupérer l'état 'failed'

export interface UsePostAiAnalysis {
  analysis?: AiAnalysis;
  /** Lance (ou relance) l'analyse à la demande. */
  start: () => void;
}

export function usePostAiAnalysis(post: BlueskyPost, enabled = true): UsePostAiAnalysis {
  const [analysis, setAnalysis] = useState<AiAnalysis | undefined>(undefined);

  const msgId = post.uri;
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  // Entrée IA courante (ref -> start()/tick() restent à jour sans réabonner les effets)
  const inputRef = useRef<AiPostInput>({ msg_id: msgId, message: '', user: '' });
  inputRef.current = {
    msg_id: msgId,
    message: post.record?.text || '',
    user: post.author?.handle || post.author?.did || '',
  };

  // Vérification lecture seule au montage : badge si déjà analysé, sinon bouton.
  useEffect(() => {
    pollCountRef.current = 0;
    setAnalysis(undefined);
    if (!enabled) return;

    let cancelled = false;
    api.analysis.results([msgId]).then((res) => {
      if (cancelled || !res.success || !res.data) return;
      const r = res.data.results[msgId];
      // 'done' -> badge ; 'pending' -> déjà en cours ailleurs, on poll.
      // 'failed'/absent -> jamais analysé : on laisse undefined (bouton « Analyser »).
      if (r && (r.status === 'done' || r.status === 'pending')) {
        setAnalysis(r);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [msgId, enabled]);

  // Lancement à la demande : passe en "pending" puis déclenche /request
  const start = useCallback(() => {
    pollCountRef.current = 0;
    setAnalysis({ status: 'pending' });
    api.analysis.request([inputRef.current]).then((res) => {
      if (!res.success || !res.data) return;
      const result = res.data.results[inputRef.current.msg_id];
      if (result) setAnalysis(result);
    });
  }, []);

  // Poll les résultats tant que le post est "pending"
  useEffect(() => {
    const stopPolling = () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    // Ne poll que si une analyse est en cours
    if (!analysis || analysis.status !== 'pending') {
      stopPolling();
      return;
    }

    const tick = async () => {
      // Abandon après MAX_POLLS : bascule en "failed" (-> bouton « Relancer »).
      if (pollCountRef.current >= MAX_POLLS) {
        stopPolling();
        setAnalysis({ status: 'failed' });
        return;
      }

      pollCountRef.current += 1;
      const res = await api.analysis.results([msgId]);
      if (res.success && res.data && res.data.results[msgId]) {
        setAnalysis(res.data.results[msgId]);
      }
    };

    if (!pollTimerRef.current) {
      pollTimerRef.current = setInterval(tick, POLL_INTERVAL_MS);
    }

    return stopPolling;
  }, [msgId, analysis]);

  return { analysis, start };
}
