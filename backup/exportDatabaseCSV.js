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

export const SaveBackup = async (req, res) => {
  const allowedIP = "152.59.49.216"; 

  let clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  if (clientIP.includes(',')) clientIP = clientIP.split(',')[0].trim();
  if (clientIP.startsWith('::ffff:')) clientIP = clientIP.replace('::ffff:', '');

  if (clientIP !== allowedIP) {
    return res.status(403).send("❌ Forbidden: Your IP is not allowed");
  }

  const { date, collection } = req.params;

  const filePath = path.join(
    process.cwd(),
    "exports",
    process.env.DATABASE_NAME,
    date,
    `${collection}.json`
  );

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Backup not found");
  }

  res.download(filePath);
};

