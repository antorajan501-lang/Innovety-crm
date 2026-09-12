/**
 * Central Branding Helper for Innoveity CRM
 * Controls browser tab title, favicon links, and Chrome password autofill icon.
 */

export const setPlatformBranding = () => {
  try {
    document.title = 'Innoveity';

    // Update or create main favicon tag
    let link = document.querySelector("link[rel='icon']") || document.querySelector("link[rel='shortcut icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/png';
      document.head.appendChild(link);
    }
    link.href = '/v-logo.png';

    // Update apple-touch-icon if present
    const appleTouchIcon = document.querySelector("link[rel='apple-touch-icon']");
    if (appleTouchIcon) {
      appleTouchIcon.href = '/v-logo.png';
    }

    // Clean up any extra icon link tags created dynamically
    const extraIconLinks = document.querySelectorAll("link[rel*='icon']");
    if (extraIconLinks.length > 1) {
      extraIconLinks.forEach((el, index) => {
        if (index > 0) el.remove();
      });
    }
  } catch (err) {
    console.warn('Failed to set platform branding:', err);
  }
};

export const setTenantBranding = (companyName, _logoUrl) => {
  try {
    const titleText = companyName ? `${companyName} | Innoveity` : 'Innoveity';
    document.title = titleText;

    const faviconUrl = '/v-logo.png';

    let link = document.querySelector("link[rel='icon']") || document.querySelector("link[rel='shortcut icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/png';
      document.head.appendChild(link);
    }
    link.href = faviconUrl;

    const appleTouchIcon = document.querySelector("link[rel='apple-touch-icon']");
    if (appleTouchIcon) {
      appleTouchIcon.href = faviconUrl;
    }
  } catch (err) {
    console.warn('Failed to set tenant branding:', err);
  }
};
