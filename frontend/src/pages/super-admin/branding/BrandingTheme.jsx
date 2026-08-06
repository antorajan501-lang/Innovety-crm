import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Palette, Upload, Image as ImageIcon, Trash2, CheckCircle2,
  Building2, Save, Sun, Moon, Sparkles, RefreshCw, AlertCircle
} from 'lucide-react';
import api, { getUploadUrl } from '../../../services/api';
import { useTheme } from '../../../context/ThemeContext';

const THEME_PRESETS = [
  {
    id: 'emerald',
    name: 'Default Green',
    description: 'Classic emerald green enterprise palette',
    sidebarColor: 'bg-emerald-950',
    headerColor: 'bg-emerald-600',
    buttonColor: 'bg-emerald-600 text-white',
    accentColor: 'bg-emerald-500',
    cardBorder: 'border-emerald-500/40'
  },
  {
    id: 'blue',
    name: 'Royal Blue',
    description: 'Professional royal blue corporate design',
    sidebarColor: 'bg-blue-950',
    headerColor: 'bg-blue-600',
    buttonColor: 'bg-blue-600 text-white',
    accentColor: 'bg-blue-500',
    cardBorder: 'border-blue-500/40'
  },
  {
    id: 'purple',
    name: 'Vibrant Purple',
    description: 'Modern violet & deep purple theme',
    sidebarColor: 'bg-purple-950',
    headerColor: 'bg-purple-600',
    buttonColor: 'bg-purple-600 text-white',
    accentColor: 'bg-purple-500',
    cardBorder: 'border-purple-500/40'
  },
  {
    id: 'orange',
    name: 'Warm Orange',
    description: 'Energetic tangerine & amber tone',
    sidebarColor: 'bg-stone-900',
    headerColor: 'bg-orange-600',
    buttonColor: 'bg-orange-600 text-white',
    accentColor: 'bg-orange-500',
    cardBorder: 'border-orange-500/40'
  },
  {
    id: 'dark-corporate',
    name: 'Dark Corporate',
    description: 'Sleek dark slate with sky cyan accents',
    sidebarColor: 'bg-slate-950',
    headerColor: 'bg-slate-900',
    buttonColor: 'bg-sky-500 text-slate-950',
    accentColor: 'bg-cyan-400',
    cardBorder: 'border-sky-500/40'
  },
  {
    id: 'maroon',
    name: 'Maroon',
    description: 'Professional maroon enterprise theme with elegant burgundy accents.',
    sidebarColor: 'bg-rose-950',
    headerColor: 'bg-rose-900',
    buttonColor: 'bg-rose-900 text-white',
    accentColor: 'bg-rose-600',
    cardBorder: 'border-rose-900/40'
  }
];

