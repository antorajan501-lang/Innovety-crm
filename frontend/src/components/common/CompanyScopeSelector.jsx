import React from 'react';
import { Building2, Lock } from 'lucide-react';
import { useCompanyScope } from '../../context/CompanyScopeContext';
import { useAuth } from '../../context/AuthContext';

const CompanyScopeSelector = ({ onScopeChange, className = '', allowAllCompanies = false }) => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  if (!isSuperAdmin) {
    return null;
  }

  const { companies, selectedOrgId, setSelectedOrgId, selectedCompany, loading: companiesLoading } = useCompanyScope();
  const safeCompanies = Array.isArray(companies) ? companies : [];

  const handleCompanyChange = (e) => {
    if (!isSuperAdmin) return;
    const newId = e.target.value;
    setSelectedOrgId(newId);
    if (onScopeChange) {
      onScopeChange(newId);
    }
  };

  const userOrgName = user?.organization?.name || user?.organizationName;

  const currentDisplayName = selectedOrgId === 'all'
    ? 'All Companies'
    : (selectedCompany?.name || selectedCompany?.companyName || 
      safeCompanies.find((c) => c.id === selectedOrgId)?.name || 
      userOrgName ||
      (safeCompanies.length > 0 ? safeCompanies[0]?.name : ''));

  return (
    <div className={`p-4 rounded-3xl bg-card border border-border/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`}>
      <div className="flex items-center gap-3 flex-1">
        <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-extrabold text-xs shrink-0 flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          <span>Company:</span>
        </div>

        {isSuperAdmin ? (
          <div className="relative flex-1 max-w-md">
            <select
              id="global-company-scope-selector"
              value={selectedOrgId || (allowAllCompanies ? 'all' : (safeCompanies.length > 0 ? safeCompanies[0]?.id : ''))}
              onChange={handleCompanyChange}
              className="w-full pl-4 pr-10 py-2.5 text-xs font-extrabold rounded-2xl border border-border/60 bg-muted/30 focus:bg-background focus:ring-2 focus:ring-emerald-500/20 outline-none cursor-pointer text-foreground appearance-none"
            >
              {companiesLoading ? (
                <option value="">Loading companies...</option>
              ) : safeCompanies.length === 0 ? (
                <option value="">No companies available</option>
              ) : (
                <>
                  {allowAllCompanies && <option value="all">All Companies (ALL)</option>}
                  {safeCompanies.map((c) => (
                    <option key={c.id || c._id} value={c.id || c._id}>
                      {c.name || c.companyName} ({c.companyCode || c.code || 'ORG'}) {c.slug === 'innoveity' ? '• Default Tenant' : ''}
                    </option>
                  ))}
                </>
              )}
            </select>
            <div className="absolute right-3.5 top-3 pointer-events-none text-muted-foreground text-xs font-bold">
              ▼
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-border/60 bg-muted/20 text-xs font-extrabold text-foreground">
            <span>{currentDisplayName || 'Assigned Organization'}</span>
            <Lock className="h-3.5 w-3.5 text-muted-foreground ml-1" title="Company scope is locked to your organization" />
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground font-medium px-2 flex items-center gap-1.5">
        <span>Managing company scope:</span>
        <strong className="text-emerald-600 font-extrabold flex items-center gap-1">
          {currentDisplayName || 'Selected Company'}
          {!isSuperAdmin && <Lock className="h-3 w-3 text-muted-foreground inline" />}
        </strong>
      </div>
    </div>
  );
};

export default CompanyScopeSelector;

