from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from typing import Optional, List
import boto3
import json
from jose import jwt, JWTError

from models.reminder import (
    CreateReminderRequest, ReminderResponse, UpdateReminderRequest,
    LocationEventRequest, ReminderStatus
)
from services.db import DynamoDBService
from services.parser_enhanced import EnhancedReminderParser
from utils.config import settings
from utils.logger import get_logger

logger = get_logger(__name__)

app = FastAPI(title="Reminder API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = DynamoDBService()
parser = EnhancedReminderParser()
sqs = boto3.client('sqs', region_name=settings.REGION)

# Cognito JWT verification
def get_current_user(authorization: Optional[str] = Header(None)) -> str:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.split(' ')[1]
    
    try:
        # Verify JWT (simplified - in production, verify signature with Cognito JWKS)
        payload = jwt.decode(
            token,
            options={"verify_signature": False},  # FIXME: Verify signature in production
            audience=None
        )
        user_id = payload.get('sub')
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError as e:
        logger.error('JWT verification failed', error=str(e))
        raise HTTPException(status_code=401, detail="Invalid token")

@app.get("/health")
def health_check():
    return {"status": "healthy", "env": settings.ENV}

@app.post("/reminders", response_model=ReminderResponse)
def create_reminder(
    request: CreateReminderRequest,
    user_id: str = Depends(get_current_user)
):
    try:
        # Parse natural language
        parsed = parser.parse(request.text)
        
        # Override with explicit values if provided
        location = request.override_location
        radius = request.override_radius or parsed.radius_meters
        trigger_type = request.override_trigger_type or parsed.trigger_type
        recurrence = request.override_recurrence or parsed.recurrence
        
        # Create reminder with enhanced fields
        reminder = db.create_reminder(
            user_id=user_id,
            task=parsed.task,
            location_query=parsed.location_query,
            location=location,
            radius_meters=radius,
            priority=parsed.priority,
            time_constraints=parsed.time_constraints,
            trigger_type=trigger_type,
            recurrence=recurrence,
            time_window=parsed.time_window,
            dwell_time_seconds=parsed.dwell_time_seconds,
            min_gps_accuracy=parsed.min_gps_accuracy
        )
        
        return reminder
    except Exception as e:
        logger.error('Failed to create reminder', error=str(e), user_id=user_id)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/reminders", response_model=List[ReminderResponse])
def list_reminders(
    status: Optional[ReminderStatus] = None,
    user_id: str = Depends(get_current_user)
):
    try:
        reminders = db.list_reminders(user_id, status)
        return reminders
    except Exception as e:
        logger.error('Failed to list reminders', error=str(e), user_id=user_id)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/reminders/{reminder_id}", response_model=ReminderResponse)
def get_reminder(
    reminder_id: str,
    user_id: str = Depends(get_current_user)
):
    reminder = db.get_reminder(user_id, reminder_id)
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return reminder

@app.patch("/reminders/{reminder_id}", response_model=ReminderResponse)
def update_reminder(
    reminder_id: str,
    request: UpdateReminderRequest,
    user_id: str = Depends(get_current_user)
):
    try:
        reminder = db.update_reminder(
            user_id=user_id,
            reminder_id=reminder_id,
            status=request.status,
            location=request.location,
            radius_meters=request.radius_meters
        )
        if not reminder:
            raise HTTPException(status_code=404, detail="Reminder not found")
        return reminder
    except Exception as e:
        logger.error('Failed to update reminder', error=str(e), reminder_id=reminder_id)
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/reminders/{reminder_id}")
def delete_reminder(
    reminder_id: str,
    user_id: str = Depends(get_current_user)
):
    try:
        db.delete_reminder(user_id, reminder_id)
        return {"message": "Reminder deleted"}
    except Exception as e:
        logger.error('Failed to delete reminder', error=str(e), reminder_id=reminder_id)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/location-events")
def post_location_event(
    request: LocationEventRequest,
    user_id: str = Depends(get_current_user)
):
    try:
        # Send to SQS FIFO queue with enhanced fields
        message_body = {
            'user_id': user_id,
            'location': request.location.model_dump(),
            'timestamp': request.timestamp,
            'speed': request.speed,
            'heading': request.heading,
            'activity': request.activity
        }
        
        sqs.send_message(
            QueueUrl=settings.QUEUE_URL,
            MessageBody=json.dumps(message_body),
            MessageGroupId=user_id,  # FIFO: ordered per user
            MessageDeduplicationId=f"{user_id}-{request.timestamp}"
        )
        
        logger.info('Location event queued', user_id=user_id, speed=request.speed, activity=request.activity)
        return {"message": "Location event received"}
    except Exception as e:
        logger.error('Failed to queue location event', error=str(e), user_id=user_id)
        raise HTTPException(status_code=500, detail=str(e))

# Lambda handler
handler = Mangum(app, lifespan="off")
