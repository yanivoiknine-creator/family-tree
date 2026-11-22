import { useEffect, useState } from 'react';

/** Phone layout: the same breakpoint as the mobile rules in styles.css. */
export const MOBILE_QUERY = '(max-width: 720px)';

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const mq = matchMedia(MOBILE_QUERY);
    const on = () => setMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
}

/** Vertical swipe on an element: calls back with 'up' or 'down' after a clear drag. */
export function swipeHandlers(onSwipe: (dir: 'up' | 'down' | 'left' | 'right') => void, min = 40) {
  let x0 = 0, y0 = 0;
  return {
    onTouchStart: (e: React.TouchEvent) => {
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return;
      if (Math.abs(dy) > Math.abs(dx)) onSwipe(dy < 0 ? 'up' : 'down');
      else onSwipe(dx < 0 ? 'left' : 'right');
    },
  };
}
