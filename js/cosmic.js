(function () {
  var M = window.NewsModel;
  var STORAGE_KEY = "news.cosmicPaste";
  var host = document.getElementById("cosmic-fields");
  var hud = document.getElementById("hud");
  var cosmicWarn = document.getElementById("cosmic-warn");
  var result = document.getElementById("result");
  var waiting = document.getElementById("waiting");
  var elements = {};

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function buildField(stop) {
    var wrap = el("div", "stop stop-" + stop.kind);
    wrap.dataset.stopId = stop.id;

    if (stop.kind === "gap") {
      var gapLabel = el("label");
      var gapText = el("span", "stop-label", stop.label);
      var gapDetail = el("small", null, stop.detail);
      var gapInput = document.createElement("input");
      gapInput.type = "text";
      gapInput.readOnly = false;
      gapInput.autocomplete = "off";
      gapInput.spellcheck = false;
      gapInput.setAttribute("aria-label", stop.detail);
      gapInput.dataset.stop = stop.id;
      gapInput.dataset.kind = "gap";
      gapLabel.appendChild(gapText);
      gapLabel.appendChild(gapDetail);
      gapLabel.appendChild(gapInput);
      wrap.appendChild(gapLabel);
      elements[stop.id] = gapInput;
      return wrap;
    }

    if (stop.control === "check") {
      var checkLabel = el("label", "flag");
      var check = document.createElement("input");
      check.type = "checkbox";
      check.dataset.stop = stop.id;
      check.dataset.kind = "manual";
      checkLabel.appendChild(check);
      checkLabel.appendChild(el("span", null, stop.label));
      wrap.appendChild(checkLabel);
      elements[stop.id] = check;
      return wrap;
    }

    if (stop.control === "choice") {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      button.textContent = stop.choice;
      button.dataset.stop = stop.id;
      button.dataset.kind = "manual";
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", stop.label + " " + stop.choice);
      button.addEventListener("click", function () {
        var pair = stop.id === "syrgas-ja" ? "syrgas-nej" : "syrgas-ja";
        var other = elements[pair];
        var on = button.getAttribute("aria-pressed") !== "true";
        button.setAttribute("aria-pressed", on ? "true" : "false");
        if (on && other) other.setAttribute("aria-pressed", "false");
      });
      if (stop.id === "syrgas-ja") {
        var row = el("div", "choice-row");
        row.appendChild(el("span", "stop-label", "Tillsatt syrgas?"));
        row.appendChild(button);
        wrap.appendChild(row);
        wrap.dataset.choiceRow = "ja";
      }
      elements[stop.id] = button;
      return wrap;
    }

    if (stop.kind === "readonly") {
      var mapLabel = el("label");
      mapLabel.appendChild(el("span", "stop-label", stop.label));
      mapLabel.appendChild(el("small", null, stop.detail));
      var mapInput = document.createElement("input");
      mapInput.type = "text";
      mapInput.readOnly = true;
      mapInput.tabIndex = 0;
      mapInput.placeholder = "mmHg";
      mapInput.dataset.stop = stop.id;
      mapInput.dataset.kind = "readonly";
      mapInput.setAttribute("aria-label", "MAP, räknas i Cosmic");
      mapLabel.appendChild(mapInput);
      wrap.appendChild(mapLabel);
      elements[stop.id] = mapInput;
      return wrap;
    }

    var label = el("label");
    var title = el("span", "stop-label");
    title.textContent = stop.short && stop.short !== stop.label ? stop.label + " (" + stop.short + ")" : stop.label;
    label.appendChild(title);

    var control;
    if (stop.input === "acvpu") {
      control = document.createElement("select");
      var empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "Välj";
      control.appendChild(empty);
      M.ACVPU.forEach(function (option) {
        var node = document.createElement("option");
        node.value = option.value;
        node.textContent = option.value;
        control.appendChild(node);
      });
    } else {
      control = document.createElement("input");
      control.type = "text";
      control.inputMode = stop.input === "decimal" ? "decimal" : "numeric";
      control.autocomplete = "off";
      control.spellcheck = false;
    }
    control.dataset.stop = stop.id;
    control.dataset.kind = "value";
    label.appendChild(control);
    if (stop.unit && stop.input !== "acvpu") label.appendChild(el("em", "unit", stop.unit));
    wrap.appendChild(label);
    elements[stop.id] = control;
    return wrap;
  }

  function mount() {
    var choiceRow = null;
    M.STOPS.forEach(function (stop) {
      var node = buildField(stop);
      if (stop.id === "syrgas-nej" && choiceRow) {
        choiceRow.appendChild(elements[stop.id]);
        return;
      }
      if (stop.id === "syrgas-ja") {
        choiceRow = node.querySelector(".choice-row");
      }
      if (stop.id === "sys") {
        var bp = el("div", "bp-row");
        bp.appendChild(node);
        host.appendChild(bp);
        host._bp = bp;
        return;
      }
      if ((stop.id === "dia" || stop.id === "map") && host._bp) {
        host._bp.appendChild(node);
        return;
      }
      host.appendChild(node);
    });
  }

  function stops() {
    return Array.prototype.slice.call(host.querySelectorAll("[data-stop]"));
  }

  function applyPart(node, part) {
    var kind = node.dataset.kind;
    if (kind === "manual" || kind === "readonly") return;
    if (node.tagName === "SELECT") {
      var want = part.trim().toLowerCase();
      if (!want) {
        node.value = "";
        return;
      }
      var match = Array.prototype.find.call(node.options, function (option) {
        return option.value.toLowerCase() === want;
      });
      node.value = match ? match.value : "";
      return;
    }
    node.value = part;
  }

  function showBlockedPaste() {
    cosmicWarn.hidden = false;
    cosmicWarn.textContent = "Hela inklistringen hamnade i den markerade rutan. Cosmic gör likadant och hoppar inte till nästa fält. Kopiera ett värde i taget, klistra in och tryck TAB.";
  }

  function onPaste(event) {
    var text = event.clipboardData ? event.clipboardData.getData("text/plain") : "";
    var target = event.target;
    if (!text || !target) return;
    if (text.indexOf("\t") !== -1) {
      window.setTimeout(function () {
        showBlockedPaste();
        compare();
      }, 0);
      return;
    }
    if (target.tagName === "SELECT") {
      event.preventDefault();
      applyPart(target, text);
      updateHud(target);
      compare();
    }
  }

  function loadPayload() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function showWaiting() {
    var payload = loadPayload();
    waiting.innerHTML = "";
    if (!payload || !payload.values) {
      waiting.hidden = false;
      var p = document.createElement("p");
      p.textContent = "Inga kopierade värden väntar. Fyll i dem på registreringssidan och tryck Kopiera värden.";
      waiting.appendChild(p);
      return;
    }
    waiting.hidden = false;
    var lead = document.createElement("p");
    lead.textContent = "Kopierade värden väntar. Klistra in ett värde i taget i den markerade rutan och tryck TAB. Alla värden på en gång hamnar i en enda ruta, precis som i Cosmic.";
    waiting.appendChild(lead);
    var list = document.createElement("ul");
    [
      ["Andningsfrekvens", payload.values.af],
      ["Saturation", payload.values.sat],
      ["Flöde", payload.values.flow],
      ["Systoliskt", payload.values.sys],
      ["Diastoliskt", payload.values.dia],
      ["Puls", payload.values.puls],
      ["ACVPU", payload.values.acvpu],
      ["Temperatur", payload.values.temp]
    ].forEach(function (item) {
      var li = document.createElement("li");
      li.textContent = item[0] + ": " + (item[1] || "tomt");
      list.appendChild(li);
    });
    waiting.appendChild(list);
    (payload.reminders || []).forEach(function (line) {
      var note = document.createElement("p");
      note.textContent = line;
      waiting.appendChild(note);
    });
  }

  function actualValue(id) {
    var node = elements[id];
    if (!node) return "";
    if (node.tagName === "SELECT" || node.tagName === "INPUT") return node.value.trim();
    return "";
  }

  function compare() {
    var payload = loadPayload();
    result.innerHTML = "";
    result.hidden = false;
    var heading = document.createElement("h2");
    heading.textContent = "Så landade värdena";
    result.appendChild(heading);
    if (!payload || !payload.values) {
      var note = document.createElement("p");
      note.textContent = "Det finns ingen sparad kopia att jämföra med. Kontrollera rutorna mot det du tänkte skriva in.";
      result.appendChild(note);
      return;
    }
    var rows = [
      ["af", "Andningsfrekvens"],
      ["sat", "Saturation"],
      ["flow", "Flödeshastighet"],
      ["sys", "Systoliskt"],
      ["dia", "Diastoliskt"],
      ["puls", "Puls"],
      ["acvpu", "ACVPU"],
      ["temp", "Temperatur"]
    ];
    var list = document.createElement("ul");
    list.className = "check";
    var misses = 0;
    M.STOPS.forEach(function (stop) {
      if (stop.kind !== "gap" && stop.kind !== "readonly") return;
      var spilled = actualValue(stop.id);
      if (!spilled) return;
      misses += 1;
      var item = document.createElement("li");
      item.className = "bad";
      item.textContent = (stop.detail || stop.label) + " fick värdet " + spilled + " och ska vara tom.";
      list.appendChild(item);
    });
    rows.forEach(function (row) {
      var expected = payload.values[row[0]] || "";
      var actual = actualValue(row[0]);
      var ok = actual === expected;
      if (!ok) misses += 1;
      var item = document.createElement("li");
      item.className = ok ? "ok" : "bad";
      item.textContent = row[1] + ": " + (actual || "tomt") + (ok ? "" : " (förväntat " + (expected || "tomt") + ")");
      list.appendChild(item);
      elements[row[0]].closest(".stop").classList.toggle("mismatch", !ok);
      elements[row[0]].closest(".stop").classList.toggle("match", ok && expected !== "");
    });
    result.appendChild(list);
    var summary = document.createElement("p");
    summary.className = misses === 0 ? "lead" : "lead bad-text";
    summary.textContent = misses === 0
      ? "Alla värden hamnade i rätt ruta."
      : misses + (misses === 1 ? " värde hamnade fel." : " värden hamnade fel.");
    result.appendChild(summary);
    (payload.reminders || []).forEach(function (line) {
      var extra = document.createElement("p");
      extra.textContent = line;
      result.appendChild(extra);
    });
  }

  function updateHud(target) {
    var list = stops();
    var index = list.indexOf(target);
    if (index < 0) {
      hud.textContent = "Klicka i Andningsfrekvens. Tabbstopp 1 av " + list.length + ".";
      return;
    }
    var stop = M.STOPS[index];
    var text = "Tabbstopp " + (index + 1) + " av " + list.length + " — " + (stop.detail || stop.label);
    var previous = null;
    for (var i = index - 1; i >= 0; i--) {
      if (M.STOPS[i].kind === "value" && M.CHAIN.indexOf(M.STOPS[i].id) !== -1) {
        previous = M.STOPS[i];
        text += ". " + (index - i) + (index - i === 1 ? " tabb" : " tabbar") + " från " + previous.label + ".";
        break;
      }
    }
    hud.textContent = text;
  }

  function resetForm() {
    stops().forEach(function (node) {
      if (node.dataset.kind === "manual") {
        if (node.type === "checkbox") node.checked = false;
        else node.setAttribute("aria-pressed", "false");
        return;
      }
      if (node.tagName === "SELECT" || node.tagName === "INPUT") node.value = "";
    });
    host.querySelectorAll(".stop").forEach(function (node) {
      node.classList.remove("match", "mismatch");
    });
    result.hidden = true;
    result.innerHTML = "";
    cosmicWarn.hidden = true;
    elements.af.focus();
    updateHud(elements.af);
  }

  mount();
  host.addEventListener("paste", onPaste);
  host.addEventListener("input", compare);
  host.addEventListener("change", compare);
  host.addEventListener("focusin", function (event) {
    if (event.target && event.target.dataset && event.target.dataset.stop) updateHud(event.target);
  });
  document.getElementById("reset").addEventListener("click", resetForm);
  showWaiting();
  elements.af.focus();
  updateHud(elements.af);
})();
