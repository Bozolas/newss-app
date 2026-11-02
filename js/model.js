(function () {
  /**
   * Tabbordning i Cosmic, räknad från anteckningen:
   * Andningsfrekvens, sedan 2 tabbar till saturation,
   * 5 till systoliskt, 1 till diastoliskt, 3 till puls,
   * 3 till ACVPU och 2 till temperatur.
   *
   * Avståndet i listan (indexskillnad) är antalet TAB.
   * Flödeshastighet ligger bland de fem tabbarna efter saturation
   * och fylls bara när personalen har skrivit ett flöde.
   * Kryssrutor och Ja/Nej går inte att fylla med inklistring.
   */
  var STOPS = [
    { id: "af", label: "Andningsfrekvens", short: "AF", kind: "value", input: "int", unit: "/min" },
    { id: "gap-af", label: "Tomt tabbstopp", detail: "Mellan andningsfrekvens och saturation", kind: "gap" },
    { id: "sat", label: "Saturation", short: "SAT", kind: "value", input: "int", unit: "%" },
    { id: "habituell", label: "Låg habituell syremättnad", kind: "manual", control: "check" },
    { id: "syrgas-ja", label: "Tillsatt syrgas", kind: "manual", control: "choice", choice: "Ja" },
    { id: "syrgas-nej", label: "Tillsatt syrgas", kind: "manual", control: "choice", choice: "Nej" },
    { id: "flow", label: "Flödeshastighet", short: "O2", kind: "value", input: "decimal", unit: "l/min" },
    { id: "sys", label: "Systoliskt", short: "BT", kind: "value", input: "int", unit: "mmHg" },
    { id: "dia", label: "Diastoliskt", short: "BT", kind: "value", input: "int", unit: "mmHg" },
    { id: "map", label: "MAP", kind: "readonly", detail: "Räknas i Cosmic och lämnas tom" },
    { id: "gap-puls", label: "Tomt tabbstopp", detail: "Mellan diastoliskt och puls", kind: "gap" },
    { id: "puls", label: "Puls", short: "P", kind: "value", input: "int", unit: "/min" },
    { id: "oregelbunden", label: "Oregelbunden", kind: "manual", control: "check" },
    { id: "gap-acvpu", label: "Tomt tabbstopp", detail: "Mellan puls och ACVPU", kind: "gap" },
    { id: "acvpu", label: "ACVPU", short: "ACVPU", kind: "value", input: "acvpu" },
    { id: "gap-temp", label: "Tomt tabbstopp", detail: "Mellan ACVPU och temperatur", kind: "gap" },
    { id: "temp", label: "Temperatur", short: "TEMP", kind: "value", input: "decimal", unit: "°C" }
  ];

  var CHAIN = ["af", "sat", "sys", "dia", "puls", "acvpu", "temp"];

  var ACVPU = [
    { value: "Alert", hint: "vaken" },
    { value: "Confusion", hint: "nytillkommen förvirring" },
    { value: "Voice", hint: "reagerar på tilltal" },
    { value: "Pain", hint: "reagerar på smärta" },
    { value: "Unresponsive", hint: "reagerar inte" }
  ];

  function indexOf(id) {
    for (var i = 0; i < STOPS.length; i++) {
      if (STOPS[i].id === id) return i;
    }
    return -1;
  }

  function toNumber(value) {
    if (value == null) return null;
    var text = String(value).trim().replace(/\s/g, "").replace(",", ".");
    if (!text) return null;
    var number = Number(text);
    return Number.isFinite(number) ? number : null;
  }

  function formatInt(value) {
    var number = toNumber(value);
    if (number == null) return "";
    return String(Math.round(number));
  }

  function formatDecimal(value) {
    var number = toNumber(value);
    if (number == null) return "";
    var rounded = Math.round(number * 10) / 10;
    if (Object.is(rounded, -0)) rounded = 0;
    if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
    return rounded.toFixed(1).replace(".", ",");
  }

  function formatStop(id, raw) {
    var stop = STOPS[indexOf(id)];
    if (!stop || stop.kind !== "value") return "";
    if (stop.input === "acvpu") return raw ? String(raw) : "";
    if (stop.input === "decimal") return formatDecimal(raw);
    return formatInt(raw);
  }

  function buildPaste(values) {
    return STOPS.map(function (stop) {
      if (stop.kind !== "value") return "";
      return formatStop(stop.id, values[stop.id]);
    }).join("\t");
  }

  function sendKeysText(text) {
    return String(text).replace(/[+^%~(){}[\]]/g, "{$&}");
  }

  function vbsQuoted(text) {
    return '"' + String(text).replace(/"/g, '""') + '"';
  }

  function buildCosmicScript(values) {
    var parts = buildPaste(values).split("\t");
    var lines = [
      "' Skriver in NEWS-värden i Cosmic och trycker TAB mellan fälten.",
      "Set shell = CreateObject(\"WScript.Shell\")",
      "result = MsgBox(\"1. Klicka i rutan Andningsfrekvens i Cosmic.\" & vbCrLf & \"2. Klicka OK här.\" & vbCrLf & \"3. Rör inte musen eller tangentbordet. Inmatningen startar efter 5 sekunder.\", vbOKCancel, \"Fyll i Cosmic\")",
      "If result <> vbOK Then WScript.Quit",
      "WScript.Sleep 5000"
    ];
    parts.forEach(function (part, index) {
      if (part) {
        Array.from(part).forEach(function (character) {
          lines.push("shell.SendKeys " + vbsQuoted(sendKeysText(character)));
          lines.push("WScript.Sleep 40");
        });
        if (/^(Alert|Confusion|Voice|Pain|Unresponsive)$/.test(part)) {
          lines.push("WScript.Sleep 250");
        }
      }
      if (index < parts.length - 1) {
        lines.push("shell.SendKeys \"{TAB}\"");
        lines.push("WScript.Sleep 120");
      }
    });
    lines.push("MsgBox \"Klart. Kontrollera värdena i Cosmic innan du sparar.\", vbInformation, \"Fyll i Cosmic\"");
    return lines.join("\r\n") + "\r\n";
  }

  function encodeWindows1252(text) {
    var bytes = [];
    for (var i = 0; i < text.length; i++) {
      var code = text.charCodeAt(i);
      if (code <= 255) bytes.push(code);
      else bytes.push(63);
    }
    return new Uint8Array(bytes);
  }

  function tabsBetween(fromId, toId) {
    return indexOf(toId) - indexOf(fromId);
  }

  function chainSteps(values) {
    var steps = [];
    for (var i = 0; i < CHAIN.length; i++) {
      var id = CHAIN[i];
      var stop = STOPS[indexOf(id)];
      steps.push({
        id: id,
        label: stop.label,
        text: formatStop(id, values[id]),
        tabs: i === 0 ? 0 : tabsBetween(CHAIN[i - 1], id)
      });
    }
    return steps;
  }

  function scorePart(id, number, onOxygen) {
    if (number == null || !Number.isFinite(number)) return null;
    if (id === "af") {
      if (number <= 8) return 3;
      if (number <= 11) return 1;
      if (number <= 20) return 0;
      if (number <= 24) return 2;
      return 3;
    }
    if (id === "sat") {
      if (number <= 91) return 3;
      if (number <= 93) return 2;
      if (number <= 95) return 1;
      return 0;
    }
    if (id === "sys") {
      if (number <= 90) return 3;
      if (number <= 100) return 2;
      if (number <= 110) return 1;
      if (number <= 219) return 0;
      return 3;
    }
    if (id === "puls") {
      if (number <= 40) return 3;
      if (number <= 50) return 1;
      if (number <= 90) return 0;
      if (number <= 110) return 1;
      if (number <= 130) return 2;
      return 3;
    }
    if (id === "temp") {
      var tenths = Math.round(number * 10);
      if (tenths <= 350) return 3;
      if (tenths <= 360) return 1;
      if (tenths <= 380) return 0;
      if (tenths <= 390) return 1;
      return 3;
    }
    return null;
  }

  function scoreNews(values) {
    var onOxygen = values.syrgas === "ja";
    var parts = {
      af: scorePart("af", toNumber(values.af)),
      sat: scorePart("sat", toNumber(values.sat)),
      oxygen: onOxygen ? 2 : 0,
      sys: scorePart("sys", toNumber(values.sys)),
      puls: scorePart("puls", toNumber(values.puls)),
      acvpu: values.acvpu ? (values.acvpu === "Alert" ? 0 : 3) : null,
      temp: scorePart("temp", toNumber(values.temp))
    };
    var keys = ["af", "sat", "oxygen", "sys", "puls", "acvpu", "temp"];
    var complete = keys.every(function (key) { return parts[key] != null; });
    var total = null;
    var anyThree = false;
    if (complete) {
      total = 0;
      keys.forEach(function (key) {
        total += parts[key];
        if (key !== "oxygen" && parts[key] === 3) anyThree = true;
      });
    }
    var band = "";
    if (total != null) {
      if (total >= 7) band = "Hög";
      else if (total >= 5) band = "Medel";
      else if (total >= 1) band = "Låg–medel";
      else band = "Låg";
    }
    return { parts: parts, total: total, complete: complete, anyThree: anyThree, band: band };
  }

  function reminders(values) {
    var lines = [];
    if (values.habituell) lines.push("Kryssa Låg habituell syremättnad i Cosmic.");
    if (values.syrgas === "ja") lines.push("Kryssa Tillsatt syrgas: Ja i Cosmic. Ja och Nej går inte att fylla i automatiskt.");
    if (values.oregelbunden) lines.push("Kryssa Oregelbunden puls i Cosmic.");
    return lines;
  }

  function hasAnyValue(values) {
    return CHAIN.some(function (id) { return formatStop(id, values[id]) !== ""; }) ||
      formatStop("flow", values.flow) !== "";
  }

  window.NewsModel = {
    STOPS: STOPS,
    CHAIN: CHAIN,
    ACVPU: ACVPU,
    indexOf: indexOf,
    toNumber: toNumber,
    formatStop: formatStop,
    buildPaste: buildPaste,
    buildCosmicScript: buildCosmicScript,
    encodeWindows1252: encodeWindows1252,
    tabsBetween: tabsBetween,
    chainSteps: chainSteps,
    scoreNews: scoreNews,
    reminders: reminders,
    hasAnyValue: hasAnyValue
  };
})();
