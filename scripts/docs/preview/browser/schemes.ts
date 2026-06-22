type PreviewSchemeId =
  | "atlas"
  | "paper"
  | "citrine"
  | "harbor"
  | "midnight"
  | "onyx"
  | "rose"
  | "tide"
  | "ember"
  | "quartz";

interface PreviewScheme {
  id: PreviewSchemeId;
  label: string;
}

interface ProjectIconTheme {
  panel: string;
  primary: string;
  secondary: string;
}

const defaultPreviewScheme: PreviewScheme = {
  id: "atlas",
  label: "Atlas",
};
const previewSchemes: PreviewScheme[] = [
  defaultPreviewScheme,
  { id: "paper", label: "Paper" },
  { id: "citrine", label: "Citrine" },
  { id: "harbor", label: "Harbor" },
  { id: "midnight", label: "Midnight" },
  { id: "onyx", label: "Onyx" },
  { id: "rose", label: "Rose" },
  { id: "tide", label: "Tide" },
  { id: "ember", label: "Ember" },
  { id: "quartz", label: "Quartz" },
];
const schemeStorageKey = "connorhunter.theme.scheme";
const legacySchemeStorageKeys = ["docs.preview.scheme", "portfolio.theme.scheme"];
const schemeCookieName = schemeStorageKey;
const schemeMessageType = "connorhunter.theme.scheme";
const sharedSchemeRootDomain = "connorhunter.me";
const schemeCookieMaxAgeSeconds = 31_536_000;
const standardPreferenceScheme = findPreviewScheme("atlas") ?? defaultPreviewScheme;
const dimPreferenceScheme = findPreviewScheme("harbor") ?? defaultPreviewScheme;
const projectIconSvgCache = new Map<string, Promise<string | null>>();
const themedProjectIconCache = new Map<string, string>();

/**
 * Returns a configured preview color scheme.
 */
function findPreviewScheme(value: string | null): PreviewScheme | null {
  return previewSchemes.find((scheme) => scheme.id === value) ?? null;
}

/**
 * Returns the scheme currently applied to the document element.
 */
function activePreviewScheme(): PreviewScheme {
  return findPreviewScheme(document.documentElement.dataset.scheme ?? null) ?? defaultPreviewScheme;
}

/**
 * Returns the saved preview color scheme when localStorage is available.
 */
function savedScheme(): PreviewScheme | null {
  try {
    const canonicalScheme = findPreviewScheme(window.localStorage.getItem(schemeStorageKey));
    if (canonicalScheme) return canonicalScheme;
  } catch {
    // File previews may run in privacy modes where localStorage is blocked.
  }

  const cookieScheme = findPreviewScheme(cookieValue(schemeCookieName));
  if (cookieScheme) return cookieScheme;

  for (const key of legacySchemeStorageKeys) {
    try {
      const legacyScheme = findPreviewScheme(window.localStorage.getItem(key));
      if (legacyScheme) return legacyScheme;
    } catch {
      // Keep trying the remaining migration paths.
    }
  }

  return null;
}

/**
 * Returns one decoded cookie value when available.
 */
function cookieValue(name: string): string | null {
  try {
    const prefix = `${name}=`;
    const cookie = document.cookie
      .split("; ")
      .find((item) => item.startsWith(prefix))
      ?.slice(prefix.length);

    return cookie ? decodeURIComponent(cookie) : null;
  } catch {
    return null;
  }
}

/**
 * Returns the shared root-domain cookie scope for product hosts.
 */
function sharedSchemeCookieDomain(hostname = window.location.hostname): string | null {
  const normalizedHostname = hostname.toLowerCase();

  if (
    normalizedHostname === sharedSchemeRootDomain ||
    normalizedHostname.endsWith(`.${sharedSchemeRootDomain}`)
  ) {
    return `.${sharedSchemeRootDomain}`;
  }

  return null;
}

/**
 * Saves the selected preview color scheme when localStorage is available.
 */
