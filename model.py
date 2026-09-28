from __future__ import annotations

import torch
import torch.nn as nn
from torchvision import models

CHECKPOINT_VERSION = 1


def build_model(n_outputs: int, pretrained: bool = True) -> nn.Module:
    weights = models.ResNet18_Weights.IMAGENET1K_V1 if pretrained else None
    net = models.resnet18(weights=weights)
    net.fc = nn.Linear(net.fc.in_features, n_outputs)
    return net


def save_checkpoint(path, model, region, violations, thresholds, metrics=None):
    from contract import PAD_HEIGHT, IMAGENET_MEAN, IMAGENET_STD
    torch.save({
        "version": CHECKPOINT_VERSION,
        "arch": "resnet18",
        "region": region,
        "violations": list(violations),
        "thresholds": dict(thresholds),
        "pad_height": PAD_HEIGHT,
        "mean": IMAGENET_MEAN,
        "std": IMAGENET_STD,
        "metrics": metrics or {},
        "state_dict": model.state_dict(),
    }, path)


def load_checkpoint(path, device="cpu"):
    from contract import PAD_HEIGHT
    ckpt = torch.load(path, map_location=device, weights_only=False)
    if ckpt["pad_height"] != PAD_HEIGHT:
        raise ValueError(f"Чекпоинт обучен с pad_height={ckpt['pad_height']}, "
                         f"а в contract.py сейчас {PAD_HEIGHT} — препроцессинг разошёлся")
    model = build_model(len(ckpt["violations"]), pretrained=False)
    model.load_state_dict(ckpt["state_dict"])
    model.to(device).eval()
    meta = {k: v for k, v in ckpt.items() if k != "state_dict"}
    return model, meta


def save_region_checkpoint(path, model, classes, metrics=None):
    from contract import REGION_INPUT_SIZE, IMAGENET_MEAN, IMAGENET_STD
    torch.save({
        "version": CHECKPOINT_VERSION,
        "arch": "resnet18",
        "task": "region",
        "classes": list(classes),
        "input_size": REGION_INPUT_SIZE,
        "mean": IMAGENET_MEAN,
        "std": IMAGENET_STD,
        "metrics": metrics or {},
        "state_dict": model.state_dict(),
    }, path)


def load_region_checkpoint(path, device="cpu"):
    from contract import REGION_INPUT_SIZE
    ckpt = torch.load(path, map_location=device, weights_only=False)
    if ckpt.get("task") != "region":
        raise ValueError(f"{path} — не чекпоинт классификатора зоны")
    if ckpt["input_size"] != REGION_INPUT_SIZE:
        raise ValueError(f"Классификатор зоны обучен с input_size={ckpt['input_size']}, "
                         f"а в contract.py сейчас {REGION_INPUT_SIZE} — препроцессинг разошёлся")
    model = build_model(len(ckpt["classes"]), pretrained=False)
    model.load_state_dict(ckpt["state_dict"])
    model.to(device).eval()
    meta = {k: v for k, v in ckpt.items() if k != "state_dict"}
    return model, meta
