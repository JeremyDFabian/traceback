import json
from pathlib import Path

from app.main import app


def main() -> None:
    output_path = Path("../../packages/api-client/openapi.json")
    output_path.write_text(
        json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
