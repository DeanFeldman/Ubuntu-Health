require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const inputPath = path.join(__dirname, "..", "data", "clean", "clinics.cleaned.json");

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function seedClinics() {
  const clinics = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
  console.log(`Loaded ${clinics.length} cleaned clinics from file`);

  const { error: deleteError } = await supabase
    .from("clinics")
    .delete()
    .not("id", "is", null);

  if (deleteError) {
    console.error("Failed to clear clinics table:", deleteError);
    process.exit(1);
  }

  console.log("Cleared existing clinics rows");

  const batchSize = 500;

  for (let i = 0; i < clinics.length; i += batchSize) {
    const batch = clinics.slice(i, i + batchSize);

    const { error } = await supabase.from("clinics").insert(batch);

    if (error) {
      console.error(`Failed inserting batch starting at ${i}:`, error);
      process.exit(1);
    }

    console.log(`Inserted ${Math.min(i + batchSize, clinics.length)} / ${clinics.length}`);
  }

  console.log("Clinic seed complete");
}

seedClinics().catch((err) => {
  console.error("Unexpected seed error:", err);
  process.exit(1);
});