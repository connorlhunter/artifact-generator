import { docGroupTitle, docLinkLabel, docSectionTitle, type MarkdownDoc } from "../docs-utils.ts";

/**
 * Builds the searchable text attached to one rendered document.
 *
 * @param {MarkdownDoc} doc - Document metadata.
 * @returns {string} Text used by the preview search filter.
 */
export function docSearchText(doc: MarkdownDoc): string {
  return [docLinkLabel(doc), docGroupTitle(doc.project), docSectionTitle(doc), doc.input]
    .join(" ")
    .toLowerCase();
}

/**
 * Builds the compact project/section label shown above one document title.
 *
 * @param {MarkdownDoc} doc - Document metadata.
 * @returns {string} Project and section label.
 */
export function docEyebrow(doc: MarkdownDoc): string {
  const group = docGroupTitle(doc.project);
  const section = docSectionTitle(doc);
  return group === section ? group : `${group} / ${section}`;
}
