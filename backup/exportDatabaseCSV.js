import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DATABASE_NAME;
const BACKUP_DIR = path.join(process.cwd(), "exports", DB_NAME);

function deleteOldBackups(daysToKeep = 7) {
  if (!fs.existsSync(BACKUP_DIR)) return;

  const folders = fs.readdirSync(BACKUP_DIR)
    .map(folder => ({
      name: folder,
      path: path.join(BACKUP_DIR, folder),
      time: new Date(folder).getTime()
    }))
    .filter(f => !isNaN(f.time))
    .sort((a, b) => a.time - b.time);

  const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

  for (const folder of folders) {
    if (folder.time < cutoff) {
      fs.rmSync(folder.path, { recursive: true, force: true });
      console.log(`🗑️ Deleted old backup: ${folder.name}`);
    }
  }
}

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

  const backupDir = path.join(process.cwd(), "exports", process.env.DATABASE_NAME);

  if (!fs.existsSync(backupDir)) {
    return res.status(404).send("No backups found");
  }

  const folders = fs.readdirSync(backupDir)
    .filter(f => fs.statSync(path.join(backupDir, f)).isDirectory())
    .sort((a, b) => new Date(b) - new Date(a)); 

  if (!folders.length) {
    return res.status(404).send("No backup folders found");
  }

  const latestFolder = folders[0];
  const latestFolderPath = path.join(backupDir, latestFolder);

  const files = fs.readdirSync(latestFolderPath).filter(f => f.endsWith(".json"));

  if (!files.length) {
    return res.status(404).send("No backup files found");
  }

  const filePath = path.join(latestFolderPath, files[0]);


  res.download(filePath);
};

