import { db } from '../lib/db/drizzle';
import { nswTermDatesData } from '../lib/db/nsw-term-dates-data';
import { nswTermDates } from '../lib/db/schema';

async function seedNSWTermDates() {
  try {
    // Remove existing NSW term dates for these years to avoid duplicates
    await db.execute(`DELETE FROM nsw_term_dates WHERE calendar_year >= 2025`);
    // Insert all term dates
    await db.insert(nswTermDates).values(nswTermDatesData);
    console.log('✅ NSW term dates seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding NSW term dates:', error);
    process.exit(1);
  }
}

seedNSWTermDates(); 