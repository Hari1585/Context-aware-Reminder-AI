import boto3
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import uuid
from models.reminder import (
    ReminderResponse, ReminderStatus, ReminderPriority, Location,
    TriggerType, RecurrenceType, TimeWindow
)
from utils.config import settings
from utils.logger import get_logger

logger = get_logger(__name__)

class DynamoDBService:
    def __init__(self):
        self.dynamodb = boto3.resource('dynamodb', region_name=settings.REGION)
        self.table = self.dynamodb.Table(settings.TABLE_NAME)
    
    def create_reminder(
        self,
        user_id: str,
        task: str,
        location_query: str,
        location: Optional[Location],
        radius_meters: int,
        priority: ReminderPriority,
        time_constraints: Optional[str] = None,
        trigger_type: TriggerType = TriggerType.ARRIVAL,
        recurrence: RecurrenceType = RecurrenceType.ONCE,
        time_window: Optional[TimeWindow] = None,
        dwell_time_seconds: int = 60,
        min_gps_accuracy: int = 100
    ) -> ReminderResponse:
        reminder_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        item = {
            'PK': f'USER#{user_id}',
            'SK': f'REM#{reminder_id}',
            'GSI1PK': f'STATUS#{ReminderStatus.ACTIVE.value}',
            'GSI1SK': f'USER#{user_id}#REM#{reminder_id}',
            'id': reminder_id,
            'user_id': user_id,
            'task': task,
            'location_query': location_query,
            'radius_meters': radius_meters,
            'status': ReminderStatus.ACTIVE.value,
            'priority': priority.value,
            'trigger_type': trigger_type.value,
            'recurrence': recurrence.value,
            'dwell_time_seconds': dwell_time_seconds,
            'min_gps_accuracy': min_gps_accuracy,
            'trigger_count': 0,
            'created_at': now,
            'updated_at': now,
            'ttl': int((datetime.utcnow() + timedelta(days=90)).timestamp()),
        }
        
        if location:
            item['location'] = location.model_dump()
        if time_constraints:
            item['time_constraints'] = time_constraints
        if time_window:
            item['time_window'] = time_window.model_dump()
        
        self.table.put_item(Item=item)
        logger.info('Created reminder', reminder_id=reminder_id, user_id=user_id)
        
        return self._item_to_reminder(item)
    
    def get_reminder(self, user_id: str, reminder_id: str) -> Optional[ReminderResponse]:
        response = self.table.get_item(
            Key={'PK': f'USER#{user_id}', 'SK': f'REM#{reminder_id}'}
        )
        item = response.get('Item')
        return self._item_to_reminder(item) if item else None
    
    def list_reminders(self, user_id: str, status: Optional[ReminderStatus] = None) -> List[ReminderResponse]:
        response = self.table.query(
            KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues={
                ':pk': f'USER#{user_id}',
                ':sk': 'REM#'
            }
        )
        
        items = response.get('Items', [])
        reminders = [self._item_to_reminder(item) for item in items]
        
        if status:
            reminders = [r for r in reminders if r.status == status]
        
        return sorted(reminders, key=lambda x: x.created_at, reverse=True)
    
    def update_reminder(
        self,
        user_id: str,
        reminder_id: str,
        status: Optional[ReminderStatus] = None,
        location: Optional[Location] = None,
        radius_meters: Optional[int] = None,
        triggered_at: Optional[str] = None,
        last_notification_at: Optional[str] = None,
        trigger_count: Optional[int] = None,
        last_location: Optional[Location] = None
    ) -> Optional[ReminderResponse]:
        update_expr = 'SET updated_at = :updated_at'
        expr_values = {':updated_at': datetime.utcnow().isoformat()}
        
        if status:
            update_expr += ', #status = :status, GSI1PK = :gsi1pk'
            expr_values[':status'] = status.value
            expr_values[':gsi1pk'] = f'STATUS#{status.value}'
        if location:
            update_expr += ', #location = :location'
            expr_values[':location'] = location.model_dump()
        if radius_meters:
            update_expr += ', radius_meters = :radius'
            expr_values[':radius'] = radius_meters
        if triggered_at:
            update_expr += ', triggered_at = :triggered_at'
            expr_values[':triggered_at'] = triggered_at
        if last_notification_at:
            update_expr += ', last_notification_at = :last_notif'
            expr_values[':last_notif'] = last_notification_at
        if trigger_count is not None:
            update_expr += ', trigger_count = :trigger_count'
            expr_values[':trigger_count'] = trigger_count
        if last_location:
            update_expr += ', last_location = :last_location'
            expr_values[':last_location'] = last_location.model_dump()
        
        response = self.table.update_item(
            Key={'PK': f'USER#{user_id}', 'SK': f'REM#{reminder_id}'},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values,
            ExpressionAttributeNames={'#status': 'status', '#location': 'location'} if status or location else {},
            ReturnValues='ALL_NEW'
        )
        
        item = response.get('Attributes')
        return self._item_to_reminder(item) if item else None
    
    def delete_reminder(self, user_id: str, reminder_id: str) -> bool:
        self.table.delete_item(
            Key={'PK': f'USER#{user_id}', 'SK': f'REM#{reminder_id}'}
        )
        logger.info('Deleted reminder', reminder_id=reminder_id, user_id=user_id)
        return True
    
    def get_active_reminders(self) -> List[ReminderResponse]:
        response = self.table.query(
            IndexName='GSI1-Status',
            KeyConditionExpression='GSI1PK = :status',
            ExpressionAttributeValues={':status': f'STATUS#{ReminderStatus.ACTIVE.value}'}
        )
        return [self._item_to_reminder(item) for item in response.get('Items', [])]
    
    def _item_to_reminder(self, item: Dict[str, Any]) -> ReminderResponse:
        location = None
        if 'location' in item:
            location = Location(**item['location'])
        
        time_window = None
        if 'time_window' in item:
            time_window = TimeWindow(**item['time_window'])
        
        last_location = None
        if 'last_location' in item:
            last_location = Location(**item['last_location'])
        
        return ReminderResponse(
            id=item['id'],
            user_id=item['user_id'],
            task=item['task'],
            location_query=item['location_query'],
            location=location,
            radius_meters=item['radius_meters'],
            status=ReminderStatus(item['status']),
            priority=ReminderPriority(item['priority']),
            time_constraints=item.get('time_constraints'),
            trigger_type=TriggerType(item.get('trigger_type', 'arrival')),
            recurrence=RecurrenceType(item.get('recurrence', 'once')),
            time_window=time_window,
            dwell_time_seconds=item.get('dwell_time_seconds', 60),
            min_gps_accuracy=item.get('min_gps_accuracy', 100),
            created_at=item['created_at'],
            updated_at=item['updated_at'],
            triggered_at=item.get('triggered_at'),
            last_notification_at=item.get('last_notification_at'),
            trigger_count=item.get('trigger_count', 0),
            last_location=last_location
        )
