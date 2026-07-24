"""
Small, dependency-free User-Agent parser.

We only need a human-readable summary like "Chrome on Windows (Desktop)" for
the login-history admin view - not full analytics-grade UA parsing - so a
few regex checks are enough and avoid pulling in a third-party library.
"""
import re


def _detect_browser(ua: str) -> str:
    checks = [
        (r"Edg/", "Edge"),
        (r"OPR/|Opera", "Opera"),
        (r"Chrome/", "Chrome"),
        (r"CriOS/", "Chrome (iOS)"),
        (r"FxiOS/", "Firefox (iOS)"),
        (r"Firefox/", "Firefox"),
        (r"Version/.*Safari/", "Safari"),
        (r"Safari/", "Safari"),
        (r"MSIE|Trident/", "Internet Explorer"),
    ]
    for pattern, name in checks:
        if re.search(pattern, ua):
            return name
    return "Unknown browser"


def _detect_os(ua: str) -> str:
    checks = [
        (r"Windows NT 10\.0", "Windows 10/11"),
        (r"Windows NT", "Windows"),
        # iOS UAs also contain the literal substring "like Mac OS X", so
        # this must be checked before the generic macOS patterns below.
        (r"iPhone OS|iPad; CPU OS|iPod touch", "iOS"),
        (r"Mac OS X 10[_.]15", "macOS"),
        (r"Mac OS X", "macOS"),
        (r"Android", "Android"),
        (r"CrOS", "ChromeOS"),
        (r"Linux", "Linux"),
    ]
    for pattern, name in checks:
        if re.search(pattern, ua):
            return name
    return "Unknown OS"


def _detect_device_type(ua: str) -> str:
    if re.search(r"iPad|Tablet(?!.*Mobile)", ua):
        return "Tablet"
    if re.search(r"Mobi|Android.*Mobile|iPhone|iPod", ua):
        return "Mobile"
    return "Desktop"


def summarize_user_agent(ua: str | None) -> str:
    """Returns e.g. 'Chrome on Windows 10/11 (Desktop)'. Falls back gracefully
    for missing/unrecognized User-Agent strings (e.g. API clients, curl)."""
    if not ua or not ua.strip():
        return "Unknown device"
    if re.search(r"^curl/|^PostmanRuntime|^python-requests|^okhttp", ua, re.IGNORECASE):
        return f"API client ({ua.split('/')[0]})"
    browser = _detect_browser(ua)
    os_name = _detect_os(ua)
    device_type = _detect_device_type(ua)
    return f"{browser} on {os_name} ({device_type})"
