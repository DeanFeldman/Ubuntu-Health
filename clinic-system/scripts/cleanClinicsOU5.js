const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const inputPath = path.join(__dirname, "..", "data", "raw", "vwOrgunitStructureOU5.csv");
const outputDir = path.join(__dirname, "..", "data", "clean");
const outputPath = path.join(outputDir, "clinics.cleaned.json");

const ALLOWED_TYPES = new Set([
  "Clinic",
  "Satellite Clinic",
  "Specialised Clinic",
  "Community Health Centre",
  "WC Community Health Centre",
  "WC Community Health Centre / Clinic",
  "WC Pharmacy/Clinic",
  "WC Special Clinic",
  "WC Midwife Obstetrics Unit",
  "Community Day Centre",
  "Health Post",
  "Mobile Service",
  "District Hospital",
  "Regional Hospital",
  "Provincial Tertiary Hospital",
  "National Central Hospital",
  "Military Hospital",
  "Private Hospital",
  "Specialised Hospital Other",
  "Specialised Psychiatric Hospital",
  "Specialised TB Hospital"
]);

function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function stripPrefix(value) {
  const text = normalizeText(value);
  if (!text) return null;
  return text.replace(/^[a-z]{2}\s+/i, "").trim();
}

function normalizeNumber(value) {
  const text = normalizeText(value);
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function normalizeFacilityType(type) {
  const text = normalizeText(type);
  if (!text) return null;

  if (text.includes("Hospital")) return "Hospital";
  if (
    text === "Community Health Centre" ||
    text === "WC Community Health Centre" ||
    text === "WC Community Health Centre / Clinic"
  ) {
    return "Community Health Centre";
  }
  if (text === "Community Day Centre") return "Community Day Centre";
  if (text === "Health Post") return "Health Post";
  if (text === "Mobile Service") return "Mobile Service";
  if (
    text === "Clinic" ||
    text === "Satellite Clinic" ||
    text === "Specialised Clinic" ||
    text === "WC Special Clinic" ||
    text === "WC Pharmacy/Clinic" ||
    text === "WC Midwife Obstetrics Unit"
  ) {
    return "Clinic";
  }

  return text;
}

const seen = new Set();
const clinics = [];

fs.mkdirSync(outputDir, { recursive: true });

fs.createReadStream(inputPath)
  .pipe(csv())
  .on("data", (row) => {
    const orgUnitType = normalizeText(row.OrgUnitType);
    if (!orgUnitType || !ALLOWED_TYPES.has(orgUnitType)) return;

    const facilityId = normalizeText(row.OU5uid);
    const name = stripPrefix(row.OU5name) || normalizeText(row.OU5short);

    if (!facilityId || !name || seen.has(facilityId)) return;
    seen.add(facilityId);

    clinics.push({
      name,
      address: normalizeText(row.address),
      province: normalizeText(row.OU2short) || stripPrefix(row.OU2name),
      district: stripPrefix(row.OU3name) || normalizeText(row.OU3short),
      municipality: stripPrefix(row.OU4name) || normalizeText(row.OU4short),
      facility_type: normalizeFacilityType(orgUnitType),
      services: [],
      latitude: normalizeNumber(row.latitude),
      longitude: normalizeNumber(row.longitude),
      operating_hours: null
    });
  })
  .on("end", () => {
    clinics.sort((a, b) => a.name.localeCompare(b.name));
    fs.writeFileSync(outputPath, JSON.stringify(clinics, null, 2), "utf-8");
    console.log(`Cleaned ${clinics.length} clinics to ${outputPath}`);
  })
  .on("error", (err) => {
    console.error("Failed to clean OU5 dataset:", err);
    process.exit(1);
  });