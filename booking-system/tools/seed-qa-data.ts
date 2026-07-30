import mongoose from "mongoose";
import { connectDatabase, stopMemoryDatabase } from "../server/src/db.js";
import { seedQaData } from "../server/src/qaSeed.js";

try {
  await connectDatabase();
  const result = await seedQaData({ source: "script" });

  console.log(JSON.stringify({ status: "seeded", ...result }, null, 2));
} finally {
  await mongoose.disconnect();
  await stopMemoryDatabase();
}
