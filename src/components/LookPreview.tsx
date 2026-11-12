"use client";

import Box from "@mui/material/Box";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useRef, useState } from "react";
import { renderPreview } from "@/utils/renderPreview";
import type { LightroomSettings } from "@/utils/types";

const INITIAL_SPLIT_PCT = 50;

interface LookPreviewProps {
  source: ImageData;
  beforeUrl: string;
  settings: LightroomSettings;
}

const LookPreview: React.FC<LookPreviewProps> = ({ source, beforeUrl, settings }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [splitPct, setSplitPct] = useState(INITIAL_SPLIT_PCT);

  useEffect(() => {
    // Rendu différé pour ne pas bloquer l'affichage des réglages.
    const timeoutId = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = source.width;
      canvas.height = source.height;
      canvas.getContext("2d")?.putImageData(renderPreview(source, settings), 0, 0);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [source, settings]);

  const handleSplitChange = useCallback((_event: Event, value: number | number[]) => {
    setSplitPct(Array.isArray(value) ? value[0] : value);
  }, []);

  return (
    <Box>
      <Box sx={{ position: "relative", overflow: "hidden", borderRadius: 1, lineHeight: 0 }}>
        <Box component="canvas" ref={canvasRef} sx={{ display: "block", width: "100%", height: "auto" }} />
        <Box
          component="img"
          src={beforeUrl}
          alt="Photo d'origine"
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            clipPath: `inset(0 ${100 - splitPct}% 0 0)`,
          }}
        />
        <Box
          sx={(theme) => ({
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${splitPct}%`,
            borderLeft: `1px solid ${theme.palette.common.white}`,
          })}
        />
      </Box>
      <Slider
        size="small"
        value={splitPct}
        onChange={handleSplitChange}
        aria-label="Position de la comparaison avant / après"
      />
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography variant="body2" color="text.secondary">
          ← Avant
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Aperçu approximatif, hors masques
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Après →
        </Typography>
      </Box>
    </Box>
  );
};

export default LookPreview;
