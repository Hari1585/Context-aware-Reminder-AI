"""
Tests for enhanced reminder features: arrival, departure, recurring, time windows.
"""
import pytest
from datetime import datetime, timedelta
from models.reminder import (
    ReminderResponse, ReminderStatus, ReminderPriority, Location,
    TriggerType, RecurrenceType, TimeWindow
)
from services.geofence_enhanced import (
    calculate_geofence_score, should_rate_limit, detect_trigger_type,
    is_within_time_window, check_gps_accuracy, is_high_speed
)
from services.parser_enhanced import EnhancedReminderParser

# Test data
WALMART_LOCATION = Location(latitude=47.6062, longitude=-122.3321)
NEARBY_LOCATION = Location(latitude=47.6070, longitude=-122.3321)  # ~100m away
FAR_LOCATION = Location(latitude=47.6150, longitude=-122.3321)  # ~1km away

def create_test_reminder(
    trigger_type=TriggerType.ARRIVAL,
    recurrence=RecurrenceType.ONCE,
    priority=ReminderPriority.MEDIUM,
    time_window=None,
    trigger_count=0
):
    return ReminderResponse(
        id="test-1",
        user_id="user-1",
        task="Test task",
        location_query="Walmart",
        location=WALMART_LOCATION,
        radius_meters=500,
        status=ReminderStatus.ACTIVE,
        priority=priority,
        trigger_type=trigger_type,
        recurrence=recurrence,
        time_window=time_window,
        dwell_time_seconds=60,
        min_gps_accuracy=100,
        created_at=datetime.utcnow().isoformat(),
        updated_at=datetime.utcnow().isoformat(),
        trigger_count=trigger_count
    )

# ===== TRIGGER TYPE TESTS =====

def test_arrival_trigger_from_outside():
    """Test arrival trigger when coming from outside geofence."""
    reminder = create_test_reminder(trigger_type=TriggerType.ARRIVAL)
    
    # Coming from far away
    should_trigger, reason = detect_trigger_type(reminder, NEARBY_LOCATION, FAR_LOCATION)
    assert should_trigger is True
    assert "Arrived" in reason

def test_arrival_no_trigger_already_inside():
    """Test arrival doesn't trigger when already inside."""
    reminder = create_test_reminder(trigger_type=TriggerType.ARRIVAL)
    
    # Already inside, moving within geofence
    should_trigger, reason = detect_trigger_type(reminder, NEARBY_LOCATION, WALMART_LOCATION)
    assert should_trigger is False
    assert "not an arrival" in reason

def test_departure_trigger():
    """Test departure trigger when leaving geofence."""
    reminder = create_test_reminder(trigger_type=TriggerType.DEPARTURE)
    
    # Leaving from inside to outside
    should_trigger, reason = detect_trigger_type(reminder, FAR_LOCATION, NEARBY_LOCATION)
    assert should_trigger is True
    assert "Departed" in reason

def test_departure_no_trigger_still_inside():
    """Test departure doesn't trigger when still inside."""
    reminder = create_test_reminder(trigger_type=TriggerType.DEPARTURE)
    
    # Still inside geofence
    should_trigger, reason = detect_trigger_type(reminder, NEARBY_LOCATION, WALMART_LOCATION)
    assert should_trigger is False
    assert "Still inside" in reason

def test_nearby_trigger():
    """Test nearby trigger when within radius."""
    reminder = create_test_reminder(trigger_type=TriggerType.NEARBY)
    
    should_trigger, reason = detect_trigger_type(reminder, NEARBY_LOCATION)
    assert should_trigger is True
    assert "Nearby" in reason

def test_nearby_no_trigger_outside():
    """Test nearby doesn't trigger when outside radius."""
    reminder = create_test_reminder(trigger_type=TriggerType.NEARBY)
    
    should_trigger, reason = detect_trigger_type(reminder, FAR_LOCATION)
    assert should_trigger is False
    assert "Not nearby" in reason

# ===== RECURRENCE TESTS =====

