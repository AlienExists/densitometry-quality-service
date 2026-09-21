import { useRef, useState, useEffect } from 'react';
import { Button, Space, Slider, Tooltip, Switch, Skeleton } from 'antd';
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  UndoOutlined,
  FullscreenOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import type { ImageResult } from '@/types/api';
import { ViolationOverlay } from './ViolationOverlay';

interface Props {
  image: ImageResult;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;

/**
 * Простой вьюер на <img> + CSS-трансформации. Согласно плану — старт с
 * PNG-превью, полноценный Cornerstone.js подключаем отдельно (см. README,
 * "Подводные камни" в ТЗ: Cornerstone требует web workers и WASM, поэтому
 * его лучше делать вторым шагом, когда базовый UI уже работает).
 */
export function ImageViewer({ image }: Props) {
  const [zoom, setZoom] = useState(1);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [inverted, setInverted] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoaded(false);
    setZoom(1);
    setBrightness(100);
    setContrast(100);
    setInverted(false);
  }, [image.image_uid]);

  const handleReset = () => {
    setZoom(1);
    setBrightness(100);
    setContrast(100);
    setInverted(false);
  };

  const handleFullscreen = () => {
    containerRef.current?.requestFullscreen?.();
  };

  const filterStyle = `brightness(${brightness}%) contrast(${contrast}%) ${
    inverted ? 'invert(1)' : ''
  }`;

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Space wrap>
        <Tooltip title="Уменьшить">
          <Button
            icon={<ZoomOutOutlined />}
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - 0.25))}
          />
        </Tooltip>
        <Slider
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={0.1}
          value={zoom}
          onChange={setZoom}
          style={{ width: 120 }}
        />
        <Tooltip title="Увеличить">
          <Button
            icon={<ZoomInOutlined />}
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + 0.25))}
          />
        </Tooltip>
        <Tooltip title="Инверсия (MONOCHROME1)">
          <Button
            icon={<SwapOutlined />}
            type={inverted ? 'primary' : 'default'}
            onClick={() => setInverted((v) => !v)}
          />
        </Tooltip>
        <Tooltip title="Сбросить вид">
          <Button icon={<UndoOutlined />} onClick={handleReset} />
        </Tooltip>
        <Tooltip title="Полноэкранный режим">
          <Button icon={<FullscreenOutlined />} onClick={handleFullscreen} />
        </Tooltip>
        {image.visualization && (
          <Space>
            <span>Визуализация нарушений:</span>
            <Switch checked={showOverlay} onChange={setShowOverlay} />
          </Space>
        )}
      </Space>

      <Space wrap>
        <span style={{ width: 90, display: 'inline-block' }}>Яркость</span>
        <Slider
          min={20}
          max={200}
          value={brightness}
          onChange={setBrightness}
          style={{ width: 160 }}
        />
        <span style={{ width: 90, display: 'inline-block' }}>Контраст</span>
        <Slider min={20} max={200} value={contrast} onChange={setContrast} style={{ width: 160 }} />
      </Space>

      <div ref={containerRef} className="viewer-canvas-wrapper" style={{ width: 512, height: 640 }}>
        {!loaded && (
          <Skeleton.Image active style={{ width: 512, height: 640 }} className="skeleton-block" />
        )}
        <div
          style={{
            display: loaded ? 'block' : 'none',
            position: 'relative',
            width: 512,
            height: 640,
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            transition: 'transform 0.15s ease-out',
          }}
        >
          <img
            src={image.preview_url}
            alt={`DICOM превью ${image.image_uid}`}
            style={{ width: '100%', height: '100%', objectFit: 'contain', filter: filterStyle }}
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
          {showOverlay && image.visualization && (
            <ViolationOverlay visualization={image.visualization} width={512} height={640} />
          )}
        </div>
      </div>
    </Space>
  );
}
