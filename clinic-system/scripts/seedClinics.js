require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const inputPath = path.join(
  __dirname,
  "..",
  "data",
  "clean",
  "clinics.cleaned.json",
);

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function retry(fn, attempts = 4, delayMs = 2000) {
  let lastError;

  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.warn(`Attempt ${i}/${attempts} failed: ${err.message || err}`);
      if (i < attempts) {
        await sleep(delayMs * i);
      }
    }
  }

  throw lastError;
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    global: {
      fetch: (url, options) => fetchWithTimeout(url, options, 30000),
    },
  },
);

async function seedClinics() {
  const rawClinics = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
  const clinics = rawClinics.map(({ raw_facility_type, ...rest }) => rest);
  console.log(`Loaded ${clinics.length} cleaned clinics from file`);

  await retry(async () => {
    const result = await supabase
      .from("clinics")
      .delete()
      .not("id", "is", null);

    if (result.error) {
      throw new Error(JSON.stringify(result.error));
    }

    return result;
  });

  console.log("Cleared existing clinics rows");

  const batchSize = 500;

  for (let i = 0; i < clinics.length; i += batchSize) {
    const batch = clinics.slice(i, i + batchSize);

    await retry(async () => {
      const result = await supabase.from("clinics").insert(batch);

      if (result.error) {
        throw new Error(JSON.stringify(result.error));
      }

      return result;
    });

    console.log(
      `Inserted ${Math.min(i + batchSize, clinics.length)} / ${clinics.length}`,
    );
  }

  console.log("Clinic seed complete");
}

seedClinics().catch((err) => {
  console.error("Unexpected seed error:", err);
  process.exit(1);
});
