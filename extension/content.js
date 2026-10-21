(() => {
  "use strict";
  const shared = globalThis.CleanZhihuSettings;
  let settings = shared.normalize();
  let headerObserver;
  let scanTimer;
  let sidebarTimer;
  let fishSaveQueue = Promise.resolve();
  const markedSidebars = new Set();
  const mainColumnSelector = ".Topstory-mainColumn";
  const sidebarSelector = ".GlobalSideBar, .GlobalSidebar, [class*='sidebar' i], aside, [role='complementary']";

  function scanSidebars() {
    sidebarTimer = undefined;
    // Recompute instead of permanently hiding a node React might move or reuse.
    for (const sidebar of markedSidebars) sidebar.removeAttribute("data-cz-sidebar");
    markedSidebars.clear();
    for (const container of document.querySelectorAll(".Topstory-container")) {
      const main = container.querySelector(mainColumnSelector);
      if (!main) continue;
      // Inspect only siblings of the feed branch; answer text is never classified.
      for (const candidate of container.children) {
        if (candidate === main || candidate.contains(main)
          || candidate.matches("script, style, link, template")) continue;
        const hasSidebar = candidate.matches(sidebarSelector) || candidate.querySelector(sidebarSelector);
        const hasModules = /创作中心|大家都在搜|盐言作者平台|知乎知学堂|付费咨询/.test(candidate.textContent);
        if (hasSidebar || hasModules) {
          candidate.setAttribute("data-cz-sidebar", "");
          markedSidebars.add(candidate);
        }
      }
    }
  }

  function scheduleSidebarScan() {
    if (sidebarTimer === undefined) sidebarTimer = setTimeout(scanSidebars, 60);
  }

  function apply(value) {
    settings = shared.normalize(value);
    const root = document.documentElement;
    if (!root) return;
    for (const key of ["enabled", "hideSidebar", "hideAiNav", "hideHeaderActions", "hideMascot", "imageLess", "widenContent"]) {
      root.toggleAttribute(`data-cz-${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`, settings[key]);
    }
    root.style.setProperty("--cz-content-width", settings.width === 0 ? "calc(100vw - 32px)" : `${settings.width}px`);
    updateFishButtons();
  }

  function updateFishButtons() {
    const label = settings.imageLess ? "恢复图片" : "开启无图模式";
    for (const button of document.querySelectorAll("[data-cz-fish-toggle]")) {
      for (const [key, value] of Object.entries({ "aria-label": label, "aria-pressed": String(settings.imageLess), title: label })) {
        // Avoid retriggering the header observer when nothing has changed.
        if (button.getAttribute(key) !== value) button.setAttribute(key, value);
      }
    }
  }

  function ensureFishButton(header) {
    if (header.querySelector("[data-cz-fish-toggle]")) return;
    const search = header.querySelector(".SearchBar, form[role='search']");
    const parent = search?.parentElement || header.querySelector(".AppHeader-inner");
    if (!parent) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cz-fish-toggle";
    button.setAttribute("data-cz-fish-toggle", "");
    // Code-native icon stays visible in image-less mode.
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="27" height="22" viewBox="0 0 32 24" aria-hidden="true" fill="none"><path d="M24 12C20 5 12 4 6 12c6 8 14 7 18 0Z" fill="currentColor" opacity=".18"/><path d="M24 12C20 5 12 4 6 12c6 8 14 7 18 0Zm0 0 6-6v12l-6-6ZM12 7l4-4 3 4M12 17l4 4 3-4" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="11" cy="11" r="1.2" fill="currentColor"/></svg>';
    parent.insertBefore(button, search || null);
  }

  function toggleImageMode() {
    const next = !settings.imageLess;
    const previous = settings.imageLess;
    apply({ ...settings, imageLess: next });
    // Merge only this preference with the latest stored settings.
    fishSaveQueue = fishSaveQueue.catch(() => {}).then(async () => {
      const stored = await chrome.storage.local.get(shared.key);
      await chrome.storage.local.set({ [shared.key]: { ...shared.normalize(stored[shared.key]), imageLess: next } });
    }).catch(() => {
      apply({ ...settings, imageLess: previous });
    });
  }

  // Match only header controls. Never search answer text for these words.
  function scanHeader() {
    scanTimer = undefined;
    const headers = document.querySelectorAll(".AppHeader");
    for (const header of headers) {
      ensureFishButton(header);
      // Recompute markers so React can safely reuse an existing element.
      header.querySelectorAll("[data-cz-hide]").forEach(el => el.removeAttribute("data-cz-hide"));
      for (const control of header.querySelectorAll("a, button, [role='button'], [role='tab']")) {
        if (control.hasAttribute("data-cz-fish-toggle")) continue;
        const label = (control.getAttribute("aria-label") || control.getAttribute("title") || control.textContent || "")
          .replace(/\s+/g, "").trim();
        const href = control.getAttribute("href") || "";
        let kind;
        if (/^(AIWorks(?:Beta)?(?:故事)?|故事)$/i.test(label)) kind = "nav";
        else if (/^(?:知乎)?直答$/.test(label) || /^https:\/\/ai\.zhihu\.com(?:[/?#]|$)/.test(href)) kind = "actions";
        else if (/^(?:\+|＋|发布|发布内容|创作|开始创作|新建|提问)$/.test(label)
          || control.querySelector("svg.Zi--Plus, svg.Zi--PlusCircle, svg[class*='PlusIcon'], svg use[href*='plus'], svg use[xlink\\:href*='plus']")) kind = "actions";
        if (!kind) continue;
        const item = control.closest("li");
        const target = item && item.querySelectorAll("a, button, [role='button']").length === 1 ? item : control;
        target.setAttribute("data-cz-hide", kind);
      }
      // Some header versions render the divider before AI Works as a text span.
      for (const divider of header.querySelectorAll(".AppHeader-Tabs span, .AppHeader-Tabs li")) {
        if (/^[|｜]$/.test(divider.textContent.trim())) divider.setAttribute("data-cz-hide", "nav");
      }
    }
    updateFishButtons();
    // Connect directly to the header to avoid rescanning on every feed append.
    headerObserver?.disconnect();
    headerObserver = new MutationObserver(scheduleScan);
    headers.forEach(header => headerObserver.observe(header, {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ["href", "aria-label", "title", "class"]
    }));
  }

  function scheduleScan() {
    if (scanTimer === undefined) scanTimer = setTimeout(scanHeader, 100);
  }

  function start() {
    // Delegation survives a header being cloned or replaced by site navigation.
    document.addEventListener("click", event => {
      const button = event.target.closest?.("[data-cz-fish-toggle]");
      if (button?.closest(".AppHeader") && settings.enabled) {
        event.preventDefault();
        event.stopPropagation();
        toggleImageMode();
      }
    });
    scanHeader();
    scanSidebars();
    // Header may mount late or be replaced during client-side navigation.
    const mounts = new MutationObserver(records => {
      if (records.some(record => [...record.addedNodes].some(node => node.nodeType === 1
        && (node.matches(".AppHeader") || node.querySelector(".AppHeader"))))) scheduleScan();
      if (records.some(record => {
        const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        if (target?.closest(".Topstory-container") && !target.closest(mainColumnSelector)) return true;
        return [...record.addedNodes].some(node => node.nodeType === 1
          && (node.matches(".Topstory-container") || node.querySelector(".Topstory-container")));
      })) scheduleSidebarScan();
    });
    mounts.observe(document.documentElement, { childList: true, characterData: true, subtree: true });
  }

  apply(settings);
  chrome.storage.local.get(shared.key).then(result => apply(result[shared.key])).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[shared.key]) apply(changes[shared.key].newValue);
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