function saveScheme(scheme: PreviewScheme): void {
  try {
    window.localStorage.setItem(schemeStorageKey, scheme.id);

    for (const key of legacySchemeStorageKeys) {
      window.localStorage.setItem(key, scheme.id);
    }
  } catch {
    // File previews may run in privacy modes where localStorage is blocked.
  }

  try {
    const attributes = [
      `${schemeCookieName}=${encodeURIComponent(scheme.id)}`,
      "Path=/",
      `Max-Age=${schemeCookieMaxAgeSeconds}`,
      "SameSite=Lax",
    ];
    const domain = sharedSchemeCookieDomain();

    if (domain) attributes.push(`Domain=${domain}`);
    if (window.location.protocol === "https:") attributes.push("Secure");

    document.cookie = attributes.join("; ");
  } catch {
    // File previews may run in privacy modes where cookies are blocked.
  }
}

/**
 * Returns a valid scheme from a cross-frame theme message.
 */
function messageScheme(value: unknown): PreviewScheme | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const message = value as { readonly scheme?: unknown; readonly type?: unknown };

  return message.type === schemeMessageType && typeof message.scheme === "string"
    ? findPreviewScheme(message.scheme)
    : null;
}

/**
 * Sends the selected scheme to the embedding portfolio shell.
 */
function broadcastScheme(scheme: PreviewScheme): void {
  if (window.parent === window) {
    return;
  }

  try {
    window.parent.postMessage({ scheme: scheme.id, type: schemeMessageType }, "*");
  } catch {
    // Standalone previews still persist locally when cross-frame messaging is blocked.
  }
}

/**
 * Returns a valid scheme from a same-origin storage event.
 */
function storageEventScheme(event: StorageEvent): PreviewScheme | null {
  const watchedKeys = new Set<string>([schemeStorageKey, ...legacySchemeStorageKeys]);

  return event.key && watchedKeys.has(event.key) ? findPreviewScheme(event.newValue) : null;
}

/**
 * Returns the initial scheme from the user's OS color preference.
 */
function preferredScheme(): PreviewScheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? dimPreferenceScheme
    : standardPreferenceScheme;
}

/**
 * Returns the next color scheme in the configured cycle.
 */
function nextScheme(currentScheme: PreviewScheme): PreviewScheme {
  const index = previewSchemes.findIndex((scheme) => scheme.id === currentScheme.id);
  return previewSchemes[(index + 1) % previewSchemes.length] ?? defaultPreviewScheme;
}

/**
 * Returns the configured project icon href.
 */
function projectIconHref(element: HTMLElement): string | undefined {
  return element.dataset.iconStandard;
}

/**
 * Returns one active scheme token for derived project SVG icons.
 */
function schemeToken(styles: CSSStyleDeclaration, token: string, fallback: string): string {
  return styles.getPropertyValue(token).trim() || fallback;
}

/**
 * Returns the current theme colors used to tint copied project SVGs.
 */
function projectIconTheme(): ProjectIconTheme {
  const styles = window.getComputedStyle(document.documentElement);

  return {
    panel: schemeToken(styles, "--panel", "#ffffff"),
    primary: schemeToken(styles, "--accent", "#0f6b7a"),
    secondary: schemeToken(styles, "--warm", "#8a5a00"),
  };
}

/**
 * Loads one copied project SVG so the preview can derive a theme-tinted data URL.
 */
async function loadProjectIconSvg(href: string): Promise<string | null> {
  let cached = projectIconSvgCache.get(href);
  if (!cached) {
    cached = fetch(href)
      .then(
        (response): Promise<string | null> =>
          response.ok ? response.text() : Promise.resolve(null),
      )
      .catch((): null => null);
    projectIconSvgCache.set(href, cached);
  }

  return cached;
}

/**
 * Replaces the project icon palette with active preview scheme tokens.
 */
