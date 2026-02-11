import boto3
import json
from models.reminder import ReminderResponse
from utils.config import settings
from utils.logger import get_logger

logger = get_logger(__name__)

class NotificationService:
    def __init__(self):
        self.sns = boto3.client('sns', region_name=settings.REGION)
    
    def send_reminder_notification(self, reminder: ReminderResponse, score: float):
        """Publish reminder notification to SNS topic."""
        message = {
            'reminder_id': reminder.id,
            'user_id': reminder.user_id,
            'task': reminder.task,
            'location_query': reminder.location_query,
            'score': score,
            'priority': reminder.priority.value,
        }
        
        subject = f"Reminder: {reminder.task}"
        
        # Message for email subscribers
        email_message = f"""
You're near {reminder.location_query}!

Reminder: {reminder.task}

Priority: {reminder.priority.value.upper()}
Confidence: {score:.0%}

---
Reminder App
"""
        
        try:
            self.sns.publish(
                TopicArn=settings.TOPIC_ARN,
                Subject=subject,
                Message=json.dumps({
                    'default': json.dumps(message),
                    'email': email_message,
                    'sms': f"Reminder: {reminder.task} (near {reminder.location_query})"
                }),
                MessageStructure='json',
                MessageAttributes={
                    'user_id': {'DataType': 'String', 'StringValue': reminder.user_id},
                    'priority': {'DataType': 'String', 'StringValue': reminder.priority.value},
                }
            )
            logger.info('Notification sent', reminder_id=reminder.id, user_id=reminder.user_id)
        except Exception as e:
            logger.error('Failed to send notification', reminder_id=reminder.id, error=str(e))
            raise
