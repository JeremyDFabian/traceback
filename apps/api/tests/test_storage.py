from io import BytesIO
from unittest.mock import MagicMock, patch

from app.storage import SupabaseStorage, iter_file_chunks


def test_supabase_storage_uploads_using_server_side_key() -> None:
    response = MagicMock()
    response.__enter__.return_value.read.return_value = b"{}"
    storage = SupabaseStorage(
        "https://example.supabase.co",
        "secret-key",
        "traceback-files",
    )

    with patch("app.storage.urlopen", return_value=response) as urlopen:
        result = storage.save("deck/session.pdf", b"pdf-data")

    assert result == "deck/session.pdf"
    request = urlopen.call_args.args[0]
    assert request.full_url == (
        "https://example.supabase.co/storage/v1/object/traceback-files/deck/session.pdf"
    )
    assert request.get_header("Authorization") == "Bearer secret-key"
    assert request.data == b"pdf-data"


def test_supabase_storage_loads_an_object() -> None:
    response = MagicMock()
    response.__enter__.return_value.read.return_value = b"json-data"
    storage = SupabaseStorage("https://example.supabase.co", "secret-key", "traceback-files")

    with patch("app.storage.urlopen", return_value=response):
        result = storage.load("analysis/session.json")

    assert result == b"json-data"


def test_iter_file_chunks_limits_read_size() -> None:
    chunks = list(iter_file_chunks(BytesIO(b"abcdef"), chunk_size=2))

    assert chunks == [b"ab", b"cd", b"ef"]
