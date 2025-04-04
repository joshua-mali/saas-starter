// test-db-connection.mjs
import dotenv from 'dotenv';
import postgres from 'postgres';

// Load environment variables from .env file in the current directory
dotenv.config();

const url = process.env.POSTGRES_URL;

if (!url) {
  console.error('ERROR: POSTGRES_URL environment variable is not set in your .env file.');
  process.exit(1); // Exit with error code
}

// Mask the password for logging
const maskedUrl = url.replace(/:[^@\/]+@/, ':*****@');
console.log(`Attempting to connect to database using URL: ${maskedUrl}`);

let sql;

try {
  // Initialize postgres client
  sql = postgres(url, {
    ssl: 'require', // Supabase requires SSL
    connect_timeout: 15, // Set connection timeout (seconds) - adjust if needed
    // idle_timeout: 5, // Optional: close idle connections sooner for serverless
    // max: 1 // Optional: Limit connections for testing
  });

  console.log('Client initialized. Performing test query...');

  // Perform a simple query to test the connection
  const result = await sql`SELECT NOW();`;

  console.log('-----------------------------------------');
  console.log('✅ Connection Successful!');
  console.log('   Server Timestamp:', result[0].now);
  console.log('-----------------------------------------');

} catch (err) {
  console.error('-----------------------------------------');
  console.error('❌ Connection Failed!');
  console.error('   Error Details:', err);
  console.error('-----------------------------------------');
  // Log specific error properties if available
  if (err instanceof Error) {
      console.error(`   Error Name: ${err.name}`);
      console.error(`   Error Message: ${err.message}`);
  }
  if (typeof err === 'object' && err !== null && 'code' in err) {
     console.error(`   Error Code: ${err.code}`); // e.g., ECONNREFUSED, ETIMEDOUT
  }

} finally {
  // Ensure the connection is closed
  if (sql) {
    console.log('Closing database connection...');
    await sql.end({ timeout: 5 }); // Timeout for closing
    console.log('Connection closed.');
  }
  process.exit(0); // Exit cleanly
}