export class ContentConflict extends Error {
  constructor() { super("This draft changed in another tab. Reload the catalog before saving or publishing again."); }
}
