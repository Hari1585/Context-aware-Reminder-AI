import re
import json
import boto3
from typing import Optional
from openai import OpenAI
from models.reminder import ParsedReminder, ReminderPriority
from utils.config import settings
from utils.logger import get_logger

logger = get_logger(__name__)

class ReminderParser:
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
- priority: "low" | "medium" | "high" (default "medium")

Examples:
Input: "Remind me to buy milk when I'm near Walmart"
Output: {"task": "buy milk", "location_query": "Walmart", "radius_meters": 500, "time_constraints": null, "priority": "medium"}

Input: "Pick up dry cleaning at Main St Cleaners, urgent"
Output: {"task": "pick up dry cleaning", "location_query": "Main St Cleaners", "radius_meters": 500, "time_constraints": null, "priority": "high"}
"""
        
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text}
            ],
            temperature=0.1,
            max_tokens=200,
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content
        data = json.loads(content)
        
        # Validate and create ParsedReminder
        parsed = ParsedReminder(**data)
        logger.info('LLM parsing successful', text=text, parsed=parsed.model_dump())
        return parsed
    
    def _parse_with_regex(self, text: str) -> ParsedReminder:
        """Deterministic fallback parser using regex patterns."""
        # Extract task (everything before location indicators)
        location_patterns = [
            r'\b(?:at|near|by|around|close to)\b',
            r'\bwhen\s+(?:I\'m|im)\s+(?:at|near)\b'
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
        if re.search(r'\b(urgent|important|asap|critical)\b', text, re.IGNORECASE):
            priority = ReminderPriority.HIGH
        elif re.search(r'\b(low priority|when you can|sometime)\b', text, re.IGNORECASE):
            priority = ReminderPriority.LOW
        
        # Extract radius
        radius_match = re.search(r'within\s+(\d+)\s*(m|meters|ft|feet)', text, re.IGNORECASE)
        radius_meters = settings.DEFAULT_RADIUS_METERS
        if radius_match:
            value = int(radius_match.group(1))
            unit = radius_match.group(2).lower()
            if unit in ['ft', 'feet']:
                radius_meters = int(value * 0.3048)
            else:
                radius_meters = value
        
        # Extract time constraints
        time_constraints = None
        time_match = re.search(r'(weekdays?|weekends?|mornings?|evenings?|[\d:apm\s-]+)', text, re.IGNORECASE)
        if time_match:
            time_constraints = time_match.group(1)
        
        if not location_query:
            location_query = "unknown location"
        
        parsed = ParsedReminder(
            task=task or "reminder",
            location_query=location_query,
            radius_meters=radius_meters,
            time_constraints=time_constraints,
            priority=priority
        )
        
        logger.info('Regex parsing successful', text=text, parsed=parsed.model_dump())
        return parsed
