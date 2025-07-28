
import 'dotenv/config';
import { getDb } from '../src/lib/db.js';

/**
 * =================================================================
 * DATABASE SEEDING SCRIPT
 * =================================================================
 *
 * This script initializes the database with essential data, such as
 * the main site and the super admin user.
 *
 * It is designed to be run once to set up a new database instance.
 *
 * ---
 *
 * To run this script:
 * 1. Ensure your .env file is correctly configured with your
 *    database credentials (DB_HOST, DB_USER, etc.).
 * 2. From your terminal, run the command:
 *    npm run db:seed
 *
 * ---
 *
 * What it does:
 * 1. Connects to the database specified in your .env file.
 * 2. Inserts the 'main' site, which is required for the super admin.
 * 3. Inserts the super admin user with the username 'Florante Catapang'
 *    and password 'Handsome_16'.
 *
 * If the 'main' site or the admin user already exist, the script
 * will skip creating them to avoid errors on subsequent runs.
 *
 */
async function seedDatabase() {
  let db;
  try {
    console.log('Connecting to the database...');
    db = await getDb();
    console.log('Database connection successful.');

    // 1. Check for and create the 'main' site if it doesn't exist
    const [mainSiteRows] = await db.query("SELECT * FROM sites WHERE id = 'main'");
    if (mainSiteRows.length === 0) {
      console.log("'main' site not found. Creating it...");
      await db.query("INSERT INTO sites (id, name) VALUES ('main', 'Skills Ascend HQ')");
      console.log("'main' site created successfully.");
    } else {
      console.log("'main' site already exists. Skipping creation.");
    }

    // 2. Check for and create the super admin user if it doesn't exist
    const [adminUserRows] = await db.query("SELECT * FROM users WHERE username = ?", ['Florante Catapang']);
    if (adminUserRows.length === 0) {
      console.log('Super admin user not found. Creating it...');
      const adminUserData = {
        username: 'Florante Catapang',
        password: 'Handsome_16',
        site_id: 'main',
        fullName: 'Florante M. Catapang', // Full name for certificates
        role: 'Admin', // The role for permissions
        type: 'Admin', // The user type
      };
      await db.query(
        'INSERT INTO users (username, password, site_id, fullName, role, type) VALUES (?, ?, ?, ?, ?, ?)',
        [adminUserData.username, adminUserData.password, adminUserData.site_id, adminUserData.fullName, adminUserData.role, adminUserData.type]
      );
      console.log('Super admin user "Florante Catapang" created successfully.');
    } else {
      console.log('Super admin user "Florante Catapang" already exists. Skipping creation.');
    }

    console.log('Database seeding completed successfully!');
  } catch (error) {
    console.error('An error occurred during database seeding:', error);
    process.exit(1);
  } finally {
    if (db) {
      console.log('Closing database connection...');
      await db.end();
    }
  }
}

seedDatabase();

