/**
 * Central Branding Helper for Innoveity CRM
 * Controls browser tab title, favicon links, and Chrome password autofill icon.
 */

export const setPlatformBranding = () => {
  try {
    if (document.title !== 'Innoveity') {
      document.title = 'Innoveity';
    }

    // Update or create main favicon tag without redundant DOM changes
    let link = document.querySelector("link[rel='icon']") || document.querySelector("link[rel='shortcut icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/png';
      link.href = '/v-logo.png';
      document.head.appendChild(link);
    } else if (!link.href.endsWith('/v-logo.png')) {
      link.href = '/v-logo.png';
    }

    // Update apple-touch-icon if present and not already matching
    const appleTouchIcon = document.querySelector("link[rel='apple-touch-icon']");
    if (appleTouchIcon && !appleTouchIcon.href.endsWith('/v-logo.png')) {
      appleTouchIcon.href = '/v-logo.png';
    }

    // Clean up any extra icon link tags created dynamically
    const extraIconLinks = document.querySelectorAll("link[rel*='icon']");
    if (extraIconLinks.length > 2) {
      extraIconLinks.forEach((el, index) => {
        if (index > 1) el.remove();
      });
    }
  } catch (err) {
    console.warn('Failed to set platform branding:', err);
  }
};

export const setTenantBranding = (companyName, _logoUrl) => {
  try {
    const titleText = companyName ? `${companyName} | Innoveity` : 'Innoveity';
    if (document.title !== titleText) {
      document.title = titleText;
    }

    const faviconUrl = '/v-logo.png';

    let link = document.querySelector("link[rel='icon']") || document.querySelector("link[rel='shortcut icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/png';
      link.href = faviconUrl;
      document.head.appendChild(link);
    } else if (!link.href.endsWith(faviconUrl)) {
      link.href = faviconUrl;
    }

    const appleTouchIcon = document.querySelector("link[rel='apple-touch-icon']");
    if (appleTouchIcon && !appleTouchIcon.href.endsWith(faviconUrl)) {
      appleTouchIcon.href = faviconUrl;
    }
  } catch (err) {
    console.warn('Failed to set tenant branding:', err);
  }
};
