/** Rich text with no words in it -- an emptied editor keeps "<p><br></p>" --
 * is sent as "", which the API stores as nothing.
 *
 * Shared by every editor that writes rich text: the Country editor first, and
 * now the level-page editor, whose intro and notes are hidden on the site
 * when they are empty. */
export const richTextOrEmpty = (value: string) =>
  value.replace(/<[^>]*>|&nbsp;/gi, "").trim() ? value.trim() : "";