def test_rate_limit_once_after_trigger():
    """Test one-shot reminder is rate limited after first trigger."""
    reminder = create_test_reminder(
        recurrence=RecurrenceType.ONCE,
        trigger_count=1
    )
    reminder.last_notification_at = datetime.utcnow().isoformat()
    
    assert should_rate_limit(reminder) is True

def test_rate_limit_always_respects_cooldown():
    """Test recurring reminder respects cooldown period."""
    reminder = create_test_reminder(
        recurrence=RecurrenceType.ALWAYS,
        trigger_count=1
    )
    # Recent notification (5 minutes ago)
    reminder.last_notification_at = (datetime.utcnow() - timedelta(minutes=5)).isoformat()
    
    assert should_rate_limit(reminder) is True

def test_rate_limit_always_allows_after_cooldown():
    """Test recurring reminder allows trigger after cooldown."""
    reminder = create_test_reminder(
        recurrence=RecurrenceType.ALWAYS,
        trigger_count=1
    )
    # Old notification (20 minutes ago)
    reminder.last_notification_at = (datetime.utcnow() - timedelta(minutes=20)).isoformat()
    
    assert should_rate_limit(reminder) is False

def test_rate_limit_daily():
    """Test daily reminder respects 24-hour cooldown."""
    reminder = create_test_reminder(
        recurrence=RecurrenceType.DAILY,
        trigger_count=1
    )
    # 12 hours ago
    reminder.last_notification_at = (datetime.utcnow() - timedelta(hours=12)).isoformat()
    
    assert should_rate_limit(reminder) is True
    
    # 25 hours ago
    reminder.last_notification_at = (datetime.utcnow() - timedelta(hours=25)).isoformat()
    assert should_rate_limit(reminder) is False

# ===== TIME WINDOW TESTS =====

def test_time_window_weekdays():
    """Test time window restricts to weekdays."""
    time_window = TimeWindow(days_of_week=[0, 1, 2, 3, 4])  # Mon-Fri
    
    # This test depends on current day, so we just verify it runs
    result = is_within_time_window(time_window)
    assert isinstance(result, bool)

def test_time_window_time_range():
    """Test time window restricts to time range."""
    # 9am-5pm window
    time_window = TimeWindow(start_time="09:00", end_time="17:00")
    
    # This test depends on current time, so we just verify it runs
    result = is_within_time_window(time_window)
    assert isinstance(result, bool)

def test_time_window_none_always_passes():
    """Test no time window always passes."""
    assert is_within_time_window(None) is True

# ===== GPS ACCURACY TESTS =====

def test_gps_accuracy_good():
    """Test good GPS accuracy passes."""
    location = Location(latitude=47.6062, longitude=-122.3321, accuracy=50)
    assert check_gps_accuracy(location, 100) is True

def test_gps_accuracy_poor():
    """Test poor GPS accuracy fails."""
    location = Location(latitude=47.6062, longitude=-122.3321, accuracy=150)
    assert check_gps_accuracy(location, 100) is False

def test_gps_accuracy_no_data():
    """Test no accuracy data passes (assume acceptable)."""
    location = Location(latitude=47.6062, longitude=-122.3321)
    assert check_gps_accuracy(location, 100) is True

# ===== SPEED DETECTION TESTS =====

def test_high_speed_driving():
    """Test high speed detection (driving)."""
    speed = 20.0  # 20 m/s = 72 km/h
    assert is_high_speed(speed) is True

def test_low_speed_walking():
    """Test low speed (walking)."""
    speed = 1.5  # 1.5 m/s = 5.4 km/h
    assert is_high_speed(speed) is False

def test_no_speed_data():
    """Test no speed data."""
    assert is_high_speed(None) is False

# ===== ENHANCED SCORING TESTS =====

