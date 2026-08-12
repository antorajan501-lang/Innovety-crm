import React, { useState, useEffect } from 'react';
import api, { getUploadUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import UserAvatar from '../components/common/UserAvatar';
import { motion } from 'framer-motion';
import {
  Laptop,
  Plus,
  Search,
  Filter,
  Trash2,
  Download,
  MoreVertical,
  X,
  CheckCircle,
  AlertCircle,
  Edit2,
  Eye,
  UserCheck,
  Building2,
  Calendar,
  Clock,
  ShieldCheck,
  Tag,
  DollarSign,
  MapPin,
  RefreshCw,
  CornerUpLeft,
  FileText,
  Wrench,
  AlertTriangle,
  Upload,
  Image as ImageIcon
} from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } }
};

const DEFAULT_CATEGORIES = [
  { label: 'Laptop', value: 'LAPTOP' },
  { label: 'Desktop', value: 'DESKTOP' },
  { label: 'Monitor', value: 'MONITOR' },
  { label: 'Mobile', value: 'MOBILE' },
  { label: 'Keyboard', value: 'KEYBOARD' },
  { label: 'Mouse', value: 'MOUSE' },
  { label: 'Headset', value: 'HEADSET' },
  { label: 'Tablet', value: 'TABLET' },
  { label: 'Printer', value: 'PRINTER' },
  { label: 'Network Equipment', value: 'NETWORK' },
  { label: 'Office Furniture', value: 'FURNITURE' },
  { label: 'Other', value: 'OTHER' }
];

