import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import api, { getSocket } from '../services/api';
import { useAuth } from './AuthContext';
import { useCompanyScope } from './CompanyScopeContext';

const ThemeContext = createContext();

const parseBoolVal = (value) => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
};

const getTenantThemeKey = (orgId) => (orgId && orgId !== 'all') ? `mrf_theme_${orgId}` : 'mrf_theme_default';
const getTenantModeKey = (orgId) => (orgId && orgId !== 'all') ? `mrf_mode_${orgId}` : 'mrf_mode_default';

export const ThemeProvider = ({ children }) => {
  const { user } = useAuth();
  const scopeContext = useCompanyScope();
  const selectedOrgId = scopeContext?.selectedOrgId;
  const effectiveOrgId = scopeContext?.effectiveOrgId;

  const activeOrgId = user?.role === 'SUPER_ADMIN'
    ? (selectedOrgId && selectedOrgId !== 'all' ? selectedOrgId : (effectiveOrgId && effectiveOrgId !== 'all' ? effectiveOrgId : null))
    : (user?.organizationId || user?.organization?.id);

  const [companyName, setCompanyName] = useState('Innoviety Enterprise');
  const [companyLogo, setCompanyLogo] = useState(null);

  const [selectedTheme, setSelectedTheme] = useState(() => {
    const savedCompanyId = localStorage.getItem('mrf_selected_company_id');
    return localStorage.getItem(getTenantThemeKey(savedCompanyId)) || 'emerald';
  });

  const [themeMode, setThemeMode] = useState(() => {
    const savedCompanyId = localStorage.getItem('mrf_selected_company_id');
    return localStorage.getItem(getTenantModeKey(savedCompanyId)) || 'light';
  });
  
  // Platform & Tenant Chat Settings
  const [platformChatEnabledForAdmins, setPlatformChatEnabledForAdmins] = useState(true);
  const [platformChatEnabledForUsers, setPlatformChatEnabledForUsers] = useState(true);
  const [tenantChatEnabledForAdmins, setTenantChatEnabledForAdmins] = useState(true);
  const [tenantChatEnabledForUsers, setTenantChatEnabledForUsers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  // Apply data-theme & dark mode attributes on document root
  const applyThemeToDOM = (themeName, mode) => {
    if (themeName) {
      document.documentElement.setAttribute('data-theme', themeName);
    }
    const currentMode = mode !== undefined ? mode : themeMode;
    const isDark = currentMode === 'dark' || themeName === 'dark-corporate';
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    applyThemeToDOM(selectedTheme, themeMode);
  }, [selectedTheme, themeMode]);

  const fetchPlatformSettings = useCallback(async (targetOrgId) => {
    if (!user) return;
    try {
      const orgToFetch = targetOrgId !== undefined ? targetOrgId : activeOrgId;
      const params = (orgToFetch && orgToFetch !== 'all') ? { organizationId: orgToFetch } : {};
      const res = await api.get('/platform/settings', { params });

      if (res.data) {
        if (res.data.companyName) setCompanyName(res.data.companyName);
        if (res.data.companyLogo !== undefined) setCompanyLogo(res.data.companyLogo);

        const newTheme = res.data.selectedTheme || 'emerald';
        const newMode = res.data.themeMode || 'light';

        setSelectedTheme(newTheme);
        setThemeMode(newMode);

        if (orgToFetch && orgToFetch !== 'all') {
          localStorage.setItem(getTenantThemeKey(orgToFetch), newTheme);
          localStorage.setItem(getTenantModeKey(orgToFetch), newMode);
        }

        // Platform level settings
        if (res.data.platform) {
          const pAdmin = parseBoolVal(res.data.platform.adminChatEnabled !== undefined ? res.data.platform.adminChatEnabled : res.data.platform.chatEnabledForAdmins);
          if (pAdmin !== undefined) setPlatformChatEnabledForAdmins(pAdmin);
          const pUser = parseBoolVal(res.data.platform.userChatEnabled !== undefined ? res.data.platform.userChatEnabled : res.data.platform.chatEnabledForUsers);
          if (pUser !== undefined) setPlatformChatEnabledForUsers(pUser);
        } else {
          const pAdmin = parseBoolVal(res.data.adminChatEnabled !== undefined ? res.data.adminChatEnabled : res.data.chatEnabledForAdmins);
          if (pAdmin !== undefined) setPlatformChatEnabledForAdmins(pAdmin);
          const pUser = parseBoolVal(res.data.userChatEnabled !== undefined ? res.data.userChatEnabled : res.data.chatEnabledForUsers);
          if (pUser !== undefined) setPlatformChatEnabledForUsers(pUser);
        }

        // Tenant (Organization) level settings
        if (res.data.organization) {
          const tAdmin = parseBoolVal(res.data.organization.adminChatEnabled !== undefined ? res.data.organization.adminChatEnabled : res.data.organization.chatEnabledForAdmins);
          if (tAdmin !== undefined) setTenantChatEnabledForAdmins(tAdmin);
          const tUser = parseBoolVal(res.data.organization.userChatEnabled !== undefined ? res.data.organization.userChatEnabled : res.data.organization.chatEnabledForUsers);
          if (tUser !== undefined) setTenantChatEnabledForUsers(tUser);
        } else {
          const tAdmin = parseBoolVal(res.data.adminChatEnabled !== undefined ? res.data.adminChatEnabled : res.data.chatEnabledForAdmins);
          if (tAdmin !== undefined) setTenantChatEnabledForAdmins(tAdmin);
          const tUser = parseBoolVal(res.data.userChatEnabled !== undefined ? res.data.userChatEnabled : res.data.chatEnabledForUsers);
          if (tUser !== undefined) setTenantChatEnabledForUsers(tUser);
        }

        applyThemeToDOM(newTheme, newMode);
      }
    } catch (err) {
      console.warn('Failed to load platform settings:', err);
    } finally {
      setLoading(false);
      setPermissionsLoaded(true);
    }
  }, [user, activeOrgId]);

  useEffect(() => {
    if (!user) {
      setCompanyName('Innoviety Enterprise');
      setCompanyLogo(null);
    }
  }, [user]);

  // When active company scope changes, immediately load its cached theme and fetch updated settings
  useEffect(() => {
    if (!user) return;
    if (activeOrgId && activeOrgId !== 'all') {
      const cachedTheme = localStorage.getItem(getTenantThemeKey(activeOrgId));
      const cachedMode = localStorage.getItem(getTenantModeKey(activeOrgId));
      if (cachedTheme) {
        setSelectedTheme(cachedTheme);
        applyThemeToDOM(cachedTheme, cachedMode || 'light');
      }
    }
    fetchPlatformSettings(activeOrgId);
  }, [activeOrgId, user, fetchPlatformSettings]);

  // Real-time socket listener for chat_settings_updated
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    if (!socket) return;

    const handleChatSettingsUpdated = () => {
      fetchPlatformSettings(activeOrgId);
    };

    socket.on('chat_settings_updated', handleChatSettingsUpdated);
    return () => {
      socket.off('chat_settings_updated', handleChatSettingsUpdated);
    };
  }, [user, activeOrgId, fetchPlatformSettings]);

  const updateThemeSettings = useCallback((newSettings, targetOrgId) => {
    const orgId = targetOrgId !== undefined ? targetOrgId : activeOrgId;

    if (newSettings.companyName !== undefined) setCompanyName(newSettings.companyName);
    if (newSettings.companyLogo !== undefined) setCompanyLogo(newSettings.companyLogo);

    if (newSettings.platform) {
      const pAdmin = parseBoolVal(newSettings.platform.chatEnabledForAdmins);
      if (pAdmin !== undefined) setPlatformChatEnabledForAdmins(pAdmin);
      const pUser = parseBoolVal(newSettings.platform.chatEnabledForUsers);
      if (pUser !== undefined) setPlatformChatEnabledForUsers(pUser);
    }
    if (newSettings.organization) {
      const tAdmin = parseBoolVal(newSettings.organization.chatEnabledForAdmins);
      if (tAdmin !== undefined) setTenantChatEnabledForAdmins(tAdmin);
      const tUser = parseBoolVal(newSettings.organization.chatEnabledForUsers);
      if (tUser !== undefined) setTenantChatEnabledForUsers(tUser);
    }

    const adminVal = parseBoolVal(newSettings.chatEnabledForAdmins);
    if (adminVal !== undefined) {
      setPlatformChatEnabledForAdmins(adminVal);
      setTenantChatEnabledForAdmins(adminVal);
    }
    const userVal = parseBoolVal(newSettings.chatEnabledForUsers);
    if (userVal !== undefined) {
      setPlatformChatEnabledForUsers(userVal);
      setTenantChatEnabledForUsers(userVal);
    }

    let updatedTheme = selectedTheme;
    let updatedMode = themeMode;

    if (newSettings.selectedTheme !== undefined) {
      updatedTheme = newSettings.selectedTheme;
      setSelectedTheme(updatedTheme);
      if (orgId && orgId !== 'all') {
        localStorage.setItem(getTenantThemeKey(orgId), updatedTheme);
      }
    }
    if (newSettings.themeMode !== undefined) {
      updatedMode = newSettings.themeMode;
      setThemeMode(updatedMode);
      if (orgId && orgId !== 'all') {
        localStorage.setItem(getTenantModeKey(orgId), updatedMode);
      }
    }

    applyThemeToDOM(updatedTheme, updatedMode);
  }, [activeOrgId, selectedTheme, themeMode]);

  /**
   * Final Permission Hierarchy:
   * SUPER_ADMIN -> true (Always allowed)
   * ADMIN -> platformChatEnabledForAdmins AND tenantChatEnabledForAdmins
   * TEAM_LEADER / EMPLOYEE / INTERN -> platformChatEnabledForUsers AND tenantChatEnabledForUsers
   */
  const userChatEnabled = useMemo(() => {
    if (user?.role === 'SUPER_ADMIN') return true;
    const pUser = platformChatEnabledForUsers !== false;
    const tUser = tenantChatEnabledForUsers !== false;
    return pUser && tUser;
  }, [user, platformChatEnabledForUsers, tenantChatEnabledForUsers]);

  const adminChatEnabled = useMemo(() => {
    if (user?.role === 'SUPER_ADMIN') return true;
    const pAdmin = platformChatEnabledForAdmins !== false;
    const tAdmin = tenantChatEnabledForAdmins !== false;
    return pAdmin && tAdmin;
  }, [user, platformChatEnabledForAdmins, tenantChatEnabledForAdmins]);

  const canUseChat = useMemo(() => {
    if (!user) return false;
    const roleUpper = String(user.role || '').toUpperCase();
    if (roleUpper === 'SUPER_ADMIN') return true;
    if (roleUpper === 'ADMIN') return adminChatEnabled;
    return userChatEnabled;
  }, [user, adminChatEnabled, userChatEnabled]);

  const contextValue = useMemo(() => ({
    companyName,
    companyLogo,
    selectedTheme,
    themeMode,
    chatEnabledForAdmins: platformChatEnabledForAdmins,
    chatEnabledForUsers: platformChatEnabledForUsers,
    platformChatEnabledForAdmins,
    platformChatEnabledForUsers,
    tenantChatEnabledForAdmins,
    tenantChatEnabledForUsers,
    adminChatEnabled,
    userChatEnabled,
    setPlatformChatEnabledForAdmins,
    setPlatformChatEnabledForUsers,
    setTenantChatEnabledForAdmins,
    setTenantChatEnabledForUsers,
    refreshPlatformSettings: fetchPlatformSettings,
    canUseChat,
    updateThemeSettings,
    loading
  }), [
    companyName,
    companyLogo,
    selectedTheme,
    themeMode,
    platformChatEnabledForAdmins,
    platformChatEnabledForUsers,
    tenantChatEnabledForAdmins,
    tenantChatEnabledForUsers,
    adminChatEnabled,
    userChatEnabled,
    fetchPlatformSettings,
    canUseChat,
    updateThemeSettings,
    loading
  ]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
