import { eq } from 'drizzle-orm';
import { db } from '../lib/db/drizzle';
import { classes, teams } from '../lib/db/schema';

async function cleanupOrphanedData() {
  try {
    // Get all team IDs that exist
    const existingTeams = await db.select({ id: teams.id }).from(teams);
    const existingTeamIds = existingTeams.map(team => team.id);
    
    console.log(`Found ${existingTeamIds.length} existing teams`);
    
    // Find classes with orphaned team references
    const allClasses = await db.select().from(classes);
    const orphanedClasses = allClasses.filter(cls => !existingTeamIds.includes(cls.teamId));
    
    console.log(`Found ${orphanedClasses.length} orphaned classes out of ${allClasses.length} total classes`);
    
    if (orphanedClasses.length > 0) {
      // Delete orphaned classes
      for (const cls of orphanedClasses) {
        await db.delete(classes).where(eq(classes.id, cls.id));
      }
      console.log(`✅ Deleted ${orphanedClasses.length} orphaned classes`);
    } else {
      console.log('✅ No orphaned classes found');
    }
    
  } catch (error) {
    console.error('❌ Error cleaning up orphaned data:', error);
    process.exit(1);
  }
}

cleanupOrphanedData(); 