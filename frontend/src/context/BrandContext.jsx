import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import api, { getUploadUrl } from '../services/api';
import { setPlatformBranding, setTenantBranding } from '../utils/branding';

const BrandContext = createContext(null);

export const BrandProvider = ({ children }) => {
  const { user } = useAuth();

  const defaultBranding = {
    companyName: 'INNOVEITY',
    primaryColor: '#10B981',
    logo: null,
    companyCode: 'INN001',
    slug: 'innoveity',
    timezone: 'Asia/Kolkata'
  };

  const [branding, setBranding] = useState(defaultBranding);
  const [loadingBranding, setLoadingBranding] = useState(false);

  // Sync branding with logged in user's organization
  useEffect(() => {
    if (user && user.role !== 'SUPER_ADMIN' && user.organizationId) {
      setLoadingBranding(true);
      api.get(`/organizations/${user.organizationId}/settings`)
        .then((res) => {
          if (res.data) {
            setBranding({
              companyName: res.data.companyName || user.organization?.name || 'INNOVEITY',
              primaryColor: res.data.primaryColor || '#10B981',
              logo: res.data.logo ? getUploadUrl(res.data.logo) : (user.organization?.logo ? getUploadUrl(user.organization.logo) : null),
              companyCode: user.organization?.companyCode || 'INN001',
              slug: user.organization?.slug || 'innoveity',
              timezone: res.data.timezone || user.organization?.timezone || 'Asia/Kolkata'
            });
          }
        })
        .catch((err) => {
          console.warn('Failed to load user organization branding:', err);
        })
        .finally(() => setLoadingBranding(false));
    } else {
      setBranding(defaultBranding);
      setPlatformBranding();
    }
  }, [user?.id, user?.organizationId]);

  // Update dynamic browser favicon & tab title
  useEffect(() => {
    if (user && user.role !== 'SUPER_ADMIN' && user.organizationId) {
      setTenantBranding(branding.companyName);
    } else {
      setPlatformBranding();
    }
  }, [user?.id, user?.organizationId, branding?.companyName]);

  const updatePublicBranding = (publicData) => {
    if (!publicData) return;
    setBranding({
      companyName: publicData.name || 'INNOVEITY',
      primaryColor: publicData.primaryColor || '#10B981',
      logo: publicData.logo ? getUploadUrl(publicData.logo) : null,
      companyCode: publicData.companyCode || 'INN001',
      slug: publicData.slug || 'innoveity',
      timezone: publicData.timezone || 'Asia/Kolkata'
    });
  };

  const resetBranding = () => {
    setBranding(defaultBranding);
    setPlatformBranding();
  };

  return (
    <BrandContext.Provider
      value={{
        branding,
        loadingBranding,
        updatePublicBranding,
        resetBranding,
        isCompanyBranded: Boolean(user?.organizationId && user?.role !== 'SUPER_ADMIN')
      }}
    >
      {children}
    </BrandContext.Provider>
  );
};

export const useOrganizationBranding = () => {
  const context = useContext(BrandContext);
  if (!context) {
    throw new Error('useOrganizationBranding must be used within a BrandProvider');
  }
  return context;
};

export default BrandContext;
