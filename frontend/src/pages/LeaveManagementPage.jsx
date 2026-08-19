import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import AdvancedLeaveFilterSuite from '../components/leave/AdvancedLeaveFilterSuite';

const LeaveManagementPage = () => {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaves = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const res = await api.get('/leaves');
      const data = Array.isArray(res.data) ? res.data : (res.data?.leaves || []);
      setLeaves(data);
    } catch (err) {
      console.error('Failed to fetch leave records:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves(true);
    const interval = setInterval(() => fetchLeaves(false), 5000);
    return () => clearInterval(interval);
  }, []);

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
