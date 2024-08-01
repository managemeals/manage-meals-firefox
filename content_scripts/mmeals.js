(() => {
  if (window.hasRun) {
    return;
  }
  window.hasRun = true;

  browser.runtime.onMessage.addListener(async (message) => {
    if (message.action === "login") {
      try {
        browser.runtime.sendMessage({ action: "loginSuccess" });
        const res = await fetch("https://api.managemeals.com/v1/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(message.formData),
        });
        if (res.ok) {
          console.log(await res.json());
        } else {
          browser.runtime.sendMessage({ action: "loginError" });
        }
      } catch (e) {
        browser.runtime.sendMessage({ action: "loginError" });
      }
    }

    if (message.action === "import") {
    }
  });
})();
