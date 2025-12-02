from typing import Optional
from openai import OpenAI
from app.core.config import get_settings
from app.db.database import get_supabase
from datetime import datetime, timezone
import json


def get_openai_client() -> OpenAI:
    settings = get_settings()
    return OpenAI(api_key=settings.openai_api_key)


async def prioritize_cards(board_id: Optional[str] = None) -> dict:
    """
    Use AI to prioritize cards based on deadlines, complexity, and context.
    Returns updated priorities and reasoning.
    """
    supabase = get_supabase()

    # Fetch cards
    query = supabase.table("cards").select("*")
    if board_id:
        query = query.eq("board_id", board_id)
    cards_response = query.execute()
    cards = cards_response.data

    if not cards:
        return {"cards_updated": 0, "priorities": []}

    # Fetch boards for context
    boards_response = supabase.table("boards").select("*").execute()
    boards = {b["id"]: b["name"] for b in boards_response.data}

    # Build prompt
    cards_info = []
    for card in cards:
        cards_info.append({
            "id": card["id"],
            "title": card["title"],
            "description": card.get("description", ""),
            "board": boards.get(card["board_id"], "Unknown"),
            "status": card["status"],
            "current_priority": card.get("priority", 3),
            "deadline": card.get("deadline"),
            "estimated_hours": card.get("estimated_hours"),
            "tags": card.get("tags", []),
            "created_at": card.get("created_at"),
        })

    prompt = f"""You are a task prioritization assistant. Analyze these tasks and assign priority levels (1-5, where 1 is highest priority).

Current date: {datetime.now(timezone.utc).isoformat()}

Consider these factors:
1. Deadline proximity (highest weight)
2. Task complexity and estimated time
3. Dependencies and blocking tasks
4. Current status (in_progress tasks may need attention)
5. Task age (older tasks might be neglected)

Tasks to prioritize:
{json.dumps(cards_info, indent=2)}

Respond with a JSON array of objects with this exact structure:
[
  {{"id": "card-id", "priority": 1-5, "reasoning": "Brief explanation"}}
]

Only output the JSON array, no other text."""

    try:
        client = get_openai_client()
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a task prioritization expert. Output only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=2000,
        )

        result_text = response.choices[0].message.content.strip()
        # Clean up potential markdown code blocks
        if result_text.startswith("```"):
            result_text = result_text.split("\n", 1)[1]
            result_text = result_text.rsplit("```", 1)[0]

        priorities = json.loads(result_text)

        # Update cards in database
        now = datetime.now(timezone.utc).isoformat()
        for p in priorities:
            # Record priority history
            old_card = next((c for c in cards if c["id"] == p["id"]), None)
            old_priority = old_card.get("priority", 3) if old_card else 3

            if old_priority != p["priority"]:
                supabase.table("priority_history").insert({
                    "card_id": p["id"],
                    "old_priority": old_priority,
                    "new_priority": p["priority"],
                    "reasoning": p["reasoning"],
                    "model_used": "gpt-4o-mini",
                    "timestamp": now,
                }).execute()

            # Update card priority
            supabase.table("cards").update({
                "priority": p["priority"],
                "priority_reason": p["reasoning"],
                "updated_at": now,
            }).eq("id", p["id"]).execute()

        return {
            "cards_updated": len(priorities),
            "priorities": priorities,
        }

    except Exception as e:
        raise Exception(f"AI prioritization failed: {str(e)}")


async def get_card_suggestions(card_id: str) -> dict:
    """Get AI suggestions for a specific card."""
    supabase = get_supabase()

    card_response = supabase.table("cards").select("*").eq("id", card_id).execute()
    if not card_response.data:
        raise Exception("Card not found")

    card = card_response.data[0]

    prompt = f"""Analyze this task and provide actionable suggestions:

Task: {card["title"]}
Description: {card.get("description", "No description")}
Status: {card["status"]}
Priority: {card.get("priority", 3)}/5
Deadline: {card.get("deadline", "No deadline")}
Estimated hours: {card.get("estimated_hours", "Not estimated")}
Tags: {", ".join(card.get("tags", []))}

Provide 2-4 brief, actionable suggestions to help complete this task effectively.
Consider: breaking down the task, time management, potential blockers, and prioritization.

Respond with JSON:
{{"suggestions": ["suggestion 1", "suggestion 2"], "reasoning": "Brief overall assessment"}}"""

    try:
        client = get_openai_client()
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a productivity assistant. Output only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
            max_tokens=500,
        )

        result_text = response.choices[0].message.content.strip()
        if result_text.startswith("```"):
            result_text = result_text.split("\n", 1)[1]
            result_text = result_text.rsplit("```", 1)[0]

        return json.loads(result_text)

    except Exception as e:
        raise Exception(f"AI suggestions failed: {str(e)}")