const AssetManagement = () => {
  const { user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [assetStats, setAssetStats] = useState({ totalAssets: 0, availableAssets: 0, assignedAssets: 0, maintenanceAssets: 0 });
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [alertMsg, setAlertMsg] = useState({ type: '', text: '' });

  // Dynamic custom categories state
  const [customCategoriesList, setCustomCategoriesList] = useState([]);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState(false);

  // Users list for assignment dropdown
  const [allUsers, setAllUsers] = useState([]);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [detailsModalAsset, setDetailsModalAsset] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [billFile, setBillFile] = useState(null);

  // Form states
  const [assetForm, setAssetForm] = useState({
    name: '',
    category: 'LAPTOP',
    brand: '',
    model: '',
    serialNumber: '',
    purchaseDate: '',
    warrantyExpiry: '',
    cost: '',
    vendor: '',
    location: '',
    status: 'AVAILABLE',
    description: ''
  });

  const [assignForm, setAssignForm] = useState({
    userId: '',
    expectedReturn: '',
    notes: ''
  });

  const [returnForm, setReturnForm] = useState({
    returnDate: new Date().toISOString().split('T')[0],
    conditionOnReturn: 'Good',
    remarks: ''
  });

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });

  const isManagementRole = ['ADMIN', 'TEAM_LEADER'].includes(user.role);

  const getFinalCategoryToSave = () => {
    if (isCustomCategoryMode || assetForm.category === 'OTHER' || assetForm.category === 'ADD_NEW') {
      const trimmed = customCategoryInput.trim();
      if (trimmed) {
        const formatted = trimmed.toUpperCase();
        if (!customCategoriesList.includes(formatted)) {
          setCustomCategoriesList(prev => [...prev, formatted]);
        }
        return formatted;
      }
      return 'OTHER';
    }
    return assetForm.category;
  };

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const res = await api.get('/assets', {
        params: {
          page,
          search,
          category: categoryFilter,
          status: statusFilter,
          brand: brandFilter,
          limit: 15
        }
      });
      const fetchedAssets = res.data.assets || [];
      setAssets(fetchedAssets);
      setTotalCount(res.data.meta?.totalCount || 0);

      // Collect custom categories from database assets
      const dbCategories = fetchedAssets
        .map(a => a.category)
        .filter(c => c && !DEFAULT_CATEGORIES.some(dc => dc.value === c));
      if (dbCategories.length > 0) {
        setCustomCategoriesList(prev => Array.from(new Set([...prev, ...dbCategories])));
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      setAlertMsg({ type: 'error', text: err.response?.data?.message || 'Failed to fetch assets.' });
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users?limit=1000&status=ACTIVE');
      setAllUsers(res.data.users || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAssetAnalytics = async () => {
    if (!['ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER'].includes(user.role)) return;
    try {
      const res = await api.get('/assets/analytics');
      if (res.data) {
        setAssetStats({
          totalAssets: res.data.totalAssets || 0,
          availableAssets: res.data.availableAssets || 0,
          assignedAssets: res.data.assignedAssets || 0,
          maintenanceAssets: res.data.maintenanceAssets || 0
        });
      }
    } catch (err) {
      console.error('Failed to fetch asset analytics:', err);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [page, categoryFilter, statusFilter, brandFilter]);

  useEffect(() => {
    if (isManagementRole) {
      fetchUsers();
      fetchAssetAnalytics();
    }
  }, [user]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchAssets();
  };

  const resetForm = () => {
    setIsCustomCategoryMode(false);
    setCustomCategoryInput('');
    setAssetForm({
      name: '',
      category: 'LAPTOP',
      brand: '',
      model: '',
      serialNumber: '',
      purchaseDate: '',
      warrantyExpiry: '',
      cost: '',
      vendor: '',
      location: '',
      status: 'AVAILABLE',
      description: ''
    });
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const finalCategory = getFinalCategoryToSave();
      const formData = new FormData();
      Object.keys(assetForm).forEach((key) => {
        if (key === 'category') {
          formData.append('category', finalCategory);
        } else {
          formData.append(key, assetForm[key]);
        }
      });
      if (billFile) {
        formData.append('billPhoto', billFile);
      }

      await api.post('/assets', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setCreateModalOpen(false);
      resetForm();
      setBillFile(null);
      setAlertMsg({ type: 'success', text: 'New asset registered successfully.' });
      fetchAssets();
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.response?.data?.message || 'Failed to create asset.' });
      setLoading(false);
    }
  };

  const openEditModal = (asset) => {
    setSelectedAsset(asset);
    const existingCat = asset.category || 'LAPTOP';
    const isStandard = DEFAULT_CATEGORIES.some(dc => dc.value === existingCat);
    if (!isStandard && existingCat !== 'OTHER') {
      setIsCustomCategoryMode(true);
      setCustomCategoryInput(existingCat);
    } else {
      setIsCustomCategoryMode(false);
      setCustomCategoryInput('');
    }

    setAssetForm({
      name: asset.name || '',
      category: existingCat,
      brand: asset.brand || '',
      model: asset.model || '',
      serialNumber: asset.serialNumber || '',
      purchaseDate: asset.purchaseDate ? asset.purchaseDate.split('T')[0] : '',
      warrantyExpiry: asset.warrantyExpiry ? asset.warrantyExpiry.split('T')[0] : '',
      cost: asset.cost ? String(asset.cost) : '',
      vendor: asset.vendor || '',
      location: asset.location || '',
      status: asset.status || 'AVAILABLE',
      description: asset.description || ''
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const finalCategory = getFinalCategoryToSave();
      const formData = new FormData();
      Object.keys(assetForm).forEach((key) => {
        if (key === 'category') {
          formData.append('category', finalCategory);
        } else {
          formData.append(key, assetForm[key]);
        }
      });
      if (billFile) {
        formData.append('billPhoto', billFile);
      }
      await api.put(`/assets/${selectedAsset.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setEditModalOpen(false);
      setSelectedAsset(null);
      setBillFile(null);
      resetForm();
      setAlertMsg({ type: 'success', text: 'Asset details updated successfully.' });
      fetchAssets();
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update asset.' });
      setLoading(false);
    }
  };

  const openBillModal = (asset) => {
    setSelectedAsset(asset);
    setBillFile(null);
    setBillModalOpen(true);
  };

  const handleUploadBillSubmit = async (e) => {
    e.preventDefault();
    if (!billFile) {
      setAlertMsg({ type: 'error', text: 'Please select a bill photo file to upload.' });
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('billPhoto', billFile);

      await api.post(`/assets/${selectedAsset.id}/bill-photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setBillModalOpen(false);
      setSelectedAsset(null);
      setBillFile(null);
      setAlertMsg({ type: 'success', text: 'Bill photocopy uploaded successfully!' });
      fetchAssets();
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.response?.data?.message || 'Failed to upload bill photocopy.' });
      setLoading(false);
    }
  };

  const handleDeleteBillPhoto = async (assetId) => {
    if (!window.confirm('Are you sure you want to delete this bill photocopy?')) return;
    try {
      setLoading(true);
      await api.delete(`/assets/${assetId}/bill-photo`);
      setAlertMsg({ type: 'success', text: 'Bill photocopy deleted successfully.' });
      if (detailsModalAsset && detailsModalAsset.id === assetId) {
        setDetailsModalAsset((prev) => prev ? { ...prev, billPhoto: null } : null);
      }
      if (selectedAsset && selectedAsset.id === assetId) {
        setSelectedAsset((prev) => prev ? { ...prev, billPhoto: null } : null);
      }
      fetchAssets();
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.response?.data?.message || 'Failed to delete bill photo.' });
    } finally {
      setLoading(false);
    }
  };

  const openAssignModal = (asset) => {
    setSelectedAsset(asset);
    setAssignForm({
      userId: '',
      expectedReturn: '',
      notes: ''
    });
    setAssignModalOpen(true);
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post(`/assets/${selectedAsset.id}/assign`, assignForm);
      setAssignModalOpen(false);
      setSelectedAsset(null);
      setAlertMsg({ type: 'success', text: 'Asset assigned successfully.' });
      fetchAssets();
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.response?.data?.message || 'Failed to assign asset.' });
      setLoading(false);
    }
  };

  const openReturnModal = (asset) => {
    setSelectedAsset(asset);
    setReturnForm({
      returnDate: new Date().toISOString().split('T')[0],
      conditionOnReturn: 'Good',
      remarks: ''
    });
    setReturnModalOpen(true);
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post(`/assets/${selectedAsset.id}/return`, returnForm);
      setReturnModalOpen(false);
      setSelectedAsset(null);
      setAlertMsg({ type: 'success', text: 'Asset returned successfully.' });
      fetchAssets();
    } catch (err) {
      setAlertMsg({ type: 'error', text: err.response?.data?.message || 'Failed to return asset.' });
      setLoading(false);
    }
  };

  const handleDelete = (asset) => {
    if (asset.status === 'ASSIGNED' || asset.assignedToId) {
      setAlertMsg({
        type: 'error',
        text: `Cannot delete asset "${asset.name}" (${asset.assetId}) because it is currently assigned. Please return the asset first.`
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Delete Asset',
      message: `Are you sure you want to delete asset "${asset.name}" (${asset.assetId})? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await api.delete(`/assets/${asset.id}`);
          setAlertMsg({ type: 'success', text: 'Asset deleted successfully.' });
          fetchAssets();
        } catch (err) {
          setAlertMsg({ type: 'error', text: err.response?.data?.message || 'Failed to delete asset.' });
        }
      }
    });
  };

  const openDetailsModal = async (asset) => {
    try {
      const res = await api.get(`/assets/${asset.id}`);
      setDetailsModalAsset(res.data);
    } catch (err) {
      console.error(err);
      setDetailsModalAsset(asset);
    }
  };

  const triggerExportCSV = async () => {
    try {
      setLoading(true);
      const res = await api.get('/assets', { params: { limit: 1000 } });
      const exportList = res.data.assets || [];

      const headers = ['Asset ID', 'Name', 'Category', 'Brand', 'Model', 'Serial Number', 'Assigned User', 'Role', 'Department', 'Status', 'Purchase Date', 'Warranty Expiry', 'Cost'];
      const csvRows = exportList.map(a => [
        `"${(a.assetId || '').replace(/"/g, '""')}"`,
        `"${(a.name || '').replace(/"/g, '""')}"`,
        `"${(a.category || '').replace(/"/g, '""')}"`,
        `"${(a.brand || '').replace(/"/g, '""')}"`,
        `"${(a.model || '').replace(/"/g, '""')}"`,
        `"${(a.serialNumber || '').replace(/"/g, '""')}"`,
        `"${(a.assignedTo?.name || 'Unassigned').replace(/"/g, '""')}"`,
        `"${(a.assignedTo?.role || '—').replace(/"/g, '""')}"`,
        `"${(a.assignedTo?.department || '—').replace(/"/g, '""')}"`,
        `"${(a.status || '').replace(/"/g, '""')}"`,
        `"${a.purchaseDate ? new Date(a.purchaseDate).toLocaleDateString() : ''}"`,
        `"${a.warrantyExpiry ? new Date(a.warrantyExpiry).toLocaleDateString() : ''}"`,
        `"${a.cost || ''}"`
      ].join(','));

      const csvContent = '\uFEFF' + [headers.join(','), ...csvRows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `asset_inventory_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setLoading(false);
      setAlertMsg({ type: 'success', text: `Successfully exported ${exportList.length} asset records.` });
    } catch (err) {
      console.error(err);
      setAlertMsg({ type: 'error', text: 'Failed to export CSV file.' });
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'ASSIGNED':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'MAINTENANCE':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'DAMAGED':
        return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
      case 'LOST':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'DISPOSED':
        return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
      default:
        return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    }
  };

  return (
    <motion.div 
      className="space-y-6 pb-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Alert Header Banner */}
      {alertMsg.text && (
        <motion.div variants={itemVariants} className={`flex items-center gap-2 p-4 rounded-[20px] border ${alertMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
          {alertMsg.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span className="text-xs font-semibold">{alertMsg.text}</span>
          <button className="ml-auto" onClick={() => setAlertMsg({ type: '', text: '' })}>
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}

      {/* Asset Management Overview Card - Admin, Super Admin & Team Leader Only */}
      {['ADMIN', 'SUPER_ADMIN', 'TEAM_LEADER'].includes(user.role) && (
        <motion.div variants={itemVariants} className="bg-card rounded-2xl border border-border/60 p-6 shadow-md text-left space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary/10 p-3 text-primary border border-primary/20">
                <Laptop className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Asset Management Overview</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Hardware systems and user allocations.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
            <div className="bg-card p-4 rounded-2xl border border-border/60 shadow-xs">
              <span className="text-[10px] font-extrabold text-muted-foreground uppercase block">Total Assets</span>
              <span className="text-2xl font-black text-foreground mt-1 block">{assetStats.totalAssets}</span>
            </div>

            <div className="bg-card p-4 rounded-2xl border border-border/60 shadow-xs">
              <span className="text-[10px] font-extrabold text-primary uppercase block">Available</span>
              <span className="text-2xl font-black text-primary mt-1 block">{assetStats.availableAssets}</span>
            </div>

            <div className="bg-card p-4 rounded-2xl border border-border/60 shadow-xs">
              <span className="text-[10px] font-extrabold text-primary uppercase block">Assigned</span>
              <span className="text-2xl font-black text-primary mt-1 block">{assetStats.assignedAssets}</span>
            </div>

            <div className="bg-card p-4 rounded-2xl border border-border/60 shadow-xs">
              <span className="text-[10px] font-extrabold text-amber-500 uppercase block">Maintenance</span>
              <span className="text-2xl font-black text-amber-500 mt-1 block">{assetStats.maintenanceAssets}</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Control Actions Bar */}
      <motion.div variants={itemVariants} className="bg-card p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border border-border/60 shadow-md rounded-2xl">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by ID, name, brand, S/N..."
            className="w-full pl-9 bg-background text-xs py-2 rounded-xl border border-border/70 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>

        {/* Buttons & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {isManagementRole && (
            <>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="bg-background text-xs px-3 py-2 rounded-xl border border-border/70">
                <option value="">All Categories</option>
                {DEFAULT_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
                {customCategoriesList.map(cc => (
                  <option key={cc} value={cc}>{cc}</option>
                ))}
              </select>

              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-background text-xs px-3 py-2 rounded-xl border border-border/70">
                <option value="">All Statuses</option>
                <option value="AVAILABLE">Available</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="DAMAGED">Damaged</option>
                <option value="LOST">Lost</option>
                <option value="DISPOSED">Disposed</option>
              </select>

              <button onClick={triggerExportCSV} className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-background px-3 py-2 text-xs font-semibold hover:bg-muted transition-all">
                <Download className="h-3.5 w-3.5" />
                <span>Export CSV</span>
              </button>

              <button onClick={() => { resetForm(); setCreateModalOpen(true); }} className="flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white px-4 py-2 text-xs font-extrabold shadow-md shadow-primary/20 transition-all">
                <Plus className="h-3.5 w-3.5" />
                <span>Add Asset</span>
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* Assets Inventory Table */}
      <motion.div variants={itemVariants} className="w-full min-w-0 overflow-x-auto bg-card border border-border/60 shadow-md rounded-2xl">
        <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border/40 bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
              <th className="px-6 py-4 whitespace-nowrap">Asset ID</th>
              <th className="px-6 py-4 whitespace-nowrap">Asset Name</th>
              <th className="px-6 py-4 whitespace-nowrap">Category</th>
              <th className="px-6 py-4 whitespace-nowrap">Brand / Model</th>
              <th className="px-6 py-4 whitespace-nowrap">Serial Number</th>
              <th className="px-6 py-4 whitespace-nowrap">Assigned To</th>
              <th className="px-6 py-4 whitespace-nowrap">Status</th>
              <th className="px-6 py-4 text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {assets.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center whitespace-nowrap">
                  <div className="mx-auto flex max-w-sm flex-col items-center justify-center text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4 shadow-sm border border-primary/20">
                      <Laptop className="h-8 w-8" />
                    </div>
                    <h3 className="text-base font-bold text-foreground">No Assets Found</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isManagementRole ? 'The asset inventory is currently empty or no items match your filters.' : 'You currently do not have any company assets assigned to your profile.'}
                    </p>
                    {isManagementRole && (
                      <button
                        onClick={() => { resetForm(); setCreateModalOpen(true); }}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary-hover text-white px-4 py-2 text-xs font-bold shadow-md shadow-primary/20 transition-all"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Add New Asset</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              assets.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-muted/40 cursor-pointer transition-all h-16 whitespace-nowrap"
                  onClick={() => openDetailsModal(item)}
                >
                  <td className="px-6 py-4 font-mono font-bold text-xs text-foreground whitespace-nowrap">
                    {item.assetId}
                  </td>
                  <td className="px-6 py-4 font-bold text-foreground whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                        <Laptop className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground leading-none">{item.name}</p>
                        {item.location && <span className="text-[10px] text-muted-foreground mt-0.5 block">{item.location}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 uppercase">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-semibold text-foreground whitespace-nowrap">
                    {item.brand || '—'} {item.model ? `/ ${item.model}` : ''}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {item.serialNumber || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.assignedTo ? (
                      <div className="flex items-center gap-2">
                        <UserAvatar src={item.assignedTo.profilePic} name={item.assignedTo.name} className="h-6 w-6 rounded-lg object-cover" />
                        <div>
                          <p className="text-xs font-bold text-foreground leading-none">{item.assignedTo.name}</p>
                          <span className="text-[9px] text-muted-foreground font-mono">{item.assignedTo.employeeId}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground font-semibold">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border uppercase ${getStatusBadgeClass(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openDetailsModal(item)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                        title="View Asset Details"
                      >
                        <Eye size={15} />
                      </button>

                      {isManagementRole && (
                        <>
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                            title="Edit Asset"
                          >
                            <Edit2 size={15} />
                          </button>

                          <button
                            onClick={() => openBillModal(item)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-all font-bold text-xs flex items-center gap-1"
                            title="Upload Bill Photo Copy"
                          >
                            <Upload size={15} />
                            <span className="hidden xl:inline">Bill</span>
                          </button>

                          {item.status === 'AVAILABLE' ? (
                            <button
                              onClick={() => openAssignModal(item)}
                              className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-all font-bold text-xs flex items-center gap-1"
                              title="Assign to User"
                            >
                              <UserCheck size={15} />
                              <span className="hidden xl:inline">Assign</span>
                            </button>
                          ) : item.status === 'ASSIGNED' ? (
                            <button
                              onClick={() => openReturnModal(item)}
                              className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 transition-all font-bold text-xs flex items-center gap-1"
                              title="Return Asset"
                            >
                              <CornerUpLeft size={15} />
                              <span className="hidden xl:inline">Return</span>
                            </button>
                          ) : null}

                          <button
                            onClick={() => confirmDeleteAsset(item)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-all"
                            title="Delete Asset"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </motion.div>

      {/* Pagination Footer */}
      {totalCount > 15 && (
        <motion.div variants={itemVariants} className="flex items-center justify-between px-2 pt-2">
          <p className="text-xs text-muted-foreground font-semibold">
            Showing <span className="font-bold text-foreground">{(page - 1) * 15 + 1}</span> to{' '}
            <span className="font-bold text-foreground">{Math.min(page * 15, totalCount)}</span> of{' '}
            <span className="font-bold text-foreground">{totalCount}</span> assets
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 text-xs font-bold rounded-xl border border-border bg-card hover:bg-muted disabled:opacity-50 transition-all"
            >
              Previous
            </button>
            <span className="text-xs font-bold text-foreground px-2">Page {page}</span>
            <button
              disabled={page * 15 >= totalCount}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 text-xs font-bold rounded-xl border border-border bg-card hover:bg-muted disabled:opacity-50 transition-all"
            >
              Next
            </button>
          </div>
        </motion.div>
      )}

      {/* Create Asset Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-border/40 bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
              <h3 className="text-base font-bold text-foreground">Add New Hardware / System Asset</h3>
              <button className="rounded-lg p-1 hover:bg-muted" onClick={() => setCreateModalOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-3 space-y-3 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Asset Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MacBook Pro M3 Max 16-inch"
                    value={assetForm.name}
                    onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1 sm:col-span-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Category *</label>

                  {!isCustomCategoryMode ? (
                    <select
                      value={assetForm.category}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'ADD_NEW' || val === 'OTHER') {
                          setIsCustomCategoryMode(true);
                          setCustomCategoryInput('');
                          setAssetForm({ ...assetForm, category: 'OTHER' });
                        } else {
                          setAssetForm({ ...assetForm, category: val });
                        }
                      }}
                    >
                      {DEFAULT_CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                      {customCategoriesList.map((cc) => (
                        <option key={cc} value={cc}>{cc}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="relative flex items-center w-full">
                      <input
                        type="text"
                        required
                        autoFocus
                        placeholder="e.g. Server, Camera, GPU..."
                        value={customCategoryInput}
                        onChange={(e) => setCustomCategoryInput(e.target.value)}
                        className="w-full text-xs font-semibold py-1.5 pl-3 pr-8 rounded-xl border border-emerald-500 bg-emerald-500/5 focus:bg-background focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomCategoryMode(false);
                          setCustomCategoryInput('');
                          setAssetForm({ ...assetForm, category: 'LAPTOP' });
                        }}
                        className="absolute right-2 text-muted-foreground hover:text-rose-500 rounded p-0.5"
                        title="Cancel custom category"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Brand</label>
                  <input
                    type="text"
                    placeholder="e.g. Apple, Dell, Logitech"
                    value={assetForm.brand}
                    onChange={(e) => setAssetForm({ ...assetForm, brand: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Model</label>
                  <input
                    type="text"
                    placeholder="e.g. XPS 15 9530"
                    value={assetForm.model}
                    onChange={(e) => setAssetForm({ ...assetForm, model: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Serial Number (Unique)</label>
                  <input
                    type="text"
                    placeholder="e.g. C02G182PMD6T"
                    value={assetForm.serialNumber}
                    onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Purchase Date</label>
                  <input
                    type="date"
                    value={assetForm.purchaseDate}
                    onChange={(e) => setAssetForm({ ...assetForm, purchaseDate: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Warranty Expiry</label>
                  <input
                    type="date"
                    value={assetForm.warrantyExpiry}
                    onChange={(e) => setAssetForm({ ...assetForm, warrantyExpiry: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. ₹2,00,000"
                    value={assetForm.cost}
                    onChange={(e) => setAssetForm({ ...assetForm, cost: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Vendor</label>
                  <input
                    type="text"
                    placeholder="e.g. Apple Reseller"
                    value={assetForm.vendor}
                    onChange={(e) => setAssetForm({ ...assetForm, vendor: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Storage / Office Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Store Room - Locker B"
                    value={assetForm.location}
                    onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1 sm:col-span-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Bill Photo Copy / Invoice</label>
                  <div className="relative flex items-center w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs focus-within:ring-2 focus-within:ring-emerald-500/30">
                    <label className="cursor-pointer px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] shrink-0 mr-2 border border-emerald-500/20 transition-all">
                      Choose
                      <input
                        key={billFile ? billFile.name : 'empty-add'}
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => setBillFile(e.target.files[0] || null)}
                        className="hidden"
                      />
                    </label>
                    <span className={`text-[11px] truncate flex-1 ${billFile ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                      {billFile ? billFile.name : 'No file chosen'}
                    </span>
                    {billFile && (
                      <button
                        type="button"
                        onClick={() => setBillFile(null)}
                        className="p-0.5 text-muted-foreground hover:text-rose-500 rounded transition-all ml-1"
                        title="Remove selected file"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1 sm:col-span-3">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Asset Description / Technical Specs</label>
                  <textarea
                    rows={2}
                    placeholder="Additional hardware specifications, RAM, SSD size, condition..."
                    value={assetForm.description}
                    onChange={(e) => setAssetForm({ ...assetForm, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-1.5 text-xs font-bold rounded-xl border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md hover:from-emerald-600 hover:to-teal-700"
                >
                  {loading ? 'Creating...' : 'Save Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Asset Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-border/40 bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
              <h3 className="text-base font-bold text-foreground">Edit Asset Details ({selectedAsset?.assetId})</h3>
              <button className="rounded-lg p-1 hover:bg-muted" onClick={() => setEditModalOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-3 space-y-3 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Asset Name *</label>
                  <input
                    type="text"
                    required
                    value={assetForm.name}
                    onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1 sm:col-span-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Category *</label>

                  {!isCustomCategoryMode ? (
                    <select
                      value={assetForm.category}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'ADD_NEW' || val === 'OTHER') {
                          setIsCustomCategoryMode(true);
                          setCustomCategoryInput('');
                          setAssetForm({ ...assetForm, category: 'OTHER' });
                        } else {
                          setAssetForm({ ...assetForm, category: val });
                        }
                      }}
                    >
                      {DEFAULT_CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                      {customCategoriesList.map((cc) => (
                        <option key={cc} value={cc}>{cc}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="relative flex items-center w-full">
                      <input
                        type="text"
                        required
                        autoFocus
                        placeholder="e.g. Server, Camera, GPU..."
                        value={customCategoryInput}
                        onChange={(e) => setCustomCategoryInput(e.target.value)}
                        className="w-full text-xs font-semibold py-1.5 pl-3 pr-8 rounded-xl border border-emerald-500 bg-emerald-500/5 focus:bg-background focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomCategoryMode(false);
                          setCustomCategoryInput('');
                          setAssetForm({ ...assetForm, category: 'LAPTOP' });
                        }}
                        className="absolute right-2 text-muted-foreground hover:text-rose-500 rounded p-0.5"
                        title="Cancel custom category"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Brand</label>
                  <input
                    type="text"
                    value={assetForm.brand}
                    onChange={(e) => setAssetForm({ ...assetForm, brand: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Model</label>
                  <input
                    type="text"
                    value={assetForm.model}
                    onChange={(e) => setAssetForm({ ...assetForm, model: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Serial Number</label>
                  <input
                    type="text"
                    value={assetForm.serialNumber}
                    onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Status</label>
                  <select
                    value={assetForm.status}
                    onChange={(e) => setAssetForm({ ...assetForm, status: e.target.value })}
                  >
                    <option value="AVAILABLE">Available</option>
                    <option value="ASSIGNED">Assigned</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="DAMAGED">Damaged</option>
                    <option value="LOST">Lost</option>
                    <option value="DISPOSED">Disposed</option>
                  </select>
                </div>
              </div>

              {/* Bill Photo Section */}
              {selectedAsset?.billPhoto && (
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={15} />
                    <span className="font-medium">Existing Bill Uploaded</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={getUploadUrl(selectedAsset.billPhoto)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold underline text-blue-600 hover:text-blue-800 text-[11px]"
                    >
                      View
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeleteBillPhoto(selectedAsset.id)}
                      className="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 text-[10px] font-bold transition-all"
                    >
                      Delete Bill
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">
                  {selectedAsset?.billPhoto ? 'Replace Bill Photo Copy (Optional)' : 'Upload Bill Photo Copy / Invoice'}
                </label>
                <div className="relative flex items-center w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs focus-within:ring-2 focus-within:ring-emerald-500/30">
                  <label className="cursor-pointer px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] shrink-0 mr-2 border border-emerald-500/20 transition-all">
                    Choose
                    <input
                      key={billFile ? billFile.name : 'empty-edit'}
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setBillFile(e.target.files[0] || null)}
                      className="hidden"
                    />
                  </label>
                  <span className={`text-[11px] truncate flex-1 ${billFile ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                    {billFile ? billFile.name : 'No file chosen'}
                  </span>
                  {billFile && (
                    <button
                      type="button"
                      onClick={() => setBillFile(null)}
                      className="p-0.5 text-muted-foreground hover:text-rose-500 rounded transition-all ml-1"
                      title="Remove selected file"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-1.5 text-xs font-bold rounded-xl border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md hover:from-emerald-600 hover:to-teal-700"
                >
                  {loading ? 'Saving...' : 'Update Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Asset Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/40 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-base font-bold text-foreground">Assign Asset ({selectedAsset?.assetId})</h3>
              <button className="rounded-lg p-1 hover:bg-muted" onClick={() => setAssignModalOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="mt-4 space-y-4 text-left">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                <span>Assigning hardware item: <strong>{selectedAsset?.name}</strong></span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Assign To User (Intern / Employee / Team Leader) *</label>
                <select
                  required
                  value={assignForm.userId}
                  onChange={(e) => setAssignForm({ ...assignForm, userId: e.target.value })}
                >
                  <option value="">Select a user...</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.employeeId} - {u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Expected Return Date (Optional)</label>
                <input
                  type="date"
                  value={assignForm.expectedReturn}
                  onChange={(e) => setAssignForm({ ...assignForm, expectedReturn: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Handover Notes / Condition</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Handed over with power adapter and laptop bag."
                  value={assignForm.notes}
                  onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md hover:from-emerald-600 hover:to-teal-700"
                >
                  {loading ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Asset Modal */}
      {returnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/40 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-base font-bold text-foreground">Return Asset ({selectedAsset?.assetId})</h3>
              <button className="rounded-lg p-1 hover:bg-muted" onClick={() => setReturnModalOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} className="mt-4 space-y-4 text-left">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                <span>Returning asset from: <strong>{selectedAsset?.assignedTo?.name || 'User'}</strong></span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Return Date *</label>
                <input
                  type="date"
                  required
                  value={returnForm.returnDate}
                  onChange={(e) => setReturnForm({ ...returnForm, returnDate: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Asset Condition *</label>
                <select
                  value={returnForm.conditionOnReturn}
                  onChange={(e) => setReturnForm({ ...returnForm, conditionOnReturn: e.target.value })}
                >
                  <option value="Good">Good (Re-assignable to Available)</option>
                  <option value="Damaged">Damaged (Mark status as Damaged)</option>
                  <option value="Needs Repair">Needs Repair (Mark status as Maintenance)</option>
                  <option value="Lost">Lost (Mark status as Lost)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Remarks / Check-in Inspection</label>
                <textarea
                  rows={3}
                  placeholder="Inspection observations upon receiving hardware back..."
                  value={returnForm.remarks}
                  onChange={(e) => setReturnForm({ ...returnForm, remarks: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReturnModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md hover:from-emerald-600 hover:to-teal-700"
                >
                  {loading ? 'Processing...' : 'Complete Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Bill Photo Copy Modal */}
      {billModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/40 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-base font-bold text-foreground">Upload Bill Photo Copy</h3>
              </div>
              <button className="rounded-lg p-1 hover:bg-muted" onClick={() => setBillModalOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUploadBillSubmit} className="mt-4 space-y-4 text-left">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                <span>Asset: <strong>{selectedAsset?.name}</strong> ({selectedAsset?.assetId})</span>
              </div>

              {selectedAsset?.billPhoto && (
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-medium flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={16} />
                    <span>Current Bill Uploaded</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={getUploadUrl(selectedAsset.billPhoto)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold underline text-blue-600 hover:text-blue-800"
                    >
                      View
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeleteBillPhoto(selectedAsset.id)}
                      className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 text-[10px] font-bold transition-all"
                    >
                      Delete Bill
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Select Invoice / Bill Photocopy *</label>
                <div className="relative flex items-center w-full rounded-2xl border border-border bg-background px-3 py-2 text-xs transition-all focus-within:ring-2 focus-within:ring-emerald-500/30">
                  <label className="cursor-pointer px-3 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs shrink-0 mr-3 border border-emerald-500/20 transition-all">
                    Choose File
                    <input
                      key={billFile ? billFile.name : 'empty-upload-modal'}
                      type="file"
                      required
                      accept="image/*,application/pdf"
                      onChange={(e) => setBillFile(e.target.files[0] || null)}
                      className="hidden"
                    />
                  </label>
                  <span className={`text-xs truncate flex-1 ${billFile ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                    {billFile ? billFile.name : 'No file chosen'}
                  </span>
                  {billFile && (
                    <button
                      type="button"
                      onClick={() => setBillFile(null)}
                      className="p-1 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all ml-2"
                      title="Remove selected file"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBillModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl border hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !billFile}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50"
                >
                  {loading ? 'Uploading...' : 'Upload Bill Photo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Asset Details Drawer Modal */}
      {detailsModalAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-left">
          <div className="w-full max-w-2xl rounded-2xl border border-border/40 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Laptop className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">{detailsModalAsset.name}</h3>
                  <span className="text-xs text-muted-foreground font-mono">{detailsModalAsset.assetId}</span>
                </div>
              </div>
              <button className="rounded-lg p-1 hover:bg-muted" onClick={() => setDetailsModalAsset(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-6">
              {/* Asset Overview */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground border-b pb-2 mb-3">Asset Information</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="bg-muted/40 p-3 rounded-xl border border-border/30">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Category</span>
                    <span className="font-extrabold text-foreground mt-0.5 block">{detailsModalAsset.category}</span>
                  </div>
                  <div className="bg-muted/40 p-3 rounded-xl border border-border/30">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Brand & Model</span>
                    <span className="font-extrabold text-foreground mt-0.5 block">{detailsModalAsset.brand || '—'} {detailsModalAsset.model}</span>
                  </div>
                  <div className="bg-muted/40 p-3 rounded-xl border border-border/30">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Serial Number</span>
                    <span className="font-extrabold font-mono text-foreground mt-0.5 block">{detailsModalAsset.serialNumber || 'N/A'}</span>
                  </div>
                  <div className="bg-muted/40 p-3 rounded-xl border border-border/30">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">Status</span>
                    <span className={`inline-block mt-0.5 text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase ${getStatusBadgeClass(detailsModalAsset.status)}`}>
                      {detailsModalAsset.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial & Warranty Details */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Purchase Date</span>
                  <span className="font-semibold text-foreground">{detailsModalAsset.purchaseDate ? new Date(detailsModalAsset.purchaseDate).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Warranty Expiry</span>
                  <span className="font-semibold text-foreground">{detailsModalAsset.warrantyExpiry ? new Date(detailsModalAsset.warrantyExpiry).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Cost</span>
                  <span className="font-semibold text-foreground">{detailsModalAsset.cost ? `$${detailsModalAsset.cost}` : 'N/A'}</span>
                </div>
              </div>

              {/* Bill Photocopy Attachment Section */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground border-b pb-2 mb-3">Invoice & Bill Photocopy</h4>
                {detailsModalAsset.billPhoto ? (
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                      <div>
                        <p className="text-xs font-bold text-foreground">Official Bill Photocopy Uploaded</p>
                        <p className="text-[10px] text-muted-foreground">Original purchase receipt attached</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={getUploadUrl(detailsModalAsset.billPhoto)}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md hover:bg-emerald-700 transition-all"
                      >
                        View / Download Bill
                      </a>
                      {isManagementRole && (
                        <button
                          type="button"
                          onClick={() => handleDeleteBillPhoto(detailsModalAsset.id)}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-600 border border-rose-500/20 hover:bg-rose-500/20 text-xs font-bold transition-all flex items-center gap-1"
                          title="Delete Bill Photocopy"
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-muted/40 border border-dashed flex items-center justify-between text-xs text-muted-foreground">
                    <span>No bill photocopy uploaded yet.</span>
                    {isManagementRole && (
                      <button
                        onClick={() => { setDetailsModalAsset(null); openBillModal(detailsModalAsset); }}
                        className="text-xs font-bold text-emerald-600 hover:underline"
                      >
                        Upload Now
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Current Assignment Details */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground border-b pb-2 mb-3">Assignment Details</h4>
                {detailsModalAsset.assignedTo ? (
                  <div className="flex items-center gap-4 bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
                    <UserAvatar src={detailsModalAsset.assignedTo.profilePic} name={detailsModalAsset.assignedTo.name} className="h-10 w-10 rounded-xl object-cover" />
                    <div>
                      <h5 className="text-sm font-bold text-foreground">{detailsModalAsset.assignedTo.name}</h5>
                      <p className="text-xs text-muted-foreground font-mono">{detailsModalAsset.assignedTo.employeeId} • {detailsModalAsset.assignedTo.role}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Assigned Date: {detailsModalAsset.assignedDate ? new Date(detailsModalAsset.assignedDate).toLocaleDateString() : 'Recent'}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl border border-dashed">
                    This asset is currently not assigned to any team member.
                  </p>
                )}
              </div>

              {/* Assignment History */}
              {detailsModalAsset.assignments && detailsModalAsset.assignments.length > 0 && (
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground border-b pb-2 mb-3">Assignment Audit History</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {detailsModalAsset.assignments.map((asg) => (
                      <div key={asg.id} className="p-3 rounded-xl bg-muted/30 border border-border/30 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-foreground">{asg.user?.name} ({asg.user?.employeeId})</p>
                          <span className="text-[10px] text-muted-foreground">Assigned: {new Date(asg.assignedDate).toLocaleDateString()}</span>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${asg.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/10 text-slate-600'}`}>
                          {asg.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border/40 bg-card p-6 shadow-2xl text-left animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-foreground">{confirmModal.title}</h3>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{confirmModal.message}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                className="px-4 py-2 text-xs font-bold rounded-xl border hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const cb = confirmModal.onConfirm;
                  setConfirmModal({ ...confirmModal, isOpen: false });
                  if (cb) cb();
                }}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 text-white hover:bg-rose-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default AssetManagement;