function tintProjectIconSvg(svg: string, theme: ProjectIconTheme): string {
  return svg
    .replace(/#0f6b7a/gi, theme.primary)
    .replace(/#f4fbfc/gi, theme.primary)
    .replace(/#eaf6ff/gi, theme.primary)
    .replace(/#35b8cd/gi, theme.secondary)
    .replace(/#5fc0ee/gi, theme.secondary)
    .replace(/#f8fbfc/gi, theme.panel)
    .replace(/#0b1a24/gi, theme.panel);
}

/**
 * Returns a data URL for a project icon tinted to the active scheme.
 */
async function themedProjectIconHref(href: string): Promise<string> {
  const theme = projectIconTheme();
  const cacheKey = `${href}|${theme.primary}|${theme.secondary}|${theme.panel}`;
  const cached = themedProjectIconCache.get(cacheKey);
  if (cached) return cached;

  const svg = await loadProjectIconSvg(href);
  if (!svg) return href;

  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(tintProjectIconSvg(svg, theme))}`;
  themedProjectIconCache.set(cacheKey, dataUrl);
  return dataUrl;
}

/**
 * Applies one active scheme-tinted project icon to an image element.
 */
async function applyThemedProjectIcon(
  icon: HTMLImageElement,
  scheme: PreviewScheme,
): Promise<void> {
  const href = projectIconHref(icon);
  if (!href) return;

  icon.setAttribute("src", href);
  const themedHref = await themedProjectIconHref(href);
  if (activePreviewScheme().id === scheme.id) icon.setAttribute("src", themedHref);
}

/**
 * Applies theme-tinted project icons to image and tab icons.
 */
function applyProjectIcons(state: PreviewState, scheme: PreviewScheme): void {
  for (const icon of state.projectIcons) {
    void applyThemedProjectIcon(icon, scheme);
  }

  applyProjectFavicon(state, scheme);
}

/**
 * Applies the active document's project icon to the browser tab.
 */
function applyProjectFavicon(state: PreviewState, scheme: PreviewScheme): void {
  if (!state.projectFavicon) return;

  const activeArticle = state.articleById.get(state.activeArticleId);
  const faviconHref =
    (activeArticle ? projectIconHref(activeArticle) : undefined) ??
    projectIconHref(state.projectFavicon);
  if (!faviconHref) return;

  state.projectFavicon.setAttribute("href", faviconHref);
  void themedProjectIconHref(faviconHref).then((themedHref) => {
    const activeArticle = state.articleById.get(state.activeArticleId);
    const fallbackFaviconHref = state.projectFavicon
      ? projectIconHref(state.projectFavicon)
      : undefined;
    const activeFaviconHref =
      (activeArticle ? projectIconHref(activeArticle) : undefined) ?? fallbackFaviconHref;

    if (activePreviewScheme().id === scheme.id && activeFaviconHref === faviconHref) {
      state.projectFavicon?.setAttribute("href", themedHref);
    }
  });
}

/**
 * Re-syncs the browser tab icon after active-document changes.
 */
function syncProjectFavicon(state: PreviewState): void {
  applyProjectFavicon(state, activePreviewScheme());
}

/**
 * Applies the selected color scheme to the document and toggle control.
 */
function applyScheme(state: PreviewState, scheme: PreviewScheme): void {
  document.documentElement.dataset.scheme = scheme.id;
  applyProjectIcons(state, scheme);
  if (!state.schemeToggle) return;

  const next = nextScheme(scheme);
  state.schemeToggle.setAttribute("aria-label", `Use ${next.label} color scheme`);
  state.schemeToggle.title = `Use ${next.label} color scheme`;
}

/**
 * Wires the color scheme cycle in the docs preview header.
 */
function wireSchemeToggle(state: PreviewState): void {
  let currentScheme = savedScheme() ?? preferredScheme();

  function syncScheme(
    scheme: PreviewScheme,
    options: { readonly broadcast: boolean; readonly save: boolean },
  ): void {
    currentScheme = scheme;
    applyScheme(state, scheme);
    if (options.save) saveScheme(scheme);
    if (options.broadcast) broadcastScheme(scheme);
  }

  syncScheme(currentScheme, { broadcast: false, save: false });

  state.schemeToggle?.addEventListener(
    "click",
    () => {
      syncScheme(nextScheme(currentScheme), { broadcast: true, save: true });
    },
    { signal: state.signal },
  );

  window.addEventListener(
    "message",
    (event) => {
      const scheme = messageScheme(event.data);
      if (scheme && scheme.id !== currentScheme.id) {
        syncScheme(scheme, { broadcast: false, save: true });
      }
    },
    { signal: state.signal },
  );

  window.addEventListener(
    "storage",
    (event) => {
      const scheme = storageEventScheme(event);
      if (scheme && scheme.id !== currentScheme.id) {
        syncScheme(scheme, { broadcast: false, save: false });
      }
    },
    { signal: state.signal },
  );
}
