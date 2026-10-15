"""Bind Chrome input to a verified content window below a zero-sized omnibox."""


def _elements(state):
    return (state.get('structuredContent') or {}).get('elements') or []


def _bounds(window, state):
    return window.get('bounds') or (state.get('structuredContent') or {}).get('window_bounds') or {}


def _zero_omnibox(window, state):
    elements = _elements(state)
    bounds = _bounds(window, state)
    details = state.get('structuredContent') or {}
    return (window.get('app_name') == 'Google Chrome' and not window.get('title')
            and (details.get('screenshot_frame_valid') is False
                 or (bounds.get('width') == 0 and bounds.get('height') == 0))
            and any(e.get('role') == 'AXWebArea' and e.get('label') == 'Omnibox Popup'
                    for e in elements)
            and not any(e.get('role') in ('AXTextArea', 'AXDialog', 'AXSheet') for e in elements))


def select_content(windows, select):
    window, state = select(windows)
    if not _zero_omnibox(window, state):
        return window, state
    pid, skipped = window['pid'], set()
    for _ in range(3):
        skipped.add(window['window_id'])
        candidates = [w for w in windows if w['pid'] == pid
                      and w.get('app_name') == 'Google Chrome' and w['window_id'] not in skipped]
        if not candidates:
            break
        window, state = select(candidates)
        if _zero_omnibox(window, state):
            continue
        elements, bounds = _elements(state), _bounds(window, state)
        frame_valid = (state.get('structuredContent') or {}).get('screenshot_frame_valid')
        if ((frame_valid is True or (frame_valid is None and bounds.get('width', 0) > 0 and bounds.get('height', 0) > 0))
                and any(e.get('role') == 'AXWindow' and 'Google Chrome' in e.get('label', '')
                        for e in elements)
                and not any(e.get('role') in ('AXDialog', 'AXSheet') for e in elements)):
            # Return this exact snapshot and its element tokens, never popup tokens.
            return window, state
        raise RuntimeError('Chrome overlay has no verified content window; input remains unbound')
    raise RuntimeError('Chrome omnibox has no verified content window; input remains unbound')
