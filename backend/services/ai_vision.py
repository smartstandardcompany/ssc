"""
AI Vision Service for Face Recognition and Object Detection
Uses OpenAI GPT-4o Vision via Emergent LLM Key
"""

import os
import base64
import json
import re
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

# Import emergent integrations
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent


def extract_json_from_response(response: str) -> Optional[Dict]:
    """Try to extract JSON from AI response using multiple strategies"""
    response = response.strip()
    
    # Strategy 1: Direct JSON parse
    try:
        return json.loads(response)
    except json.JSONDecodeError:
        pass
    
    # Strategy 2: Extract from markdown code block
    if "```json" in response:
        try:
            json_str = response.split("```json")[1].split("```")[0].strip()
            return json.loads(json_str)
        except (IndexError, json.JSONDecodeError):
            pass
    
    # Strategy 3: Extract from any code block
    if "```" in response:
        try:
            json_str = response.split("```")[1].split("```")[0].strip()
            return json.loads(json_str)
        except (IndexError, json.JSONDecodeError):
            pass
    
    # Strategy 4: Find JSON object in response using regex
    try:
        match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response, re.DOTALL)
        if match:
            return json.loads(match.group())
    except json.JSONDecodeError:
        pass
    
    return None


class AIVisionService:
    """AI-powered vision service for CCTV analytics"""
    
    def __init__(self):
        self.api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not self.api_key:
            raise ValueError("EMERGENT_LLM_KEY not found in environment")
    
    def _create_chat(self, session_id: str, system_message: str) -> LlmChat:
        """Create a new LlmChat instance"""
        chat = LlmChat(
            api_key=self.api_key,
            session_id=session_id,
            system_message=system_message
        )
        chat.with_model("openai", "gpt-4o")
        return chat
    
    async def recognize_face(
        self, 
        image_base64: str, 
        registered_faces: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Recognize faces in an image and match against registered employees
        
        Args:
            image_base64: Base64 encoded image from camera
            registered_faces: List of registered employees with their face data
                [{"employee_id": "...", "name": "...", "image_data": "base64..."}]
        
        Returns:
            {
                "faces_detected": int,
                "matches": [{"employee_id": "...", "name": "...", "confidence": 0.95}],
                "unknown_faces": int
            }
        """
        if not registered_faces:
            return {
                "faces_detected": 0,
                "matches": [],
                "unknown_faces": 0,
                "message": "No registered faces to compare against"
            }
        
        # Build the prompt with registered faces info
        face_descriptions = []
        for i, face in enumerate(registered_faces[:10]):  # Limit to 10 faces
            face_descriptions.append(f"Person {i+1}: {face.get('name', 'Unknown')} (ID: {face.get('employee_id', 'N/A')})")
        
        system_message = """You are an AI face recognition system. Your task is to:
1. Detect all faces in the provided camera image
2. Compare detected faces against the registered employee faces
3. Return matches with confidence levels

Be precise and only report high-confidence matches (>70%). 
If you cannot clearly see a face or match it, report it as unknown.
Always respond in valid JSON format."""

        prompt = f"""Analyze this camera image for face recognition.

Registered employees to look for:
{chr(10).join(face_descriptions)}

Please analyze the image and return a JSON response with:
{{
    "faces_detected": <number of faces found>,
    "matches": [
        {{"employee_id": "...", "name": "...", "confidence": 0.0-1.0, "location": "description of where in frame"}}
    ],
    "unknown_faces": <number of unrecognized faces>,
    "analysis_notes": "any relevant observations"
}}

Only include matches you are confident about (>70% confidence).
If the image is unclear or no faces are visible, indicate that."""

        try:
            chat = self._create_chat(
                session_id=f"face_recognition_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                system_message=system_message
            )
            
            image_content = ImageContent(image_base64=image_base64)
            user_message = UserMessage(
                text=prompt,
                file_contents=[image_content]
            )
            
            response = await chat.send_message(user_message)
            
            # Parse JSON from response
            try:
                # Extract JSON from response
                response_text = response.strip()
                if "```json" in response_text:
                    response_text = response_text.split("```json")[1].split("```")[0]
                elif "```" in response_text:
                    response_text = response_text.split("```")[1].split("```")[0]
                
                result = json.loads(response_text)
                return result
            except json.JSONDecodeError:
                return {
                    "faces_detected": 0,
                    "matches": [],
                    "unknown_faces": 0,
                    "raw_response": response,
                    "error": "Failed to parse AI response"
                }
                
        except Exception as e:
            return {
                "faces_detected": 0,
                "matches": [],
                "unknown_faces": 0,
                "error": str(e)
            }
    
    async def detect_objects(
        self, 
        image_base64: str,
        target_objects: Optional[List[str]] = None,
        context: str = "retail store inventory"
    ) -> Dict[str, Any]:
        """
        Detect objects in an image for inventory monitoring
        
        Args:
            image_base64: Base64 encoded image from camera
            target_objects: List of specific objects to look for (optional)
            context: Description of the monitoring context
        
        Returns:
            {
                "objects_detected": [{"name": "...", "count": 1, "location": "...", "confidence": 0.9}],
                "total_count": int,
                "alerts": [{"type": "low_stock", "object": "...", "message": "..."}]
            }
        """
        system_message = """You are an AI object detection system for inventory monitoring.
Your task is to identify and count objects visible in the image provided.
IMPORTANT: You MUST always respond ONLY with valid JSON. No explanations outside JSON."""

        target_str = ""
        if target_objects:
            target_str = f"\n\nSpecifically look for these items: {', '.join(target_objects)}"

        prompt = f"""Analyze this image for inventory monitoring in a {context}.{target_str}

RESPOND ONLY WITH THIS JSON FORMAT (no other text):
{{
    "objects_detected": [
        {{"name": "object name", "count": 1, "location": "description", "confidence": 0.8, "stock_level": "high|medium|low|empty"}}
    ],
    "total_items": <total count>,
    "shelf_analysis": "description",
    "alerts": [],
    "recommendations": []
}}

If no objects are visible, return objects_detected as an empty array with total_items: 0."""

        try:
            chat = self._create_chat(
                session_id=f"object_detection_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                system_message=system_message
            )
            
            image_content = ImageContent(image_base64=image_base64)
            user_message = UserMessage(
                text=prompt,
                file_contents=[image_content]
            )
            
            response = await chat.send_message(user_message)
            
            # Parse JSON from response
            try:
                response_text = response.strip()
                if "```json" in response_text:
                    response_text = response_text.split("```json")[1].split("```")[0]
                elif "```" in response_text:
                    response_text = response_text.split("```")[1].split("```")[0]
                
                result = json.loads(response_text)
                return result
            except json.JSONDecodeError:
                return {
                    "objects_detected": [],
                    "total_items": 0,
                    "alerts": [],
                    "raw_response": response,
                    "error": "Failed to parse AI response"
                }
                
        except Exception as e:
            return {
                "objects_detected": [],
                "total_items": 0,
                "alerts": [],
                "error": str(e)
            }
    
    async def count_people(
        self, 
        image_base64: str,
        previous_count: int = 0
    ) -> Dict[str, Any]:
        """
        Count people in an image for foot traffic analysis
        
        Args:
            image_base64: Base64 encoded image from camera
            previous_count: Previous count for movement estimation
        
        Returns:
            {
                "people_count": int,
                "estimated_entries": int,
                "estimated_exits": int,
                "crowd_density": "low/medium/high",
                "areas": [{"location": "...", "count": int}]
            }
        """
        system_message = """You are an AI people counting system for retail analytics.
Your task is to accurately count the number of people visible in any image provided.
Focus on precision and report confidence levels.
IMPORTANT: You MUST always respond ONLY with valid JSON. No explanations outside JSON."""

        prompt = f"""Analyze this image and count people visible.

Previous count in this area was: {previous_count}

RESPOND ONLY WITH THIS JSON FORMAT (no other text):
{{
    "people_count": <number of people visible, 0 if none>,
    "confidence": <0.0-1.0>,
    "estimated_entries": <estimated new entries>,
    "estimated_exits": <estimated exits>,
    "crowd_density": "empty|low|medium|high|very_high",
    "areas": [],
    "demographics": {{"adults": 0, "children": 0, "groups": 0}},
    "notes": "description of what you see"
}}

If no people are visible or you cannot determine, return people_count: 0 with a note explaining why."""

        try:
            chat = self._create_chat(
                session_id=f"people_count_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                system_message=system_message
            )
            
            image_content = ImageContent(image_base64=image_base64)
            user_message = UserMessage(
                text=prompt,
                file_contents=[image_content]
            )
            
            response = await chat.send_message(user_message)
            
            # Parse JSON from response
            try:
                response_text = response.strip()
                if "```json" in response_text:
                    response_text = response_text.split("```json")[1].split("```")[0]
                elif "```" in response_text:
                    response_text = response_text.split("```")[1].split("```")[0]
                
                result = json.loads(response_text)
                return result
            except json.JSONDecodeError:
                return {
                    "people_count": 0,
                    "confidence": 0,
                    "estimated_entries": 0,
                    "estimated_exits": 0,
                    "raw_response": response,
                    "error": "Failed to parse AI response"
                }
                
        except Exception as e:
            return {
                "people_count": 0,
                "confidence": 0,
                "estimated_entries": 0,
                "estimated_exits": 0,
                "error": str(e)
            }
    
    async def analyze_motion(
        self,
        image_base64: str,
        previous_image_base64: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze motion in camera frame for security alerts
        
        Args:
            image_base64: Current frame
            previous_image_base64: Previous frame for comparison (optional)
        
        Returns:
            {
                "motion_detected": bool,
                "motion_score": float (0-1),
                "motion_areas": [{"location": "...", "intensity": "low/medium/high"}],
                "alert_type": "none|person|vehicle|animal|unknown",
                "description": "..."
            }
        """
        system_message = """You are an AI motion detection system for security monitoring.
Analyze security camera footage for any motion or activity.
Focus on identifying potential security concerns.
Always respond in valid JSON format."""

        prompt = """Analyze this security camera image for motion and activity.

Return a JSON response:
{
    "motion_detected": true/false,
    "motion_score": 0.0-1.0 (intensity of activity),
    "activity_type": "none|person|vehicle|animal|object|unknown",
    "people_detected": <number if any>,
    "motion_areas": [
        {"location": "area description", "intensity": "low|medium|high", "description": "what's moving"}
    ],
    "security_concern": true/false,
    "alert_level": "none|low|medium|high|critical",
    "description": "detailed description of what you see",
    "recommendations": ["any security recommendations"]
}

Be thorough in identifying any movement or unusual activity."""

        try:
            chat = self._create_chat(
                session_id=f"motion_analysis_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                system_message=system_message
            )
            
            image_content = ImageContent(image_base64=image_base64)
            user_message = UserMessage(
                text=prompt,
                file_contents=[image_content]
            )
            
            response = await chat.send_message(user_message)
            
            # Parse JSON from response
            try:
                response_text = response.strip()
                if "```json" in response_text:
                    response_text = response_text.split("```json")[1].split("```")[0]
                elif "```" in response_text:
                    response_text = response_text.split("```")[1].split("```")[0]
                
                result = json.loads(response_text)
                return result
            except json.JSONDecodeError:
                return {
                    "motion_detected": False,
                    "motion_score": 0,
                    "activity_type": "unknown",
                    "raw_response": response,
                    "error": "Failed to parse AI response"
                }
                
        except Exception as e:
            return {
                "motion_detected": False,
                "motion_score": 0,
                "activity_type": "error",
                "error": str(e)
            }


# Singleton instance
_ai_vision_service = None

def get_ai_vision_service() -> AIVisionService:
    """Get or create the AI Vision service instance"""
    global _ai_vision_service
    if _ai_vision_service is None:
        _ai_vision_service = AIVisionService()
    return _ai_vision_service
