"""
Preprocessing для ML: letterbox, дублирование каналов, ImageNet-нормализация.
"""

import numpy as np
import cv2


IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def letterbox(
    image: np.ndarray,
    target_size: tuple = (384, 384),
    pad_value: int = 0,
) -> np.ndarray:
    """
    Дополняет изображение чёрным до квадрата, потом ресайз.
    Геометрия сохраняется.
    """
    h, w = image.shape[:2]
    target_h, target_w = target_size

    # Масштаб
    scale = min(target_w / w, target_h / h)
    new_w = int(round(w * scale))
    new_h = int(round(h * scale))

    # Ресайз
    resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

    # Паддинг до целевого размера
    canvas = np.full((target_h, target_w), pad_value, dtype=image.dtype)
    top = (target_h - new_h) // 2
    left = (target_w - new_w) // 2
    canvas[top:top + new_h, left:left + new_w] = resized

    return canvas


def to_rgb(image: np.ndarray) -> np.ndarray:
    """Grayscale (H, W) → RGB (H, W, 3) дублированием каналов."""
    if image.ndim == 2:
        return np.stack([image] * 3, axis=-1)
    if image.ndim == 3 and image.shape[2] == 1:
        return np.repeat(image, 3, axis=2)
    return image


def imagenet_normalize(image: np.ndarray) -> np.ndarray:
    """ImageNet-нормализация: (x - mean) / std."""
    return (image - IMAGENET_MEAN) / IMAGENET_STD


def prepare_for_model(
    image: np.ndarray,
    input_size: tuple = (384, 384),
) -> np.ndarray:
    """
    Полный пайплайн:
    [0,1] grayscale → letterbox → RGB → ImageNet norm → CHW
    """
    # 1. Letterbox
    img = letterbox(image, target_size=input_size)

    # 2. Grayscale → RGB
    img = to_rgb(img)

    # 3. ImageNet normalize
    img = imagenet_normalize(img)

    # 4. HWC → CHW
    img = np.transpose(img, (2, 0, 1))

    return img.astype(np.float32)