const BrandingTheme = () => {
  const {
    companyName: ctxName,
    companyLogo: ctxLogo,
    selectedTheme: ctxTheme,
    themeMode: ctxMode,
    updateThemeSettings
  } = useTheme();

  const [companyName, setCompanyName] = useState(ctxName || 'Innoviety Enterprise');
  const [selectedTheme, setSelectedTheme] = useState(ctxTheme || 'emerald');
  const [themeMode, setThemeMode] = useState(ctxMode || 'light');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(ctxLogo || null);
  const [removeLogo, setRemoveLogo] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    setCompanyName(ctxName);
    setSelectedTheme(ctxTheme);
    setThemeMode(ctxMode);
    setLogoPreview(ctxLogo);
  }, [ctxName, ctxLogo, ctxTheme, ctxMode]);

  const handleLogoFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setRemoveLogo(false);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(true);
  };

  const handleThemeCardClick = (themeId) => {
    setSelectedTheme(themeId);
    // Apply immediately to current viewport for live preview!
    updateThemeSettings({ selectedTheme: themeId });
  };

  const handleModeToggle = (mode) => {
    setThemeMode(mode);
    updateThemeSettings({ themeMode: mode });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const formData = new FormData();
      formData.append('companyName', companyName);
      formData.append('selectedTheme', selectedTheme);
      formData.append('themeMode', themeMode);
      if (removeLogo) {
        formData.append('removeLogo', 'true');
      }
      if (logoFile) {
        formData.append('logo', logoFile);
      }

      const res = await api.put('/super-admin/branding', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      updateThemeSettings({
        companyName: res.data.companyName,
        companyLogo: res.data.companyLogo,
        selectedTheme: res.data.selectedTheme,
        themeMode: res.data.themeMode
      });

      setMessage({ type: 'success', text: 'Branding and theme settings saved successfully!' });
      setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    } catch (err) {
      console.error('Failed to save branding settings:', err);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save branding settings.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-left max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/30 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary border border-primary/20 mb-2">
            <Palette className="h-3.5 w-3.5" />
            <span>Platform Branding & Theme Module</span>
          </div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
            Company Branding & Theme Management
          </h1>
          <p className="text-xs text-muted-foreground">
            Configure platform branding details and select predefined visual themes that instantly apply across the enterprise app.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-primary-hover shadow-md transition-all shrink-0 disabled:opacity-50"
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>{saving ? 'Saving...' : 'Save Branding & Theme'}</span>
        </button>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 ${message.type === 'success' ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-red-500/10 text-red-500 border border-red-500/30'}`}>
          {message.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Module 1: Company Branding Card */}
      <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-sm space-y-6">
        <div className="border-b border-border/30 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">Company Branding</h3>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">App Header & Sidebar</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Company Name */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground block">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Innoviety Enterprise"
              className="w-full rounded-xl border border-border/60 bg-background px-4 py-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <p className="text-[10px] text-muted-foreground">
              Displayed in the navigation sidebar, login page, and application headers.
            </p>
          </div>

          {/* Company Logo Upload & Preview */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground block">
              Company Logo
            </label>

            <div className="flex items-center gap-4 p-3 rounded-xl border border-border/60 bg-muted/20">
              <div className="h-14 w-14 rounded-xl border border-border/50 bg-card flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                {logoPreview ? (
                  <img
                    src={getUploadUrl(logoPreview)}
                    alt="Company Logo Preview"
                    className="h-full w-full object-contain p-1"
                  />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 text-xs font-bold transition-all">
                    <Upload className="h-3.5 w-3.5" />
                    <span>{logoPreview ? 'Replace Logo' : 'Upload Logo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileChange}
                      className="hidden"
                    />
                  </label>

                  {logoPreview && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 px-2.5 py-1.5 text-xs font-bold transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <p className="text-[10px] text-muted-foreground">
                  PNG, SVG, or JPG (Max 10MB). Reverts to default logo if removed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Module 2: Theme Management Card */}
      <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-sm space-y-6">
        <div className="border-b border-border/30 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">Theme Palette Selector</h3>
          </div>

          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/30">
            <button
              type="button"
              onClick={() => handleModeToggle('light')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all ${themeMode === 'light' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground'}`}
            >
              <Sun className="h-3.5 w-3.5 text-amber-500" />
              <span>Light Mode</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeToggle('dark')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold transition-all ${themeMode === 'dark' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground'}`}
            >
              <Moon className="h-3.5 w-3.5 text-indigo-400" />
              <span>Dark Mode</span>
            </button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Select a predefined enterprise theme. Clicking a card updates the application's appearance immediately.
        </p>

        {/* Theme Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {THEME_PRESETS.map((preset) => {
            const isSelected = selectedTheme === preset.id;

            return (
              <div
                key={preset.id}
                onClick={() => handleThemeCardClick(preset.id)}
                className={`cursor-pointer rounded-2xl border-2 p-5 transition-all relative overflow-hidden flex flex-col justify-between space-y-4 hover:shadow-md ${isSelected ? `${preset.cardBorder} bg-primary/5 ring-2 ring-primary/30` : 'border-border/40 bg-card hover:border-border'}`}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3 text-primary">
                    <CheckCircle2 className="h-5 w-5 fill-primary text-white" />
                  </div>
                )}

                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-foreground">{preset.name}</h4>
                  <p className="text-[11px] text-muted-foreground">{preset.description}</p>
                </div>

                {/* Color Swatches Preview Component */}
                <div className="space-y-2 bg-muted/30 p-3 rounded-xl border border-border/30">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground block">
                    Swatches Preview
                  </span>

                  <div className="flex items-center gap-2">
                    {/* Sidebar Swatch */}
                    <div className="flex flex-col items-center gap-1">
                      <div className={`h-6 w-6 rounded-md shadow-2xs ${preset.sidebarColor}`} />
                      <span className="text-[8px] text-muted-foreground">Sidebar</span>
                    </div>

                    {/* Header Swatch */}
                    <div className="flex flex-col items-center gap-1">
                      <div className={`h-6 w-6 rounded-md shadow-2xs ${preset.headerColor}`} />
                      <span className="text-[8px] text-muted-foreground">Header</span>
                    </div>

                    {/* Accent Swatch */}
                    <div className="flex flex-col items-center gap-1">
                      <div className={`h-6 w-6 rounded-md shadow-2xs ${preset.accentColor}`} />
                      <span className="text-[8px] text-muted-foreground">Accent</span>
                    </div>

                    {/* Button Sample */}
                    <div className="flex flex-col items-center gap-1 ml-auto">
                      <span className={`px-2 py-1 rounded text-[9px] font-bold ${preset.buttonColor}`}>
                        Button
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BrandingTheme;
