(function () {
  var M = window.NewsModel;
  var STORAGE_KEY = "news.cosmicPaste";

  var fields = {
    af: document.getElementById("af"),
    sat: document.getElementById("sat"),
    flow: document.getElementById("flow"),
    sys: document.getElementById("sys"),
    dia: document.getElementById("dia"),
    puls: document.getElementById("puls"),
    acvpu: document.getElementById("acvpu"),
    temp: document.getElementById("temp"),
    habituell: document.getElementById("habituell"),
    oregelbunden: document.getElementById("oregelbunden")
  };

  var syrgas = "nej";
  var flowRow = document.getElementById("flow-row");
  var scoreBox = document.getElementById("score");
  var preview = document.getElementById("preview");
  var statusBox = document.getElementById("status");
  var copyButton = document.getElementById("copy");
  var warnBox = document.getElementById("warnings");

  function readValues() {
    return {
      af: fields.af.value,
      sat: fields.sat.value,
      flow: syrgas === "ja" ? fields.flow.value : "",
      sys: fields.sys.value,
      dia: fields.dia.value,
      puls: fields.puls.value,
      acvpu: fields.acvpu.value,
      temp: fields.temp.value,
      syrgas: syrgas,
      habituell: fields.habituell.checked,
      oregelbunden: fields.oregelbunden.checked
    };
  }

  function setSyrgas(next) {
    syrgas = next === "ja" ? "ja" : "nej";
    document.querySelectorAll("[data-syrgas]").forEach(function (button) {
      var on = button.getAttribute("data-syrgas") === syrgas;
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
    flowRow.hidden = syrgas !== "ja";
    if (syrgas !== "ja") fields.flow.value = "";
    render();
  }

  function warningLines(values) {
    var lines = [];
    function check(id, min, max, label) {
      var number = M.toNumber(values[id]);
      if (number == null) return;
      if (number < min || number > max) lines.push(label + " ligger utanför vanligt intervall.");
    }
    check("af", 4, 45, "Andningsfrekvens");
    check("sat", 70, 100, "Saturation");
    check("flow", 0, 30, "Flödeshastighet");
    check("sys", 60, 250, "Systoliskt blodtryck");
    check("dia", 30, 160, "Diastoliskt blodtryck");
    check("puls", 30, 200, "Puls");
    check("temp", 34, 41, "Temperatur");
    var sys = M.toNumber(values.sys);
    var dia = M.toNumber(values.dia);
    if (sys != null && dia != null && dia >= sys) {
      lines.push("Diastoliskt är inte lägre än systoliskt.");
    }
    if (values.syrgas === "ja" && M.formatStop("flow", values.flow) === "") {
      lines.push("Syrgas är Ja, men flöde saknas. Ja måste ändå kryssas i Cosmic.");
    }
    return lines;
  }

  function renderScore(values) {
    var score = M.scoreNews(values);
    var items = [
      ["AF", score.parts.af],
      ["SAT", score.parts.sat],
      ["O2", score.parts.oxygen],
      ["BT", score.parts.sys],
      ["P", score.parts.puls],
      ["ACVPU", score.parts.acvpu],
      ["TEMP", score.parts.temp]
    ];
    scoreBox.innerHTML = "";
    items.forEach(function (item) {
      var cell = document.createElement("div");
      var name = document.createElement("span");
      name.textContent = item[0];
      var value = document.createElement("strong");
      value.textContent = item[1] == null ? "–" : String(item[1]);
      cell.appendChild(name);
      cell.appendChild(value);
      scoreBox.appendChild(cell);
    });
    var total = document.createElement("div");
    total.className = "total";
    if (score.complete) total.classList.add("band-" + bandClass(score.band));
    var totalName = document.createElement("span");
    totalName.textContent = "NEWS";
    var totalValue = document.createElement("strong");
    totalValue.textContent = score.complete ? String(score.total) : "–";
    total.appendChild(totalName);
    total.appendChild(totalValue);
    scoreBox.appendChild(total);

    var note = document.getElementById("score-note");
    if (!score.complete) {
      note.textContent = "NEWS-poängen visas när alla värden är ifyllda. Poängen skrivs inte in i Cosmic. Cosmic räknar själv.";
    } else {
      var text = "NEWS " + score.total + " · " + score.band + ". Poängen skrivs inte in i Cosmic. Cosmic räknar den poäng som gäller.";
      if (score.anyThree) text += " En parameter har 3 poäng.";
      note.textContent = text;
    }
  }

  function bandClass(band) {
    if (band === "Hög") return "high";
    if (band === "Medel") return "mid";
    if (band === "Låg–medel") return "lowmid";
    return "low";
  }

  function renderPreview(values) {
    preview.innerHTML = "";
    M.chainSteps(values).forEach(function (step) {
      var row = document.createElement("p");
      if (step.tabs) {
        var tabs = document.createElement("span");
        tabs.className = "tabs";
        tabs.textContent = step.tabs + (step.tabs === 1 ? " tabb" : " tabbar") + " → ";
        row.appendChild(tabs);
      }
      var label = document.createElement("span");
      label.textContent = step.label + ": " + (step.text || "tomt");
      row.appendChild(label);
      preview.appendChild(row);
    });
    var flow = M.formatStop("flow", values.flow);
    var flowNote = document.createElement("p");
    flowNote.className = "flow-note";
    if (flow) {
      flowNote.textContent = "Flödeshastighet " + flow + " l/min skrivs in på vägen, i rutan mellan syrgasvalen och systoliskt. Det är fortfarande 5 tabbar från saturation till systoliskt.";
    } else {
      flowNote.textContent = "Flödeshastighet lämnas tom. De 5 tabbarna från saturation går förbi syrgasfälten till systoliskt.";
    }
    preview.appendChild(flowNote);
  }

  function renderWarnings(values) {
    var lines = warningLines(values);
    warnBox.innerHTML = "";
    warnBox.hidden = lines.length === 0;
    lines.forEach(function (line) {
      var p = document.createElement("p");
      p.textContent = line;
      warnBox.appendChild(p);
    });
  }

  function render() {
    var values = readValues();
    renderScore(values);
    renderPreview(values);
    renderWarnings(values);
    var ready = M.hasAnyValue(values);
    copyButton.disabled = !ready;
  }

  function fallbackCopy(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (error) {
      ok = false;
    }
    document.body.removeChild(area);
    if (!ok) throw new Error("copy failed");
  }

  function copyText(text) {
    function viaCommand() {
      fallbackCopy(text);
    }
    if (navigator.clipboard && window.isSecureContext) {
      window.focus();
      return navigator.clipboard.writeText(text).catch(function () {
        viaCommand();
      });
    }
    return new Promise(function (resolve, reject) {
      try {
        viaCommand();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  function showStatus(values, failed, text) {
    statusBox.innerHTML = "";
    statusBox.hidden = false;
    statusBox.classList.toggle("error", !!failed);
    if (failed) {
      var err = document.createElement("p");
      err.className = "lead";
      err.textContent = "Webbläsaren släppte inte urklippet. Texten nedan är markerad. Tryck Ctrl+C och klistra in den i rutan Andningsfrekvens i Cosmic.";
      var area = document.createElement("textarea");
      area.className = "raw";
      area.readOnly = true;
      area.value = text;
      statusBox.appendChild(err);
      statusBox.appendChild(area);
      var failLink = document.createElement("a");
      failLink.href = "cosmic.html";
      failLink.textContent = "Testa inklistringen";
      statusBox.appendChild(failLink);
      area.focus();
      area.select();
      return;
    }
    var lead = document.createElement("p");
    lead.className = "lead";
    lead.textContent = "Värdena är kopierade.";
    var how = document.createElement("p");
    how.textContent = "I Cosmic: klicka i rutan Andningsfrekvens och tryck Ctrl+V. Kontrollera alla rutor innan du sparar.";
    statusBox.appendChild(lead);
    statusBox.appendChild(how);
    M.reminders(values).forEach(function (line) {
      var p = document.createElement("p");
      p.textContent = line;
      statusBox.appendChild(p);
    });
    var link = document.createElement("a");
    link.href = "cosmic.html";
    link.textContent = "Testa inklistringen";
    statusBox.appendChild(link);
  }

  function copy() {
    var values = readValues();
    if (!M.hasAnyValue(values)) return;
    var text = M.buildPaste(values);
    var payload = {
      text: text,
      values: {
        af: M.formatStop("af", values.af),
        sat: M.formatStop("sat", values.sat),
        flow: M.formatStop("flow", values.flow),
        sys: M.formatStop("sys", values.sys),
        dia: M.formatStop("dia", values.dia),
        puls: M.formatStop("puls", values.puls),
        acvpu: values.acvpu || "",
        temp: M.formatStop("temp", values.temp)
      },
      reminders: M.reminders(values)
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      /* Sessionen kan vara stängd. Inklistringen fungerar ändå om urklipp går igenom. */
    }
    copyText(text).then(function () {
      showStatus(values, false, text);
      copyButton.textContent = "Kopierat";
      window.setTimeout(function () {
        copyButton.textContent = "Kopiera värden";
      }, 1600);
    }).catch(function () {
      showStatus(values, true, text);
    });
  }

  function randomInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function fillRandom() {
    var sys = randomInt(90, 180);
    var tempTenths = randomInt(350, 395);
    var levels = ["Alert", "Confusion", "Voice", "Pain", "Unresponsive"];
    fields.af.value = String(randomInt(6, 36));
    fields.sat.value = String(randomInt(88, 100));
    fields.sys.value = String(sys);
    fields.dia.value = String(randomInt(50, Math.min(110, sys - 10)));
    fields.puls.value = String(randomInt(40, 140));
    fields.acvpu.value = levels[randomInt(0, levels.length - 1)];
    fields.temp.value = Math.floor(tempTenths / 10) + "," + (tempTenths % 10);
    fields.habituell.checked = Math.random() < 0.2;
    fields.oregelbunden.checked = Math.random() < 0.2;
    var onOxygen = Math.random() < 0.35;
    setSyrgas(onOxygen ? "ja" : "nej");
    if (onOxygen) {
      fields.flow.value = String(randomInt(1, 15));
      render();
    }
    statusBox.hidden = true;
  }

  function fillExample() {
    fields.af.value = "12";
    fields.sat.value = "96";
    fields.sys.value = "144";
    fields.dia.value = "76";
    fields.puls.value = "57";
    fields.acvpu.value = "Alert";
    fields.temp.value = "36,4";
    fields.habituell.checked = false;
    fields.oregelbunden.checked = false;
    setSyrgas("nej");
  }

  function clearForm() {
    Object.keys(fields).forEach(function (key) {
      var field = fields[key];
      if (field.type === "checkbox") field.checked = false;
      else field.value = "";
    });
    setSyrgas("nej");
    statusBox.hidden = true;
  }

  document.querySelectorAll("[data-syrgas]").forEach(function (button) {
    button.addEventListener("click", function () {
      setSyrgas(button.getAttribute("data-syrgas"));
    });
  });

  document.getElementById("entry").addEventListener("submit", function (event) {
    event.preventDefault();
  });
  document.getElementById("entry").addEventListener("input", render);
  document.getElementById("entry").addEventListener("change", render);
  copyButton.addEventListener("click", copy);
  document.getElementById("example").addEventListener("click", fillExample);
  document.getElementById("random").addEventListener("click", fillRandom);
  document.getElementById("clear").addEventListener("click", clearForm);
  document.addEventListener("keydown", function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      copy();
    }
  });

  var order = ["af", "sat", "sys", "dia", "puls", "acvpu", "temp"];
  order.forEach(function (id, index) {
    fields[id].addEventListener("keydown", function (event) {
      if (event.key !== "Enter" || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      var next = fields[order[index + 1]];
      if (next) next.focus();
      else copy();
    });
  });

  setSyrgas("nej");
})();
