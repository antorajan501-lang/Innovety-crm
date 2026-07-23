import React, { useState, useEffect } from 'react';
import { getUploadUrl } from '../../services/api';

const BG_COLORS = [
  '#0F5A46', '#17A673', '#1F3A36', '#2563EB', '#7C3AED', 
  '#DB2777', '#EA580C', '#D97706', '#059669', '#0891B2'
];

const getInitials = (name) => {
  if (!name) return 'U';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const getColorByName = (name) => {
  if (!name) return BG_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % BG_COLORS.length;
  return BG_COLORS[index];
};

export const createInlineSvgAvatar = (name) => {
  const initials = getInitials(name);
  const bgColor = encodeURIComponent(getColorByName(name));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" rx="24" fill="${bgColor}"/><text x="50%" y="54%" dominant-baseline="central" text-anchor="middle" font-size="38" font-weight="800" fill="%23ffffff" font-family="system-ui, -apple-system, sans-serif">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${svg}`;
};

const UserAvatar = ({ src, name, className = "h-8 w-8 rounded-xl object-cover" }) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [src, name]);

  const hasCustomPic = src && !imgError;
  const avatarSrc = hasCustomPic ? getUploadUrl(src) : createInlineSvgAvatar(name);

  return (
    <img
      src={avatarSrc}
      alt={name || 'User Avatar'}
      className={className}
      onError={() => setImgError(true)}
    />
  );
};

export default UserAvatar;
