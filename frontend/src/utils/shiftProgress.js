/**
 * Shift Progress Color & Target Calculation Utility
 */

export const getTargetShiftHours = (clockInStr = '09:00', clockOutStr = '18:00') => {
  if (!clockInStr || !clockOutStr) return 8.0;
  const [inH, inM] = String(clockInStr).split(':').map(Number);
  const [outH, outM] = String(clockOutStr).split(':').map(Number);
  if (isNaN(inH) || isNaN(inM) || isNaN(outH) || isNaN(outM)) return 8.0;
  const diff = (outH * 60 + outM - (inH * 60 + inM)) / 60;
  return diff > 0 ? Math.round(diff * 10) / 10 : 8.0;
};

export const getShiftProgressColor = (percentage) => {
  if (percentage <= 25) {
    return {
      bg: 'bg-[#EF4444]',
      text: 'text-[#EF4444]',
      hex: '#EF4444',
      label: '0–25%'
    };
  }
  if (percentage <= 50) {
    return {
      bg: 'bg-[#F97316]',
      text: 'text-[#F97316]',
      hex: '#F97316',
      label: '26–50%'
    };
  }
  if (percentage <= 75) {
    return {
      bg: 'bg-[#EAB308]',
      text: 'text-[#EAB308]',
      hex: '#EAB308',
      label: '51–75%'
    };
  }
  if (percentage < 100) {
    return {
      bg: 'bg-[#16A34A]',
      text: 'text-[#16A34A]',
      hex: '#16A34A',
      label: '76–100%'
    };
  }
  return {
    bg: 'bg-[#15803D]',
    text: 'text-[#15803D]',
    hex: '#15803D',
    label: '100%+'
  };
};
