import json
from typing import Dict, Any, List
from datetime import datetime

from models.reminder import Location, ReminderStatus
from services.db import DynamoDBService
from services.geofence import calculate_geofence_score, should_rate_limit
from services.notifications import NotificationService
from utils.logger import get_logger

logger = get_logger(__name__)

db = DynamoDBService()
notifier = NotificationService()

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for evaluating location events against active reminders.
    Triggered by SQS FIFO queue.
    """
    logger.info('Evaluator invoked', record_count=len(event.get('Records', [])))
    
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
    """Process a single location event."""
    body = json.loads(record['body'])
    user_id = body['user_id']
    location = Location(**body['location'])
    
    logger.info('Processing location event', user_id=user_id, location=location.model_dump())
    
    # Get all active reminders (could optimize with geohash in Phase 3)
    active_reminders = db.get_active_reminders()
    
    # Filter to user's reminders
    user_reminders = [r for r in active_reminders if r.user_id == user_id]
    
    logger.debug('Found active reminders', count=len(user_reminders), user_id=user_id)
    
    for reminder in user_reminders:
        try:
            evaluate_reminder(reminder, location)
        except Exception as e:
            logger.error('Failed to evaluate reminder', error=str(e), reminder_id=reminder.id)
            # Continue with other reminders

def evaluate_reminder(reminder, location: Location):
    """Evaluate a single reminder against current location."""
    # Check rate limit
    if should_rate_limit(reminder):
        logger.debug('Reminder rate limited', reminder_id=reminder.id)
        return
    
    # Calculate geofence score
    should_trigger, score = calculate_geofence_score(reminder, location)
    
    if not should_trigger:
        return
    
    logger.info(
        'Reminder triggered',
        reminder_id=reminder.id,
        user_id=reminder.user_id,
        score=score
    )
    
    # Send notification
    notifier.send_reminder_notification(reminder, score)
    
    # Update reminder status
    now = datetime.utcnow().isoformat()
    db.update_reminder(
        user_id=reminder.user_id,
        reminder_id=reminder.id,
        status=ReminderStatus.TRIGGERED,
        triggered_at=now,
        last_notification_at=now
    )
