// Wipes logged contacts and rebuilds the original synthetic data, dated around today.
// Run between recording takes so every take starts from the same state.

import { defaultDatabasePath, openDatabase } from '../src/data/database.js';
import { seedDatabase } from '../src/data/seed.js';

const databasePath = defaultDatabasePath();
const db = openDatabase(databasePath);
seedDatabase(db, new Date());
db.close();
console.log(`Reset complete: ${databasePath} now holds fresh synthetic data.`);
