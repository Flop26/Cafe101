# Cafe101 database setup

The Expo app talks to the MySQL database through the API in `server/`; never connect the mobile app directly to MySQL.

1. Create the database and seed the initial menu and inventory:

   ```text
   mysql -u root -p < server/schema.sql
   ```

   For an existing database, apply `server/migration_category_size_options.sql` once to add category-level size settings. The migration also enables the existing Coffee and Sodas size behavior.

2. Create `server/.env` from `server/.env.example` and set the MySQL password. Add a stable `AUTH_SECRET` value there as well so logins remain valid across server restarts.

3. Install and start the API:

   ```text
   cd server
   npm install
   npm start
   ```

4. In the project root, create `.env` with the API address. For a physical phone, use the computer's LAN IP instead of `localhost`:

   ```text
   EXPO_PUBLIC_API_URL=http://192.168.1.10:3000
   ```

5. Start Expo from the project root:

   ```text
   npm start
   ```

Without `EXPO_PUBLIC_API_URL`, the app keeps its demo in-memory behavior. With it set, it loads and saves menu items, inventory, and completed orders through MySQL.
