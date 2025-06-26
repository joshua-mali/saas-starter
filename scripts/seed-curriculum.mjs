// scripts/seed-curriculum.mjs
import csv from 'csv-parser';
import { and, eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { db } from '../lib/db/drizzle';
import {
    contentGroups,
    contentPoints,
    focusAreas,
    focusGroups,
    outcomes,
    stages,
    subjects
} from '../lib/db/schema';

// --- Configuration ---
// Files to process
const CSV_FILES = [
    './syllabus/English Syllabus Stage 1-3.csv',
    './syllabus/Maths Syllabus Stage 1-3.csv'
];
// --- End Configuration ---

// Caches - shared across files to avoid duplicates
const stageCache = new Map();
const subjectCache = new Map();
const outcomeCache = new Map();
const focusAreaCache = new Map();
const focusGroupCache = new Map();
const contentGroupCache = new Map();

async function processRow(row) {
    // --- 1. Extract data ---
    const stageName = row['Stage']?.trim();
    const subjectName = row['Subject']?.trim();
    const outcomeName = row['Outcome']?.trim();
    const focusAreaName = row['Focus Area']?.trim();
    const focusGroupName = row['Focus Group']?.trim();
    const contentGroupName = row['Content Group']?.trim();
    const contentPointName = row['Content Point']?.trim();
    const contentPointDescription = row['Content Point Description']?.trim();
  
    // Validation
    if (!stageName || !subjectName || !outcomeName || !focusAreaName || !focusGroupName || !contentGroupName || !contentPointName) {
      console.warn('Skipping row due to missing core data:', row);
      return;
    }
  
    try {
      // --- 2. Find or Create Stage ---
      let stageId = stageCache.get(stageName);
      if (!stageId) {
        let [stageRecord] = await db.select({ id: stages.id }).from(stages).where(eq(stages.name, stageName)).limit(1);
        if (!stageRecord) {
          console.log(`Creating Stage: ${stageName}`);
          [stageRecord] = await db.insert(stages).values({ name: stageName }).returning({ id: stages.id });
        }
        stageId = stageRecord.id;
        stageCache.set(stageName, stageId);
      }
  
      // --- 3. Find or Create Subject ---
      let subjectId = subjectCache.get(subjectName);
      if (!subjectId) {
        let [subjectRecord] = await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.name, subjectName)).limit(1);
        if (!subjectRecord) {
          console.log(`Creating Subject: ${subjectName}`);
          [subjectRecord] = await db.insert(subjects).values({ name: subjectName }).returning({ id: subjects.id });
        }
        subjectId = subjectRecord.id;
        subjectCache.set(subjectName, subjectId);
      }
  
      // --- 4. Find or Create Outcome ---
      const outcomeKey = `${subjectId}-${outcomeName}`;
      let outcomeId = outcomeCache.get(outcomeKey);
      if (!outcomeId) {
        let [outcomeRecord] = await db.select({ id: outcomes.id })
          .from(outcomes)
          .where(and(
            eq(outcomes.subjectId, subjectId),
            eq(outcomes.name, outcomeName)
          ))
          .limit(1);
  
        if (!outcomeRecord) {
          console.log(`Creating Outcome: ${outcomeName} (Subject: ${subjectName})`);
          [outcomeRecord] = await db.insert(outcomes).values({
              subjectId: subjectId,
              name: outcomeName
          }).returning({ id: outcomes.id });
        }
        outcomeId = outcomeRecord.id;
        outcomeCache.set(outcomeKey, outcomeId);
      }
  
      // --- 5. Find or Create Focus Area ---
      const focusAreaKey = `${outcomeId}-${stageId}-${focusAreaName}`;
      let focusAreaId = focusAreaCache.get(focusAreaKey);
      if (!focusAreaId) {
          let [focusAreaRecord] = await db.select({ id: focusAreas.id })
              .from(focusAreas)
              .where(and(
                  eq(focusAreas.outcomeId, outcomeId),
                  eq(focusAreas.stageId, stageId),
                  eq(focusAreas.name, focusAreaName)
              ))
              .limit(1);
  
          if (!focusAreaRecord) {
              console.log(`Creating Focus Area: ${focusAreaName} (Outcome: ${outcomeName}, Stage: ${stageName})`);
              [focusAreaRecord] = await db.insert(focusAreas).values({
                  outcomeId: outcomeId,
                  stageId: stageId,
                  name: focusAreaName
              }).returning({ id: focusAreas.id });
          }
          focusAreaId = focusAreaRecord.id;
          focusAreaCache.set(focusAreaKey, focusAreaId);
      }
  
      // --- 6. Find or Create Focus Group ---
      const focusGroupKey = `${focusAreaId}-${focusGroupName}`;
      let focusGroupId = focusGroupCache.get(focusGroupKey);
      if (!focusGroupId) {
         let [focusGroupRecord] = await db.select({ id: focusGroups.id })
             .from(focusGroups)
             .where(and(
                 eq(focusGroups.focusAreaId, focusAreaId),
                 eq(focusGroups.name, focusGroupName)
             ))
             .limit(1);
  
         if (!focusGroupRecord) {
             console.log(`Creating Focus Group: ${focusGroupName} (Focus Area: ${focusAreaName})`);
             [focusGroupRecord] = await db.insert(focusGroups).values({
                 focusAreaId: focusAreaId,
                 name: focusGroupName
             }).returning({ id: focusGroups.id });
         }
         focusGroupId = focusGroupRecord.id;
         focusGroupCache.set(focusGroupKey, focusGroupId);
      }
  
      // --- 7. Find or Create Content Group ---
      const contentGroupKey = `${focusGroupId}-${contentGroupName}`;
      let contentGroupId = contentGroupCache.get(contentGroupKey);
      if (!contentGroupId) {
         let [contentGroupRecord] = await db.select({ id: contentGroups.id })
             .from(contentGroups)
             .where(and(
                 eq(contentGroups.focusGroupId, focusGroupId),
                 eq(contentGroups.name, contentGroupName)
             ))
             .limit(1);
  
         if (!contentGroupRecord) {
             console.log(`Creating Content Group: ${contentGroupName} (Focus Group: ${focusGroupName})`);
             [contentGroupRecord] = await db.insert(contentGroups).values({
                 focusGroupId: focusGroupId,
                 name: contentGroupName
             }).returning({ id: contentGroups.id });
         }
         contentGroupId = contentGroupRecord.id;
         contentGroupCache.set(contentGroupKey, contentGroupId);
      }
  
      // --- 8. Create Content Point ---
      let [contentPointRecord] = await db.select({ id: contentPoints.id })
           .from(contentPoints)
           .where(and(
               eq(contentPoints.contentGroupId, contentGroupId),
               eq(contentPoints.name, contentPointName)
           ))
           .limit(1);
  
      if (!contentPointRecord) {
          console.log(`Creating Content Point: ${contentPointName} (Content Group: ${contentGroupName})`);
          await db.insert(contentPoints).values({
              contentGroupId: contentGroupId,
              name: contentPointName,
              description: contentPointDescription || null
          });
      } else {
           console.log(`Skipping existing Content Point: ${contentPointName} (Content Group: ${contentGroupName})`);
      }
  
    } catch (error) {
      console.error(`Error processing row:`, row, `\nError:`, error);
    }
}