async def generate_daily_briefing() -> dict:
    """Generate a daily briefing of priorities and suggestions."""
    supabase = get_supabase()
    now = datetime.now(timezone.utc)

    # Fetch all active cards
    cards_response = (
        supabase.table("cards")
        .select("*, boards(name)")
        .neq("status", "done")
        .order("priority")
        .execute()
    )
    cards = cards_response.data

    # Identify high priority and overdue tasks
    high_priority = [c for c in cards if c.get("priority", 3) <= 2]
    overdue = []
    for c in cards:
        if c.get("deadline"):
            try:
                deadline = datetime.fromisoformat(c["deadline"].replace("Z", "+00:00"))
                if deadline < now:
                    overdue.append(c)
            except (ValueError, TypeError):
                pass

    # Build prompt for AI summary
    cards_summary = [{
        "title": c["title"],
        "board": c.get("boards", {}).get("name", "Unknown") if c.get("boards") else "Unknown",
        "priority": c.get("priority", 3),
        "deadline": c.get("deadline"),
        "status": c["status"],
    } for c in cards[:20]]  # Limit to top 20

    prompt = f"""Generate a brief daily briefing for these tasks.

Current date: {now.strftime("%Y-%m-%d %H:%M")}

Active tasks:
{json.dumps(cards_summary, indent=2)}

High priority count: {len(high_priority)}
Overdue count: {len(overdue)}

Provide:
1. A 2-3 sentence summary of the day's focus
2. Top 3 actionable suggestions for productivity

Respond with JSON:
{{"summary": "...", "suggestions": ["...", "...", "..."]}}"""

    try:
        client = get_openai_client()
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a productivity coach. Be concise and actionable. Output only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
            max_tokens=500,
        )

        result_text = response.choices[0].message.content.strip()
        if result_text.startswith("```"):
            result_text = result_text.split("\n", 1)[1]
            result_text = result_text.rsplit("```", 1)[0]

        ai_response = json.loads(result_text)

        return {
            "date": now.strftime("%Y-%m-%d"),
            "high_priority_tasks": [{"id": c["id"], "title": c["title"], "priority": c.get("priority")} for c in high_priority[:5]],
            "overdue_tasks": [{"id": c["id"], "title": c["title"], "deadline": c.get("deadline")} for c in overdue],
            "suggestions": ai_response.get("suggestions", []),
            "summary": ai_response.get("summary", ""),
        }

    except Exception as e:
        # Return basic briefing without AI if it fails
        return {
            "date": now.strftime("%Y-%m-%d"),
            "high_priority_tasks": [{"id": c["id"], "title": c["title"], "priority": c.get("priority")} for c in high_priority[:5]],
            "overdue_tasks": [{"id": c["id"], "title": c["title"], "deadline": c.get("deadline")} for c in overdue],
            "suggestions": ["Review your high-priority tasks first", "Check for any overdue items"],
            "summary": f"You have {len(high_priority)} high-priority tasks and {len(overdue)} overdue items.",
        }


async def extract_tasks_from_text(text: str, board_id: str, board_name: str) -> dict: # AI extracts tasks from pasted text
    now = datetime.now(timezone.utc)
    prompt = f"""You are a task extraction assistant. Extract actionable tasks from the following text.

Current date: {now.strftime("%Y-%m-%d")}
Board/Context: {board_name}

Text to analyze:
\"\"\"
{text}
\"\"\"

For each task found, extract:
1. title: Clear, concise task title (max 100 chars)
2. description: Additional details if available
3. deadline: ISO date string if mentioned (interpret "next Tuesday", "Dec 15", etc.), null if not mentioned
4. priority: 1-5 based on urgency words (urgent=1, important=2, normal=3, low=4, minimal=5)
5. estimated_hours: Rough estimate based on complexity, null if unclear
6. tags: Relevant tags extracted from context (e.g., "essay", "reading", "meeting", "research")

Respond with JSON:
{{
  "tasks": [
    {{
      "title": "Task title",
      "description": "Details or null",
      "deadline": "2024-12-15T23:59:00Z or null",
      "priority": 3,
      "estimated_hours": 2.0 or null,
      "tags": ["tag1", "tag2"]
    }}
  ],
  "summary": "Brief summary of what was extracted"
}}

Extract ALL actionable items. Be thorough but avoid duplicates. Output only valid JSON."""

    try:
        client = get_openai_client()
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert at extracting tasks from unstructured text. Output only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=2000,
        )
        result_text = response.choices[0].message.content.strip()
        if result_text.startswith("```"):
            result_text = result_text.split("\n", 1)[1]
            result_text = result_text.rsplit("```", 1)[0]
        result = json.loads(result_text)
        for task in result.get("tasks", []): # Add board_id to each task
            task["board_id"] = board_id
            task["status"] = "todo"
            task["position"] = 0
        return result
    except Exception as e:
        raise Exception(f"AI task extraction failed: {str(e)}")


async def create_extracted_tasks(tasks: list) -> dict: # Bulk create cards from extracted tasks
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    created = []
    for task in tasks:
        card_data = {
            "board_id": task["board_id"],
            "title": task["title"],
            "description": task.get("description"),
            "status": task.get("status", "todo"),
            "priority": task.get("priority", 3),
            "estimated_hours": task.get("estimated_hours"),
            "deadline": task.get("deadline"),
            "position": task.get("position", 0),
            "tags": task.get("tags", []),
            "metadata": {"source": "ai_extraction"},
            "created_at": now,
            "updated_at": now,
        }
        response = supabase.table("cards").insert(card_data).execute()
        if response.data:
            created.append(response.data[0])
    return {"created_count": len(created), "cards": created}
