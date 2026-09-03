/**
 * The page: language switching, the Decision Check result, sharing.
 * Copy lives in ./domain/strings.js so build scripts can read the same words.
 */

import { copiedByLang, optionLabels, strings } from './domain/strings.js?v=27';

let currentLang = "en";

function getNestedValue(source, path) {
  return path.split(".").reduce((value, key) => value && value[key], source);
}

function getInitialLang() {
  const urlLang = new URLSearchParams(window.location.search).get("lang");
  if (urlLang === "ru" || urlLang === "en") {
    return urlLang;
  }

  const savedLang = window.localStorage.getItem("dst-lang");
  if (savedLang === "ru" || savedLang === "en") {
    return savedLang;
  }

  return navigator.language.toLowerCase().startsWith("ru") ? "ru" : "en";
}

function optionLabel(group, value, lang = currentLang) {
  const key = optionLabels[group] && optionLabels[group][value];
  return key ? getNestedValue(strings[lang], key) : value;
}

function setSwitchLink(lang) {
  const switcher = document.querySelector("[data-lang-switch]");
  if (!switcher) {
    return;
  }

  const nextLang = lang === "ru" ? "en" : "ru";
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("lang", nextLang);
  switcher.textContent = strings[lang].switchTo;
  switcher.href = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  switcher.dataset.nextLang = nextLang;
}

function renderCopy(element, value) {
  if (!value.includes("[[")) {
    element.textContent = value;
    return;
  }
  element.textContent = "";
  const parts = value.split(/\[\[|\]\]/);
  parts.forEach((part, index) => {
    if (!part) return;
    if (index % 2 === 1) {
      const mark = document.createElement("mark");
      mark.className = "ink";
      mark.textContent = part;
      element.appendChild(mark);
    } else {
      element.appendChild(document.createTextNode(part));
    }
  });
}

function setLanguage(lang) {
  currentLang = lang;
  document.documentElement.lang = lang;
  document.title = strings[lang].title;
  const description = document.querySelector("meta[name='description']");
  if (description) {
    description.content = strings[lang].description;
  }
  updateMeta("property", "og:title", strings[lang].title);
  updateMeta("property", "og:description", strings[lang].description);
  updateMeta("name", "twitter:title", strings[lang].title);
  updateMeta("name", "twitter:description", strings[lang].description);

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const value = getNestedValue(strings[lang], element.dataset.i18n);
    if (typeof value === "string") {
      renderCopy(element, value);
    }
  });

  document.querySelectorAll("[data-i18n-alt]").forEach((element) => {
    const value = getNestedValue(strings[lang], element.dataset.i18nAlt);
    if (typeof value === "string") {
      element.alt = value;
    }
  });

  setSwitchLink(lang);
  refreshVisibleResult();
  document.dispatchEvent(new CustomEvent("bydi:language", { detail: { lang, strings: strings[lang] } }));
}

window.bydiStrings = () => strings[currentLang];

function updateMeta(attribute, key, content) {
  const element = document.querySelector(`meta[${attribute}='${key}']`);
  if (element) {
    element.content = content;
  }
}

function addParam(url, key, value) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

function trackOfferEvent(path, title) {
  if (!window.goatcounter || typeof window.goatcounter.count !== "function") {
    return;
  }

  window.goatcounter.count({ path, title, event: true });
}

function buildCalendlyUrl(baseUrl, decisionType, whyNow, stakes, deadline, clarityBlock) {
  let url = baseUrl;
  url = addParam(url, "a1", decisionType);
  url = addParam(url, "a2", `${whyNow}; deadline: ${deadline}`);
  url = addParam(url, "a3", stakes);
  url = addParam(url, "a4", clarityBlock);
  return url;
}

function selectedFormState(form) {
  const data = new FormData(form);
  return {
    business: data.get("business"),
    decisionType: data.get("decisionType"),
    whyNow: data.get("whyNow"),
    stakes: data.getAll("stakes").join(", ") || strings.en.result.notSelected,
    clarityBlock: data.get("clarityBlock"),
    deadline: data.get("deadline")
  };
}

