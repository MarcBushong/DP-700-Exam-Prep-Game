import { useEffect, useState } from 'react';
import { useGame } from '../features/quiz/context';
import { remainingSeconds } from '../features/quiz/engine';

export function useSessionTimer(flagged = false) {
  const { active, expireTimer } = useGame();
  useEffect(() => {
    if (!active || active.config.timerMode === 'off') return;
    const response = active.responses.find(
      (item) => item.questionId === active.questions[active.currentIndex].id,
    );
    if (response && active.config.timerMode === 'question') return;
    const check = () => {
      if (remainingSeconds(active, Date.now()) === 0) expireTimer(flagged);
    };
    check();
    const interval = window.setInterval(check, 250);
    const onVisible = () => {
      if (!document.hidden) check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active, expireTimer, flagged]);
}

export function useNow(running: boolean) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, [running]);
  return now;
}
