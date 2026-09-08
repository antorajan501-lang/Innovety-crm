import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCompanyScope } from '../context/CompanyScopeContext';
import AdvancedLeaveFilterSuite from '../components/leave/AdvancedLeaveFilterSuite';

const LeaveManagementPage = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { selectedOrgId, effectiveOrgId } = useCompanyScope();
  const targetOrg = isSuperAdmin ? selectedOrgId : (effectiveOrgId || user?.organizationId);
  const selectedOrgIdRef = useRef(targetOrg);
  useEffect(() => {
    selectedOrgIdRef.current = targetOrg;
  }, [targetOrg]);

  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaves = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const activeOrg = selectedOrgIdRef.current || targetOrg;
      const params = activeOrg ? { organizationId: activeOrg } : {};
      const res = await api.get('/leaves', { params });
      const data = Array.isArray(res.data) ? res.data : (res.data?.leaves || []);
      setLeaves(data);
    } catch (err) {
      console.error('Failed to fetch leave records:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    setLeaves([]);
    fetchLeaves(true);
  }, [targetOrg, user?.organizationId]);

  useEffect(() => {
    const interval = setInterval(() => fetchLeaves(false), 5000);
    return () => clearInterval(interval);
  }, [selectedOrgId]);

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-muted-foreground font-medium">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mb-2" />
        <p className="text-sm font-semibold text-foreground">Loading workforce leave applications & analytics...</p>
      </div>
    );
  }

  return (
    <AdvancedLeaveFilterSuite
      leaves={leaves}
      userRole={user?.role || 'EMPLOYEE'}
      onRefresh={() => fetchLeaves(false)}
    />
  );
};

export default LeaveManagementPage;
