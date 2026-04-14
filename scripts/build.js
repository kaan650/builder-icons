const fs = require("fs");
const path = require("path");
const https = require("https");
const opentype = require("opentype.js");

const ROOT = path.resolve(__dirname, "..");
const FONTS_DIR = path.join(ROOT, "fonts");
const CATEGORIES_FILE = path.join(__dirname, "categories.json");
const APP_JS = path.join(ROOT, "js", "app.js");

const FONT_BASE_URL =
  "https://raw.githubusercontent.com/MaximumADHD/Roblox-Client-Tracker/refs/heads/roblox/LuaPackages/Packages/_Index/BuilderIcons/BuilderIcons/Font";

const FONT_URLS = {
  reg: `${FONT_BASE_URL}/BuilderIcons-Regular.ttf`,
  fill: `${FONT_BASE_URL}/BuilderIcons-Filled.ttf`,
};

const FONT_FILES = {
  reg: path.join(FONTS_DIR, "BuilderIcons-Regular.ttf"),
  fill: path.join(FONTS_DIR, "BuilderIcons-Filled.ttf"),
};

const CATEGORY_ORDER = [
  "Social Media",
  "PlayStation",
  "Xbox",
  "Avatar & Body",
  "Clothing & Fashion",
  "Makeup",
  "Media Controls",
  "Communication",
  "Text Formatting",
  "UI Elements",
  "Developer",
  "E-Commerce",
  "Arrows & Navigation",
  "Other",
];

const PATTERNS = [
  { pattern: /^(amazon|android|apple|discord|facebook|figma|github|guilded|instagram|linkedin|messenger|meta|microsoft|slack|tencent|tik-tok|twitch|twitter|we-chat|whatsapp|youtube)/, category: "Social Media" },
  { pattern: /^playstation|^ps[0-9-]|^ps-/, category: "PlayStation" },
  { pattern: /^xbox/, category: "Xbox" },
  { pattern: /^(arm-|beard|dot-frame|eyebrow|eyelash|face-|head-|leg|lips|lipstick|nose|person|torso)/, category: "Avatar & Body" },
  { pattern: /^(backpack|belt|bow-tie|butterfly-wing|clothes|dress|glasses|hat-|helmet|hoodie|jacket|pants|shirt|shoe|shorts|skirt|sweater|tshirt|vest|wings)/, category: "Clothing & Fashion" },
  { pattern: /^(blush|cosmetic|eyeshadow|makeup|nail-polish)/, category: "Makeup" },
  { pattern: /^(fast-forward|loop|microphone|music|pause|play|record|rewind|shuffle|skip|speaker|stop-media|volume)/, category: "Media Controls" },
  { pattern: /^(at-sign|bell|bookmark|chat|comment|envelope|inbox|mail|megaphone|message|notification|phone|speech)/, category: "Communication" },
  { pattern: /^(align-|bold|font|heading|indent|italic|line-spacing|list-|paragraph|strikethrough|subscript|superscript|text-|underline)/, category: "Text Formatting" },
  { pattern: /^(arrow|chevron|corner|direction)/, category: "Arrows & Navigation" },
  { pattern: /^(api|bug|code|command|console|database|deploy|git|terminal|variable|webhook)/, category: "Developer" },
  { pattern: /^(cart|coin|credit-card|currency|dollar|money|payment|price|receipt|shop|store|wallet)/, category: "E-Commerce" },
];