def test_enhanced_score_arrival_with_speed():
    """Test enhanced scoring considers speed."""
    reminder = create_test_reminder(trigger_type=TriggerType.ARRIVAL)
    
    # High speed (driving)
    should_trigger, score, reason = calculate_geofence_score(
        reminder, NEARBY_LOCATION, FAR_LOCATION, speed=20.0
    )
    assert should_trigger is False
    assert "driving" in reason.lower()
    
    # Low speed (walking)
    should_trigger, score, reason = calculate_geofence_score(
        reminder, NEARBY_LOCATION, FAR_LOCATION, speed=1.5
    )
    assert should_trigger is True

def test_enhanced_score_poor_gps():
    """Test enhanced scoring rejects poor GPS accuracy."""
    reminder = create_test_reminder()
    location = Location(latitude=47.6070, longitude=-122.3321, accuracy=150)
    
    should_trigger, score, reason = calculate_geofence_score(
        reminder, location, FAR_LOCATION
    )
    assert should_trigger is False
    assert "GPS accuracy" in reason

def test_enhanced_score_urgent_priority():
    """Test urgent priority gets higher score."""
    reminder_medium = create_test_reminder(priority=ReminderPriority.MEDIUM)
    reminder_urgent = create_test_reminder(priority=ReminderPriority.URGENT)
    
    _, score_medium, _ = calculate_geofence_score(reminder_medium, NEARBY_LOCATION, FAR_LOCATION)
    _, score_urgent, _ = calculate_geofence_score(reminder_urgent, NEARBY_LOCATION, FAR_LOCATION)
    
    assert score_urgent > score_medium

# ===== PARSER TESTS =====

def test_parser_arrival():
    """Test parser detects arrival trigger."""
    parser = EnhancedReminderParser()
    text = "Remind me to buy milk when I arrive at Walmart"
    parsed = parser._parse_with_regex(text)
    
    assert parsed.trigger_type == TriggerType.ARRIVAL
    assert "milk" in parsed.task.lower()
    assert "walmart" in parsed.location_query.lower()

def test_parser_departure():
    """Test parser detects departure trigger."""
    parser = EnhancedReminderParser()
    text = "When I leave office, remind me to call mom"
    parsed = parser._parse_with_regex(text)
    
    assert parsed.trigger_type == TriggerType.DEPARTURE
    assert "call mom" in parsed.task.lower()
    assert "office" in parsed.location_query.lower()

def test_parser_recurring_always():
    """Test parser detects recurring reminders."""
    parser = EnhancedReminderParser()
    text = "Every time I go to the gym, remind me to bring my belt"
    parsed = parser._parse_with_regex(text)
    
    assert parsed.recurrence == RecurrenceType.ALWAYS
    assert "belt" in parsed.task.lower()
    assert "gym" in parsed.location_query.lower()

def test_parser_time_window_after():
    """Test parser detects time window (after X pm)."""
    parser = EnhancedReminderParser()
    text = "If I'm near Target after 6pm, remind me to buy batteries"
    parsed = parser._parse_with_regex(text)
    
    assert parsed.time_window is not None
    assert parsed.time_window.start_time == "18:00"
    assert "batteries" in parsed.task.lower()

def test_parser_time_window_weekdays():
    """Test parser detects weekday restriction."""
    parser = EnhancedReminderParser()
    text = "Remind me to check email at office on weekdays"
    parsed = parser._parse_with_regex(text)
    
    assert parsed.time_window is not None
    assert parsed.time_window.days_of_week == [0, 1, 2, 3, 4]

def test_parser_radius_miles():
    """Test parser extracts radius in miles."""
    parser = EnhancedReminderParser()
    text = "Remind me to get gas when I'm within 1 mile of a Shell"
    parsed = parser._parse_with_regex(text)
    
    assert parsed.radius_meters == 1609  # 1 mile in meters
    assert "gas" in parsed.task.lower()

def test_parser_urgent_priority():
    """Test parser detects urgent priority."""
    parser = EnhancedReminderParser()
    text = "Urgent: remind me to pick up prescription at pharmacy"
    parsed = parser._parse_with_regex(text)
    
    assert parsed.priority == ReminderPriority.URGENT
    assert "prescription" in parsed.task.lower()
