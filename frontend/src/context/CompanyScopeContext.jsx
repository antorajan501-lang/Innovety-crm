import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { getSocket } from '../services/api';
import { useAuth } from './AuthContext';

const CompanyScopeContext = createContext(null);

export const extractCompanyList = (responseData) => {
  if (Array.isArray(responseData)) return responseData;
  if (Array.isArray(responseData?.data)) return responseData.data;
  if (Array.isArray(responseData?.organizations)) return responseData.organizations;
  if (Array.isArray(responseData?.companies)) return responseData.companies;
  if (Array.isArray(responseData?.items)) return responseData.items;
  return [];
};

export const CompanyScopeProvider = ({ children }) => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const userOrgId = user?.organizationId || user?.organization?.id || '';

  const [companies, setCompanies] = useState([]);
  const [selectedOrgIdState, setSelectedOrgIdState] = useState(() => {
    if (user && user.role !== 'SUPER_ADMIN') {
      return user.organizationId || user.organization?.id || '';
    }
    return localStorage.getItem('mrf_selected_company_id') || '';
  });
  const [loading, setLoading] = useState(true);

  // Strictly enforce selectedOrgId based on user role
  const selectedOrgId = isSuperAdmin
    ? selectedOrgIdState
    : (userOrgId || selectedOrgIdState);

  const effectiveOrgId = isSuperAdmin
    ? selectedOrgId
    : (userOrgId || selectedOrgIdState || user?.organizationId || '');

  const safeCompanies = Array.isArray(companies) ? companies : [];

  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/organizations');
      const comps = extractCompanyList(res.data);
      setCompanies(comps);

      if (isSuperAdmin) {
        if (comps.length > 0) {
          const targetId = selectedOrgIdState || localStorage.getItem('mrf_selected_company_id');
          const isValidTarget = targetId && (targetId === 'all' || comps.some((c) => (c.id || c._id) === targetId));

          if (isValidTarget) {
            setSelectedOrgIdState(targetId);
            return targetId;
          }

          // If target company was deleted or invalid, fallback to userOrg or innoveity or comps[0]
          const userOrg = comps.find((c) => (c.id || c._id) === userOrgId);
          const defaultOrg = userOrg || comps.find((c) => c.slug === 'innoveity' || c.companyCode === 'INN001') || comps[0];

          if (defaultOrg) {
            const defId = defaultOrg.id || defaultOrg._id;
            console.log('[CompanyScopeContext] Selected organization no longer exists. Switching to default:', defId);
            setSelectedOrgIdState(defId);
            localStorage.setItem('mrf_selected_company_id', defId);
            return defId;
          } else {
            setSelectedOrgIdState('all');
            localStorage.setItem('mrf_selected_company_id', 'all');
            return 'all';
          }
        }
      } else {
        if (userOrgId) {
          setSelectedOrgIdState(userOrgId);
        }
      }
    } catch (err) {
      console.error('Failed to fetch company list:', err);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
    return selectedOrgId;
  }, [userOrgId, isSuperAdmin, selectedOrgIdState, selectedOrgId]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Real-time synchronization for deleted/created/updated companies
  useEffect(() => {
    const handleOrgUpdate = () => {
      console.log('[CompanyScopeContext] Organization update detected. Refreshing organization list...');
      fetchCompanies();
    };

    window.addEventListener('organization-updated', handleOrgUpdate);

    const socket = getSocket();
    if (socket) {
      socket.off('organization_deleted', handleOrgUpdate);
      socket.off('organization_created', handleOrgUpdate);
      socket.off('organization_updated', handleOrgUpdate);

      socket.on('organization_deleted', handleOrgUpdate);
      socket.on('organization_created', handleOrgUpdate);
      socket.on('organization_updated', handleOrgUpdate);
    }

    return () => {
      window.removeEventListener('organization-updated', handleOrgUpdate);
      if (socket) {
        socket.off('organization_deleted', handleOrgUpdate);
        socket.off('organization_created', handleOrgUpdate);
        socket.off('organization_updated', handleOrgUpdate);
      }
    };
  }, [fetchCompanies]);

  useEffect(() => {
    if (!user) {
      setSelectedOrgIdState('');
      localStorage.removeItem('mrf_selected_company_id');
      setCompanies([]);
      return;
    }

    if (!isSuperAdmin) {
      if (userOrgId) {
        setSelectedOrgIdState(userOrgId);
      }
      localStorage.removeItem('mrf_selected_company_id');
    } else {
      if (!selectedOrgIdState && userOrgId) {
        setSelectedOrgIdState(userOrgId);
      }
    }
  }, [user, isSuperAdmin, userOrgId]);

  const setSelectedOrgId = (newId) => {
    if (!isSuperAdmin) {
      console.warn('[CompanyScopeContext] Non-SUPER_ADMIN users cannot alter company scope.');
      return;
    }
    setSelectedOrgIdState(newId);
    if (newId) {
      localStorage.setItem('mrf_selected_company_id', newId);
    } else {
      localStorage.removeItem('mrf_selected_company_id');
    }
  };

  const selectedCompany = selectedOrgId === 'all'
    ? { id: 'all', name: 'All Companies', companyName: 'All Companies', companyCode: 'ALL' }
    : (safeCompanies.find((c) => c.id === selectedOrgId) || (user?.organization ? user.organization : null));

  return (
    <CompanyScopeContext.Provider
      value={{
        companies: safeCompanies,
        selectedOrgId,
        effectiveOrgId,
        setSelectedOrgId,
        selectedCompany,
        loading,
        refetchCompanies: fetchCompanies,
        extractCompanyList
      }}
    >
      {children}
    </CompanyScopeContext.Provider>
  );
};

export const useCompanyScope = () => {
  const context = useContext(CompanyScopeContext);
  if (!context) {
    throw new Error('useCompanyScope must be used within a CompanyScopeProvider');
  }
  return context;
};

export default CompanyScopeContext;

