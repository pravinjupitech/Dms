import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DATABASE_NAME;
const BACKUP_DIR = path.join(process.cwd(), "exports", DB_NAME);

export async function exportDatabase() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  const today = new Date().toISOString().split("T")[0];
  const todayDir = path.join(BACKUP_DIR, today);
  fs.mkdirSync(todayDir, { recursive: true });

  const collections = await db.listCollections().toArray();

  for (const col of collections) {
    const data = await db.collection(col.name).find({}).toArray();

    fs.writeFileSync(
      path.join(todayDir, `${col.name}.json`),
      JSON.stringify(data)
    );

    console.log(`✅ Backed up ${col.name}`);
  }

  await client.close();
  console.log("🎉 Atlas Free DB backup completed");

  deleteOldBackups(7);
}
