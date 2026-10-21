// Deliberately outside the distributable extension.
(() => {
  let data = {};
  if (new URLSearchParams(location.search).has("stored-image-less")) {
    data = { cleanZhihu: { imageLess: true, width: 1120 } };
  }
  const listeners = [];
  window.chrome = { storage: {
    local: {
      async get(key) { return { [key]: data[key] }; },
      async set(next) {
        const changes = {};
        for (const [key, value] of Object.entries(next)) {
          changes[key] = { oldValue: data[key], newValue: value };
        }
        data = { ...data, ...next };
        listeners.forEach(listener => listener(changes, "local"));
      }
    },
    onChanged: { addListener(listener) { listeners.push(listener); } }
  } };
})();
