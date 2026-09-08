import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Copy, Check, ShieldCheck, Building2, Key, Mail, X, Layers } from 'lucide-react';

const CompanyProvisionSuccessModal = ({ isOpen, onClose, data }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !data) return null;

  const { organization, admin } = data;

  const credentialsText = `Company Name: ${organization?.name}\nCompany Code: ${organization?.companyCode}\nAdmin Email: ${admin?.email}\nTemporary Password: ${admin?.temporaryPassword}\nLogin Portal: ${window.location.origin}/login`;

  const handleCopy = () => {
    navigator.clipboard.writeText(credentialsText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="w-full max-w-lg rounded-3xl border border-emerald-500/30 bg-card p-6 sm:p-8 shadow-2xl space-y-6 text-left my-8 relative overflow-hidden"
        >
          {/* Top Gradient Banner */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-xl font-black text-foreground tracking-tight">Company Provisioned!</h3>
                <p className="text-xs text-muted-foreground font-semibold">
                  Workspace and Administrator account created successfully.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Company Profile Card */}
          <div className="p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Building2 className="h-4 w-4 text-emerald-600" />
                <span className="font-extrabold text-base text-foreground">{organization?.name}</span>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                {organization?.companyCode}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-medium pt-1 border-t border-border/40">
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Admin Email:</span>
                <span className="font-bold text-foreground truncate">{admin?.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Key className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Temp Password:</span>
                <span className="font-mono font-extrabold text-emerald-600">{admin?.temporaryPassword}</span>
              </div>
            </div>
          </div>

          {/* Provisioning Checklist */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-emerald-600" /> Provisioned Infrastructure Checklist
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Workspace Created</span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Settings Configured</span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>Company Admin Active</span>
              </div>
            </div>
          </div>

          {/* Warning Notice */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-medium flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Save these credentials now. The temporary password will not be displayed again.</span>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={handleCopy}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-xs transition-all cursor-pointer border ${
                copied
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Credentials Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy Credentials</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl bg-muted hover:bg-muted/80 text-foreground text-xs font-bold transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CompanyProvisionSuccessModal;
