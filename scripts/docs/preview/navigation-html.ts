import {
  docGroupTitle,
  docLinkLabel,
  orderedDocGroups,
  orderedDocSections,
  projectIconAsset,
  type MarkdownDoc,
  type ProjectIconPreviewAsset,
} from "../docs-utils.ts";
import { escapeHtml } from "./html-escape.ts";
import { docSearchText } from "./labels.ts";

/**
 * Renders sidebar navigation grouped by project/root.
 *
 * @param {MarkdownDoc[]} docs - Documents included in the preview.
 * @returns {string} Sidebar HTML.
 */
export function renderNavigation(docs: MarkdownDoc[]): string {
  return orderedDocGroups(docs)
    .map(([project, projectDocs]): string => {
      const icon = projectIconAsset(project);

      return `
      <section class="nav-group" data-nav-group>
        <h2${icon ? ' class="has-project-icon"' : ""}>${navGroupIconHtml(icon)}<span>${escapeHtml(docGroupTitle(project))}</span></h2>
        ${orderedDocSections(projectDocs)
          .map(
            (section): string => `
          <section class="nav-section" data-nav-section>
            <h3>${escapeHtml(section.title)}</h3>
            ${section.docs
              .map(
                (doc): string => `
              <a
                href="#${doc.id}"
                data-doc-link
                data-doc-id="${doc.id}"
                data-doc-search="${escapeHtml(docSearchText(doc))}"
              >
                <span data-doc-link-label>${escapeHtml(docLinkLabel(doc))}</span>
                <span class="nav-search-context" data-doc-search-context hidden></span>
              </a>
            `,
              )
              .join("")}
          </section>
        `,
          )
          .join("")}
      </section>
    `;
    })
    .join("");
}

function navGroupIconHtml(icon: ProjectIconPreviewAsset | null): string {
  if (!icon) return "";

  return `<img class="project-icon nav-project-icon" src="${escapeHtml(icon.href)}" data-project-icon data-icon-standard="${escapeHtml(icon.href)}" alt="" aria-hidden="true">`;
}