function renderResult(form, shouldScroll = true) {
  const result = document.querySelector("[data-decision-result]");
  if (!result) {
    return;
  }

  const state = selectedFormState(form);
  const resultTitle = result.querySelector("[data-result-title]");
  const resultType = result.querySelector("[data-result-type]");
  const resultBlindspot = result.querySelector("[data-result-blindspot]");
  const bookCall = result.querySelector("[data-book-call]");
  const doorNote = result.querySelector("[data-door-note]");
  const status = result.querySelector("[data-result-status]");
  const emailPayload = result.querySelector("[data-email-result-payload]");
  const emailResult = result.querySelector("[data-email-result]");
  const langStrings = strings[currentLang];

  result.hidden = false;

  if (state.business === "No") {
    resultTitle.textContent = langStrings.result.warmTitle;
    resultType.textContent = "";
    resultBlindspot.textContent = langStrings.result.warmCopy;
    bookCall.hidden = true;
    if (emailResult) {
      emailResult.hidden = true;
    }
    doorNote.textContent = "";
    status.textContent = "";
    if (shouldScroll) {
      result.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return;
  }

  resultTitle.textContent = langStrings.result.title;
  resultType.textContent = `${langStrings.result.typePrefix}: ${optionLabel("decisionType", state.decisionType, currentLang)}`;
  resultBlindspot.textContent = langStrings.result.texts[state.clarityBlock] || "";
  if (emailResult) {
    emailResult.hidden = false;
  }
  bookCall.hidden = false;
  doorNote.textContent = langStrings.result.doorNote;

  const calendlyUrl = form.dataset.calendlyUrl || "";
  const summary = [
    `Decision type: ${state.decisionType}`,
    `Why now: ${state.whyNow}; deadline: ${state.deadline}`,
    `Stakes: ${state.stakes}`,
    `Clarity block: ${state.clarityBlock}`
  ].join(" | ");

  if (!calendlyUrl || calendlyUrl.includes("{{")) {
    bookCall.href = "#check";
    status.textContent = langStrings.result.statusMissing;
    navigator.clipboard.writeText(summary)
      .then(() => {
        status.textContent += langStrings.result.statusCopied;
      })
      .catch(() => {
        status.textContent += ` ${langStrings.result.answers}: ${summary}`;
      });
  } else {
    bookCall.href = buildCalendlyUrl(
      calendlyUrl,
      state.decisionType,
      state.whyNow,
      state.stakes,
      state.deadline,
      state.clarityBlock
    );
    status.textContent = langStrings.result.statusReady;
  }

  if (emailPayload) {
    emailPayload.value = [
      `${langStrings.result.typePrefix}: ${optionLabel("decisionType", state.decisionType, currentLang)}`,
      resultBlindspot.textContent,
      `Book: ${bookCall.href}`
    ].join("\\n\\n");
  }

  if (shouldScroll) {
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function refreshVisibleResult() {
  const form = document.querySelector("[data-decision-check]");
  const result = document.querySelector("[data-decision-result]");
  if (form && result && !result.hidden) {
    renderResult(form, false);
  }
}

document.querySelectorAll("[data-copy-text]").forEach((button) => {
  button.addEventListener("click", async () => {
    const status = button.parentElement.querySelector(".copy-status");
    const lang = document.documentElement.lang === "ru" ? "ru" : "en";

    try {
      await navigator.clipboard.writeText(button.dataset.copyText);
      status.textContent = copiedByLang[lang];
    } catch {
      status.textContent = button.dataset.copyText;
    }
  });
});

document.querySelectorAll("[data-share='telegram']").forEach((link) => {
  const copyButton = link.parentElement.querySelector("[data-copy-text]");
  const text = copyButton ? copyButton.dataset.copyText : "DECISION";
  if (!link.href.includes("?text=")) {
    link.href = `https://t.me/share/url?text=${encodeURIComponent(text)}`;
  }
});

document.querySelectorAll("[data-lang-switch]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const lang = link.dataset.nextLang;
    window.localStorage.setItem("dst-lang", lang);
    setLanguage(lang);
  });
});

document.querySelectorAll("[data-decision-check]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    renderResult(form);
    trackOfferEvent("/check-result", "Decision Check result shown");
  });
});

document.querySelectorAll("[data-book-call]").forEach((link) => {
  link.addEventListener("click", () => {
    if (!link.hidden && link.href && link.href !== "#check") {
      trackOfferEvent("/book-call-click", "Book call clicked");
    }
  });
});

if (document.querySelector("[data-lang-switch]")) {
  setLanguage(getInitialLang());
}