async function processFile(csvFilePath) {
  console.log(`\n=== Processing ${csvFilePath} ===`);
  
  const stream = fs.createReadStream(csvFilePath).pipe(csv());
  
  let rowCount = 0;
  for await (const row of stream) {
    try {
      await processRow(row);
      rowCount++;
      if (rowCount % 50 === 0) {
        console.log(`Processed ${rowCount} rows from ${path.basename(csvFilePath)}...`);
      }
    } catch (error) {
      console.error(`Error processing row in ${csvFilePath}:`, row, `\nError:`, error);
    }
  }
  
  console.log(`Completed processing ${csvFilePath} - ${rowCount} rows processed`);
}

async function seedDatabase() {
  console.log('Starting syllabus seeding process...\n');

  for (const csvFile of CSV_FILES) {
    const csvFilePath = path.resolve(process.cwd(), csvFile);
    
    if (!fs.existsSync(csvFilePath)) {
      console.error(`File not found: ${csvFilePath}`);
      continue;
    }
    
    await processFile(csvFilePath);
  }

  console.log('\n=== Seeding Summary ===');
  console.log(`Stages: ${stageCache.size}`);
  console.log(`Subjects: ${subjectCache.size}`);
  console.log(`Outcomes: ${outcomeCache.size}`);
  console.log(`Focus Areas: ${focusAreaCache.size}`);
  console.log(`Focus Groups: ${focusGroupCache.size}`);
  console.log(`Content Groups: ${contentGroupCache.size}`);
  console.log('\nSeeding finished successfully!');
}

seedDatabase().catch((error) => {
  console.error('Unhandled error during seeding:', error);
  process.exit(1);
});