"""
Enhanced NLP parser supporting multiple trigger types and use cases.
Detects: arrival, departure, nearby, recurring, time windows, saved places.
"""
import re
import json
import boto3
import sys
import os
from typing import Optional
from openai import OpenAI

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.reminder import (
    ParsedReminder, ReminderPriority, TriggerType, 
    RecurrenceType, TimeWindow
)
from utils.config import settings
from utils.logger import get_logger

logger = get_logger(__name__)

class EnhancedReminderParser:
    def __init__(self):
        self.ssm = boto3.client('ssm', region_name=settings.REGION)
        self._openai_client: Optional[OpenAI] = None
    
    def _get_openai_client(self) -> OpenAI:
        if not self._openai_client:
            try:
                response = self.ssm.get_parameter(
                    Name=settings.OPENAI_API_KEY_PARAM,
                    WithDecryption=True
                )
                api_key = response['Parameter']['Value']
                self._openai_client = OpenAI(api_key=api_key)
            except Exception as e:
                logger.error('Failed to get OpenAI API key', error=str(e))
                raise
        return self._openai_client
    
    def parse(self, text: str) -> ParsedReminder:
        """Parse reminder text using LLM with fallback to regex."""
        try:
            return self._parse_with_llm(text)
        except Exception as e:
            logger.warning('LLM parsing failed, using fallback', error=str(e))
            return self._parse_with_regex(text)
    
    def _parse_with_llm(self, text: str) -> ParsedReminder:
        client = self._get_openai_client()
        
        system_prompt = """You are a reminder parser. Extract structured data from natural language reminders.
Output ONLY valid JSON with these fields:
- task: string (what to remind)
- location_query: string (place name or address)
- radius_meters: integer (50-10000, default 500)
- time_constraints: string or null (e.g., "weekdays 9am-5pm")
- priority: "low" | "medium" | "high" | "urgent" (default "medium")
- trigger_type: "arrival" | "departure" | "nearby" | "dwell" (default "arrival")
- recurrence: "once" | "always" | "daily" | "weekly" (default "once")
- time_window: object or null with {start_time: "HH:MM", end_time: "HH:MM", days_of_week: [0-6]}
- dwell_time_seconds: integer (default 60)
- min_gps_accuracy: integer (default 100)

Trigger type detection:
- "arrive", "reach", "get to", "when I'm at" → arrival
- "leave", "exit", "depart from" → departure
- "near", "close to", "within X of" → nearby
- "stay at", "while at" → dwell

Recurrence detection:
- "every time", "always", "whenever" → always
- "once", "next time", "only once" → once
- "daily", "every day" → daily
- "weekly", "every week" → weekly

Time window detection:
- "after 6pm" → {start_time: "18:00", end_time: null}
- "weekdays" → {days_of_week: [0,1,2,3,4]}
- "mornings" → {start_time: "06:00", end_time: "12:00"}

Examples:
Input: "Remind me to buy milk when I arrive at Walmart"
Output: {"task": "buy milk", "location_query": "Walmart", "radius_meters": 500, "time_constraints": null, "priority": "medium", "trigger_type": "arrival", "recurrence": "once", "time_window": null, "dwell_time_seconds": 60, "min_gps_accuracy": 100}

Input: "When I leave office, remind me to call mom"
Output: {"task": "call mom", "location_query": "office", "radius_meters": 200, "time_constraints": null, "priority": "medium", "trigger_type": "departure", "recurrence": "once", "time_window": null, "dwell_time_seconds": 60, "min_gps_accuracy": 100}

Input: "Every time I go to the gym, remind me to bring my belt"
Output: {"task": "bring my belt", "location_query": "gym", "radius_meters": 300, "time_constraints": null, "priority": "medium", "trigger_type": "arrival", "recurrence": "always", "time_window": null, "dwell_time_seconds": 60, "min_gps_accuracy": 100}

Input: "If I'm near Target after 6pm, remind me to buy batteries"
Output: {"task": "buy batteries", "location_query": "Target", "radius_meters": 500, "time_constraints": "after 6pm", "priority": "medium", "trigger_type": "nearby", "recurrence": "once", "time_window": {"start_time": "18:00", "end_time": null, "days_of_week": null}, "dwell_time_seconds": 60, "min_gps_accuracy": 100}

Input: "Remind me to get gas when I'm within 1 mile of a Shell, urgent"
Output: {"task": "get gas", "location_query": "Shell", "radius_meters": 1609, "time_constraints": null, "priority": "urgent", "trigger_type": "nearby", "recurrence": "once", "time_window": null, "dwell_time_seconds": 60, "min_gps_accuracy": 100}
"""
        
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ],
            temperature=0.1,
            max_tokens=300,
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content
        data = json.loads(content)
        
        # Parse time_window if present
        if data.get('time_window'):
            data['time_window'] = TimeWindow(**data['time_window'])
        
        # Validate and create ParsedReminder
        parsed = ParsedReminder(**data)
        logger.info('LLM parsing successful', text=text, parsed=parsed.model_dump())
        return parsed
    
    def _parse_with_regex(self, text: str) -> ParsedReminder:
        """Enhanced deterministic fallback parser using regex patterns."""
        
        # Detect trigger type
        trigger_type = TriggerType.ARRIVAL  # default
        if re.search(r'\b(leave|exit|depart|leaving|exiting)\b', text, re.IGNORECASE):
            trigger_type = TriggerType.DEPARTURE
        elif re.search(r'\b(near|close to|within|around)\b', text, re.IGNORECASE):
            trigger_type = TriggerType.NEARBY
        elif re.search(r'\b(stay|while at|during)\b', text, re.IGNORECASE):
            trigger_type = TriggerType.DWELL
        
        # Detect recurrence
        recurrence = RecurrenceType.ONCE  # default
        if re.search(r'\b(every time|always|whenever|each time)\b', text, re.IGNORECASE):
            recurrence = RecurrenceType.ALWAYS
        elif re.search(r'\b(daily|every day)\b', text, re.IGNORECASE):
            recurrence = RecurrenceType.DAILY
        elif re.search(r'\b(weekly|every week)\b', text, re.IGNORECASE):
            recurrence = RecurrenceType.WEEKLY
        
        # Extract task and location
        location_patterns = [
            r'\b(?:at|near|by|around|close to)\b',
            r'\bwhen\s+(?:I\'m|im|I am)\s+(?:at|near)\b',
            r'\b(?:arrive|reach|get to)\b',
            r'\b(?:leave|exit|depart from)\b'
        ]
        
        task = text
        location_query = ""
        
        for pattern in location_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                task = text[:match.start()].strip()
                location_query = text[match.end():].strip()
                break
        
        # Clean up task
        task = re.sub(r'^(?:remind me to|remind me|remember to)\s+', '', task, flags=re.IGNORECASE)
        task = task.strip()
        
        # Extract priority
        priority = ReminderPriority.MEDIUM
        if re.search(r'\b(urgent|asap|critical|important)\b', text, re.IGNORECASE):
            priority = ReminderPriority.URGENT
        elif re.search(r'\b(high priority)\b', text, re.IGNORECASE):
            priority = ReminderPriority.HIGH
        elif re.search(r'\b(low priority|when you can|sometime)\b', text, re.IGNORECASE):
            priority = ReminderPriority.LOW
        
        # Extract radius
        radius_match = re.search(r'within\s+(\d+(?:\.\d+)?)\s*(m|meters|km|kilometers|mi|miles|ft|feet)', text, re.IGNORECASE)
        radius_meters = settings.DEFAULT_RADIUS_METERS
        if radius_match:
            value = float(radius_match.group(1))
            unit = radius_match.group(2).lower()
            if unit in ['km', 'kilometers']:
                radius_meters = int(value * 1000)
            elif unit in ['mi', 'miles']:
                radius_meters = int(value * 1609.34)
            elif unit in ['ft', 'feet']:
                radius_meters = int(value * 0.3048)
            else:
                radius_meters = int(value)
        
        # Extract time window
        time_window = None
        time_constraints = None
        
        # After/before time
        after_match = re.search(r'after\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?', text, re.IGNORECASE)
        if after_match:
            hour = int(after_match.group(1))
            minute = int(after_match.group(2)) if after_match.group(2) else 0
            period = after_match.group(3)
            
            if period and period.lower() == 'pm' and hour < 12:
                hour += 12
            elif period and period.lower() == 'am' and hour == 12:
                hour = 0
            
            time_window = TimeWindow(
                start_time=f"{hour:02d}:{minute:02d}",
                end_time=None,
                days_of_week=None
            )
            time_constraints = f"after {hour:02d}:{minute:02d}"
        
        # Weekdays/weekends
        if re.search(r'\bweekdays?\b', text, re.IGNORECASE):
            if time_window:
                time_window.days_of_week = [0, 1, 2, 3, 4]
            else:
                time_window = TimeWindow(days_of_week=[0, 1, 2, 3, 4])
            time_constraints = "weekdays"
        elif re.search(r'\bweekends?\b', text, re.IGNORECASE):
            if time_window:
                time_window.days_of_week = [5, 6]
            else:
                time_window = TimeWindow(days_of_week=[5, 6])
            time_constraints = "weekends"
        
        # Mornings/evenings
        if re.search(r'\bmornings?\b', text, re.IGNORECASE):
            time_window = TimeWindow(start_time="06:00", end_time="12:00")
            time_constraints = "mornings"
        elif re.search(r'\bevenings?\b', text, re.IGNORECASE):
            time_window = TimeWindow(start_time="18:00", end_time="23:00")
            time_constraints = "evenings"
        
        if not location_query:
            location_query = "unknown location"
        
        parsed = ParsedReminder(
            task=task or "reminder",
            location_query=location_query,
            radius_meters=radius_meters,
            time_constraints=time_constraints,
            priority=priority,
            trigger_type=trigger_type,
            recurrence=recurrence,
            time_window=time_window,
            dwell_time_seconds=60,
            min_gps_accuracy=100
        )
        
        logger.info('Regex parsing successful', text=text, parsed=parsed.model_dump())
        return parsed
