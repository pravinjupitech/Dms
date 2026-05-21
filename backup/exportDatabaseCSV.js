import fs from "fs";
import path from "path";
import cron from "node-cron";
import { MongoClient } from "mongodb";

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DATABASE_NAME;
const BACKUP_DIR = path.join(process.cwd(), "exports", DB_NAME);

export async function exportDatabase() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    const now = new Date();
    const date = now.toISOString().split("T")[0];
    const time = now.toTimeString().split(" ")[0].replace(/:/g, "-");
    const folderName = `${date}_${time}`;

    const backupPath = path.join(BACKUP_DIR, folderName);
    fs.mkdirSync(backupPath, { recursive: true });

    const collections = await db.listCollections().toArray();

    for (const col of collections) {
      const data = await db.collection(col.name).find({}).toArray();

      fs.writeFileSync(
        path.join(backupPath, `${col.name}.json`),
        JSON.stringify(data, null, 2)
      );

      console.log(` Backed up ${col.name}`);
    }

    console.log(` Backup completed at ${folderName}`);

    deleteOldBackups(30);

  } catch (err) {
    console.error(" Backup failed:", err);
  } finally {
    await client.close();
  }
}

function deleteOldBackups(days = 30) {
  if (!fs.existsSync(BACKUP_DIR)) return;

  const now = Date.now();

  fs.readdirSync(BACKUP_DIR).forEach(folder => {
    const folderPath = path.join(BACKUP_DIR, folder);

    if (fs.statSync(folderPath).isDirectory()) {
      const folderTime = new Date(folder.split("_")[0]).getTime();

      if (now - folderTime > days * 24 * 60 * 60 * 1000) {
        fs.rmSync(folderPath, { recursive: true, force: true });
        console.log(` Deleted old backup: ${folder}`);
      }
    }
  });
}

export const SaveBackup = (req, res) => {
  const allowedIP = "152.59.49.216";

  let clientIP =
    req.headers["x-forwarded-for"] ||
    req.socket.remoteAddress ||
    "";

  if (clientIP.includes(",")) clientIP = clientIP.split(",")[0].trim();
  if (clientIP.startsWith("::ffff:")) clientIP = clientIP.replace("::ffff:", "");

  if (clientIP !== allowedIP) {
    return res.status(403).send("❌ Forbidden: Your IP is not allowed");
  }

  if (!fs.existsSync(BACKUP_DIR)) {
    return res.status(404).send("No backups found");
  }

  const folders = fs
    .readdirSync(BACKUP_DIR)
    .filter(f => fs.statSync(path.join(BACKUP_DIR, f)).isDirectory())
    .sort((a, b) => new Date(b) - new Date(a));

  if (!folders.length) {
    return res.status(404).send("No backup folders found");
  }

  const latestFolderPath = path.join(BACKUP_DIR, folders[0]);

 
  const files = fs
    .readdirSync(latestFolderPath)
    .filter(f => f.endsWith(".json"));

  if (!files.length) {
    return res.status(404).send("No backup files found");
  }

  const filePath = path.join(latestFolderPath, files[0]);

  return res.download(filePath);
};

