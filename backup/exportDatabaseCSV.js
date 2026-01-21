import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";
import csv from "fast-csv";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const DATABASE_NAME = process.env.DATABASE_NAME;
const BACKUP_DIR = path.join(process.cwd(), "exports", DATABASE_NAME);

export async function exportDatabaseToCSV() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DATABASE_NAME);

  const collections = await db.listCollections().toArray();
  const today = new Date().toISOString().split("T")[0];
  const todayDir = path.join(BACKUP_DIR, today);

  fs.mkdirSync(todayDir, { recursive: true });

  for (const col of collections) {
    const collectionName = col.name;
    const filePath = path.join(todayDir, `${collectionName}.csv`);
    const writeStream = fs.createWriteStream(filePath);
    const csvStream = csv.format({ headers: true });
    csvStream.pipe(writeStream);

    const cursor = db.collection(collectionName).find({}).batchSize(1000);
    for await (const doc of cursor) {
      csvStream.write({ ...doc, _id: doc._id.toString() });
    }

    csvStream.end();
    console.log(`✅ Exported ${collectionName}.csv`);
  }

  await client.close();
  console.log("🎉 Daily CSV export completed");

  // Delete backups older than 7 days
  deleteOldBackups(7);
}

// Delete backups older than N days
function deleteOldBackups(days = 7) {
  if (!fs.existsSync(BACKUP_DIR)) return;

  const folders = fs.readdirSync(BACKUP_DIR);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  folders.forEach((folder) => {
    const folderPath = path.join(BACKUP_DIR, folder);
    const folderDate = new Date(folder);
    if (isNaN(folderDate.getTime())) return; 
    if (folderDate < cutoff) {
      fs.rmSync(folderPath, { recursive: true, force: true });
      console.log(`🗑 Deleted old backup: ${folder}`);
    }
  });
}
