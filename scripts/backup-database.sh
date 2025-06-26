#!/bin/bash

# MALI-Ed Database Backup Script
# Run this before implementing RLS policies

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔄 Starting MALI-Ed Database Backup...${NC}"

# Check if required tools are installed
if ! command -v pg_dump &> /dev/null; then
    echo -e "${RED}❌ pg_dump is not installed. Please install PostgreSQL client tools.${NC}"
    exit 1
fi

# Set your Supabase connection details
# Get these from your Supabase project settings > Database
read -p "Enter your Supabase DB Host (e.g., db.xyz.supabase.co): " DB_HOST
read -p "Enter your database name (usually 'postgres'): " DB_NAME
read -p "Enter your database user (usually 'postgres'): " DB_USER
read -s -p "Enter your database password: " DB_PASSWORD
echo

# Create backup directory
BACKUP_DIR="./backups"
mkdir -p $BACKUP_DIR

# Generate backup filename with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/mali_ed_backup_$TIMESTAMP.sql"

echo -e "${YELLOW}📦 Creating backup: $BACKUP_FILE${NC}"

# Create the backup
PGPASSWORD=$DB_PASSWORD pg_dump \
  --host=$DB_HOST \
  --port=5432 \
  --username=$DB_USER \
  --dbname=$DB_NAME \
  --verbose \
  --clean \
  --no-owner \
  --no-privileges \
  --file=$BACKUP_FILE

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backup completed successfully!${NC}"
    echo -e "📁 Backup saved to: $BACKUP_FILE"
    
    # Show backup file size
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "📊 Backup size: $BACKUP_SIZE"
    
    # Create a backup info file
    INFO_FILE="${BACKUP_FILE%.sql}_info.txt"
    cat > "$INFO_FILE" << EOF
MALI-Ed Database Backup Information
====================================
Backup Date: $(date)
Backup File: $BACKUP_FILE
Database Host: $DB_HOST
Database Name: $DB_NAME
Backup Size: $BACKUP_SIZE

Purpose: Pre-RLS implementation backup
Notes: This backup was created before implementing Row Level Security policies.

To restore this backup:
PGPASSWORD=your_password psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f $BACKUP_FILE
EOF
    
    echo -e "${GREEN}📋 Backup info saved to: $INFO_FILE${NC}"
    
else
    echo -e "${RED}❌ Backup failed! Please check your connection details.${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 Backup process completed!${NC}"
echo -e "${YELLOW}💡 Keep this backup safe before implementing RLS policies.${NC}" 