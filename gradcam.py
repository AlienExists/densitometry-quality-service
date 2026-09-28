from __future__ import annotations

import numpy as np
import torch
import torch.nn.functional as F


class GradCAM:
    def __init__(self, model, layer=None):
        self.model = model
        self.layer = layer if layer is not None else model.layer4
        self._acts = None
        self._grads = None

    def _forward_hook(self, module, inputs, output):
        self._acts = output
        output.register_hook(self._save_grad)

    def _save_grad(self, grad):
        self._grads = grad

    def __call__(self, x: np.ndarray, index: int) -> np.ndarray:
        handle = self.layer.register_forward_hook(self._forward_hook)
        try:
            device = next(self.model.parameters()).device
            t = torch.from_numpy(np.ascontiguousarray(x))[None].to(device)
            with torch.enable_grad():
                self.model.zero_grad(set_to_none=True)
                logits = self.model(t)
                logits[0, index].backward()
            weights = self._grads.mean(dim=(2, 3), keepdim=True)
            cam = F.relu((weights * self._acts).sum(dim=1, keepdim=True))
            cam = F.interpolate(cam, size=t.shape[2:], mode="bilinear", align_corners=False)[0, 0]
            cam = cam.detach().cpu().numpy()
        finally:
            handle.remove()
            self.model.zero_grad(set_to_none=True)
        peak = float(cam.max())
        return cam / peak if peak > 0 else cam
