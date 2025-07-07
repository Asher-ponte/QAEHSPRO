# SQLite Database Files

This directory contains the SQLite database files for your application. Each file corresponds to a specific "site" or "branch" within your multi-tenant setup.

- `main.sqlite`: The database for the super admin / main site.
- `branch-one.sqlite`: The database for "Branch One".
- `branch-two.sqlite`: The database for "Branch Two".
- `external.sqlite`: The database for public/external users.
- Other `.sqlite` files will appear here as you create new branches.

## How to View This Data

You can inspect the contents of these database files using any standard SQLite client. A popular, free, and open-source tool is **DB Browser for SQLite**.

1.  **Download a file:** Right-click on a `.sqlite` file in the file explorer and choose "Download".
2.  **Open the file:** Launch DB Browser for SQLite on your local machine and open the downloaded file.
3.  **Explore:** You can now browse the tables, view the data, and run SQL queries to inspect the database state.
