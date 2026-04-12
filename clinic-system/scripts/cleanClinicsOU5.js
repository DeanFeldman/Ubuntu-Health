const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

const inputPath = path.join(__dirname, "..", "data", "raw", "vwOrgunitStructureOU5.csv");
const outputDir = path.join(__dirname, "..", "data", "clean");
const outputPath = path.join(outputDir, "clinics.cleaned.json");

// ✅ Allowed categories (NO hospitals)
const CATEGORY_MAP = {
  "Clinic": "Clinic",
  "Satellite Clinic": "Satellite Clinic",
  "Specialised Clinic": "Specialised Clinic",

  "Community Health Centre": "Community Health Centre",
  "WC Community Health Centre": "Community Health Centre",
  "WC Community Health Centre / Clinic": "Community Health Centre",

  "Community Day Centre": "Community Day Centre",

  "Health Post": "Health Post",

  "Mobile Service": "Mobile Service",

  "WC Special Clinic": "Specialised Clinic",
  "WC Pharmacy/Clinic": "Clinic",
  "WC Midwife Obstetrics Unit": "Clinic"
};


function mapServices(category) {
  switch (category) {

    case "Clinic":
      return [
        "General Consultation",
        "Vaccination",
        "Maternal Care",
        "HIV Testing",
        "TB Treatment",
        "Chronic Care"
      ];

    case "Satellite Clinic":
      return [
        "General Consultation",
        "Vaccination",
        "Basic Screening",
        "Referrals"
      ];

    case "Specialised Clinic":
      return [
        "Specialist Consultation",
        "Chronic Disease Management",
        "Diagnostics",
        "Follow-up Care"
      ];

    case "Community Health Centre":
      return [
        "Emergency Care",
        "Maternity Services",
        "Pharmacy",
        "Minor Procedures",
        "Chronic Care",
        "Diagnostics"
      ];

    case "Community Day Centre":
      return [
        "Outpatient Care",
        "Chronic Disease Management",
        "Minor Procedures",
        "Follow-up Care"
      ];

    case "Health Post":
      return [
        "Basic Care",
        "First Aid",
        "Screening",
        "Referrals"
      ];

    case "Mobile Service":
      return [
        "Outreach",
        "Vaccination",
        "Screening",
        "Health Education"
      ];

    default:
      return [];
  }
}

function normalizeText(value) {
  if (!value) return null;
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

const seen = new Set();
const clinics = [];

fs.mkdirSync(outputDir, { recursive: true });

fs.createReadStream(inputPath)
  .pipe(csv())
  .on("data", (row) => {
    const rawType = normalizeText(row.OrgUnitType);

   
    if (!rawType || !CATEGORY_MAP[rawType]) return;

    const category = CATEGORY_MAP[rawType];

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

    
      facility_type: category,

    
      raw_facility_type: rawType,

      services: mapServices(category),

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