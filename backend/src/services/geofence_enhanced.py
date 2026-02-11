"""
Enhanced geofence service supporting multiple trigger types and use cases.
Supports: arrival, departure, nearby, dwell, time windows, GPS accuracy, speed detection.
"""
import math
from typing import Tuple, Optional
from datetime import datetime, timedelta, time as dt_time
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.reminder import (
    Location, ReminderResponse, ReminderPriority, 
    TriggerType, RecurrenceType, TimeWindow
)
from utils.config import settings
from utils.logger import get_logger

logger = get_logger(__name__)

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in meters using Haversine formula."""
    R = 6371000  # Earth radius in meters
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

def is_within_time_window(time_window: Optional[TimeWindow]) -> bool:
    """Check if current time is within the specified time window."""
    if not time_window:
        return True
    
    now = datetime.utcnow()
    current_time = now.time()
    current_day = now.weekday()  # 0=Monday, 6=Sunday
    
    # Check day of week
    if time_window.days_of_week and current_day not in time_window.days_of_week:
        logger.debug('Outside day of week window', current_day=current_day, allowed=time_window.days_of_week)
        return False
    
    # Check time range
    if time_window.start_time and time_window.end_time:
        start = dt_time.fromisoformat(time_window.start_time)
        end = dt_time.fromisoformat(time_window.end_time)
        
        if start <= end:
            # Normal range (e.g., 09:00-17:00)
            if not (start <= current_time <= end):
                logger.debug('Outside time window', current=current_time, start=start, end=end)
                return False
        else:
            # Overnight range (e.g., 22:00-06:00)
            if not (current_time >= start or current_time <= end):
                logger.debug('Outside overnight time window', current=current_time, start=start, end=end)
                return False
    
    return True

def check_gps_accuracy(location: Location, min_accuracy: int) -> bool:
    """Check if GPS accuracy meets minimum threshold."""
    if not location.accuracy:
        # No accuracy data, assume acceptable
        return True
    
    if location.accuracy > min_accuracy:
        logger.debug('GPS accuracy too low', accuracy=location.accuracy, min_required=min_accuracy)
        return False
    
    return True

def is_high_speed(speed: Optional[float], threshold: float = 13.89) -> bool:
    """
    Check if user is moving at high speed (likely driving).
    Default threshold: 13.89 m/s = 50 km/h = 31 mph
    """
    if speed is None:
        return False
    
    return speed > threshold

def detect_trigger_type(
    reminder: ReminderResponse,
    current_location: Location,
    previous_location: Optional[Location] = None
) -> Tuple[bool, str]:
    """
    Detect if reminder should trigger based on trigger type.
    Returns (should_trigger, reason).
    """
    if not reminder.location:
        return False, "No reminder location set"
    
    current_distance = haversine_distance(
        current_location.latitude,
        current_location.longitude,
        reminder.location.latitude,
        reminder.location.longitude
    )
    
    inside_geofence = current_distance <= reminder.radius_meters
    
    if reminder.trigger_type == TriggerType.ARRIVAL:
        # Trigger when entering geofence
        if not inside_geofence:
            return False, f"Outside geofence ({current_distance:.0f}m > {reminder.radius_meters}m)"
        
        # Check if we were outside before (arrival detection)
        if previous_location:
            prev_distance = haversine_distance(
                previous_location.latitude,
                previous_location.longitude,
                reminder.location.latitude,
                reminder.location.longitude
            )
            was_outside = prev_distance > reminder.radius_meters
            
            if not was_outside:
                return False, "Already inside geofence (not an arrival)"
        
        return True, f"Arrived at location ({current_distance:.0f}m)"
    
    elif reminder.trigger_type == TriggerType.DEPARTURE:
        # Trigger when exiting geofence
        if inside_geofence:
            return False, f"Still inside geofence ({current_distance:.0f}m)"
        
        # Check if we were inside before (departure detection)
        if previous_location:
            prev_distance = haversine_distance(
                previous_location.latitude,
                previous_location.longitude,
                reminder.location.latitude,
                reminder.location.longitude
            )
            was_inside = prev_distance <= reminder.radius_meters
            
            if not was_inside:
                return False, "Already outside geofence (not a departure)"
            
            return True, f"Departed from location ({current_distance:.0f}m)"
        
        return False, "No previous location to detect departure"
    
    elif reminder.trigger_type == TriggerType.NEARBY:
        # Trigger when within radius (default behavior)
        if not inside_geofence:
            return False, f"Not nearby ({current_distance:.0f}m > {reminder.radius_meters}m)"
        
        return True, f"Nearby location ({current_distance:.0f}m)"
    
    elif reminder.trigger_type == TriggerType.DWELL:
        # Trigger after dwelling in geofence for specified duration
        # This requires tracking entry time (handled in evaluator)
        if not inside_geofence:
            return False, f"Outside geofence ({current_distance:.0f}m)"
        
        # Dwell time check is done in evaluator using last_notification_at
        return True, f"Inside geofence for dwell check ({current_distance:.0f}m)"
    
    return False, "Unknown trigger type"

def calculate_geofence_score(
    reminder: ReminderResponse,
    current_location: Location,
    previous_location: Optional[Location] = None,
    speed: Optional[float] = None,
    activity: Optional[str] = None
) -> Tuple[bool, float, str]:
    """
    Enhanced geofence scoring with multiple trigger types and conditions.
    Returns (should_trigger, score, reason).
    """
    # Check GPS accuracy first
    if not check_gps_accuracy(current_location, reminder.min_gps_accuracy):
        return False, 0.0, f"GPS accuracy too low ({current_location.accuracy}m > {reminder.min_gps_accuracy}m)"
    
    # Check time window
    if not is_within_time_window(reminder.time_window):
        return False, 0.0, "Outside time window"
    
    # Check if user is driving at high speed (delay notification)
    if is_high_speed(speed):
        logger.debug('User is driving, delaying notification', speed=speed, reminder_id=reminder.id)
        return False, 0.0, f"User is driving ({speed:.1f} m/s)"
    
    # Detect trigger based on type
    should_trigger_type, reason = detect_trigger_type(reminder, current_location, previous_location)
    
    if not should_trigger_type:
        return False, 0.0, reason
    
    # Calculate base score
    if not reminder.location:
        return False, 0.0, "No reminder location"
    
    distance = haversine_distance(
        current_location.latitude,
        current_location.longitude,
        reminder.location.latitude,
        reminder.location.longitude
    )
    
    # Score based on distance (1.0 at center, decreasing to threshold at edge)
    if distance <= reminder.radius_meters:
        base_score = 1.0 - (distance / reminder.radius_meters) * (1.0 - settings.GEOFENCE_SCORE_THRESHOLD)
    else:
        base_score = 0.0
    
    # Priority multiplier
    priority_multiplier = {
        ReminderPriority.LOW: 0.9,
        ReminderPriority.MEDIUM: 1.0,
        ReminderPriority.HIGH: 1.1,
        ReminderPriority.URGENT: 1.2,
    }
    score = base_score * priority_multiplier.get(reminder.priority, 1.0)
    
    # Activity boost (stationary is better than walking)
    if activity == 'stationary':
        score *= 1.05
    
    should_trigger = score >= settings.GEOFENCE_SCORE_THRESHOLD
    
    logger.debug(
        'Geofence calculation',
        reminder_id=reminder.id,
        trigger_type=reminder.trigger_type,
        distance=distance,
        radius=reminder.radius_meters,
        score=score,
        should_trigger=should_trigger,
        reason=reason
    )
    
    return should_trigger, score, reason

def should_rate_limit(reminder: ReminderResponse) -> bool:
    """
    Check if reminder was notified recently (rate limiting).
    Handles recurring reminders differently.
    """
    if not reminder.last_notification_at:
        return False
    
    last_notif = datetime.fromisoformat(reminder.last_notification_at)
    time_since = datetime.utcnow() - last_notif
    
    # For recurring reminders, use longer cooldown
    if reminder.recurrence == RecurrenceType.ALWAYS:
        cooldown = settings.RATE_LIMIT_SECONDS
    elif reminder.recurrence == RecurrenceType.DAILY:
        cooldown = 86400  # 24 hours
    elif reminder.recurrence == RecurrenceType.WEEKLY:
        cooldown = 604800  # 7 days
    else:  # ONCE
        # One-shot reminders should not trigger again after first notification
        return True
    
    is_limited = time_since.total_seconds() < cooldown
    
    if is_limited:
        logger.debug(
            'Rate limit active',
            reminder_id=reminder.id,
            recurrence=reminder.recurrence,
            seconds_since_last=time_since.total_seconds(),
            cooldown=cooldown
        )
    
    return is_limited

def should_complete_reminder(reminder: ReminderResponse) -> bool:
    """
    Determine if reminder should be marked as completed.
    One-shot reminders complete after first trigger.
    Recurring reminders stay active.
    """
    if reminder.recurrence == RecurrenceType.ONCE and reminder.trigger_count > 0:
        return True
    
    return False
