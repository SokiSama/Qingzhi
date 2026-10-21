(async () => {
  const results = [];
  const pause = () => new Promise(resolve => setTimeout(resolve, 100));
  const shared = window.CleanZhihuSettings;
  const el = id => document.getElementById(id);
  const check = (condition, name) => {
    results.push(`${condition ? "PASS" : "FAIL"} ${name}`);
    if (!condition) throw new Error(name);
  };
  const stored = async () => (await chrome.storage.local.get(shared.key))[shared.key];
  try {
    await pause();
    check(el("enabled").checked && el("widthLabel").value === "1440 px", "popup default state");
    check(document.title === "轻知" && document.querySelector("h1").textContent === "轻知", "popup name updated");
    check(document.querySelector(".logo").naturalWidth === 128, "supplied profile image loaded");
    await chrome.storage.local.set({ [shared.key]: { ...shared.defaults, imageLess: true } });
    check(el("imageLess").checked, "popup follows fish setting changes");
    el("imageLess").click();
    el("hideMascot").click();
    await pause();
    check((await stored()).imageLess === false && (await stored()).hideMascot === false, "popup media and mascot preferences persist");
    el("hideAiNav").click();
    await pause();
    check((await stored()).hideAiNav === false, "popup checkbox persists");
    el("width").value = "1120";
    el("width").dispatchEvent(new Event("input", { bubbles: true }));
    await pause();
    check((await stored()).width === 1120 && el("widthLabel").value === "1120 px", "popup width persists");
    el("fullWidth").click();
    await pause();
    check((await stored()).width === 0 && el("width").disabled, "popup full-window mode");
    el("enabled").click();
    await pause();
    check((await stored()).enabled === false && el("hideSidebar").disabled, "popup master switch");
    el("reset").click();
    await pause();
    check((await stored()).enabled && (await stored()).width === 1440 && el("hideAiNav").checked, "popup reset restores defaults");
    document.body.dataset.testStatus = "passed";
  } catch (error) {
    document.body.dataset.testStatus = "failed";
    results.push(error.message);
  }
  const output = document.createElement("pre");
  output.id = "results";
  output.textContent = results.join("\n");
  document.body.append(output);
})();
