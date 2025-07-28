
// scripts/seed-db.mjs
import 'dotenv/config';
import mysql from 'mysql2/promise';

/**
 * ==========================================================================================
 * DATABASE SEED SCRIPT
 * ==========================================================================================
 *
 * Description:
 * This script initializes the database with essential data for the application to function correctly.
 * It creates the 'main' site required for the Super Admin and an 'external' site for public users.
 * It also creates the default Super Admin user.
 *
 * How to Run:
 * 1. Make sure your .env file has the correct database credentials (DB_HOST, DB_USER, etc.).
 * 2. Open your terminal in the project's root directory.
 * 3. Run the command: `npm run db:seed`
 *
 * IMPORTANT:
 * This script is designed to be run only ONCE on a fresh database.
 * Running it again will cause errors because it tries to insert data with IDs that already exist.
 *
 * =================================com=========================================================
 */

async function main() {
    // --- Database Connection ---
    const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DB_PORT'];
    for (const varName of requiredEnv) {
        if (!process.env[varName]) {
            console.error(`❌ Missing required environment variable for database connection: ${varName}`);
            process.exit(1);
        }
    }

    const dbConfig = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: parseInt(process.env.DB_PORT || '3306', 10),
    };
    
    let connection;
    try {
        console.log('Connecting to database...');
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connection successful.');

        await connection.beginTransaction();
        console.log('🚀 Starting database seed...');

        // --- 1. Create Core Sites ---
        console.log("Inserting core 'main' and 'external' sites...");
        const sites = [
            { id: 'main', name: 'QAEHS Pro Academy' },
            { id: 'external', name: 'External Users' },
        ];
        for (const site of sites) {
            try {
                await connection.execute(
                    'INSERT INTO sites (id, name) VALUES (?, ?)',
                    [site.id, site.name]
                );
                console.log(`   - Site '${site.name}' created.`);
            } catch (error) {
                if (error.code === 'ER_DUP_ENTRY') {
                    console.warn(`   - Site '${site.name}' already exists. Skipping.`);
                } else {
                    throw error;
                }
            }
        }
        
        // --- 2. Create Super Admin User ---
        console.log("Inserting Super Admin user...");
        const superAdmin = {
            id: 1, // Fixed ID for the first user
            username: 'florante',
            password: 'password', // IMPORTANT: Change this in the app after first login!
            site_id: 'main',
            fullName: 'Florante M. Catapang',
            role: 'Admin', // Must be 'Admin'
            type: 'Employee',  // Must be 'Employee' or 'External'
        };
        
        try {
            await connection.execute(
                `INSERT INTO users (id, username, password, site_id, fullName, role, type) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    superAdmin.id,
                    superAdmin.username,
                    superAdmin.password,
                    superAdmin.site_id,
                    superAdmin.fullName,
                    superAdmin.role,
                    superAdmin.type
                ]
            );
            console.log(`   - Super Admin user '${superAdmin.username}' created.`);
        } catch (error) {
             if (error.code === 'ER_DUP_ENTRY') {
                console.warn(`   - Super Admin user '${superAdmin.username}' already exists. Skipping.`);
            } else {
                throw error;
            }
        }

        await connection.commit();
        console.log('✅ Database seeding completed successfully!');

    } catch (error) {
        console.error('\n❌ An error occurred during seeding:', error.message);
        if (connection) {
            console.log('Attempting to rollback transaction...');
            await connection.rollback();
            console.log('Transaction rolled back.');
        }
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

main();
