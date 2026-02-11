#!/usr/bin/env python3
"""
Data migration script: DynamoDB → Postgres (Phase 2)
Usage: python scripts/migrate_dynamodb_to_postgres.py
"""

import boto3
import os
import sys
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend', 'src'))

Base = declarative_base()

class ReminderModel(Base):
    __tablename__ = 'reminders'
    
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    task = Column(String, nullable=False)
    location_query = Column(String, nullable=False)
    location_lat = Column(Float, nullable=True)
    location_lon = Column(Float, nullable=True)
    radius_meters = Column(Integer, nullable=False)
    status = Column(String, nullable=False, index=True)
    priority = Column(String, nullable=False)
    time_constraints = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    triggered_at = Column(DateTime, nullable=True)
    last_notification_at = Column(DateTime, nullable=True)

def main():
    # Configuration
    TABLE_NAME = os.getenv('TABLE_NAME', 'reminder-app-prod-reminders')
    DATABASE_URL = os.getenv('DATABASE_URL')
    REGION = os.getenv('REGION', 'us-east-1')
    
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL environment variable not set")
        sys.exit(1)
    
    print(f"Migrating from DynamoDB table: {TABLE_NAME}")
    print(f"Migrating to Postgres: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'hidden'}")
    
    # Connect to DynamoDB
    dynamodb = boto3.resource('dynamodb', region_name=REGION)
    table = dynamodb.Table(TABLE_NAME)
    
    # Connect to Postgres
    engine = create_engine(DATABASE_URL)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    # Scan DynamoDB
    print("Scanning DynamoDB...")
    response = table.scan()
    items = response['Items']
    
    while 'LastEvaluatedKey' in response:
        response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        items.extend(response['Items'])
    
    print(f"Found {len(items)} items")
    
    # Filter reminders (skip non-reminder items)
    reminders = [item for item in items if item.get('SK', '').startswith('REM#')]
    print(f"Found {len(reminders)} reminders to migrate")
    
    # Migrate
    migrated = 0
    errors = 0
    
    for item in reminders:
        try:
            reminder = ReminderModel(
                id=item['id'],
                user_id=item['user_id'],
                task=item['task'],
                location_query=item['location_query'],
                location_lat=item.get('location', {}).get('latitude'),
                location_lon=item.get('location', {}).get('longitude'),
                radius_meters=item['radius_meters'],
                status=item['status'],
                priority=item['priority'],
                time_constraints=item.get('time_constraints'),
                created_at=datetime.fromisoformat(item['created_at'].replace('Z', '+00:00')),
                updated_at=datetime.fromisoformat(item['updated_at'].replace('Z', '+00:00')),
                triggered_at=datetime.fromisoformat(item['triggered_at'].replace('Z', '+00:00')) if item.get('triggered_at') else None,
                last_notification_at=datetime.fromisoformat(item['last_notification_at'].replace('Z', '+00:00')) if item.get('last_notification_at') else None
            )
            session.add(reminder)
            migrated += 1
            
            if migrated % 100 == 0:
                print(f"Migrated {migrated} reminders...")
                session.commit()
        
        except Exception as e:
            print(f"ERROR migrating reminder {item.get('id')}: {e}")
            errors += 1
    
    # Final commit
    session.commit()
    session.close()
    
    print(f"\n✅ Migration complete!")
    print(f"   Migrated: {migrated}")
    print(f"   Errors: {errors}")
    
    # Verify
    session = Session()
    count = session.query(ReminderModel).count()
    print(f"   Postgres count: {count}")
    session.close()

if __name__ == '__main__':
    main()
