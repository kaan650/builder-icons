var FONT_BASE = "https://raw.githubusercontent.com/MaximumADHD/Roblox-Client-Tracker/refs/heads/roblox/LuaPackages/Packages/_Index/BuilderIcons/BuilderIcons/Font";

var FONT_URLS = {
  reg: FONT_BASE + "/BuilderIcons-Regular.ttf",
  fill: FONT_BASE + "/BuilderIcons-Filled.ttf",
};

var CATEGORY_ORDER = [
  "Social Media", "PlayStation", "Xbox", "Avatar & Body",
  "Clothing & Fashion", "Makeup", "Media Controls", "Communication",
  "Text Formatting", "UI Elements", "Developer", "E-Commerce",
  "Arrows & Navigation", "Other",
];

var PATTERNS = [
  { pattern: /^(amazon|android|apple|discord|facebook|figma|github|guilded|instagram|linkedin|messenger|meta|microsoft|slack|tencent|tik-tok|twitch|twitter|we-chat|whatsapp|youtube)/, category: "Social Media" },
  { pattern: /^playstation|^ps[0-9-]|^ps-/, category: "PlayStation" },
  { pattern: /^xbox/, category: "Xbox" },
  { pattern: /^(arm|beard|dot-frame|eyebrow|eyelash|face-|head-|leg|lips|lipstick|nose|person|torso)/, category: "Avatar & Body" },
  { pattern: /^(backpack|belt|bow-tie|butterfly-wing|clothes|dress|glasses|hat-|helmet|hoodie|jacket|mirror-standing|necklace|pants|purse|shirt|shoe|shorts|skirt|sweater|tshirt|vest|wings)/, category: "Clothing & Fashion" },
  { pattern: /^(blush|compact-makeup|cosmetic|eye-with-eyeliner|eyeshadow|makeup|mascara|nail-polish|two-makeup)/, category: "Makeup" },
  { pattern: /^(audio-wave|fast-forward|frame-record|frame-soundwave|loop|music|pause|play|record|rewind|shuffle|skip|speaker|stop-large|stop-small|stop-media|volume)/, category: "Media Controls" },
  { pattern: /^(envelope|headphones|microphone|paper-airplane|phone|speech|video-camera)/, category: "Communication" },
  { pattern: /^(four-bars-horizontal|list-bulleted|list-numbered|paragraph|quotation|text-)/, category: "Text Formatting" },
  { pattern: /^(arrow|caret-small|chevron|dual-arrows|three-chevrons|two-arrows)/, category: "Arrows & Navigation" },
  { pattern: /^(check|checkmark-square|circle-check|circle-i$|circle-minus|circle-play|circle-plus|circle-question|circle-slash|circle-three-dots|circle-x$|crop|frame-collapsed|frame-corners|frame-expanded|grid$|minus$|minus-small|nine-dots|picture-in-picture|plus-large|plus-small|sidebar|six-dots|square-check|square-minus|squares-grid|stacked-squares|three-bars|three-dots|three-horizontal|three-sliders|three-stacked|two-stacked|two-switches|x$|x-small)/, category: "UI Elements" },
  { pattern: /^(code|controller|cube-question|cube-vertex|gear|generic-dpad|hack-week|hammer-code|keyboard|lab-beaker|nexus|ro-gro|speedometer|square-bar-graph|square-code|studio|teletype)/, category: "Developer" },
  { pattern: /^(building-store|gift-|premium|roblox-plus|robux|shopping|tag-sparkle|wallet)/, category: "E-Commerce" },
];

