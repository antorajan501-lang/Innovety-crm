import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Plus,
  Ticket as TicketIcon,
  X,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Wrench
} from 'lucide-react';

const Tickets = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [availableAssignees, setAvailableAssignees] = useState([]);
  
  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    category: 'TECHNICAL'
  });
  
  const [editStatus, setEditStatus] = useState('');
  const [editAssignee, setEditAssignee] = useState('');

  const [alert, setAlert] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tickets');
      setTickets(res.data);
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const fetchStaffMembers = async () => {
    try {
      // Only team leaders are assignable (System Admin cannot be assigned ticket work)
      const res = await api.get('/users?limit=1000');
      const staff = (res.data.users || []).filter(u => u.role === 'TEAM_LEADER');
      setAvailableAssignees(staff);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTickets();
    if (['ADMIN', 'TEAM_LEADER'].includes(user.role)) {
      fetchStaffMembers();
    }
  }, [user]);

  const handleInputChange = (e) => {
    setCreateForm({ ...createForm, [e.target.name]: e.target.value });
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post('/tickets', createForm);
      setCreateModalOpen(false);
      setCreateForm({ title: '', description: '', category: 'TECHNICAL' });
      setAlert('Ticket raised successfully.');
      fetchTickets();
    } catch (err) {
      setAlert(err.response?.data?.message || 'Failed to raise ticket.');
      setLoading(false);
    }
  };

  const openDetailModal = (ticket) => {
    setSelectedTicket(ticket);
    setEditStatus(ticket.status);
    setEditAssignee(ticket.assigneeId || '');
    setDetailModalOpen(true);
  };

  const handleUpdateTicket = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.put(`/tickets/${selectedTicket.id}`, {
        status: editStatus,
        assigneeId: editAssignee || null
      });
      setDetailModalOpen(false);
      setSelectedTicket(null);
      setAlert('Ticket details updated.');
      fetchTickets();
    } catch (err) {
      setAlert('Failed to update ticket status.');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {alert && (
        <div className="flex items-center justify-between p-4 rounded-xl border border-primary/20 bg-primary/5 text-primary text-xs font-semibold">
          <span>{alert}</span>
          <button onClick={() => setAlert('')}>✕</button>
        </div>
      )}

      {/* Header Panel */}
      <div className="flex items-center justify-between bg-card p-4 rounded-2xl border border-border/40 shadow-premium">
        <div>
          <h2 className="text-base font-bold">CRM Support Desk</h2>
          <p className="text-xs text-muted-foreground">Raise technical, operational, HR, software, or software licensing issues.</p>
        </div>
        <button onClick={() => setCreateModalOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-md hover:bg-primary-hover">
          <Plus className="h-3.5 w-3.5" />
          <span>Raise Ticket</span>
        </button>
      </div>

      {/* Tickets List */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tickets.length === 0 ? (
          <div className="col-span-3 text-center py-10 bg-card rounded-2xl border text-muted-foreground text-sm">
            No active support tickets found.
          </div>
        ) : (
          tickets.map((ticket) => (
            <div 
              key={ticket.id}
              onClick={() => openDetailModal(ticket)}
              className="flex flex-col rounded-2xl border border-border/40 bg-card p-5 shadow-premium hover-premium text-left cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] bg-primary/10 text-primary-hover font-bold px-2 py-0.5 rounded-full uppercase tracking-tight">
                  {ticket.category}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-yellow-500/10 text-yellow-600'}`}>
                  {ticket.status}
                </span>
              </div>

              <h4 className="text-xs font-bold mt-3 text-foreground line-clamp-1">{ticket.title}</h4>
              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{ticket.description}</p>

              <div className="mt-4 flex items-center justify-between border-t border-border/30 pt-3 text-[10px] text-muted-foreground">
                <span>By: {ticket.creator?.name}</span>
                <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Ticket Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/40 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-base font-bold">Raise Support Ticket</h3>
              <button className="rounded-lg p-1 hover:bg-muted" onClick={() => setCreateModalOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold text-left flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                <span>Note: Leave/WFH requests must NOT be raised as tickets. Please submit a formal Leave Application Letter in the <strong>Attendance Portal</strong>. Work cannot be assigned to Super Administrators.</span>
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold text-muted-foreground">Ticket Title *</label>
                <input 
                  type="text" 
                  name="title"
                  required 
                  placeholder="e.g. Docker container crash" 
                  value={createForm.title} 
                  onChange={handleInputChange} 
                />
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold text-muted-foreground">Description *</label>
                <textarea 
                  name="description"
                  rows={4} 
                  required 
                  placeholder="Elaborate on technical issue, error codes, steps to reproduce..." 
                  className="w-full border border-border bg-card px-4 py-2 text-sm rounded-lg"
                  value={createForm.description} 
                  onChange={handleInputChange} 
                />
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold text-muted-foreground">Category *</label>
                <select name="category" value={createForm.category} onChange={handleInputChange}>
                  <option value="TECHNICAL">Technical Issue</option>
                  <option value="PROJECT">Project Blockers</option>
                  <option value="SOFTWARE">Software Installs</option>
                  <option value="HARDWARE">Hardware Failure</option>
                  <option value="GENERAL">General Inquiries</option>
                </select>
              </div>

              <button type="submit" disabled={loading} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary-hover active:scale-95 disabled:opacity-50">
                Submit Ticket
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Details & Resolution Modal */}
      {detailModalOpen && selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/40 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-left">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-primary/10 text-primary-hover rounded-full uppercase">Ticket Audit</span>
                <h3 className="text-base font-bold mt-1">{selectedTicket.title}</h3>
              </div>
              <button className="rounded-lg p-1 hover:bg-muted" onClick={() => {
                setDetailModalOpen(false);
                setSelectedTicket(null);
              }}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <span className="text-xs text-muted-foreground font-semibold">Raised By</span>
                <p className="text-xs font-semibold mt-0.5">{selectedTicket.creator?.name} ({selectedTicket.creator?.employeeId})</p>
              </div>

              <div>
                <span className="text-xs text-muted-foreground font-semibold">Description</span>
                <p className="text-xs text-foreground mt-1 bg-muted/40 p-3 rounded-lg border border-border/30 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              {/* Status Update / Assignment Form (For Admins/Leaders) */}
              {['ADMIN', 'TEAM_LEADER'].includes(user.role) ? (
                <form onSubmit={handleUpdateTicket} className="border-t border-border/30 pt-3 space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Assign Owner</label>
                    <select value={editAssignee} onChange={(e) => setEditAssignee(e.target.value)}>
                      <option value="">Unassigned</option>
                      {availableAssignees.map(staff => (
                        <option key={staff.id} value={staff.id}>{staff.name} ({staff.role.replace('_', ' ')})</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Update Ticket Status</label>
                    <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                      <option value="OPEN">Open</option>
                      <option value="ASSIGNED">Assigned</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </div>

                  <button type="submit" disabled={loading} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary-hover active:scale-95 disabled:opacity-50">
                    Apply Updates
                  </button>
                </form>
              ) : (
                <div className="border-t border-border/30 pt-3 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground font-semibold">Assigned Owner</span>
                    <p className="font-semibold mt-0.5">{selectedTicket.assignee ? selectedTicket.assignee.name : 'Unassigned'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-semibold">Ticket Status</span>
                    <p className="font-semibold mt-0.5 text-primary uppercase">{selectedTicket.status}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tickets;
