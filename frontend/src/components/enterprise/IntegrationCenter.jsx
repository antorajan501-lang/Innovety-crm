import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Share2, Mail, Calendar, MessageSquare, Users, CheckCircle2,
  AlertCircle, RefreshCw, X, Link2, Unlink, Settings, Key,
  ExternalLink, Globe, ShieldCheck, Zap
} from 'lucide-react';
import api from '../../services/api';
import { useCompanyScope } from '../../context/CompanyScopeContext';

const PROVIDER_ICONS = {
  GMAIL: Mail,
  GOOGLE_CALENDAR: Calendar,
  SLACK: MessageSquare,
  MS_TEAMS: Users,
  OUTLOOK: Mail
};

const PROVIDER_GRADIENTS = {
  GMAIL: 'from-red-600 to-rose-700',
  GOOGLE_CALENDAR: 'from-blue-600 to-sky-600',
  SLACK: 'from-purple-700 to-pink-700',
  MS_TEAMS: 'from-indigo-600 to-purple-800',
  OUTLOOK: 'from-blue-700 to-indigo-900'
};

const IntegrationCenter = () => {
  const { selectedOrgId } = useCompanyScope();
  const [connectors, setConnectors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncingMap, setSyncingMap] = useState({});
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Config modal
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [activeConnector, setActiveConnector] = useState(null);
  const [formData, setFormData] = useState({
    clientId: '',
    clientSecret: '',
    webhookUrl: '',
    scope: 'read_write'
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchIntegrations = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.get('/enterprise/integrations');
      if (res.data?.success) {
        setConnectors(res.data.integrations || []);
      }
    } catch (err) {
      console.error('Error fetching integrations:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to load external integrations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, [selectedOrgId]);

  const handleOpenConfig = (connector) => {
    setActiveConnector(connector);
    setFormData({
      clientId: connector.clientId ? '' : '',
      clientSecret: '',
      webhookUrl: connector.webhookUrl || '',
      scope: 'read_write'
    });
    setConfigModalOpen(true);
  };

  const handleSaveConnection = async (e) => {
    e.preventDefault();
    if (!activeConnector) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await api.post('/enterprise/integrations/connect', {
        provider: activeConnector.provider,
        clientId: formData.clientId || 'demo_client_' + Date.now(),
        clientSecret: formData.clientSecret || 'demo_secret_' + Date.now(),
        webhookUrl: formData.webhookUrl || undefined,
        settings: { scope: formData.scope }
      });
      if (res.data?.success) {
        setSuccessMsg(`Successfully connected to ${activeConnector.name}`);
        setConfigModalOpen(false);
        fetchIntegrations();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to connect integration');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisconnect = async (provider, name) => {
    if (!window.confirm(`Are you sure you want to disconnect ${name}? Active synchronizations will pause.`)) return;
    try {
      const res = await api.post('/enterprise/integrations/disconnect', { provider });
      if (res.data?.success) {
        setSuccessMsg(`Disconnected ${name}`);
        fetchIntegrations();
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to disconnect integration');
    }
  };

  const handleTriggerSync = async (provider, name) => {
    setSyncingMap(prev => ({ ...prev, [provider]: true }));
    setErrorMsg(null);
    try {
      const res = await api.post('/enterprise/integrations/sync', { provider });
      if (res.data?.success) {
        setSuccessMsg(`Sync complete for ${name}: ${res.data.syncedRecordsCount} records processed.`);
        fetchIntegrations();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || `Failed to sync ${name}`);
    } finally {
      setSyncingMap(prev => ({ ...prev, [provider]: false }));
    }
  };

  const connectedCount = connectors.filter(c => c.status === 'CONNECTED').length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20 text-white">
              <Share2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">External Integrations Center</h1>
              <p className="text-sm text-slate-400">Connect cloud services, sync schedules, and automate multi-channel notifications</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium text-slate-300">
              Active Connectors: <strong className="text-white font-mono">{connectedCount} / {connectors.length}</strong>
            </span>
          </div>

          <button
            onClick={fetchIntegrations}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
            title="Refresh Integrations"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Connector Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {connectors.map((connector) => {
          const IconComp = PROVIDER_ICONS[connector.provider] || Globe;
          const isConnected = connector.status === 'CONNECTED';
          const isSyncing = syncingMap[connector.provider];
          const grad = PROVIDER_GRADIENTS[connector.provider] || 'from-slate-700 to-slate-800';

          return (
            <motion.div
              layout
              key={connector.provider}
              className={`flex flex-col justify-between bg-slate-900/60 border rounded-2xl p-5 shadow-lg backdrop-blur-sm transition ${
                isConnected ? 'border-indigo-500/40 shadow-indigo-500/5' : 'border-slate-800'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className={`p-3 rounded-xl bg-gradient-to-tr ${grad} text-white shadow-md`}>
                    <IconComp className="w-6 h-6" />
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${
                      isConnected
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {connector.category}
                    </span>
                  </div>
                </div>

                {/* Title & Description */}
                <h3 className="text-base font-bold text-white mb-1.5">{connector.name}</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  {connector.description}
                </p>

                {/* Details if connected */}
                {isConnected && (
                  <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800/80 mb-4 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Auth Protocol:</span>
                      <span className="font-mono text-slate-200">{connector.authType}</span>
                    </div>
                    {connector.clientId && (
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Client ID:</span>
                        <span className="font-mono text-slate-300">{connector.clientId}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Last Sync:</span>
                      <span className="text-slate-300">
                        {connector.lastSyncAt ? new Date(connector.lastSyncAt).toLocaleString() : 'Never synced'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Sync Status:</span>
                      <span className={`font-semibold ${
                        connector.lastSyncStatus === 'SUCCESS' ? 'text-emerald-400' : 'text-slate-400'
                      }`}>
                        {connector.lastSyncStatus}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                {isConnected ? (
                  <>
                    <button
                      onClick={() => handleTriggerSync(connector.provider, connector.name)}
                      disabled={isSyncing}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 text-xs font-semibold rounded-xl transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      {isSyncing ? 'Syncing...' : 'Sync Now'}
                    </button>

                    <button
                      onClick={() => handleOpenConfig(connector)}
                      className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
                      title="Edit Configuration"
                    >
                      <Settings className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDisconnect(connector.provider, connector.name)}
                      className="p-2 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition"
                      title="Disconnect Connector"
                    >
                      <Unlink className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleOpenConfig(connector)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-500/10 transition"
                  >
                    <Link2 className="w-4 h-4" />
                    Connect {connector.name.split(' ')[0]}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Integration Setup Modal */}
      <AnimatePresence>
        {configModalOpen && activeConnector && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Configure {activeConnector.name}</h3>
                    <p className="text-xs text-slate-400">OAuth 2.0 and API Webhook Credentials</p>
                  </div>
                </div>
                <button
                  onClick={() => setConfigModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveConnection} className="p-6 space-y-4">
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 flex items-start gap-2">
                  <Zap className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    To connect {activeConnector.name}, generate OAuth credentials in your provider console and enter the client parameters below.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Client ID / App ID
                  </label>
                  <input
                    type="text"
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                    placeholder="e.g. 849302-live-oauth.apps.googleusercontent.com"
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Client Secret / Token
                  </label>
                  <input
                    type="password"
                    value={formData.clientSecret}
                    onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
                    placeholder="••••••••••••••••••••••••••••"
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Incoming / Outgoing Webhook URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={formData.webhookUrl}
                    onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                    placeholder="https://hooks.slack.com/services/T00/B00/XXXXX"
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Permission Scope
                  </label>
                  <select
                    value={formData.scope}
                    onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="read_only">Read-Only (Sync Events & Status)</option>
                    <option value="read_write">Read & Write (Publish Notifications & Alerts)</option>
                    <option value="full_access">Full Administrative Access</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setConfigModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition"
                  >
                    {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                    Save & Connect
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default IntegrationCenter;
