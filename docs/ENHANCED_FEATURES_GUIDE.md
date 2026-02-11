# Enhanced Features Guide

## Quick Reference

### Trigger Types

| Type | Description | Example |
|------|-------------|---------|
| `arrival` | Enter geofence | "When I arrive at Walmart" |
| `departure` | Exit geofence | "When I leave office" |
| `nearby` | Within radius | "When I'm near Shell" |
| `dwell` | Stay for duration | "While I'm at the gym" |

### Recurrence Types

| Type | Description | Cooldown | Example |
|------|-------------|----------|---------|
| `once` | One-shot | N/A (completes) | "Next time I'm near..." |
| `always` | Every time | 15 minutes | "Every time I go to..." |
| `daily` | Once per day | 24 hours | "Daily when I'm at..." |
| `weekly` | Once per week | 7 days | "Weekly when I'm at..." |

### Priority Levels

| Priority | Score Multiplier | Example |
|----------|------------------|---------|
| `low` | 0.9x | "When you can..." |
| `medium` | 1.0x | Default |
| `high` | 1.1x | "High priority..." |
| `urgent` | 1.2x | "Urgent: ..." |

## Natural Language Examples

### Basic Reminders

```
"Remind me to buy milk when I arrive at Walmart"
→ trigger_type: arrival
→ recurrence: once
→ priority: medium
→ radius: 500m

"Remind me to get gas when I'm near Shell"
→ trigger_type: nearby
→ recurrence: once
→ priority: medium
→ radius: 500m
```

### Departure Reminders

```
"When I leave office, remind me to call mom"
→ trigger_type: departure
→ recurrence: once

"Every time I leave home, remind me to lock the door"
→ trigger_type: departure
→ recurrence: always
```

### Recurring Reminders

```
"Every time I go to the gym, remind me to bring my belt"
→ trigger_type: arrival
→ recurrence: always
→ cooldown: 15 minutes

"Daily when I'm at office, remind me to check email"
→ trigger_type: arrival
→ recurrence: daily
→ cooldown: 24 hours
```

### Time Windows

```
"If I'm near Target after 6pm, remind me to buy batteries"
→ time_window: {start_time: "18:00"}

"When I'm at office on weekdays, remind me to send standup"
→ time_window: {days_of_week: [0,1,2,3,4]}

"When I arrive at gym in the morning, remind me to stretch"
→ trigger_type: arrival
→ time_window: {start_time: "06:00", end_time: "12:00"}
```

### Priority & Urgency

```
"Urgent: remind me to pick up prescription at pharmacy"
→ priority: urgent
→ score_multiplier: 1.2x

"High priority: remind me ASAP when near pharmacy"
→ priority: high
→ score_multiplier: 1.1x
```

### Custom Radius

```
"Remind me to get gas when I'm within 1 mile of Shell"
→ radius: 1609 meters (1 mile)

"When I'm within 500 meters of office, remind me to badge in"
→ radius: 500 meters

"Remind me when I'm close to Target, within 200 feet"
→ radius: 61 meters (200 feet)
```

### Complex Combinations

```
"Every time I arrive at office on weekdays after 9am, remind me to send standup"
→ trigger_type: arrival
→ recurrence: always
→ time_window: {start_time: "09:00", days_of_week: [0,1,2,3,4]}

"When I leave gym in the evening, remind me to buy protein shake"
→ trigger_type: departure
→ time_window: {start_time: "18:00", end_time: "23:00"}

"Urgent: every time I'm near pharmacy, remind me to pick up prescription"
→ trigger_type: nearby
→ recurrence: always
→ priority: urgent
```

## API Usage

### Create Reminder (Enhanced)

```bash
curl -X POST https://API_URL/dev/reminders \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Every time I arrive at gym, remind me to bring my belt",
    "override_trigger_type": "arrival",
    "override_recurrence": "always"
  }'
```

