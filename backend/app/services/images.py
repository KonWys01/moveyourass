import io

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_SIDE = 1600
MAX_BYTES = 10 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 50_000_000


class InvalidImage(Exception):
    pass


def process_image(data: bytes) -> bytes:
    """Validate, apply EXIF rotation, downscale, re-encode as JPEG.

    Re-encoding drops all metadata (EXIF/GPS), which is intended.
    """
    try:
        with Image.open(io.BytesIO(data)) as img:
            img = ImageOps.exif_transpose(img)
            img = img.convert('RGB')
            img.thumbnail((MAX_SIDE, MAX_SIDE))
            out = io.BytesIO()
            img.save(out, 'JPEG', quality=85, optimize=True)
            return out.getvalue()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise InvalidImage from None
