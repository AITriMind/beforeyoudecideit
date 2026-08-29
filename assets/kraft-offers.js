const copiedByLang = {
  ru: "Текст заявки скопирован.",
  en: "Request text copied."
};

document.querySelectorAll("[data-copy-text]").forEach((button) => {
  button.addEventListener("click", async () => {
    const status = button.parentElement.querySelector(".copy-status");
    const lang = document.documentElement.lang === "en" ? "en" : "ru";

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

const blindspots = {
  chosenCollecting:
    "You may already have enough signal to move. The useful test is not more information, but whether the reason for moving still holds when timing, team cost, and consequences are named clearly.",
  researching:
    "Research can look responsible while it quietly postpones commitment. The useful test is to separate what must be known before action from what can only be learned after a contained step.",
  partnerDiffers:
    "The difference may not be about the option itself. It may be about which risk each person is protecting against. The useful test is to name the competing risk models before forcing agreement.",
  stoppedChecking:
    "A clear yes can be a strong result. The useful test is to understand why it is a yes, what would make it no, and which assumptions deserve one last look before commitment.",
  fearExcitement:
    "Strong emotion is data, but not a decision rule. The useful test is to separate market signal, personal cost, and the story you are telling yourself about both.",
  alreadyInvested:
    "Past investment can make stopping feel more expensive than continuing. The useful test is to compare the next commitment against the future case, not against the work already spent."
};

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

document.querySelectorAll("[data-decision-check]").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const result = document.querySelector("[data-decision-result]");
    const resultTitle = result.querySelector("[data-result-title]");
    const resultBlindspot = result.querySelector("[data-result-blindspot]");
    const bookCall = result.querySelector("[data-book-call]");
    const status = result.querySelector("[data-result-status]");
    const business = data.get("business");
    const decisionType = data.get("decisionType");
    const whyNow = data.get("whyNow");
    const stakes = data.getAll("stakes").join(", ") || "not selected";
    const clarityBlock = data.get("clarityBlock");
    const deadline = data.get("deadline");

    result.hidden = false;
    trackOfferEvent("/check-result", "Decision Check result shown");

    if (business === "No") {
      resultTitle.textContent = "This check is built for owners of an existing business.";
      resultBlindspot.textContent = "If you are still before that stage, keep the decision note and use the Telegram path when you want to ask whether the format fits. The filter is here to protect the call for people with active business stakes.";
      bookCall.hidden = true;
      status.textContent = "";
      result.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    resultTitle.textContent = `Decision type: ${decisionType}`;
    resultBlindspot.textContent = blindspots[clarityBlock] || "";
    bookCall.hidden = false;

    const calendlyUrl = form.dataset.calendlyUrl || "";
    const summary = [
      `Decision type: ${decisionType}`,
      `Why now: ${whyNow}; deadline: ${deadline}`,
      `Stakes: ${stakes}`,
      `Clarity block: ${clarityBlock}`
    ].join(" | ");

    if (!calendlyUrl || calendlyUrl.includes("{{")) {
      bookCall.href = "#check";
      status.textContent = "Calendly URL placeholder is still in use. Add the booking link before publishing.";
      try {
        await navigator.clipboard.writeText(summary);
        status.textContent += " Your answers were copied so you can paste them into the booking form later.";
      } catch {
        status.textContent += ` Answers: ${summary}`;
      }
    } else {
      let url = calendlyUrl;
      url = addParam(url, "a1", decisionType);
      url = addParam(url, "a2", `${whyNow}; deadline: ${deadline}`);
      url = addParam(url, "a3", stakes);
      url = addParam(url, "a4", clarityBlock);
      bookCall.href = url;
      status.textContent = "Your answers are added to the booking link.";
    }

    result.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

document.querySelectorAll("[data-book-call]").forEach((link) => {
  link.addEventListener("click", () => {
    if (!link.hidden && link.href && link.href !== "#check") {
      trackOfferEvent("/book-call-click", "Book call clicked");
    }
  });
});
