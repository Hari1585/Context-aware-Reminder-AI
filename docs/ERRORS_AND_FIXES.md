# Errors and Fixes

## Current Errors

### 1. ❌ Missing Imports in Enhanced Files

**Files Affected**:
- `backend/src/services/geofence_enhanced.py`
- `backend/src/services/parser_enhanced.py`
- `backend/src/handlers/evaluator_handler_enhanced.py`

**Error**: Import statements reference models without proper path
```python
from models.reminder import ...  # ❌ Should be relative import
```

**Fix**: Use relative imports
```python
from ..models.reminder import ...  # ✅ Correct
```

### 2. ❌ DynamoDB Service Missing New Fields

**File**: `backend/src/services/db.py`

**Error**: `create_reminder()` doesn't accept new fields:
- `trigger_type`
- `recurrence`
- `time_window`
- `dwell_time_seconds`
- `min_gps_accuracy`
- `trigger_count`
- `last_location`

**Impact**: Enhanced reminders can't be stored in database

### 3. ❌ API Handler Not Using Enhanced Parser

**File**: `backend/src/handlers/api_handler.py`

**Error**: Still imports original parser
```python
from services.parser import ReminderParser  # ❌ Original
```

**Should be**:
```python
from services.parser_enhanced import EnhancedReminderParser  # ✅ Enhanced
```

### 4. ❌ Evaluator Handler Not Deployed

**File**: `infra/lib/api-stack.ts`

**Error**: Lambda still uses original evaluator handler
```typescript
handler: 'handlers.evaluator_handler.handler'  // ❌ Original
```

**Should be**:
```typescript
handler: 'handlers.evaluator_handler_enhanced.handler'  // ✅ Enhanced
```

### 5. ⚠️ Python Type Hints Compatibility

**File**: `backend/src/models/reminder.py`

**Warning**: `list[int]` syntax requires Python 3.9+
```python
days_of_week: Optional[list[int]] = None  # ⚠️ Python 3.9+
```

**Fix for Python 3.8 compatibility**:
```python
from typing import List
days_of_week: Optional[List[int]] = None  # ✅ Python 3.8+
```

### 6. ⚠️ Frontend TypeScript Compilation

**File**: `infra/tsconfig.json`

**Warning**: TypeScript compilation not tested

**Action**: Need to run `npm install` in infra folder first

## Quick Fixes

### Fix 1: Update Import Statements

All enhanced files need relative imports. Here's the pattern:

```python
# In backend/src/services/geofence_enhanced.py
from ..models.reminder import (  # ✅ Relative import
    Location, ReminderResponse, ReminderPriority, 
    TriggerType, RecurrenceType, TimeWindow
)
from ..utils.config import settings
from ..utils.logger import get_logger
```

### Fix 2: Update DynamoDB Service

Add new fields to `create_reminder()` and `_item_to_reminder()`:

```python
def create_reminder(
    self,
    user_id: str,
    task: str,
    location_query: str,
    location: Optional[Location],
    radius_meters: int,
    priority: ReminderPriority,
    time_constraints: Optional[str] = None,
    trigger_type: TriggerType = TriggerType.ARRIVAL,  # NEW
    recurrence: RecurrenceType = RecurrenceType.ONCE,  # NEW
    time_window: Optional[TimeWindow] = None,  # NEW
    dwell_time_seconds: int = 60,  # NEW
    min_gps_accuracy: int = 100  # NEW
) -> ReminderResponse:
    # ... existing code ...
    
    item = {
        # ... existing fields ...
        'trigger_type': trigger_type.value,  # NEW
        'recurrence': recurrence.value,  # NEW
        'dwell_time_seconds': dwell_time_seconds,  # NEW
        'min_gps_accuracy': min_gps_accuracy,  # NEW
        'trigger_count': 0,  # NEW
    }
    
    if time_window:
        item['time_window'] = time_window.model_dump()  # NEW
```

### Fix 3: Update API Handler

