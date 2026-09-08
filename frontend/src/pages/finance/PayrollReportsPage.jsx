import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { BarChart3, Download, FileSpreadsheet, Users, DollarSign, TrendingUp, ShieldCheck } from 'lucide-react';
import CompanyScopeSelector from '../../components/common/CompanyScopeSelector';
import { useCompanyScope } from '../../context/CompanyScopeContext';

import { useAuth } from '../../context/AuthContext';

export default function PayrollReportsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { selectedOrgId, effectiveOrgId, loading: orgsLoading, selectedCompany } = useCompanyScope();
  const targetOrg = isSuperAdmin ? selectedOrgId : (effectiveOrgId || user?.organizationId);
  const selectedOrgIdRef = useRef(targetOrg);

  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const activeOrg = selectedOrgIdRef.current || targetOrg;
      const params = activeOrg ? { organizationId: activeOrg } : {};
      const res = await api.get('/payroll/reports/summary', { params });
      const reportsData = res.data || {};
      setReports({
        totalGrossExpense: reportsData.totalGrossExpense || 0,
        totalNetExpense: reportsData.totalNetExpense || 0,
        totalPF: reportsData.totalPF || 0,
        totalESI: reportsData.totalESI || 0,
        totalTax: reportsData.totalTax || 0,
        totalOvertimePay: reportsData.totalOvertimePay || 0,
        totalHolidayPay: reportsData.totalHolidayPay || 0,
        totalPublishedPayslips: reportsData.totalPublishedPayslips || 0,
        departmentBreakdown: Array.isArray(reportsData.departmentBreakdown) ? reportsData.departmentBreakdown : [],
        monthlyTrends: Array.isArray(reportsData.monthlyTrends) ? reportsData.monthlyTrends : []
      });
    } catch (err) {
      console.error('Failed to load payroll reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    selectedOrgIdRef.current = targetOrg;
    setReports(null);
    if (orgsLoading) return;
    fetchReports();
  }, [user, targetOrg, user?.organizationId, orgsLoading]);

  const exportToCSV = () => {
    if (!reports?.departmentBreakdown) return;
    const companyName = selectedCompany?.name || 'Company';
    const cleanFileName = companyName.replace(/[^a-zA-Z0-9]/g, '_');
    const headers = ['Department', 'Employees Paid', 'Total Gross (INR)', 'Total Net (INR)'];
    const rows = reports.departmentBreakdown.map(d => [d.department, d.totalEmployees, d.totalGross, d.totalNet]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${cleanFileName}_Payroll_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatINR = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

  return (
    <div className="space-y-6 text-left font-sans w-full max-w-7xl mx-auto">
      {/* Company Scope Selector */}
      <CompanyScopeSelector />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" /> Payroll Financial Reports & Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Executive monthly cost summaries, department breakdowns, statutory tax liabilities, and CSV/Excel exports.
          </p>
        </div>
        <button
          onClick={exportToCSV}
          disabled={!reports?.departmentBreakdown || reports.departmentBreakdown.length === 0}
          className="flex items-center gap-2 px-4 py-2 btn-primary rounded-xl font-bold text-sm shadow-md transition-all disabled:opacity-50"
        >
          <FileSpreadsheet className="w-4 h-4" /> Export Department Report (CSV)
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading financial reports...</p>
      ) : (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card border border-border p-5 rounded-2xl shadow-sm space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase">Published Payout Batches</span>
              <p className="text-2xl font-black text-foreground">{reports?.totalPublishedPayslips || 0} Payslips Issued</p>
              <p className="text-xs text-muted-foreground">Across all departments in {selectedCompany?.name || 'company'}</p>
            </div>

            <div className="bg-card border border-border p-5 rounded-2xl shadow-sm space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase">Total Gross Expenditure</span>
              <p className="text-2xl font-black text-foreground">{formatINR(reports?.totalGrossExpense)}</p>
              <p className="text-xs text-muted-foreground">Salary + Overtime + Holiday Pay</p>
            </div>

            <div className="bg-card border border-border p-5 rounded-2xl shadow-sm space-y-2">
              <span className="text-xs font-bold text-muted-foreground uppercase">Net Disbursement Total</span>
              <p className="text-2xl font-black text-primary">{formatINR(reports?.totalNetExpense)}</p>
              <p className="text-xs text-muted-foreground">Direct bank transfer disbursements</p>
            </div>
          </div>

          {/* Department Summary Table */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Department-Wise Payroll Analysis ({selectedCompany?.name || 'Selected Scope'})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold uppercase">
                  <tr>
                    <th className="p-3.5">Department</th>
                    <th className="p-3.5">Employees Paid</th>
                    <th className="p-3.5">Gross Amount</th>
                    <th className="p-3.5 text-right">Net Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {!reports?.departmentBreakdown || reports.departmentBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="p-8 text-center text-muted-foreground font-semibold">
                        No published payroll analytics available for {selectedCompany?.name || 'this company'}. Process and publish a payroll batch to generate reports.
                      </td>
                    </tr>
                  ) : (
                    reports.departmentBreakdown.map((d, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="p-3.5 font-bold text-foreground">{d.department}</td>
                        <td className="p-3.5 font-semibold text-foreground">{d.totalEmployees} employee(s)</td>
                        <td className="p-3.5 font-semibold text-foreground">{formatINR(d.totalGross)}</td>
                        <td className="p-3.5 text-right font-black text-primary text-sm">
                          {formatINR(d.totalNet)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
