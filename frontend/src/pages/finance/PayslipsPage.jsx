import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { FileCode, Search, Eye, Download, Printer, ShieldCheck, X, QrCode } from 'lucide-react';
import CompanyScopeSelector from '../../components/common/CompanyScopeSelector';
import { useCompanyScope } from '../../context/CompanyScopeContext';

import { useAuth } from '../../context/AuthContext';

export default function PayslipsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { selectedOrgId, effectiveOrgId, loading: orgsLoading, selectedCompany } = useCompanyScope();
  const targetOrg = isSuperAdmin ? selectedOrgId : (effectiveOrgId || user?.organizationId);
  const selectedOrgIdRef = useRef(targetOrg);

  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [settings, setSettings] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const fetchPayslips = async () => {
    try {
      setLoading(true);
      const activeOrg = selectedOrgIdRef.current || targetOrg;
      const params = activeOrg ? { organizationId: activeOrg } : {};
      const res = await api.get('/payroll/payslips', { params });
      setPayslips(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch payslips:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    selectedOrgIdRef.current = targetOrg;
    setPayslips([]);
    if (orgsLoading) return;
    fetchPayslips();
  }, [user, targetOrg, user?.organizationId, orgsLoading]);

  const handleViewPayslip = async (id) => {
    try {
      const targetOrg = selectedOrgIdRef.current || selectedOrgId;
      const params = targetOrg ? { organizationId: targetOrg } : {};
      const res = await api.get(`/payroll/payslips/${id}`, { params });
      setSelectedPayslip(res.data.payslip);
      setSettings(res.data.settings);
      setShowModal(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to view payslip.');
    }
  };

  const formatINR = (val) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

  const filteredPayslips = payslips.filter(ps =>
    ps.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ps.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ps.user?.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 text-left font-sans w-full max-w-7xl mx-auto">
      {/* Company Scope Selector */}
      <CompanyScopeSelector />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border p-6 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <FileCode className="w-6 h-6 text-primary" /> Payslips Management Desk
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            View, search, print, and audit generated employee payslips across published batches.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by employee name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-muted/50 border border-border rounded-xl pl-9 pr-4 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading payslips...</p>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold uppercase">
                <tr>
                  <th className="p-4">Employee</th>
                  <th className="p-4">Pay Period</th>
                  <th className="p-4">Basic Salary</th>
                  <th className="p-4">Gross Earnings</th>
                  <th className="p-4">Total Net Payout</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredPayslips.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-muted-foreground font-semibold">
                      No published payslips found for {selectedCompany?.name || 'this company'}.
                    </td>
                  </tr>
                ) : (
                  filteredPayslips.map(ps => (
                    <tr key={ps.id} className="hover:bg-muted/30">
                      <td className="p-4">
                        <p className="font-bold text-foreground">{ps.user?.name}</p>
                        <p className="text-[11px] text-muted-foreground">{ps.user?.email} • {ps.user?.department || 'Engineering'}</p>
                      </td>
                      <td className="p-4 font-semibold text-foreground">
                        Month {ps.month} / {ps.year}
                      </td>
                      <td className="p-4 text-muted-foreground">{formatINR(ps.basicSalary)}</td>
                      <td className="p-4 font-semibold text-foreground">{formatINR(ps.grossSalary)}</td>
                      <td className="p-4 font-extrabold text-primary text-sm">
                        {formatINR(ps.netSalary)}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${ps.status === 'PUBLISHED' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
                          {ps.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleViewPayslip(ps.id)}
                          className="px-3 py-1.5 btn-primary rounded-lg font-bold transition-all text-xs flex items-center gap-1 ml-auto"
                        >
                          <Eye className="w-3.5 h-3.5" /> View / Print
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Payslip Viewer */}
      {showModal && selectedPayslip && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl print:p-0 print:border-none print:shadow-none">
            <div className="flex items-center justify-between pb-3 border-b border-border print:hidden">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <h3 className="font-extrabold text-foreground text-base">Official Employee Payslip</h3>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="px-3 py-1.5 border border-border hover:bg-muted rounded-lg font-bold text-xs flex items-center gap-1.5">
                  <Printer className="w-4 h-4" /> Print / Save PDF
                </button>
                <button onClick={() => setShowModal(false)} className="p-1 hover:bg-muted rounded-lg text-muted-foreground"><X className="w-5 h-5" /></button>
              </div>
            </div>

            {/* Printable Body */}
            <div className="bg-white text-slate-900 p-8 rounded-xl border border-slate-200 space-y-6 text-xs">
              <div className="flex justify-between items-start border-b border-slate-300 pb-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">{settings?.companyName || 'Innoveity'}</h2>
                  <p className="text-slate-500 text-[11px] mt-0.5">{settings?.companyAddress || '100 Innovation Towers, Cyber City, Bangalore - 560001'}</p>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-800 font-black rounded text-[10px] uppercase">CONFIDENTIAL PAYSLIP</span>
                  <p className="text-slate-600 font-bold mt-1 text-sm">Month {selectedPayslip.month} / {selectedPayslip.year}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <p className="text-slate-500 font-semibold">Employee Name: <span className="text-slate-900 font-bold">{selectedPayslip.user?.name}</span></p>
                  <p className="text-slate-500 font-semibold">Employee ID: <span className="text-slate-900 font-bold">{selectedPayslip.user?.employeeId || 'EMP-' + selectedPayslip.user?.id?.substring(0, 6)}</span></p>
                  <p className="text-slate-500 font-semibold">Role / Designation: <span className="text-slate-900 font-bold">{selectedPayslip.user?.role}</span></p>
                </div>
                <div>
                  <p className="text-slate-500 font-semibold">Department: <span className="text-slate-900 font-bold">{selectedPayslip.user?.department || 'General'}</span></p>
                  <p className="text-slate-500 font-semibold">Payment Method: <span className="text-slate-900 font-bold">Direct Bank Transfer</span></p>
                  <p className="text-slate-500 font-semibold">Pay Date: <span className="text-slate-900 font-bold">{settings?.payDay ? `${settings.payDay}th of Month` : '30th of Month'}</span></p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800 border-b border-slate-300 pb-1 text-xs">GROSS EARNINGS</h4>
                  <div className="flex justify-between text-slate-600"><span>Basic Salary</span><span className="font-semibold text-slate-900">{formatINR(selectedPayslip.basicSalary)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>HRA</span><span className="font-semibold text-slate-900">{formatINR(selectedPayslip.hra)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>DA</span><span className="font-semibold text-slate-900">{formatINR(selectedPayslip.da)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>Allowances & Bonus</span><span className="font-semibold text-slate-900">{formatINR((selectedPayslip.allowancesJson?.specialAllowance || 0) + (selectedPayslip.allowancesJson?.travelAllowance || 0))}</span></div>
                  <div className="flex justify-between text-slate-600"><span>Overtime Pay ({selectedPayslip.overtimeHours}h)</span><span className="font-semibold text-slate-900">{formatINR(selectedPayslip.overtimePay)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>Holiday Work Pay ({selectedPayslip.holidayDaysWorked}d)</span><span className="font-semibold text-slate-900">{formatINR(selectedPayslip.holidayPay)}</span></div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800 border-b border-slate-300 pb-1 text-xs">DEDUCTIONS</h4>
                  <div className="flex justify-between text-slate-600"><span>PF Contribution</span><span className="font-semibold text-slate-900">{formatINR(selectedPayslip.deductionsJson?.pfDeduction)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>Professional Tax</span><span className="font-semibold text-slate-900">{formatINR(selectedPayslip.deductionsJson?.profTax)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>Income Tax (TDS)</span><span className="font-semibold text-slate-900">{formatINR(selectedPayslip.deductionsJson?.incomeTax)}</span></div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-300 p-4 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-800 uppercase block">NET DISBURSEMENT AMOUNT</span>
                  <span className="text-2xl font-black text-slate-900">{formatINR(selectedPayslip.netSalary)}</span>
                </div>
                <div className="text-right flex items-center gap-2">
                  <QrCode className="w-10 h-10 text-slate-800" />
                  <div>
                    <span className="text-[9px] font-mono text-slate-700 block">QR HASH: {selectedPayslip.qrCodeHash}</span>
                    <span className="text-[10px] font-bold text-slate-800">Digitally Verified</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-300 flex justify-between items-end text-[10px] text-slate-500">
                <p>This is a computer-generated document and requires no physical signature.</p>
                <div className="text-right">
                  <p className="font-bold text-slate-800 text-xs">{settings?.authorizedSignature || 'Authorized HR Signatory'}</p>
                  <p>Innoveity Payroll Desk</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
