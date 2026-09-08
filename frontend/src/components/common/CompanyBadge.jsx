import React from 'react';
import { Building2 } from 'lucide-react';
import { getUploadUrl } from '../../services/api';

const CompanyBadge = ({ organization, size = 'sm', className = '' }) => {
  if (!organization || !organization.name) {
    return <span className="text-muted-foreground font-medium">—</span>;
  }

  const name = organization.name;
  const logo = organization.logo || null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-bold text-[11px] uppercase tracking-wider shrink-0 shadow-2xs ${className}`}
      title={`Organization: ${name}`}
    >
      {logo ? (
        <img
          src={getUploadUrl(logo)}
          alt={name}
          className="h-3.5 w-3.5 object-contain rounded-full shrink-0"
        />
      ) : (
        <Building2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
      )}
      <span className="truncate max-w-[140px]">{name}</span>
    </span>
  );
};

export default CompanyBadge;
