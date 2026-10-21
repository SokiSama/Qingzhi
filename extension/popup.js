(() => {
  "use strict";
  const shared = globalThis.CleanZhihuSettings;
  let settings = shared.normalize();
  let saveQueue = Promise.resolve();
  const ids = ["enabled", "hideSidebar", "hideAiNav", "hideHeaderActions", "hideMascot", "imageLess", "widenContent"];
  const element = id => document.getElementById(id);

  function render() {
    ids.forEach(id => { element(id).checked = settings[id]; });
    element("fullWidth").checked = settings.width === 0;
    element("width").value = settings.width || 1440;
    element("widthLabel").value = settings.width === 0 ? "随窗口铺满" : `${settings.width} px`;
    ids.filter(id => id !== "enabled").forEach(id => { element(id).disabled = !settings.enabled; });
    element("fullWidth").disabled = !settings.enabled || !settings.widenContent;
    element("width").disabled = !settings.enabled || !settings.widenContent || settings.width === 0;
  }

  function save() {
    render();
    const snapshot = { ...settings };
    saveQueue = saveQueue.catch(() => {}).then(() => chrome.storage.local.set({ [shared.key]: snapshot }));
    saveQueue.then(() => { element("status").textContent = "已保存 · 已打开的知乎页面自动生效"; })
      .catch(() => { element("status").textContent = "保存失败，请重新打开扩展重试"; });
  }

  // Attach controls after storage has loaded to avoid overwriting saved settings.
  async function init() {
    try {
      const stored = await chrome.storage.local.get(shared.key);
      settings = shared.normalize(stored[shared.key]);
    } catch {
      element("status").textContent = "读取失败，当前显示默认设置";
    }
    render();
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[shared.key]) {
        settings = shared.normalize(changes[shared.key].newValue);
        render();
      }
    });
    ids.forEach(id => element(id).addEventListener("change", () => {
      settings[id] = element(id).checked;
      save();
    }));
    element("width").addEventListener("input", () => {
      settings.width = Number(element("width").value);
      save();
    });
    element("fullWidth").addEventListener("change", () => {
      settings.width = element("fullWidth").checked ? 0 : Number(element("width").value);
      save();
    });
    element("reset").addEventListener("click", () => {
      settings = shared.normalize();
      save();
    });
  }
  init();
})();
