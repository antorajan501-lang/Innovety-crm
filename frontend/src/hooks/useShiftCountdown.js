import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

export const useShiftCountdown = ({
  shiftEndAt,
  serverTime,
  autoClockOutEnabled = true,
  isClockedIn = false,
  onShiftEnd
}) => {
  const serverOffsetRef = useRef(0);
  const onShiftEndRef = useRef(onShiftEnd);
  onShiftEndRef.current = onShiftEnd;

  const hasTriggeredShiftEndRef = useRef(false);

  useEffect(() => {
    if (serverTime) {
      const serverMs = new Date(serverTime).getTime();
      const localMs = Date.now();
      if (!isNaN(serverMs)) {
        serverOffsetRef.current = serverMs - localMs;
      }
    }
  }, [serverTime]);

  // Reset trigger ref on new clock-in
  useEffect(() => {
    if (!isClockedIn) {
      hasTriggeredShiftEndRef.current = false;
    }
  }, [isClockedIn]);

  const targetEndMs = useMemo(() => {
    if (!shiftEndAt || !isClockedIn) return null;
    const ms = new Date(shiftEndAt).getTime();
    return isNaN(ms) ? null : ms;
  }, [shiftEndAt, isClockedIn]);

  const calculateRemaining = useCallback(() => {
    if (!targetEndMs || !isClockedIn) {
      return 0;
    }
    const currentServerMs = Date.now() + serverOffsetRef.current;
    const diffSeconds = Math.floor((targetEndMs - currentServerMs) / 1000);
    return Math.max(0, diffSeconds);
  }, [targetEndMs, isClockedIn]);

  const [secondsRemaining, setSecondsRemaining] = useState(calculateRemaining);

  useEffect(() => {
    const initial = calculateRemaining();
    setSecondsRemaining(initial);
  }, [calculateRemaining, isClockedIn]);

  useEffect(() => {
    if (!targetEndMs || !isClockedIn) {
      setSecondsRemaining(0);
      return;
    }

    const timer = setInterval(() => {
      const remaining = calculateRemaining();
      setSecondsRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        if (!hasTriggeredShiftEndRef.current) {
          hasTriggeredShiftEndRef.current = true;
          console.log('[AutoClockOut] Countdown reached 00:00:00. Triggering single shift end state refresh');
          if (typeof onShiftEndRef.current === 'function') {
            onShiftEndRef.current();
          }
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetEndMs, isClockedIn, calculateRemaining]);

  const hours = Math.floor(secondsRemaining / 3600);
  const minutes = Math.floor((secondsRemaining % 3600) / 60);
  const seconds = secondsRemaining % 60;

  const formattedHours = isClockedIn ? String(hours).padStart(2, '0') : '--';
  const formattedMinutes = isClockedIn ? String(minutes).padStart(2, '0') : '--';
  const formattedSeconds = isClockedIn ? String(seconds).padStart(2, '0') : '--';
  const formattedRemaining = isClockedIn ? `${formattedHours}:${formattedMinutes}:${formattedSeconds}` : '--:--';

  const targetEndTimeFormatted = (isClockedIn && targetEndMs)
    ? new Date(targetEndMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  const isExpired = (isClockedIn && targetEndMs) ? secondsRemaining <= 0 : false;

  return {
    hours: formattedHours,
    minutes: formattedMinutes,
    seconds: formattedSeconds,
    formattedTime: formattedRemaining,
    formattedRemaining,
    secondsRemaining,
    isExpired,
    targetEndTimeFormatted,
    autoClockOutEnabled: Boolean(autoClockOutEnabled)
  };
};

export default useShiftCountdown;
