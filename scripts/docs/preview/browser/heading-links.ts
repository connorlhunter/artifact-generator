export interface HeadingLinkState {
  readonly activeHeadings: HTMLElement[];
  readonly navHeadingLinks: HTMLElement | null;
  readonly navLinks: HTMLAnchorElement[];
}

type HeadingLinkFactory = () => HTMLAnchorElement;

declare global {
  function syncHeadingLinkState(
    links: HTMLElement | null,
    current: HTMLElement | undefined,
  ): HTMLAnchorElement | undefined;

  function buildNavHeadingLinks(
    state: HeadingLinkState,
    article: HTMLElement,
    createHeadingLink?: HeadingLinkFactory,
  ): void;
}

/**
 * Applies one active heading state inside a left or right heading collection.
 */
export function syncHeadingLinkState(
  links: HTMLElement | null,
  current: HTMLElement | undefined,
): HTMLAnchorElement | undefined {
  let activeLink: HTMLAnchorElement | undefined;

  Array.from(links?.querySelectorAll<HTMLAnchorElement>("a") ?? []).forEach((link) => {
    const active = Boolean(current) && link.hash === `#${current?.id}`;
    link.classList.toggle("is-active", active);
    if (active) {
      link.setAttribute("aria-current", "true");
      activeLink = link;
    } else link.removeAttribute("aria-current");
  });

  return activeLink;
}

/**
 * Builds in-document heading links beneath the active document in the left sidebar.
 */
export function buildNavHeadingLinks(
  state: HeadingLinkState,
  article: HTMLElement,
  createHeadingLink: HeadingLinkFactory = () => document.createElement("a"),
): void {
  const links = state.navHeadingLinks;
  if (!links) return;

  links.replaceChildren();
  links.hidden = true;

  const activeDocLink = state.navLinks.find((link) => link.dataset.docId === article.id);
  if (!activeDocLink || state.activeHeadings.length === 0) return;

  activeDocLink.after(links);
  links.setAttribute("aria-label", `Sections in ${article.dataset.docTitle || "current document"}`);

  state.activeHeadings.forEach((heading) => {
    const link = createHeadingLink();
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent || "Section";
    link.className = `nav-heading-link depth-${heading.tagName.toLowerCase()}`;
    link.dataset.navHeadingLink = "";
    links.append(link);
  });

  links.hidden = false;
}
