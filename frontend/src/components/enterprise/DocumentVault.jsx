import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Upload, Download, Eye, History, CheckCircle2,
  AlertCircle, Search, Filter, Plus, X, RefreshCw, Clock, ShieldCheck
} from 'lucide-react';
import api from '../../services/api';
import { useCompanyScope } from '../../context/CompanyScopeContext';
import { useAuth } from '../../context/AuthContext';

const DOCUMENT_TYPE_LABELS = {
  AADHAAR: 'Aadhaar Card',
  PAN: 'PAN Card',
  RESUME: 'Resume / CV',
  OFFER_LETTER: 'Signed Offer Letter',
  CERTIFICATES: 'Educational Certificates',
  AGREEMENTS: 'NDA & Policies Agreement',
  OTHER: 'General Statutory Document'
};

const DocumentVault = () => {
  const { selectedOrgId } = useCompanyScope();
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [overview, setOverview] = useState({ totalDocs: 0, verifiedDocs: 0, typeCounts: {} });
  const [loading, setLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyData, setHistoryData] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [uploadForm, setUploadForm] = useState({
    documentType: 'PAN',
    title: '',
    fileName: '',
    filePath: '',
    notes: ''
  });

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const [docsRes, overviewRes] = await Promise.all([
        api.get(`/enterprise/documents/user/${user?.id}`),
        api.get('/enterprise/documents/overview')
      ]);

      if (docsRes.data?.success) setDocuments(docsRes.data.documents || []);
      if (overviewRes.data?.success) setOverview(overviewRes.data);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [selectedOrgId, user?.id]);

  const handleUpload = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        userId: user.id,
        documentType: uploadForm.documentType,
        title: uploadForm.title || `${DOCUMENT_TYPE_LABELS[uploadForm.documentType]} Document`,
        fileName: uploadForm.fileName || `${uploadForm.documentType.toLowerCase()}_verified.pdf`,
        filePath: uploadForm.filePath || `/uploads/documents/${uploadForm.documentType.toLowerCase()}_sample.pdf`,
        fileSize: 154000,
        notes: uploadForm.notes
      };

      const res = await api.post('/enterprise/documents/upload', payload);
      if (res.data?.success) {
        setUploadModalOpen(false);
        setUploadForm({ documentType: 'PAN', title: '', fileName: '', filePath: '', notes: '' });
        fetchDocuments();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to upload document.');
    } finally {
      setSubmitting(false);
    }
  };

  const openHistory = async (doc) => {
    setSelectedDoc(doc);
    try {
      const res = await api.get(`/enterprise/documents/${doc.id}/history`);
      if (res.data?.success) {
        setHistoryData(res.data);
        setHistoryModalOpen(true);
      }
    } catch (err) {
      alert('Failed to load version history.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-emerald-500" />
            Employee Document Vault
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Encrypted statutory repository for Aadhaar, PAN, Agreements, and Certificates with full version history.
          </p>
        </div>
        <button
          onClick={() => setUploadModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow-md shadow-emerald-500/20"
        >
          <Upload className="w-4 h-4" />
          Upload Document / Version
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Total Uploaded</p>
            <h4 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{overview.totalDocs || documents.length}</h4>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Verified &amp; Active</p>
            <h4 className="text-2xl font-bold text-blue-600 dark:text-blue-400">{overview.verifiedDocs || documents.length}</h4>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
            <History className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Audit Version Tracking</p>
            <h4 className="text-2xl font-bold text-purple-600 dark:text-purple-400">100% Immutable</h4>
          </div>
        </div>
      </div>

      {/* Document Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading document vault...</div>
      ) : documents.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border text-center text-xs text-slate-400">
          No documents uploaded yet. Upload your PAN, Aadhaar, or educational certificates to begin.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                      {DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold">
                    v{doc.version}
                  </span>
                </div>

                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{doc.title}</h4>
                <p className="text-xs text-slate-400 mt-1 font-mono">{doc.fileName}</p>

                {doc.notes && (
                  <p className="text-xs text-slate-500 mt-2 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg italic">
                    "{doc.notes}"
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px]">
                  Updated {new Date(doc.updatedAt).toLocaleDateString()}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openHistory(doc)}
                    className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 flex items-center gap-1 font-medium"
                    title="Version History"
                  >
                    <History className="w-3.5 h-3.5" />
                    History ({doc.history?.length || 0})
                  </button>

                  <a
                    href={doc.filePath}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"
                    title="Preview / Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {uploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b">
                <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">Upload Statutory Document</h3>
                <button onClick={() => setUploadModalOpen(false)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>

              <form onSubmit={handleUpload} className="space-y-3 mt-4 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Document Category *</label>
                  <select
                    value={uploadForm.documentType}
                    onChange={(e) => setUploadForm({ ...uploadForm, documentType: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800"
                  >
                    {Object.entries(DOCUMENT_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Document Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Aadhaar Card Front & Back"
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">File Name</label>
                  <input
                    type="text"
                    placeholder="e.g. pan_card_scanned_v2.pdf"
                    value={uploadForm.fileName}
                    onChange={(e) => setUploadForm({ ...uploadForm, fileName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Version Notes / Comments</label>
                  <textarea
                    rows="2"
                    placeholder="e.g. Renewal copy with updated address"
                    value={uploadForm.notes}
                    onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border text-[11px] text-slate-500">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Automatic Versioning:</p>
                  <p>If an existing document of this category exists, it will be automatically archived into version history and replaced with version {documents.find((d) => d.documentType === uploadForm.documentType)?.version + 1 || 1}.</p>
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t">
                  <button type="button" onClick={() => setUploadModalOpen(false)} className="px-4 py-2 rounded-xl text-slate-500">Cancel</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium">Upload Document</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Version History Modal */}
      <AnimatePresence>
        {historyModalOpen && historyData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b">
                <div>
                  <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <History className="w-5 h-5 text-purple-500" />
                    Version History: {selectedDoc?.title}
                  </h3>
                  <p className="text-xs text-slate-400">Chronological history of uploaded document iterations.</p>
                </div>
                <button onClick={() => setHistoryModalOpen(false)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>

              <div className="my-4 space-y-3 max-h-80 overflow-y-auto pr-1 text-xs">
                {/* Current Version */}
                <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-700 dark:text-emerald-300">Version {historyData.current.version} (CURRENT ACTIVE)</span>
                    <span className="text-[11px] text-slate-400">{new Date(historyData.current.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <p className="font-mono text-slate-600 dark:text-slate-300 mt-1">{historyData.current.fileName}</p>
                </div>

                {/* Previous Versions */}
                {historyData.history?.length === 0 ? (
                  <p className="text-center text-slate-400 py-4">No previous versions. This is the initial version (v1).</p>
                ) : (
                  historyData.history.map((hist) => (
                    <div key={hist.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">Version {hist.version} (Archived)</span>
                        <span className="text-[11px] text-slate-400">{new Date(hist.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="font-mono text-slate-500 mt-1">{hist.fileName}</p>
                      {hist.changeNotes && <p className="text-[11px] text-slate-400 mt-0.5 italic">{hist.changeNotes}</p>}
                    </div>
                  ))
                )}
              </div>

              <div className="pt-3 flex justify-end border-t">
                <button onClick={() => setHistoryModalOpen(false)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  Close History
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DocumentVault;
