import pytest
from unittest.mock import Mock, patch
from services.parser import ReminderParser
from models.reminder import ReminderPriority

@pytest.fixture
def parser():
    return ReminderParser()

def test_regex_parser_basic(parser):
    """Test basic reminder parsing with regex fallback."""
    text = "Remind me to buy milk when I'm near Walmart"
    parsed = parser._parse_with_regex(text)
    
    assert parsed.task == "buy milk"
    assert "walmart" in parsed.location_query.lower()
    assert parsed.radius_meters == 500
    assert parsed.priority == ReminderPriority.MEDIUM

def test_regex_parser_urgent(parser):
    """Test urgent priority detection."""
    text = "Pick up prescription at CVS, urgent"
    parsed = parser._parse_with_regex(text)
    
    assert "prescription" in parsed.task.lower()
    assert "cvs" in parsed.location_query.lower()
    assert parsed.priority == ReminderPriority.HIGH

def test_regex_parser_with_radius(parser):
    """Test radius extraction."""
    text = "Remind me to call John when near office within 200 meters"
    parsed = parser._parse_with_regex(text)
    
    assert "call john" in parsed.task.lower()
    assert "office" in parsed.location_query.lower()
    assert parsed.radius_meters == 200

def test_regex_parser_low_priority(parser):
    """Test low priority detection."""
    text = "Buy coffee at Starbucks when you can"
    parsed = parser._parse_with_regex(text)
    
    assert parsed.priority == ReminderPriority.LOW

@patch('services.parser.OpenAI')
@patch('services.parser.boto3.client')
def test_llm_parser_success(mock_boto_client, mock_openai, parser):
    """Test LLM parsing with mocked OpenAI response."""
    # Mock SSM
    mock_ssm = Mock()
    mock_ssm.get_parameter.return_value = {
        'Parameter': {'Value': 'fake-api-key'}
    }
    mock_boto_client.return_value = mock_ssm
    
    # Mock OpenAI
    mock_client = Mock()
    mock_response = Mock()
    mock_response.choices = [Mock()]
    mock_response.choices[0].message.content = '''
    {
        "task": "buy groceries",
        "location_query": "Whole Foods",
        "radius_meters": 500,
        "time_constraints": null,
        "priority": "medium"
    }
    '''
    mock_client.chat.completions.create.return_value = mock_response
    mock_openai.return_value = mock_client
    
    text = "Remind me to buy groceries at Whole Foods"
    parsed = parser._parse_with_llm(text)
    
    assert parsed.task == "buy groceries"
    assert parsed.location_query == "Whole Foods"
    assert parsed.priority == ReminderPriority.MEDIUM

def test_parser_fallback_on_llm_failure(parser):
    """Test that parser falls back to regex when LLM fails."""
    with patch.object(parser, '_parse_with_llm', side_effect=Exception("LLM error")):
        text = "Remind me to buy milk near Walmart"
        parsed = parser.parse(text)
        
        # Should succeed with regex fallback
        assert parsed.task == "buy milk"
        assert "walmart" in parsed.location_query.lower()
