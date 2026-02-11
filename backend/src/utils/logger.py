import logging
import json
import sys
from datetime import datetime
from typing import Any, Dict

class StructuredLogger:
    def __init__(self, name: str, level: str = 'INFO'):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(getattr(logging, level.upper()))
        
        if not self.logger.handlers:
            handler = logging.StreamHandler(sys.stdout)
            handler.setFormatter(logging.Formatter('%(message)s'))
            self.logger.addHandler(handler)
    
    def _log(self, level: str, message: str, **kwargs: Any):
        log_entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'level': level,
            'message': message,
            **kwargs
        }
        self.logger.log(getattr(logging, level), json.dumps(log_entry))
    
    def info(self, message: str, **kwargs: Any):
        self._log('INFO', message, **kwargs)
    
    def error(self, message: str, **kwargs: Any):
        self._log('ERROR', message, **kwargs)
    
    def warning(self, message: str, **kwargs: Any):
        self._log('WARNING', message, **kwargs)
    
    def debug(self, message: str, **kwargs: Any):
        self._log('DEBUG', message, **kwargs)

def get_logger(name: str) -> StructuredLogger:
    from .config import settings
    return StructuredLogger(name, settings.LOG_LEVEL)
