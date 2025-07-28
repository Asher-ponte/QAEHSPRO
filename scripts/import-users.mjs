
#!/usr/bin/env node

/**
 * =================================================================
 * User Data Import Script
 * =================================================================
 * 
 * Description:
 * This script reads user data from a CSV file and generates SQL INSERT statements
 * to import these users into a specific branch (site) in your database.
 * 
 * ---
 * 
 * CSV File Format:
 * Your CSV file MUST have a header row with the following column names in any order:
 * `fullName`, `username`, `password`, `department`, `position`, `email`, `phone`
 * 
 * Example `users.csv`:
 * ```csv
 * fullName,username,password,department,position,email,phone
 * John Doe,johndoe,password123,Sales,Manager,john.d@example.com,1234567890
 * Jane Smith,janesmith,securepass,Engineering,Developer,jane.s@example.com,0987654321
 * ```
 * 
 * ---
 * 
 * How to Run:
 * 1. Prepare your user data in a CSV file (e.g., `users.csv`).
 * 2. Open your terminal in the project root directory.
 * 3. Run the script using Node.js, specifying the path to your CSV and the target branch ID.
 * 
 * Command:
 * node scripts/import-users.mjs --file /path/to/your/users.csv --branch <target-branch-id>
 * 
 * Example:
 * node scripts/import-users.mjs --file ./users.csv --branch branch-one
 * 
 * ---
 * 
 * Output:
 * The script will print the generated SQL statements to the console. You can then
 * copy these statements and execute them in your Google Cloud SQL instance to
 * perform the import. You can also redirect the output to a file:
 * 
 * node scripts/import-users.mjs --file ./users.csv --branch branch-one > import.sql
 * 
 */

import { Command } from 'commander';
import { parse } from 'csv-parse';
import fs from 'fs';
import path from 'path';

const program = new Command();

program
  .version('1.0.0')
  .description('Generate SQL INSERT statements to import users from a CSV file.')
  .requiredOption('-f, --file <path>', 'Path to the CSV file containing user data.')
  .requiredOption('-b, --branch <id>', 'The ID of the branch (site) to import users into.')
  .parse(process.argv);

const options = program.opts();
const csvFilePath = path.resolve(options.file);
const branchId = options.branch;

if (!fs.existsSync(csvFilePath)) {
  console.error(`Error: File not found at ${csvFilePath}`);
  process.exit(1);
}

const parser = fs.createReadStream(csvFilePath)
  .pipe(parse({
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }));

console.log(`-- Generated SQL for importing users into branch: '${branchId}'`);
console.log(`-- Source file: ${csvFilePath}\n`);

// Note: For simplicity, all imported users are given the default role of 'Employee' and type of 'Employee'.
// You can adjust the generated SQL if you need different roles/types.
console.log("INSERT INTO users (site_id, fullName, username, password, department, position, email, phone, role, type) VALUES");

let isFirstRow = true;

parser.on('data', (row) => {
  // Basic validation
  const requiredColumns = ['fullName', 'username', 'password'];
  for (const col of requiredColumns) {
    if (!row[col]) {
      console.error(`\n-- SKIPPING ROW: Missing required value in column '${col}'. Row data:`, row);
      return;
    }
  }

  const values = [
    branchId,
    row.fullName || null,
    row.username || null,
    row.password || null,
    row.department || null,
    row.position || null,
    row.email || null,
    row.phone || null,
    'Employee', // Default role
    'Employee'  // Default type
  ];

  // SQL-safe escaping (basic)
  const escapedValues = values.map(val => {
    if (val === null) return 'NULL';
    // Escape single quotes by doubling them up
    return `'${val.toString().replace(/'/g, "''")}'`;
  }).join(', ');

  const prefix = isFirstRow ? '' : ',';
  console.log(`${prefix}  (${escapedValues})`);
  
  if (isFirstRow) {
    isFirstRow = false;
  }
});

parser.on('end', () => {
  if (isFirstRow) { // No data rows were processed
    console.log('-- No data rows found in CSV. No INSERT statements generated.');
  } else {
    console.log(';');
    console.log('\n-- Import script finished.');
  }
});

parser.on('error', (err) => {
  console.error('\n-- An error occurred while parsing the CSV file:');
  console.error(err.message);
});
