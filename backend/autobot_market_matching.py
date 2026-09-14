"""Conservative matching at the AutoBot → CRM boundary."""
from collections import Counter
import re


def _unit(value: object) -> str:
    text = str(value or "").casefold().replace("²", "2").replace("³", "3").strip()
    aliases = {"куб.м": "м3", "куб. м": "м3", "кв.м": "м2", "кв. м": "м2",
               "тонна": "т", "тонн": "т", "шт.": "шт", "пог.м": "п.м", "пог. м": "п.м"}
    return re.sub(r"\s+", "", aliases.get(text, text))


def match_market_positions(items: list[dict], market: list[dict]) -> list[dict | None]:
    """Each price needs one owner; a matching title alone is insufficient."""
    candidates = []
    for item in items:
        choices = []
        for index, row in enumerate(market):
            if not item.get("titleKey") or item["titleKey"] != row.get("titleKey"):
                continue
            unit = _unit(item.get("unit"))
            if not unit or unit != _unit(row.get("unitText")):
                continue
            left, right = item.get("positionIndex"), row.get("positionIndex")
            if left and right and int(left) != int(right):
                continue
            choices.append(index)
        candidates.append(choices)
    owners = Counter(index for choices in candidates for index in choices)
    return [market[choices[0]] if len(choices) == 1 and owners[choices[0]] == 1 else None for choices in candidates]
