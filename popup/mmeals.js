const ACCESS_TOKEN_COOKIE_NAME = "mmeals_firefox_access_token";
const REFRESH_TOKEN_COOKIE_NAME = "mmeals_firefox_refresh_token";
const COOKIE_ACCESS_TOKEN_EXPIRE_SEC = 600;
const COOKIE_REFRESH_TOKEN_EXPIRE_SEC = 2629746;

/***
 * Load data
 */
const loadData = async (accessToken) => {
  // Set current URL as the input value
  browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    document.querySelector("input#url").value = tabs[0].url;
  });

  const categoriesRes = await fetch(
    "https://api.managemeals.com/v1/categories",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  const categories = await categoriesRes.json();
  const categoriesEl = document.querySelector("#categories-list");
  categoriesEl.innerHTML = categories
    .map((c) => `<button class="sm" data-uuid="${c.uuid}">${c.name}</button>`)
    .join("");

  const tagsRes = await fetch("https://api.managemeals.com/v1/tags", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const tags = await tagsRes.json();
  const tagsEl = document.querySelector("#tags-list");
  tagsEl.innerHTML = tags
    .map((t) => `<button class="sm" data-uuid="${t.uuid}">${t.name}</button>`)
    .join("");
};

/***
 * Clicks on data elements
 */
const dataClicks = async (accessToken) => {
  let selectedCategories = [];
  let selectedTags = [];

  document.querySelectorAll("#categories-list button").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();

      const uuid = e.target.getAttribute("data-uuid");
      if (e.target.classList.contains("selected")) {
        e.target.classList.remove("selected");
        selectedCategories = selectedCategories.filter((c) => c !== uuid);
      } else {
        e.target.classList.add("selected");
        selectedCategories.push(uuid);
      }
    });
  });

  document.querySelectorAll("#tags-list button").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();

      const uuid = e.target.getAttribute("data-uuid");
      if (e.target.classList.contains("selected")) {
        e.target.classList.remove("selected");
        selectedTags = selectedTags.filter((c) => c !== uuid);
      } else {
        e.target.classList.add("selected");
        selectedTags.push(uuid);
      }
    });
  });

  document.querySelector("#add-button").addEventListener("click", async (e) => {
    e.preventDefault();

    const url = document.querySelector("input#url").value;

    const res = await fetch(
      `https://api.managemeals.com/v1/recipes/import?url=${encodeURIComponent(
        url
      )}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          categoryUuids: selectedCategories,
          tagUuids: selectedTags,
        }),
      }
    );

    console.log(res);
  });
};

/***
 * Clicks on login screen
 */
const loginClicks = () => {
  document
    .querySelector("#login-button")
    .addEventListener("click", async (e) => {
      e.preventDefault();

      try {
        document.querySelector("#login-error").classList.add("hidden");
        const formData = Object.fromEntries(
          new FormData(document.querySelector("#login-form")).entries()
        );
        const res = await fetch("https://api.managemeals.com/v1/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          const now = new Date();
          const epoch = Math.floor(now.getTime() / 1000);
          const resJson = await res.json();
          browser.cookies.set({
            value: resJson.accessToken,
            expirationDate: epoch + COOKIE_ACCESS_TOKEN_EXPIRE_SEC,
            name: ACCESS_TOKEN_COOKIE_NAME,
            url: "https://api.managemeals.com/",
          });
          browser.cookies.set({
            value: resJson.refreshToken,
            expirationDate: epoch + COOKIE_REFRESH_TOKEN_EXPIRE_SEC,
            name: REFRESH_TOKEN_COOKIE_NAME,
            url: "https://api.managemeals.com/",
          });
          document.querySelector("#login-content").classList.add("hidden");
          document.querySelector("#import-content").classList.remove("hidden");
          await loadData(resJson.accessToken);
          await dataClicks(resJson.accessToken);
        } else {
          document.querySelector("#login-error").classList.remove("hidden");
        }
      } catch (e) {
        document.querySelector("#login-error").classList.remove("hidden");
      }
    });
};

/***
 * Init
 */
const init = async () => {
  const now = new Date();
  const epoch = Math.floor(now.getTime() / 1000);

  const accessTokenCookie =
    (await browser.cookies.get({
      name: ACCESS_TOKEN_COOKIE_NAME,
      url: "https://api.managemeals.com/",
    })) || {};
  let accessToken = accessTokenCookie.value;
  if (epoch >= accessTokenCookie.expirationDate || 0) {
    accessToken = "";
  }

  const refreshTokenCookie =
    (await browser.cookies.get({
      name: REFRESH_TOKEN_COOKIE_NAME,
      url: "https://api.managemeals.com/",
    })) || {};
  let refreshToken = refreshTokenCookie.value;
  if (epoch >= refreshTokenCookie.expirationDate || 0) {
    refreshToken = "";
  }

  // If the access token has expired, but not the refresh token, then refresh
  // the tokens
  if (!accessToken && refreshToken) {
    try {
      const res = await fetch(
        "https://api.managemeals.com/v1/auth/refresh-token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: refreshToken,
          }),
        }
      );
      if (!res.ok) {
        throw new Error("Error refreshing token");
      }
      const epoch = Math.floor(new Date().getTime() / 1000);
      const resJson = await res.json();
      accessToken = resJson.accessToken;
      refreshToken = resJson.refreshToken;
      browser.cookies.set({
        value: resJson.accessToken,
        expirationDate: epoch + COOKIE_ACCESS_TOKEN_EXPIRE_SEC,
        name: ACCESS_TOKEN_COOKIE_NAME,
        url: "https://api.managemeals.com/",
      });
      browser.cookies.set({
        value: resJson.refreshToken,
        expirationDate: epoch + COOKIE_REFRESH_TOKEN_EXPIRE_SEC,
        name: REFRESH_TOKEN_COOKIE_NAME,
        url: "https://api.managemeals.com/",
      });
    } catch (e) {
      console.error(e);
      document.querySelector("#login-error").classList.remove("hidden");
    }
  }

  if (accessToken && refreshToken) {
    document.querySelector("#login-content").classList.add("hidden");
    document.querySelector("#import-content").classList.remove("hidden");

    await loadData(accessToken);
    await dataClicks(accessToken);
  } else {
    loginClicks();
  }
};

init();
