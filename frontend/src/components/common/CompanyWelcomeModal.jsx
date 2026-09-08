import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, CheckCircle2, ShieldCheck, Clock, Building2, ArrowRight, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useOrganizationBranding } from '../../context/BrandContext';
import { formatWorkingHoursRange } from '../../utils/attendanceFormatter';

const CompanyWelcomeModal = () => {
  const { user, completeWelcomePopup } = useAuth();
  const { branding } = useOrganizationBranding();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'SUPER_ADMIN' && user.organizationId) {
      const storageKey = `company_welcome_dismissed_${user.id}`;
      const localDismissed = localStorage.getItem(storageKey) === 'true';
      if (!user.welcomePopupSeen && !localDismissed) {
        setOpen(true);
      } else {
        setOpen(false);
      }
    } else {
      setOpen(false);
    }
  }, [user?.id, user?.welcomePopupSeen, user?.role, user?.organizationId]);

  const handleDismiss = async () => {
    setOpen(false);
    if (user) {
      await completeWelcomePopup();
    }
  };

  if (!open || !user || user.role === 'SUPER_ADMIN') return null;

  const companyName = branding?.companyName || user.organization?.name || 'INNOVEITY';
  const primaryColor = branding?.primaryColor || '#10B981';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="w-full max-w-md rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-2xl space-y-6 text-left my-8 relative overflow-hidden"
        >
          {/* Header Banner */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="h-12 w-12 rounded-2xl flex items-center justify-center text-white font-extrabold shadow-lg overflow-hidden shrink-0"
                style={{ backgroundColor: primaryColor }}
              >
                {branding?.logo ? (
                  <img src={branding.logo} alt="Logo" className="h-full w-full object-cover" />
                ) : (
                  <Sparkles className="h-6 w-6" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-black text-foreground tracking-tight">Welcome to {companyName}!</h3>
                <p className="text-xs text-muted-foreground font-semibold">Your organization CRM workspace is ready.</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Setup Checklist */}
          <div className="p-4 rounded-2xl bg-muted/40 border border-border/60 space-y-3 font-medium text-xs">
            <div className="flex items-center gap-2.5 text-foreground font-bold">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Workspace & Tenant Directory Configured</span>
            </div>
            <div className="flex items-center gap-2.5 text-foreground font-bold">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Company Administrator Account Provisioned</span>
            </div>
            <div className="flex items-center gap-2.5 text-foreground font-bold">
              <Clock className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Working Hours: {formatWorkingHoursRange(branding?.clockInTime, branding?.clockOutTime)}</span>
            </div>
            <div className="flex items-center gap-2.5 text-foreground font-bold">
              <Building2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Isolated Data & Attendance Rules Active</span>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleDismiss}
            className="w-full py-3 rounded-2xl text-white text-xs font-extrabold transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2"
            style={{
              backgroundColor: primaryColor,
              boxShadow: `0 8px 20px -4px ${primaryColor}40`
            }}
          >
            <span>Explore {companyName} CRM</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CompanyWelcomeModal;
