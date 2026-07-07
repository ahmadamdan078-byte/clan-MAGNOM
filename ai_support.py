import base64
import json
import os
import re
import ssl
import urllib.parse
import urllib.request
from http.client import HTTPSConnection, HTTPConnection
from urllib.parse import urlparse

from ai_instant import try_instant_reply

# Compact prompts = faster time-to-first-token
BASE_SYSTEM_PROMPT = """You are **MAGNOM AI** — fast, expert assistant for MAGNOM Rocket League clan.
Answer anything: coding, school, general knowledge, RL coaching, and live clan data below.
Be clear and concise. Use markdown bullets when helpful. Match the user's language.
Use live clan data for roster/events/news questions. Never invent passwords or private data."""

FAST_HISTORY = 8
FAST_MAX_TOKENS = 1024
FULL_MAX_TOKENS = 2048
GROQ_FAST_MODEL = os.environ.get('GROQ_FAST_MODEL', 'llama-3.1-8b-instant')


def _full_system_prompt(site_context=None):
    if site_context:
        return f'{BASE_SYSTEM_PROMPT}\n\n# LIVE DATA\n{site_context}'
    return BASE_SYSTEM_PROMPT


def _http_json(url, payload, headers=None, timeout=12):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            'Content-Type': 'application/json',
            'User-Agent': 'MagnomClanSupport/4.0',
            **(headers or {}),
        },
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode('utf-8'))


def _http_text(url, timeout=10):
    req = urllib.request.Request(url, headers={'User-Agent': 'MagnomClanSupport/4.0'})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode('utf-8', errors='replace').strip()


def _openai_compatible(base_url, api_key, model, messages, timeout=12, max_tokens=FAST_MAX_TOKENS, temperature=0.55):
    headers = {}
    if api_key:
        headers['Authorization'] = f'Bearer {api_key}'
    result = _http_json(
        f'{base_url.rstrip("/")}/chat/completions',
        {
            'model': model,
            'messages': messages,
            'temperature': temperature,
            'max_tokens': max_tokens,
        },
        headers=headers,
        timeout=timeout,
    )
    return result['choices'][0]['message']['content'].strip()


def _vision_message(user_text, image_bytes, image_mime):
    b64 = base64.b64encode(image_bytes).decode('ascii')
    return {
        'role': 'user',
        'content': [
            {'type': 'text', 'text': user_text},
            {
                'type': 'image_url',
                'image_url': {'url': f'data:{image_mime};base64,{b64}'},
            },
        ],
    }


def _build_messages(user_message, history, image_bytes=None, image_mime=None, site_context=None, fast=True):
    messages = [{'role': 'system', 'content': _full_system_prompt(site_context)}]
    limit = FAST_HISTORY if fast else 16
    cap = 2000 if fast else 4000
    for item in (history or [])[-limit:]:
        role = item.get('role')
        content = (item.get('content') or '').strip()
        if role in ('user', 'assistant') and content:
            messages.append({'role': role, 'content': content[:cap]})
    text = (user_message or '').strip()[:cap]
    if image_bytes and image_mime:
        messages.append(_vision_message(text or 'Analyze this image.', image_bytes, image_mime))
    else:
        messages.append({'role': 'user', 'content': text})
    return messages


def _is_quality_reply(reply):
    text = (reply or '').strip()
    if len(text) < 8:
        return False
    if re.search(r'(\d+\s*[-–—]\s*){8,}\d+', text):
        return False
    if re.search(r'(\b\d+\b[\s,./]*){20,}', text):
        return False
    return True


def _pollinations(messages, fast=True):
    model = 'openai-fast'
    max_tokens = 800 if fast else 1200
    try:
        result = _http_json(
            'https://text.pollinations.ai/openai',
            {
                'model': model,
                'messages': messages,
                'temperature': 0.55,
                'max_tokens': max_tokens,
            },
            timeout=10,
        )
        return result['choices'][0]['message']['content'].strip()
    except Exception:
        user_text = ''
        for msg in reversed(messages):
            if msg['role'] == 'user':
                user_text = msg['content'] if isinstance(msg['content'], str) else user_text
                break
        prompt = f"{messages[0]['content']}\n\nUser: {user_text}\n\nMAGNOM AI:"
        url = (
            'https://text.pollinations.ai/'
            + urllib.parse.quote(prompt[:3500])
            + f'?model={model}&temperature=0.55'
        )
        return _http_text(url, timeout=10)


def _groq_models(has_image=False):
    if has_image:
        return [os.environ.get('GROQ_MODEL', 'llama-3.3-70b-versatile')]
    models = [GROQ_FAST_MODEL]
    quality = os.environ.get('GROQ_MODEL', 'llama-3.3-70b-versatile')
    if quality not in models:
        models.append(quality)
    return models