function download(url) {
  return new Promise((resolve, reject) => {
    const follow = (u) => {
      https.get(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${u}`));
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      }).on("error", reject);
    };
    follow(url);
  });
}

function extractLigatures(font) {
  const ligatures = {};
  const gsub = font.tables.gsub;
  if (!gsub) return ligatures;

  for (const feature of gsub.features) {
    if (feature.tag !== "liga") continue;
    for (const li of feature.feature.lookupListIndexes) {
      const lookup = gsub.lookups[li];
      if (!lookup) continue;
      for (const subtable of lookup.subtables) {
        if (!subtable.ligatureSets) continue;
        for (let i = 0; i < subtable.ligatureSets.length; i++) {
          const coverageGlyphId = subtable.coverage.glyphs
            ? subtable.coverage.glyphs[i]
            : subtable.coverage.ranges
              ? getCoverageGlyphId(subtable.coverage.ranges, i)
              : null;
          if (coverageGlyphId == null) continue;
          const firstGlyph = font.glyphs.get(coverageGlyphId);
          if (!firstGlyph) continue;
          const firstChar = String.fromCharCode(firstGlyph.unicode);

          for (const lig of subtable.ligatureSets[i]) {
            const componentChars = lig.components.map((gid) => {
              const g = font.glyphs.get(gid);
              return g ? String.fromCharCode(g.unicode) : "";
            });
            const name = firstChar + componentChars.join("");
            const ligGlyph = font.glyphs.get(lig.ligGlyph);
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
  let count = 0;
  for (const range of ranges) {
    const rangeSize = range.end - range.start + 1;
    if (index < count + rangeSize) {
      return range.start + (index - count);
    }
    count += rangeSize;
  }
  return null;
}

function guessCategory(name) {
  for (const { pattern, category } of PATTERNS) {
    if (pattern.test(name)) return category;
  }
  return "Other";
}

async function main() {
  console.log("Downloading fonts...");
  const [regBuf, fillBuf] = await Promise.all([
    download(FONT_URLS.reg),
    download(FONT_URLS.fill),
  ]);

  fs.writeFileSync(FONT_FILES.reg, regBuf);
  fs.writeFileSync(FONT_FILES.fill, fillBuf);
  console.log("Fonts saved.");

  console.log("Parsing fonts...");
  const regFont = opentype.parse(regBuf.buffer);
  const fillFont = opentype.parse(fillBuf.buffer);

  const regLigatures = extractLigatures(regFont);
  const fillLigatures = extractLigatures(fillFont);

  console.log(`Regular: ${Object.keys(regLigatures).length} ligatures`);
  console.log(`Filled: ${Object.keys(fillLigatures).length} ligatures`);

  const allNames = new Set([
    ...Object.keys(regLigatures),
    ...Object.keys(fillLigatures),
  ]);

  const knownCategories = JSON.parse(fs.readFileSync(CATEGORIES_FILE, "utf-8"));

  const categorized = {};
  for (const cat of CATEGORY_ORDER) {
    categorized[cat] = [];
  }

  let newIcons = 0;

  for (const name of [...allNames].sort()) {
    const icon = { name };
    if (regLigatures[name]) icon.reg = regLigatures[name];
    if (fillLigatures[name]) icon.fill = fillLigatures[name];

    let category;
    if (knownCategories[name]) {
      category = knownCategories[name];
    } else {
      category = guessCategory(name);
      knownCategories[name] = category;
      newIcons++;
      console.log(`  New icon: "${name}" -> ${category}`);
    }

    if (!categorized[category]) {
      categorized[category] = [];
    }
    categorized[category].push(icon);
  }

  fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(knownCategories, null, 2), "utf-8");

  const stats = {
    total: allNames.size,
    both: 0,
    regOnly: 0,
    fillOnly: 0,
  };
  for (const name of allNames) {
    const hasReg = !!regLigatures[name];
    const hasFill = !!fillLigatures[name];
    if (hasReg && hasFill) stats.both++;
    else if (hasReg) stats.regOnly++;
    else stats.fillOnly++;
  }

  console.log(`\nStats: ${stats.total} total, ${stats.both} both, ${stats.regOnly} reg-only, ${stats.fillOnly} fill-only`);
  if (newIcons) console.log(`${newIcons} new icon(s) added.`);

  const catJSON = JSON.stringify(categorized);
  const orderJSON = JSON.stringify(CATEGORY_ORDER);

  const appJS = `const categories = ${catJSON};

const categoryOrder = ${orderJSON};

let activeTab = "all";
let activeVariant = "both";

const searchInput = document.getElementById("search");
const tabsEl = document.getElementById("tabs");
const variantToggle = document.getElementById("variantToggle");
const contentEl = document.getElementById("content");
const countBadge = document.getElementById("countBadge");
const toastEl = document.getElementById("toast");

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 1500);
}

function copyIconName(name) {
  navigator.clipboard.writeText(name)
    .then(() => showToast("Copied: " + name))
    .catch(() => {});
}

function renderTabs() {
  let totalIcons = 0;

  categoryOrder.forEach((cat) => {
    totalIcons += (categories[cat] || []).length;
  });

  let html = '<div class="tab active" data-cat="all">All (' + totalIcons + ')</div>';

  categoryOrder.forEach((cat) => {
    const count = (categories[cat] || []).length;
    if (count) {
      html += '<div class="tab" data-cat="' + cat + '">' + cat + ' (' + count + ')</div>';
    }
  });

  tabsEl.innerHTML = html;

  tabsEl.querySelectorAll(".tab").forEach((tab) => {
    tab.onclick = () => {
      tabsEl.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      activeTab = tab.dataset.cat;
      render();
    };
  });
}

variantToggle.querySelectorAll("button").forEach((btn) => {
  btn.onclick = () => {
    variantToggle.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeVariant = btn.dataset.v;
    render();
  };
});

function buildIconCard(icon) {
  const hasReg = !!icon.reg;
  const hasFill = !!icon.fill;
  const regChar = hasReg ? String.fromCodePoint(parseInt(icon.reg)) : "";
  const fillChar = hasFill ? String.fromCodePoint(parseInt(icon.fill)) : "";

  let badge = "";
  if (hasReg && !hasFill) badge = '<div class="badge badge-only-reg">R</div>';
  if (!hasReg && hasFill) badge = '<div class="badge badge-only-fill">F</div>';

  const escapedName = icon.name.replace(/'/g, "\\\\'");
  let glyphs = "";

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
    '<div class="icon-card" onclick="copyIconName(\\'' + escapedName + '\\')" title="' + icon.name + '">' +
    badge +
    '<div class="glyphs">' + glyphs + "</div>" +
    '<div class="name">' + icon.name + "</div>" +
    "</div>"
  );
}

function render() {
  const query = searchInput.value.toLowerCase().trim();
  let html = "";
  let totalShown = 0;

  categoryOrder.forEach((cat) => {
    if (activeTab !== "all" && activeTab !== cat) return;

    let icons = categories[cat] || [];
    if (query) icons = icons.filter((icon) => icon.name.includes(query));
    if (activeVariant === "reg") icons = icons.filter((icon) => icon.reg);
    if (activeVariant === "fill") icons = icons.filter((icon) => icon.fill);
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

renderTabs();
render();
searchInput.addEventListener("input", render);
`;

  fs.writeFileSync(APP_JS, appJS, "utf-8");
  console.log("js/app.js updated.");

  const indexPath = path.join(ROOT, "index.html");
  let indexHTML = fs.readFileSync(indexPath, "utf-8");
  indexHTML = indexHTML.replace(/\d+ total icons/, stats.total + " total icons");
  indexHTML = indexHTML.replace(/\d+ in both variants/, stats.both + " in both variants");
  indexHTML = indexHTML.replace(/\d+ Regular only/, stats.regOnly + " Regular only");
  indexHTML = indexHTML.replace(/\d+ Filled only/, stats.fillOnly + " Filled only");
  indexHTML = indexHTML.replace(/\d+ ligatures/, Object.keys(regLigatures).length + " ligatures");
  fs.writeFileSync(indexPath, indexHTML, "utf-8");
  console.log("index.html stats updated.");

  console.log("\nDone!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
