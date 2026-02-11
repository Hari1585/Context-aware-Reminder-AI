"""
Enhanced evaluator handler supporting multiple trigger types and use cases.
Supports: arrival, departure, nearby, dwell, time windows, speed detection, recurring reminders.
"""
import json
import sys
import os
from typing import Dict, Any, Optional
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.reminder import Location, ReminderStatus, RecurrenceType
from services.db import DynamoDBService
from services.geofence_enhanced import (
    calculate_geofence_score, 
    should_rate_limit,
    should_complete_reminder
)
from services.notifications import NotificationService
from utils.logger import get_logger

logger = get_logger(__name__)

db = DynamoDBService()
notifier = NotificationService()

# In-memory cache for tracking user locations (for departure detection)
# In production, use Redis or DynamoDB with TTL
user_location_cache: Dict[str, Location] = {}

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for evaluating location events against active reminders.
    Triggered by SQS FIFO queue.
    """
    logger.info('Enhanced evaluator invoked', record_count=len(event.get('Records', [])))
    
    batch_item_failures = []
    
    for record in event.get('Records', []):
        try:
            process_location_event(record)
        except Exception as e:
            logger.error('Failed to process record', error=str(e), record_id=record['messageId'])
            # Report failure for retry
            batch_item_failures.append({'itemIdentifier': record['messageId']})
    
    return {'batchItemFailures': batch_item_failures}

def process_location_event(record: Dict[str, Any]):
    """Process a single location event with enhanced trigger detection."""
    body = json.loads(record['body'])
    user_id = body['user_id']
    location = Location(**body['location'])
    speed = body.get('speed')
    heading = body.get('heading')
    activity = body.get('activity')
    
    logger.info(
        'Processing location event',
        user_id=user_id,
        location=location.model_dump(),
        speed=speed,
        activity=activity
    )
    
    # Get previous location for departure detection
    previous_location = user_location_cache.get(user_id)
    
    # Update location cache
    user_location_cache[user_id] = location
    
    # Get all active reminders
    active_reminders = db.get_active_reminders()
    
    # Filter to user's reminders
    user_reminders = [r for r in active_reminders if r.user_id == user_id]
    
    logger.debug('Found active reminders', count=len(user_reminders), user_id=user_id)
    
    for reminder in user_reminders:
        try:
            evaluate_reminder(reminder, location, previous_location, speed, activity)
        except Exception as e:
            logger.error('Failed to evaluate reminder', error=str(e), reminder_id=reminder.id)
            # Continue with other reminders

def evaluate_reminder(
    reminder,
    location: Location,
    previous_location: Optional[Location],
    speed: Optional[float],
    activity: Optional[str]
):
    """Evaluate a single reminder with enhanced trigger logic."""
    
    # Check rate limit first
    if should_rate_limit(reminder):
        logger.debug('Reminder rate limited', reminder_id=reminder.id)
        return
    
    # Calculate geofence score with enhanced logic
    should_trigger, score, reason = calculate_geofence_score(
        reminder,
        location,
        previous_location,
        speed,
        activity
    )
    
    if not should_trigger:
        logger.debug('Reminder not triggered', reminder_id=reminder.id, reason=reason)
        return
    
    logger.info(
        'Reminder triggered',
        reminder_id=reminder.id,
        user_id=reminder.user_id,
        trigger_type=reminder.trigger_type,
        score=score,
        reason=reason
    )
    
    # Send notification
    notifier.send_reminder_notification(reminder, score)
    
    # Update reminder
    now = datetime.utcnow().isoformat()
    trigger_count = reminder.trigger_count + 1
    
    # Determine new status
    if should_complete_reminder(reminder):
        new_status = ReminderStatus.COMPLETED
        logger.info('Completing one-shot reminder', reminder_id=reminder.id)
    else:
        # Recurring reminders stay active
        new_status = ReminderStatus.TRIGGERED if reminder.recurrence == RecurrenceType.ONCE else ReminderStatus.ACTIVE
    
    db.update_reminder(
        user_id=reminder.user_id,
        reminder_id=reminder.id,
        status=new_status,
        triggered_at=now,
        last_notification_at=now,
        trigger_count=trigger_count,
        last_location=location
    )
    
    logger.info(
        'Reminder updated',
        reminder_id=reminder.id,
        new_status=new_status,
        trigger_count=trigger_count
    )
