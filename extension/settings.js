/* Shared by the isolated content script and the extension popup. */
globalThis.CleanZhihuSettings = Object.freeze({
  key: "cleanZhihu",
  defaults: Object.freeze({
    enabled: true,
    hideSidebar: true,
    hideAiNav: true,
    hideHeaderActions: true,
    hideMascot: true,
    imageLess: false,
    widenContent: true,
    width: 1440
  }),
  normalize(value) {
    const result = { ...this.defaults };
    if (!value || typeof value !== "object") return result;
    for (const key of Object.keys(result)) {
      if (typeof result[key] === "boolean" && typeof value[key] === "boolean") {
        result[key] = value[key];
      }
    }
    if (typeof value.width === "number" && Number.isFinite(value.width)) {
      result.width = value.width === 0 ? 0 : Math.max(960, Math.min(1920, Math.round(value.width)));
    }
    return result;
  }
});
