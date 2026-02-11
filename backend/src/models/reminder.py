from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class ReminderStatus(str, Enum):
    ACTIVE = 'active'
    COMPLETED = 'completed'
    SNOOZED = 'snoozed'
    TRIGGERED = 'triggered'
    PAUSED = 'paused'

class ReminderPriority(str, Enum):
    LOW = 'low'
    MEDIUM = 'medium'
    HIGH = 'high'
    URGENT = 'urgent'

class TriggerType(str, Enum):
    ARRIVAL = 'arrival'  # Enter geofence
    DEPARTURE = 'departure'  # Exit geofence
    NEARBY = 'nearby'  # Within radius (default)
    DWELL = 'dwell'  # Stay in geofence for duration

class RecurrenceType(str, Enum):
    ONCE = 'once'  # One-shot reminder
    ALWAYS = 'always'  # Recurring (every time)
    DAILY = 'daily'  # Once per day
    WEEKLY = 'weekly'  # Once per week

class Location(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    accuracy: Optional[float] = None

class TimeWindow(BaseModel):
    """Time constraints for reminders"""
    start_time: Optional[str] = None  # HH:MM format
    end_time: Optional[str] = None    # HH:MM format
    days_of_week: Optional[List[int]] = None  # 0=Monday, 6=Sunday
    
class ParsedReminder(BaseModel):
    task: str
    location_query: str
    radius_meters: int = 500
    time_constraints: Optional[str] = None
    priority: ReminderPriority = ReminderPriority.MEDIUM
    trigger_type: TriggerType = TriggerType.ARRIVAL
    recurrence: RecurrenceType = RecurrenceType.ONCE
    time_window: Optional[TimeWindow] = None
    dwell_time_seconds: int = 60  # Minimum time in geofence before trigger
    min_gps_accuracy: int = 100  # Minimum GPS accuracy in meters

class CreateReminderRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
    override_location: Optional[Location] = None
    override_radius: Optional[int] = Field(None, ge=50, le=10000)
    override_trigger_type: Optional[TriggerType] = None
    override_recurrence: Optional[RecurrenceType] = None
    saved_place_name: Optional[str] = None  # e.g., "home", "work", "gym"

class ReminderResponse(BaseModel):
    id: str
    user_id: str
    task: str
    location_query: str
    location: Optional[Location] = None
    radius_meters: int
    status: ReminderStatus
    priority: ReminderPriority
    time_constraints: Optional[str] = None
    trigger_type: TriggerType = TriggerType.ARRIVAL
    recurrence: RecurrenceType = RecurrenceType.ONCE
    time_window: Optional[TimeWindow] = None
    dwell_time_seconds: int = 60
    min_gps_accuracy: int = 100
    created_at: str
    updated_at: str
    triggered_at: Optional[str] = None
    last_notification_at: Optional[str] = None
    trigger_count: int = 0  # For recurring reminders
    last_location: Optional[Location] = None  # For departure detection

class UpdateReminderRequest(BaseModel):
    status: Optional[ReminderStatus] = None
    location: Optional[Location] = None
    radius_meters: Optional[int] = Field(None, ge=50, le=10000)

class LocationEventRequest(BaseModel):
    location: Location
    timestamp: Optional[str] = None
    speed: Optional[float] = None  # meters/second
    heading: Optional[float] = None  # degrees (0-360)
    activity: Optional[str] = None  # "stationary", "walking", "driving", etc.
    
    @field_validator('timestamp')
    @classmethod
    def validate_timestamp(cls, v):
        if v is None:
            return datetime.utcnow().isoformat()
        return v

class SavedPlace(BaseModel):
    """User's saved places (home, work, gym, etc.)"""
    name: str = Field(..., min_length=1, max_length=50)
    location: Location
    radius_meters: int = 200
    
class SavedPlaceRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    location: Location
    radius_meters: int = Field(200, ge=50, le=2000)