function extractLigatures(font) {
  var ligatures = {};
  var gsub = font.tables.gsub;
  if (!gsub) return ligatures;

  for (var f = 0; f < gsub.features.length; f++) {
    if (gsub.features[f].tag !== "liga") continue;
    var lookupIndexes = gsub.features[f].feature.lookupListIndexes;
    for (var li = 0; li < lookupIndexes.length; li++) {
      var lookup = gsub.lookups[lookupIndexes[li]];
      if (!lookup) continue;
      for (var s = 0; s < lookup.subtables.length; s++) {
        var subtable = lookup.subtables[s];
        if (!subtable.ligatureSets) continue;
        for (var i = 0; i < subtable.ligatureSets.length; i++) {
          var coverageGlyphId = subtable.coverage.glyphs
            ? subtable.coverage.glyphs[i]
            : subtable.coverage.ranges
              ? getCoverageGlyphId(subtable.coverage.ranges, i)
              : null;
          if (coverageGlyphId == null) continue;
          var firstGlyph = font.glyphs.get(coverageGlyphId);
          if (!firstGlyph) continue;
          var firstChar = String.fromCharCode(firstGlyph.unicode);

          for (var j = 0; j < subtable.ligatureSets[i].length; j++) {
            var lig = subtable.ligatureSets[i][j];
            var chars = [];
            for (var k = 0; k < lig.components.length; k++) {
              var g = font.glyphs.get(lig.components[k]);
              chars.push(g ? String.fromCharCode(g.unicode) : "");
            }
            var name = firstChar + chars.join("");
            var ligGlyph = font.glyphs.get(lig.ligGlyph);
            if (ligGlyph && ligGlyph.unicode) {
              ligatures[name] = "0x" + ligGlyph.unicode.toString(16);
            }
          }
        }
      }
    }
  }
  return ligatures;
}

function getCoverageGlyphId(ranges, index) {
  var count = 0;
  for (var i = 0; i < ranges.length; i++) {
    var rangeSize = ranges[i].end - ranges[i].start + 1;
    if (index < count + rangeSize) return ranges[i].start + (index - count);
    count += rangeSize;
  }
  return null;
}

function extractCmapIcons(font) {
  var icons = {};
  for (var cp = 0xf100; cp <= 0xf400; cp++) {
    var glyph = font.charToGlyph(String.fromCodePoint(cp));
    if (glyph && glyph.index !== 0 && glyph.name) {
      icons[glyph.name] = "0x" + cp.toString(16);
    }
  }
  return icons;
}

function guessCategory(name) {
  for (var i = 0; i < PATTERNS.length; i++) {
    if (PATTERNS[i].pattern.test(name)) return PATTERNS[i].category;
  }
  return "Other";
}

var categories = {};
var activeTab = "all";
var activeVariant = "both";

var searchInput = document.getElementById("search");
var tabsEl = document.getElementById("tabs");
var variantToggle = document.getElementById("variantToggle");
var contentEl = document.getElementById("content");
var countBadge = document.getElementById("countBadge");
var toastEl = document.getElementById("toast");

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(function () { toastEl.classList.remove("show"); }, 1500);
}

function copyIconName(name) {
  navigator.clipboard.writeText(name)
    .then(function () { showToast("Copied: " + name); })
    .catch(function () {});
}

function renderTabs() {
  var totalIcons = 0;
  CATEGORY_ORDER.forEach(function (cat) {
    totalIcons += (categories[cat] || []).length;
  });

  var html = '<div class="tab active" data-cat="all">All (' + totalIcons + ')</div>';
  CATEGORY_ORDER.forEach(function (cat) {
    var count = (categories[cat] || []).length;
    if (count) {
      html += '<div class="tab" data-cat="' + cat + '">' + cat + ' (' + count + ')</div>';
    }
  });

  tabsEl.innerHTML = html;
  tabsEl.querySelectorAll(".tab").forEach(function (tab) {
    tab.onclick = function () {
      tabsEl.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      activeTab = tab.dataset.cat;
      render();
    };
  });
}

variantToggle.querySelectorAll("button").forEach(function (btn) {
  btn.onclick = function () {
    variantToggle.querySelectorAll("button").forEach(function (b) { b.classList.remove("active"); });
    btn.classList.add("active");
    activeVariant = btn.dataset.v;
    render();
  };
});