```python
# backend/src/handlers/api_handler.py

# Change import
from services.parser_enhanced import EnhancedReminderParser  # ✅

# Update parser instantiation
parser = EnhancedReminderParser()

# Update create_reminder call
reminder = db.create_reminder(
    user_id=user_id,
    task=parsed.task,
    location_query=parsed.location_query,
    location=location,
    radius_meters=radius,
    priority=parsed.priority,
    time_constraints=parsed.time_constraints,
    trigger_type=parsed.trigger_type,  # NEW
    recurrence=parsed.recurrence,  # NEW
    time_window=parsed.time_window,  # NEW
    dwell_time_seconds=parsed.dwell_time_seconds,  # NEW
    min_gps_accuracy=parsed.min_gps_accuracy  # NEW
)
```

### Fix 4: Update CDK Stack

```typescript
// infra/lib/api-stack.ts

const evaluatorLambda = new lambda.Function(this, 'EvaluatorFunction', {
  // ... existing config ...
  handler: 'handlers.evaluator_handler_enhanced.handler',  // ✅ Changed
  // ... rest of config ...
});
```

### Fix 5: Python 3.8 Compatibility

```python
# backend/src/models/reminder.py

from typing import Optional, Dict, Any, List  # Add List

class TimeWindow(BaseModel):
    """Time constraints for reminders"""
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    days_of_week: Optional[List[int]] = None  # ✅ Changed from list[int]
```

## Testing Checklist

### Backend Tests
```bash
cd backend
pip install -r requirements.txt
python -m pytest tests/ -v
```

**Expected**: All tests pass

### Infrastructure Tests
```bash
cd infra
npm install
npm run build
npx cdk synth --context env=dev
```

**Expected**: No TypeScript errors, CloudFormation templates generated

### Frontend Tests
```bash
cd frontend
npm install
npm run build
```

**Expected**: Static site built successfully

## Deployment Impact

### Low Risk (Backward Compatible)
- ✅ New fields have default values
- ✅ Existing reminders continue to work
- ✅ No breaking API changes

### Medium Risk (Requires Testing)
- ⚠️ Database schema changes (new fields)
- ⚠️ Lambda handler changes (new logic)
- ⚠️ Parser changes (new patterns)

### Recommended Deployment Strategy

1. **Test in Dev First**
   ```bash
   cd infra
   npm run deploy:dev
   ```

2. **Verify Existing Reminders Work**
   - Create old-style reminder
   - Verify it triggers correctly

3. **Test New Features**
   - Create arrival reminder
   - Create departure reminder
   - Create recurring reminder
   - Verify all trigger correctly

4. **Monitor Logs**
   ```bash
   aws logs tail /aws/lambda/reminder-app-dev-api --follow
   aws logs tail /aws/lambda/reminder-app-dev-evaluator --follow
   ```

5. **Deploy to Prod**
   ```bash
   cd infra
   npm run deploy:prod
   ```

## Rollback Plan

If issues occur:

1. **Revert Lambda Handler**
   ```typescript
   handler: 'handlers.evaluator_handler.handler'  // Original
   ```

2. **Revert API Handler**
   ```python
   from services.parser import ReminderParser  // Original
   ```

3. **Redeploy**
   ```bash
   cd infra
   npm run deploy:dev
   ```

## Status Summary

| Issue | Severity | Status | Fix Required |
|-------|----------|--------|--------------|
| Import paths | High | ❌ Not Fixed | Update all imports to relative |
| DB service | High | ❌ Not Fixed | Add new fields support |
| API handler | Medium | ❌ Not Fixed | Use enhanced parser |
| CDK stack | Medium | ❌ Not Fixed | Use enhanced evaluator |
| Python 3.8 | Low | ⚠️ Warning | Change list[int] to List[int] |
| TypeScript | Low | ⚠️ Unknown | Run npm install + build |

## Next Steps

1. **Fix import statements** in all enhanced files
2. **Update db.py** to support new fields
3. **Update api_handler.py** to use enhanced parser
4. **Update api-stack.ts** to use enhanced evaluator
5. **Test locally** with pytest
6. **Deploy to dev** and verify
7. **Deploy to prod** after testing

## Estimated Time to Fix

- Import fixes: 10 minutes
- DB service update: 20 minutes
- API handler update: 10 minutes
- CDK stack update: 5 minutes
- Testing: 30 minutes
- **Total: ~75 minutes**

## Conclusion

All errors are **fixable and non-breaking**. The enhanced features are opt-in and backward compatible. Once fixed, the system will support all 20 use cases as documented.
