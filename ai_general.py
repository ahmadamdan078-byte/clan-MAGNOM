"""General-purpose high-level AI assistant — answers any topic with conversation history."""

import json
import os
import re
import urllib.request

from ai_context import get_cached_site_context
from ai_support import (
    _full_system_prompt,
    _openai_compatible,
    _pollinations,
    _is_quality_reply,
    FAST_HISTORY,
    FAST_MAX_TOKENS,
    GROQ_FAST_MODEL,
    _groq_models,
)
from ai_instant import try_instant_reply


def _http_json(url, payload, headers=None, timeout=20):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            'Content-Type': 'application/json',
            'User-Agent': 'MagnomAI/3.0',
            **(headers or {}),
        },
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode('utf-8'))


def _build_messages(user_message, history, site_context=None):
    messages = [{'role': 'system', 'content': _full_system_prompt(site_context)}]
    for item in (history or [])[-FAST_HISTORY:]:
        role = item.get('role')
        content = (item.get('content') or '').strip()
        if role in ('user', 'assistant') and content:
            messages.append({'role': role, 'content': content[:2000]})
    messages.append({'role': 'user', 'content': user_message.strip()[:2000]})
    return messages


def ask_general_ai(user_message, history=None, user=None, site_context=None):
    """Return a high-quality general AI reply with conversation context and live site data."""
    message = (user_message or '').strip()
    if not message:
        return 'Please send a message and I will help you.'

    instant = try_instant_reply(message, user)
    if instant:
        return instant

    if site_context is None:
        site_context = get_cached_site_context(user, fast=True)
    messages = _build_messages(message, history or [], site_context)

    providers = []

    groq_key = os.environ.get('GROQ_API_KEY', '').strip()
    if groq_key:
        for model in _groq_models(has_image=False):
            providers.append(lambda m=model: _openai_compatible(
                'https://api.groq.com/openai/v1',
                groq_key,
                m,
                messages,
                timeout=14,
                max_tokens=FAST_MAX_TOKENS,
            ))

    openai_key = os.environ.get('OPENAI_API_KEY', '').strip()
    if openai_key:
        providers.append(lambda: _openai_compatible(
            os.environ.get('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
            openai_key,
            os.environ.get('OPENAI_MODEL', 'gpt-4o-mini'),
            messages,
            timeout=18,
            max_tokens=FAST_MAX_TOKENS,
        ))

    anthropic_key = os.environ.get('ANTHROPIC_API_KEY', '').strip()
    if anthropic_key:
        system = _full_system_prompt(site_context)
        def _anthropic():
            result = _http_json(
                'https://api.anthropic.com/v1/messages',
                {
                    'model': os.environ.get('ANTHROPIC_MODEL', 'claude-3-5-sonnet-20241022'),
                    'max_tokens': FAST_MAX_TOKENS,
                    'system': system,
                    'messages': [
                        {'role': m['role'], 'content': m['content']}
                        for m in messages if m['role'] != 'system'
                    ],
                },
                headers={
                    'x-api-key': anthropic_key,
                    'anthropic-version': '2023-06-01',
                },
                timeout=20,
            )
            return result['content'][0]['text'].strip()
        providers.append(_anthropic)

    providers.append(lambda: _pollinations(messages, fast=True))

    for provider in providers:
        try:
            reply = provider()
            if _is_quality_reply(reply):
                return reply.strip()[:8000]
        except Exception:
            continue

    return (
        'I am having trouble connecting to the AI service right now. '
        'Please try again in a moment.'
    )
