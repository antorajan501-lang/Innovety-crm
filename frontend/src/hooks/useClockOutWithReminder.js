import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export const useClockOutWithReminder = (user, onExecuteClockOut) => {
  const navigate = useNavigate();
  const [reminderModal, setReminderModal] = useState({
    isOpen: false,
    isDraft: false,
    hasWorkLog: false
  });

  const handleClockOut = useCallback(async (forceAnyway = false) => {
    if (!forceAnyway && ['INTERN', 'EMPLOYEE', 'TEAM_LEADER'].includes(user?.role)) {
      try {
        const todayRes = await api.get('/worklogs/today-status');
        const { isSubmitted, isDraft, hasWorkLog } = todayRes.data;
        console.log('[CLOCKOUT] today-status', todayRes.data);

        // If today's Daily Work Log is NOT submitted, intercept and open the reminder modal
        if (!isSubmitted) {
          console.log('[CLOCKOUT] Opening reminder');
          setReminderModal({
            isOpen: true,
            isDraft: Boolean(isDraft),
            hasWorkLog: Boolean(hasWorkLog)
          });
          return; // STOP execution immediately
        }
      } catch (err) {
        console.error('[CLOCKOUT] Failed to check today work log status:', err);
      }
    }

    setReminderModal({ isOpen: false, isDraft: false, hasWorkLog: false });
    if (onExecuteClockOut) {
      console.log('[CLOCKOUT] Executing attendance clock-out');
      await onExecuteClockOut();
    }
  }, [user, onExecuteClockOut]);

  const closeModal = useCallback(() => {
    setReminderModal(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleCompleteWorkLog = useCallback(() => {
    closeModal();
    navigate('/worklogs');
  }, [closeModal, navigate]);

  const handleClockOutAnyway = useCallback(() => {
    closeModal();
    handleClockOut(true);
  }, [closeModal, handleClockOut]);

  return {
    reminderModal,
    handleClockOut,
    closeModal,
    handleCompleteWorkLog,
    handleClockOutAnyway
  };
};

export default useClockOutWithReminder;