function buildIconCard(icon) {
  var hasReg = !!icon.reg;
  var hasFill = !!icon.fill;
  var regChar = hasReg ? String.fromCodePoint(parseInt(icon.reg)) : "";
  var fillChar = hasFill ? String.fromCodePoint(parseInt(icon.fill)) : "";

  var badge = "";
  if (hasReg && !hasFill) badge = '<div class="badge badge-only-reg">R</div>';
  if (!hasReg && hasFill) badge = '<div class="badge badge-only-fill">F</div>';

  var escapedName = icon.name.replace(/'/g, "\\'");
  var glyphs = "";

  if (activeVariant === "both") {
    if (hasReg && hasFill) {
      glyphs =
        '<span class="glyph-reg">' + regChar + "</span>" +
        '<div class="divider"></div>' +
        '<span class="glyph-fill">' + fillChar + "</span>";
    } else if (hasReg) {
      glyphs = '<span class="glyph-reg glyph-single">' + regChar + "</span>";
    } else {
      glyphs = '<span class="glyph-fill glyph-single">' + fillChar + "</span>";
    }
  } else if (activeVariant === "reg" && hasReg) {
    glyphs = '<span class="glyph-reg glyph-single">' + regChar + "</span>";
  } else if (activeVariant === "fill" && hasFill) {
    glyphs = '<span class="glyph-fill glyph-single">' + fillChar + "</span>";
  }

  return (
    '<div class="icon-card" onclick="copyIconName(\'' + escapedName + '\')" title="' + icon.name + '">' +
    badge +
    '<div class="glyphs">' + glyphs + "</div>" +
    '<div class="name">' + icon.name + "</div>" +
    "</div>"
  );
}

function render() {
  var query = searchInput.value.toLowerCase().trim();
  var html = "";
  var totalShown = 0;

  CATEGORY_ORDER.forEach(function (cat) {
    if (activeTab !== "all" && activeTab !== cat) return;

    var icons = categories[cat] || [];
    if (query) icons = icons.filter(function (icon) { return icon.name.includes(query); });
    if (activeVariant === "reg") icons = icons.filter(function (icon) { return icon.reg; });
    if (activeVariant === "fill") icons = icons.filter(function (icon) { return icon.fill; });
    if (!icons.length) return;

    totalShown += icons.length;

    html += '<div class="category">';
    html += '<div class="category-title">' + cat + " <span>" + icons.length + "</span></div>";
    html += '<div class="icon-grid">';
    html += icons.map(buildIconCard).join("");
    html += "</div></div>";
  });

  if (!html) {
    html = '<div style="text-align:center; padding:60px 24px; color:#6b7280;">No results found</div>';
  }

  contentEl.innerHTML = html;
  countBadge.textContent = totalShown + " icons shown";
}

async function init() {
  try {
    var responses = await Promise.all([
      fetch(FONT_URLS.reg),
      fetch(FONT_URLS.fill),
    ]);

    if (!responses[0].ok || !responses[1].ok) throw new Error("Font download failed");

    var buffers = await Promise.all([
      responses[0].arrayBuffer(),
      responses[1].arrayBuffer(),
    ]);

    var regFont = opentype.parse(buffers[0]);
    var fillFont = opentype.parse(buffers[1]);

    var regIcons = Object.assign({}, extractCmapIcons(regFont), extractLigatures(regFont));
    var fillIcons = Object.assign({}, extractCmapIcons(fillFont), extractLigatures(fillFont));

    var allNames = new Set([
      ...Object.keys(regIcons),
      ...Object.keys(fillIcons),
    ]);

    var categorized = {};
    CATEGORY_ORDER.forEach(function (cat) { categorized[cat] = []; });

    Array.from(allNames).sort().forEach(function (name) {
      var icon = { name: name };
      if (regIcons[name]) icon.reg = regIcons[name];
      if (fillIcons[name]) icon.fill = fillIcons[name];

      var category = guessCategory(name);
      if (!categorized[category]) categorized[category] = [];
      categorized[category].push(icon);
    });

    categories = categorized;

    var both = 0, regOnly = 0, fillOnly = 0;
    allNames.forEach(function (name) {
      var hasReg = !!regIcons[name];
      var hasFill = !!fillIcons[name];
      if (hasReg && hasFill) both++;
      else if (hasReg) regOnly++;
      else fillOnly++;
    });

    document.getElementById("stats").innerHTML =
      '<div class="stat">' + allNames.size + ' total icons</div>' +
      '<div class="stat">' + both + ' in both variants</div>' +
      '<div class="stat">' + regOnly + ' Regular only</div>' +
      '<div class="stat">' + fillOnly + ' Filled only</div>';

    renderTabs();
    render();
    searchInput.addEventListener("input", render);

  } catch (err) {
    contentEl.innerHTML =
      '<div style="text-align:center; padding:80px 24px;">' +
      '<div style="color:#ef4444; font-size:18px; margin-bottom:8px;">Failed to load icons</div>' +
      '<div style="color:#6b7280; font-size:13px;">' + err.message + '</div>' +
      '<div style="color:#6b7280; font-size:13px; margin-top:8px;">Try refreshing the page</div>' +
      '</div>';
  }
}

init();
