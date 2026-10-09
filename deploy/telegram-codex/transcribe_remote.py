"""Reuse the existing Hermes speech provider without exposing its credentials."""
import json
from pathlib import Path
import sys

sys.path.insert(0, '/Users/egor/.hermes/hermes-agent')
from tools.transcription_tools import transcribe_audio, _get_provider, _load_stt_config


if __name__ == '__main__':
    if len(sys.argv) == 1:
        config = _load_stt_config()
        print(json.dumps({'provider': _get_provider(config), 'enabled': config.get('enabled', True)}))
    else:
        path = Path(sys.argv[1]).resolve()
        root = Path('/Users/egor/.hermes/codex-telegram-audio').resolve()
        if not path.is_relative_to(root) or not path.is_file() or path.stat().st_size > 20 * 1024 * 1024:
            raise SystemExit('Invalid audio path')
        result = transcribe_audio(str(path))
        print(json.dumps({'success': bool(result.get('success')), 'transcript': result.get('transcript', ''),
                          'provider': result.get('provider'), 'error': None if result.get('success') else 'speech_provider_failed'}))
