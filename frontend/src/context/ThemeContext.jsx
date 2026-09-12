import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import api, { getSocket } from '../services/api';
import { useAuth } from './AuthContext';

const ThemeContext = createContext();

const parseBoolVal = (value) => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
};

export const ThemeProvider = ({ children }) => {
  const { user } = useAuth();
  const [companyName, setCompanyName] = useState('Innoviety Enterprise');
  const [companyLogo, setCompanyLogo] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState(localStorage.getItem('selectedTheme') || 'emerald');
  const [themeMode, setThemeMode] = useState(localStorage.getItem('themeMode') || 'light');
  
  // Platform & Tenant Chat Settings
  const [platformChatEnabledForAdmins, setPlatformChatEnabledForAdmins] = useState(true);
  const [platformChatEnabledForUsers, setPlatformChatEnabledForUsers] = useState(true);
  const [tenantChatEnabledForAdmins, setTenantChatEnabledForAdmins] = useState(true);
  const [tenantChatEnabledForUsers, setTenantChatEnabledForUsers] = useState(true);
  const [loading, setLoading] = useState(true);
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

  const fetchPlatformSettings = useCallback(async () => {
    try {
      const userRole = user?.role;
      const savedCompanyId = localStorage.getItem('mrf_selected_company_id');
      const userOrgId = userRole === 'SUPER_ADMIN'
        ? (savedCompanyId && savedCompanyId !== 'all' ? savedCompanyId : null)
        : (user?.organizationId || user?.organization?.id);

      const params = userOrgId ? { organizationId: userOrgId } : {};
      const res = await api.get('/platform/settings', { params });

      console.log('[DEBUG Trace Step 2 - GET /api/platform/settings Response]', res.data);

      if (res.data) {
        if (res.data.companyName) setCompanyName(res.data.companyName);
        if (res.data.companyLogo !== undefined) setCompanyLogo(res.data.companyLogo);
        if (res.data.selectedTheme) {
          setSelectedTheme(res.data.selectedTheme);
          localStorage.setItem('selectedTheme', res.data.selectedTheme);
        }
        if (res.data.themeMode) {
          setThemeMode(res.data.themeMode);
          localStorage.setItem('themeMode', res.data.themeMode);
        }

        // Platform level settings
        if (res.data.platform) {
          const pAdmin = parseBoolVal(res.data.platform.chatEnabledForAdmins);
          if (pAdmin !== undefined) setPlatformChatEnabledForAdmins(pAdmin);
          const pUser = parseBoolVal(res.data.platform.chatEnabledForUsers);
          if (pUser !== undefined) setPlatformChatEnabledForUsers(pUser);
        } else {
          const pAdmin = parseBoolVal(res.data.chatEnabledForAdmins);
          if (pAdmin !== undefined) setPlatformChatEnabledForAdmins(pAdmin);
          const pUser = parseBoolVal(res.data.chatEnabledForUsers);
          if (pUser !== undefined) setPlatformChatEnabledForUsers(pUser);
        }

        // Tenant (Organization) level settings
        if (res.data.organization) {
          const tAdmin = parseBoolVal(res.data.organization.chatEnabledForAdmins);
          if (tAdmin !== undefined) setTenantChatEnabledForAdmins(tAdmin);
          const tUser = parseBoolVal(res.data.organization.chatEnabledForUsers);
          if (tUser !== undefined) setTenantChatEnabledForUsers(tUser);
        } else {
          const tAdmin = parseBoolVal(res.data.chatEnabledForAdmins);
          if (tAdmin !== undefined) setTenantChatEnabledForAdmins(tAdmin);
          const tUser = parseBoolVal(res.data.chatEnabledForUsers);
          if (tUser !== undefined) setTenantChatEnabledForUsers(tUser);
        }

        applyThemeToDOM(res.data.selectedTheme || selectedTheme, res.data.themeMode || themeMode);
      }
    } catch (err) {
      console.warn('Failed to load platform settings on boot:', err);
    } finally {
      setLoading(false);
      setPermissionsLoaded(true);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setCompanyName('Innoviety Enterprise');
      setCompanyLogo(null);
    }
  }, [user]);

  useEffect(() => {
    fetchPlatformSettings();
  }, [fetchPlatformSettings]);

  // Real-time socket listener for chat_settings_updated
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    if (!socket) return;

    const handleChatSettingsUpdated = () => {
      fetchPlatformSettings();
    };

    socket.on('chat_settings_updated', handleChatSettingsUpdated);
    return () => {
      socket.off('chat_settings_updated', handleChatSettingsUpdated);
    };
  }, [user, fetchPlatformSettings]);

  const updateThemeSettings = (newSettings) => {
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
      localStorage.setItem('selectedTheme', updatedTheme);
    }
    if (newSettings.themeMode !== undefined) {
      updatedMode = newSettings.themeMode;
      setThemeMode(updatedMode);
      localStorage.setItem('themeMode', updatedMode);
    }

    applyThemeToDOM(updatedTheme, updatedMode);
  };

  /**
   * Final Permission Hierarchy:
   * SUPER_ADMIN -> true (Always allowed)
   * ADMIN -> platformChatEnabledForAdmins AND tenantChatEnabledForAdmins
   * TEAM_LEADER / EMPLOYEE / INTERN -> platformChatEnabledForUsers AND tenantChatEnabledForUsers
   */
  const canUseChat = useMemo(() => {
    if (!user) return false;
    const roleUpper = String(user.role || '').toUpperCase();
    if (roleUpper === 'SUPER_ADMIN') return true;

    const pAdmin = platformChatEnabledForAdmins !== false;
    const pUser = platformChatEnabledForUsers !== false;
    const tAdmin = tenantChatEnabledForAdmins !== false;
    const tUser = tenantChatEnabledForUsers !== false;

    let computed = false;
    if (roleUpper === 'ADMIN') {
      computed = pAdmin && tAdmin;
    } else {
      computed = pUser && tUser;
    }

    console.log('[DEBUG Trace Step 3 - ThemeContext State]', {
      role: roleUpper,
      platformChatEnabledForAdmins,
      platformChatEnabledForUsers,
      tenantChatEnabledForAdmins,
      tenantChatEnabledForUsers,
      canUseChat: computed,
      permissionsLoaded
    });

    return computed;
  }, [user, platformChatEnabledForAdmins, platformChatEnabledForUsers, tenantChatEnabledForAdmins, tenantChatEnabledForUsers, permissionsLoaded]);

  return (
    <ThemeContext.Provider
      value={{
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
        setPlatformChatEnabledForAdmins,
        setPlatformChatEnabledForUsers,
        setTenantChatEnabledForAdmins,
        setTenantChatEnabledForUsers,
        refreshPlatformSettings: fetchPlatformSettings,
        canUseChat,
        updateThemeSettings,
        loading
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
