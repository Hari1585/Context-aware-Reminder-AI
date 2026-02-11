import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ENV: str = os.getenv('ENV', 'dev')
    TABLE_NAME: str = os.getenv('TABLE_NAME', '')
    QUEUE_URL: str = os.getenv('QUEUE_URL', '')
    TOPIC_ARN: str = os.getenv('TOPIC_ARN', '')
    USER_POOL_ID: str = os.getenv('USER_POOL_ID', '')
    REGION: str = os.getenv('REGION', 'us-east-1')
    LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'INFO')
    OPENAI_API_KEY_PARAM: str = f"/reminder-app/{os.getenv('ENV', 'dev')}/openai-api-key"
    DEFAULT_RADIUS_METERS: int = 500
    RATE_LIMIT_SECONDS: int = 900  # 15 minutes
    GEOFENCE_SCORE_THRESHOLD: float = 0.7

settings = Settings()
