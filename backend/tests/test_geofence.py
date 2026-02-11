import pytest
from datetime import datetime, timedelta
from models.reminder import ReminderResponse, ReminderStatus, ReminderPriority, Location
from services.geofence import haversine_distance, calculate_geofence_score, should_rate_limit

def test_haversine_distance():
    """Test Haversine distance calculation."""
    # Seattle to San Francisco (approx 1094 km)
    lat1, lon1 = 47.6062, -122.3321  # Seattle
    lat2, lon2 = 37.7749, -122.4194  # San Francisco
    
    distance = haversine_distance(lat1, lon1, lat2, lon2)
    
    # Should be approximately 1,094,000 meters
    assert 1_090_000 < distance < 1_100_000

def test_haversine_distance_same_point():
    """Test distance between same point is zero."""
    lat, lon = 40.7128, -74.0060  # New York
    distance = haversine_distance(lat, lon, lat, lon)
    assert distance == 0.0

def test_geofence_inside_radius():
    """Test reminder triggers when inside geofence."""
    reminder = ReminderResponse(
        id="test-1",
        user_id="user-1",
        task="Buy milk",
        location_query="Walmart",
        location=Location(latitude=47.6062, longitude=-122.3321),
        radius_meters=500,
        status=ReminderStatus.ACTIVE,
        priority=ReminderPriority.MEDIUM,
        created_at=datetime.utcnow().isoformat(),
        updated_at=datetime.utcnow().isoformat()
    )
    
    # Location 100m away (inside 500m radius)
    current_location = Location(latitude=47.6070, longitude=-122.3321)
    
    should_trigger, score = calculate_geofence_score(reminder, current_location)
    
    assert should_trigger is True
    assert score >= 0.7

def test_geofence_outside_radius():
    """Test reminder doesn't trigger when outside geofence."""
    reminder = ReminderResponse(
        id="test-2",
        user_id="user-1",
        task="Buy milk",
        location_query="Walmart",
        location=Location(latitude=47.6062, longitude=-122.3321),
        radius_meters=500,
        status=ReminderStatus.ACTIVE,
        priority=ReminderPriority.MEDIUM,
        created_at=datetime.utcnow().isoformat(),
        updated_at=datetime.utcnow().isoformat()
    )
    
    # Location 1km away (outside 500m radius)
    current_location = Location(latitude=47.6150, longitude=-122.3321)
    
    should_trigger, score = calculate_geofence_score(reminder, current_location)
    
    assert should_trigger is False
    assert score < 0.7

def test_geofence_high_priority_boost():
    """Test high priority reminders get score boost."""
    reminder_medium = ReminderResponse(
        id="test-3",
        user_id="user-1",
        task="Task",
        location_query="Place",
        location=Location(latitude=47.6062, longitude=-122.3321),
        radius_meters=500,
        status=ReminderStatus.ACTIVE,
        priority=ReminderPriority.MEDIUM,
        created_at=datetime.utcnow().isoformat(),
        updated_at=datetime.utcnow().isoformat()
    )
    
    reminder_high = ReminderResponse(
        id="test-4",
        user_id="user-1",
        task="Task",
        location_query="Place",
        location=Location(latitude=47.6062, longitude=-122.3321),
        radius_meters=500,
        status=ReminderStatus.ACTIVE,
        priority=ReminderPriority.HIGH,
        created_at=datetime.utcnow().isoformat(),
        updated_at=datetime.utcnow().isoformat()
    )
    
    current_location = Location(latitude=47.6070, longitude=-122.3321)
    
    _, score_medium = calculate_geofence_score(reminder_medium, current_location)
    _, score_high = calculate_geofence_score(reminder_high, current_location)
    
    assert score_high > score_medium

def test_rate_limit_no_previous_notification():
    """Test no rate limit when reminder never notified."""
    reminder = ReminderResponse(
        id="test-5",
        user_id="user-1",
        task="Task",
        location_query="Place",
        location=None,
        radius_meters=500,
        status=ReminderStatus.ACTIVE,
        priority=ReminderPriority.MEDIUM,
        created_at=datetime.utcnow().isoformat(),
        updated_at=datetime.utcnow().isoformat(),
        last_notification_at=None
    )
    
    assert should_rate_limit(reminder) is False

def test_rate_limit_recent_notification():
    """Test rate limit when recently notified."""
    recent_time = (datetime.utcnow() - timedelta(minutes=5)).isoformat()
    
    reminder = ReminderResponse(
        id="test-6",
        user_id="user-1",
        task="Task",
        location_query="Place",
        location=None,
        radius_meters=500,
        status=ReminderStatus.ACTIVE,
        priority=ReminderPriority.MEDIUM,
        created_at=datetime.utcnow().isoformat(),
        updated_at=datetime.utcnow().isoformat(),
        last_notification_at=recent_time
    )
    
    assert should_rate_limit(reminder) is True

def test_rate_limit_old_notification():
    """Test no rate limit when notification was long ago."""
    old_time = (datetime.utcnow() - timedelta(hours=1)).isoformat()
    
    reminder = ReminderResponse(
        id="test-7",
        user_id="user-1",
        task="Task",
        location_query="Place",
        location=None,
        radius_meters=500,
        status=ReminderStatus.ACTIVE,
        priority=ReminderPriority.MEDIUM,
        created_at=datetime.utcnow().isoformat(),
        updated_at=datetime.utcnow().isoformat(),
        last_notification_at=old_time
    )
    
    assert should_rate_limit(reminder) is False
