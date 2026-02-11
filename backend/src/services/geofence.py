import math
from typing import Tuple
from datetime import datetime, timedelta
from models.reminder import Location, ReminderResponse, ReminderPriority
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

def calculate_geofence_score(
    reminder: ReminderResponse,
    current_location: Location
) -> Tuple[bool, float]:
    """
    Calculate if reminder should trigger based on geofence.
    Returns (should_trigger, score).
    """
    if not reminder.location:
        logger.warning('Reminder has no location', reminder_id=reminder.id)
        return False, 0.0
    
    distance = haversine_distance(
        current_location.latitude,
        current_location.longitude,
        reminder.location.latitude,
        reminder.location.longitude
    )
    
    # Calculate score based on distance and radius
    if distance <= reminder.radius_meters:
        # Inside geofence: score 1.0 at center, decreasing to threshold at edge
        score = 1.0 - (distance / reminder.radius_meters) * (1.0 - settings.GEOFENCE_SCORE_THRESHOLD)
    else:
        # Outside geofence
        score = 0.0
    
    # Priority boost
    priority_multiplier = {
        ReminderPriority.LOW: 0.9,
        ReminderPriority.MEDIUM: 1.0,
        ReminderPriority.HIGH: 1.1,
    }
    score *= priority_multiplier.get(reminder.priority, 1.0)
    
    should_trigger = score >= settings.GEOFENCE_SCORE_THRESHOLD
    
    logger.debug(
        'Geofence calculation',
        reminder_id=reminder.id,
        distance=distance,
        radius=reminder.radius_meters,
        score=score,
        should_trigger=should_trigger
    )
    
    return should_trigger, score

def should_rate_limit(reminder: ReminderResponse) -> bool:
    """Check if reminder was notified recently (rate limiting)."""
    if not reminder.last_notification_at:
        return False
    
    last_notif = datetime.fromisoformat(reminder.last_notification_at)
    time_since = datetime.utcnow() - last_notif
    
    is_limited = time_since.total_seconds() < settings.RATE_LIMIT_SECONDS
    
    if is_limited:
        logger.debug(
            'Rate limit active',
            reminder_id=reminder.id,
            seconds_since_last=time_since.total_seconds()
        )
    
    return is_limited