def _provider_chain(messages, has_image=False):
    chain = []
    groq_key = os.environ.get('GROQ_API_KEY', '').strip()
    if groq_key:
        for model in _groq_models(has_image):
            chain.append(lambda m=model: _openai_compatible(
                'https://api.groq.com/openai/v1',
                groq_key,
                m,
                messages,
                timeout=14,
                max_tokens=FAST_MAX_TOKENS,
            ))

    openai_key = os.environ.get('OPENAI_API_KEY', '').strip()
    if openai_key:
        vision_model = os.environ.get('OPENAI_VISION_MODEL', 'gpt-4o-mini')
        text_model = os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')
        chain.append(lambda: _openai_compatible(
            os.environ.get('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
            openai_key,
            vision_model if has_image else text_model,
            messages,
            timeout=18,
            max_tokens=FAST_MAX_TOKENS,
        ))

    chain.append(lambda: _pollinations(messages, fast=True))
    return chain


def _stream_openai_sse(base_url, api_key, model, messages, timeout=14, max_tokens=FAST_MAX_TOKENS):
    parsed = urlparse(base_url.rstrip('/') + '/chat/completions')
    host = parsed.netloc
    path = parsed.path or '/chat/completions'
    payload = json.dumps({
        'model': model,
        'messages': messages,
        'temperature': 0.55,
        'max_tokens': max_tokens,
        'stream': True,
    }).encode('utf-8')
    headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'MagnomClanSupport/4.0',
        'Accept': 'text/event-stream',
    }
    if api_key:
        headers['Authorization'] = f'Bearer {api_key}'

    if parsed.scheme == 'https':
        conn = HTTPSConnection(host, timeout=timeout, context=ssl.create_default_context())
    else:
        conn = HTTPConnection(host, timeout=timeout)

    try:
        conn.request('POST', path, payload, headers)
        resp = conn.getresponse()
        if resp.status >= 400:
            body = resp.read().decode('utf-8', errors='replace')
            raise RuntimeError(body[:200] or f'HTTP {resp.status}')

        while True:
            line = resp.readline()
            if not line:
                break
            text = line.decode('utf-8', errors='replace').strip()
            if not text or not text.startswith('data:'):
                continue
            data = text[5:].strip()
            if data == '[DONE]':
                break
            try:
                chunk = json.loads(data)
                delta = chunk.get('choices', [{}])[0].get('delta', {}).get('content', '')
                if delta:
                    yield delta
            except json.JSONDecodeError:
                continue
    finally:
        conn.close()


def _stream_llm_tokens(messages, has_image=False):
    """Yield tokens from the fastest available provider — no buffering."""
    groq_key = os.environ.get('GROQ_API_KEY', '').strip()
    if groq_key:
        for model in _groq_models(has_image):
            try:
                got = False
                for token in _stream_openai_sse(
                    'https://api.groq.com/openai/v1',
                    groq_key,
                    model,
                    messages,
                ):
                    got = True
                    yield token
                if got:
                    return
            except Exception:
                continue

    openai_key = os.environ.get('OPENAI_API_KEY', '').strip()
    if openai_key:
        try:
            model = (
                os.environ.get('OPENAI_VISION_MODEL', 'gpt-4o-mini')
                if has_image
                else os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')
            )
            got = False
            for token in _stream_openai_sse(
                os.environ.get('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
                openai_key,
                model,
                messages,
                timeout=18,
            ):
                got = True
                yield token
            if got:
                return
        except Exception:
            pass

    reply = None
    for provider in _provider_chain(messages, has_image=has_image):
        try:
            reply = provider()
            if _is_quality_reply(reply):
                break
        except Exception:
            continue
    if reply:
        yield reply


def stream_support_ai(user_message, history=None, image_bytes=None, image_mime=None,
                      site_context=None, user=None):
    """Yield reply tokens immediately for SSE streaming."""
    has_image = bool(image_bytes)

    if not has_image:
        instant = try_instant_reply(user_message, user)
        if instant:
            yield instant
            return

    prompt = user_message or 'Please look at this image and help me.'
    if has_image and not prompt.strip():
        prompt = 'Analyze this image and help me.'
    messages = _build_messages(prompt, history or [], image_bytes, image_mime, site_context, fast=True)
    yield from _stream_llm_tokens(messages, has_image=has_image)


def ask_support_ai(user_message, history=None, image_bytes=None, image_mime=None,
                   site_context=None, user=None):
    """Return a high-level AI reply."""
    has_image = bool(image_bytes)

    if not has_image:
        instant = try_instant_reply(user_message, user)
        if instant:
            return instant

    prompt = user_message or 'Please look at this image and help me.'
    if has_image:
        prompt = f'{prompt}\n\n[User attached an image — describe and help.]'

    messages = _build_messages(
        prompt, history or [], image_bytes if has_image else None, image_mime, site_context, fast=True
    )

    for provider in _provider_chain(messages, has_image=has_image):
        try:
            reply = provider()
            if _is_quality_reply(reply):
                return reply.strip()[:8000]
        except Exception:
            continue

    if has_image:
        return 'I received your picture — tell me what you want help with and I will coach you.'

    return (
        'MAGNOM AI is reconnecting — try again in a moment, or ask about **roster**, **events**, or **news** '
        'for an instant answer.'
    )