**Response**:
```json
{
  "id": "abc123",
  "user_id": "user-456",
  "task": "bring my belt",
  "location_query": "gym",
  "location": null,
  "radius_meters": 300,
  "status": "active",
  "priority": "medium",
  "trigger_type": "arrival",
  "recurrence": "always",
  "time_window": null,
  "dwell_time_seconds": 60,
  "min_gps_accuracy": 100,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z",
  "trigger_count": 0
}
```

### Post Location Event (Enhanced)

```bash
curl -X POST https://API_URL/dev/location-events \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "location": {
      "latitude": 47.6062,
      "longitude": -122.3321,
      "accuracy": 50
    },
    "speed": 1.5,
    "heading": 180,
    "activity": "walking"
  }'
```

**Fields**:
- `location.accuracy`: GPS accuracy in meters (optional)
- `speed`: Speed in m/s (optional, used for driving detection)
- `heading`: Direction in degrees 0-360 (optional, future use)
- `activity`: "stationary", "walking", "driving" (optional)

## Frontend Integration

### Enhanced Location Event Posting

```typescript
// frontend/src/lib/api.ts

async function postLocationWithContext() {
  // Get location
  const position = await navigator.geolocation.getCurrentPosition();
  
  // Get speed (if available)
  const speed = position.coords.speed; // m/s
  
  // Get heading (if available)
  const heading = position.coords.heading; // degrees
  
  // Detect activity (simplified)
  const activity = speed && speed > 5 ? 'driving' : 
                   speed && speed > 0.5 ? 'walking' : 
                   'stationary';
  
  // Post to API
  await apiClient.postLocationEvent({
    location: {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy
    },
    speed,
    heading,
    activity
  });
}
```

### Create Reminder with Overrides

```typescript
// frontend/src/components/CreateReminder.tsx

async function createReminder(text: string) {
  const reminder = await apiClient.createReminder({
    text,
    override_trigger_type: 'arrival',  // Optional
    override_recurrence: 'always',     // Optional
    override_radius: 1000              // Optional (meters)
  });
  
  console.log('Created:', reminder);
}
```

## Backend Integration

### Using Enhanced Services

```python
# backend/src/handlers/api_handler.py

from services.parser_enhanced import EnhancedReminderParser
from services.geofence_enhanced import calculate_geofence_score

# Parse with enhanced parser
parser = EnhancedReminderParser()
parsed = parser.parse("Every time I arrive at gym, remind me to bring my belt")

print(parsed.trigger_type)  # TriggerType.ARRIVAL
print(parsed.recurrence)    # RecurrenceType.ALWAYS
print(parsed.task)          # "bring my belt"
print(parsed.location_query) # "gym"
```

### Evaluating with Enhanced Logic

```python
# backend/src/handlers/evaluator_handler_enhanced.py

from services.geofence_enhanced import calculate_geofence_score

# Evaluate reminder
should_trigger, score, reason = calculate_geofence_score(
    reminder=reminder,
    current_location=current_location,
    previous_location=previous_location,
    speed=speed,
    activity=activity
)

if should_trigger:
    print(f"Triggered! Score: {score:.2f}, Reason: {reason}")
else:
    print(f"Not triggered. Reason: {reason}")
```

## Configuration

### Adjusting Thresholds

```python
# backend/src/utils/config.py

class Settings(BaseSettings):
    # Geofence
    DEFAULT_RADIUS_METERS: int = 500
    GEOFENCE_SCORE_THRESHOLD: float = 0.7
    
    # Rate limiting
    RATE_LIMIT_SECONDS: int = 900  # 15 minutes
    
    # GPS accuracy
    DEFAULT_MIN_GPS_ACCURACY: int = 100  # meters
    
    # Speed detection
    HIGH_SPEED_THRESHOLD: float = 13.89  # m/s (50 km/h)
    
    # Dwell time
    DEFAULT_DWELL_TIME_SECONDS: int = 60
```

### Per-Reminder Configuration

```python
# Override defaults per reminder
reminder = create_reminder(
    text="...",
    radius_meters=1000,           # Custom radius
    min_gps_accuracy=50,          # Stricter GPS requirement
    dwell_time_seconds=120        # 2-minute dwell time
)
```

## Monitoring

### CloudWatch Metrics

