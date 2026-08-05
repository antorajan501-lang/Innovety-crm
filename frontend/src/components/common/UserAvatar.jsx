import React, { useState, useEffect } from 'react';
import { getUploadUrl } from '../../services/api';

const GOOGLE_PALETTE = [
  '#4285F4', // Google Blue
  '#34A853', // Google Green
  '#EA4335', // Google Red
  '#FBBC05', // Google Yellow
  '#9C27B0', // Purple
  '#FF7043', // Deep Orange
  '#00ACC1', // Cyan
  '#26A69A', // Teal
  '#5C6BC0', // Indigo
  '#EC407A', // Pink
  '#7E57C2', // Deep Purple
  '#EF6C00'  // Dark Orange
];

export const getFirstInitial = (name) => {
  if (!name) return 'U';
  const trimmed = String(name).trim();
  if (!trimmed) return 'U';
  return trimmed.charAt(0).toUpperCase();
};

export const getAvatarColor = (identifier) => {
  if (!identifier) return GOOGLE_PALETTE[0];
  const str = String(identifier).trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GOOGLE_PALETTE.length;
  return GOOGLE_PALETTE[index];
};

export const createInlineSvgAvatar = (name) => {
  const initial = getFirstInitial(name);
  const bg = getAvatarColor(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="${encodeURIComponent(bg)}"/><text x="50%" y="53%" dominant-baseline="central" text-anchor="middle" font-size="45" font-weight="500" fill="%23ffffff" font-family="system-ui, -apple-system, sans-serif">${initial}</text></svg>`;
  return `data:image/svg+xml;utf8,${svg}`;
};

const parsePxSize = (size, className) => {
  if (typeof size === 'number') return size;
  if (typeof size === 'string') {
    const num = parseInt(size, 10);
    if (!isNaN(num)) return num;
    const namedSizes = { xs: 24, sm: 32, md: 40, lg: 48, xl: 64, '2xl': 96 };
    if (namedSizes[size.toLowerCase()]) return namedSizes[size.toLowerCase()];
  }
  if (className) {
    const match = className.match(/(?:^|\s)(?:h|w)-(?:\[(\d+)px\]|(\d+))/);
    if (match) {
      if (match[1]) return parseInt(match[1], 10);
      if (match[2]) {
        const val = parseInt(match[2], 10);
        return val * 4; // Tailwind h-X scale (e.g. h-8 = 32px)
      }
    }
  }
  return 32; // Default size
};

const UserAvatar = ({
  user,
  src,
  name,
  size,
  className = "",
  style = {},
  alt,
  title,
  onClick,
  ...rest
}) => {
  const [imgError, setImgError] = useState(false);

  const actualSrc = user?.profilePic || user?.profilePhoto || user?.avatar || user?.profileImage || user?.profilePicture || user?.displayPic || user?.photo || src;
  const actualName = name || user?.name || user?.username || user?.fullName || user?.email;
  const identifier = user?.id || user?._id || user?.employeeId || user?.email || actualName;

  useEffect(() => {
    setImgError(false);
  }, [actualSrc, actualName]);

  const pxSize = parsePxSize(size, className);
  const fontSize = Math.max(10, Math.round(pxSize * 0.44));

  const hasCustomPic = actualSrc && !imgError;
  const initial = getFirstInitial(actualName);
  const bgColor = getAvatarColor(identifier);

  const formatSrc = (path) => {
    if (!path || typeof path !== 'string') return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('blob:')) {
      return path;
    }
    return getUploadUrl(path);
  };

  const computedTitle = title || actualName || 'User Avatar';

  // Base container class ensuring circular shape, center alignment, and text properties
  const containerClasses = `${className} relative inline-flex items-center justify-center rounded-full shrink-0 overflow-hidden select-none`.trim();

  if (hasCustomPic) {
    const imgUrl = formatSrc(actualSrc);
    return (
      <div
        className={containerClasses}
        style={{
          width: size ? `${pxSize}px` : undefined,
          height: size ? `${pxSize}px` : undefined,
          ...style
        }}
        title={computedTitle}
        onClick={onClick}
        {...rest}
      >
        <img
          src={imgUrl}
          alt={alt || computedTitle}
          className="w-full h-full object-cover rounded-full"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={containerClasses}
      style={{
        width: size ? `${pxSize}px` : undefined,
        height: size ? `${pxSize}px` : undefined,
        backgroundColor: bgColor,
        color: '#FFFFFF',
        fontSize: `${fontSize}px`,
        fontWeight: 500,
        lineHeight: 1,
        ...style
      }}
      title={computedTitle}
      onClick={onClick}
      {...rest}
    >
      <span className="leading-none uppercase font-medium">{initial}</span>
    </div>
  );
};

export default UserAvatar;

