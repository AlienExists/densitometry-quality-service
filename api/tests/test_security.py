import zipfile
import pytest
from batch.security import validate_zip, ZipSecurityError


def test_validate_good_zip(tmp_path):
    zip_path = tmp_path / "good.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("file.dcm", b"x" * 1000)
    validate_zip(str(zip_path))  # не должно бросить


def test_validate_path_traversal(tmp_path):
    zip_path = tmp_path / "bad.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("../evil.dcm", b"x" * 100)
    with pytest.raises(ZipSecurityError):
        validate_zip(str(zip_path))