```bash
# Trigger type distribution
aws cloudwatch get-metric-statistics \
  --namespace ReminderApp \
  --metric-name TriggerType \
  --dimensions Name=Type,Value=arrival \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum

# Recurrence type distribution
aws cloudwatch get-metric-statistics \
  --namespace ReminderApp \
  --metric-name RecurrenceType \
  --dimensions Name=Type,Value=always \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

### Structured Logs

```json
{
  "timestamp": "2024-01-01T00:00:00Z",
  "level": "INFO",
  "message": "Reminder triggered",
  "reminder_id": "abc123",
  "user_id": "user-456",
  "trigger_type": "arrival",
  "recurrence": "always",
  "score": 0.85,
  "reason": "Arrived at location (95m)",
  "speed": 1.5,
  "activity": "walking",
  "gps_accuracy": 50
}
```

## Troubleshooting

### Reminder Not Triggering

**Check GPS Accuracy**:
```python
# Location accuracy too low
location.accuracy = 150  # > 100m threshold
# Solution: Wait for better GPS signal
```

**Check Speed**:
```python
# User is driving
speed = 20.0  # 72 km/h
# Solution: Notification delayed until user stops
```

**Check Time Window**:
```python
# Outside time window
time_window = TimeWindow(start_time="18:00")  # After 6pm
current_time = "14:00"  # 2pm
# Solution: Wait until 6pm
```

**Check Rate Limit**:
```python
# Recently triggered
last_notification_at = "5 minutes ago"
recurrence = RecurrenceType.ALWAYS
cooldown = 15 minutes
# Solution: Wait 10 more minutes
```

### Departure Not Detected

**Check Previous Location**:
```python
# No previous location
previous_location = None
# Solution: Wait for next location update
```

**Check Geofence**:
```python
# Still inside geofence
current_distance = 400m
radius = 500m
# Solution: Move further away
```

### Parser Not Detecting Pattern

**Check Keywords**:
```python
# Missing trigger keyword
text = "Remind me to buy milk at Walmart"
# Missing: "arrive", "leave", "near"
# Solution: Add trigger keyword: "when I arrive at Walmart"
```

**Use Overrides**:
```python
# Force trigger type
create_reminder(
    text="Buy milk at Walmart",
    override_trigger_type=TriggerType.ARRIVAL
)
```

## Best Practices

### 1. Use Specific Trigger Types
```
❌ "Remind me to buy milk at Walmart"
✅ "Remind me to buy milk when I arrive at Walmart"
```

### 2. Specify Recurrence Clearly
```
❌ "Remind me to bring belt at gym"
✅ "Every time I go to gym, remind me to bring belt"
```

### 3. Add Time Windows for Context
```
❌ "Remind me to buy batteries at Target"
✅ "If I'm near Target after 6pm, remind me to buy batteries"
```

### 4. Use Priority for Important Reminders
```
❌ "Remind me to pick up prescription"
✅ "Urgent: remind me to pick up prescription at pharmacy"
```

### 5. Specify Radius for Large Areas
```
❌ "Remind me to get gas near highway"
✅ "Remind me to get gas within 1 mile of Shell on highway"
```

## Migration from Original Version

### Backward Compatibility

All existing reminders continue to work with default values:
- `trigger_type`: `ARRIVAL` (default)
- `recurrence`: `ONCE` (default)
- `time_window`: `None` (no restrictions)

### Gradual Migration

1. Deploy enhanced version alongside original
2. Test with new reminders
3. Migrate existing reminders (optional)
4. Switch to enhanced version fully

### No Breaking Changes

- API contracts unchanged
- Database schema backward compatible
- Frontend works with both versions

## Conclusion

The enhanced features provide powerful capabilities while maintaining simplicity and backward compatibility. All features are production-ready, tested, and documented.

For more information:
- [USE_CASES.md](USE_CASES.md) - Complete use case coverage
- [ENHANCEMENTS_SUMMARY.md](ENHANCEMENTS_SUMMARY.md) - What was added
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [RUNBOOK.md](RUNBOOK.md) - Operations guide
