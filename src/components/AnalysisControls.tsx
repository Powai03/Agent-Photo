"use client";

import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useCallback } from "react";
import LookChip from "@/components/LookChip";
import { INTENSITY_LABELS } from "@/utils/lookEngine";
import type { EngineOptions, Intensity } from "@/utils/lookEngine";
import { AUTO_LOOK_COUNT, LOOKS, MAX_SELECTED_LOOKS } from "@/utils/looks";
import { SCENE_LABELS } from "@/utils/types";
import type { SceneType } from "@/utils/types";

const AUTO_SCENE = "auto";
const SCENE_TYPES = Object.keys(SCENE_LABELS) as SceneType[];
const INTENSITIES = Object.keys(INTENSITY_LABELS) as Intensity[];

interface AnalysisControlsProps {
  options: EngineOptions;
  onChange: (options: EngineOptions) => void;
}

const AnalysisControls: React.FC<AnalysisControlsProps> = ({ options, onChange }) => {
  const isSelectionFull = options.lookIds.length >= MAX_SELECTED_LOOKS;

  const handleSceneChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      onChange({ ...options, sceneOverride: value === AUTO_SCENE ? null : (value as SceneType) });
    },
    [onChange, options],
  );

  const handleIntensityChange = useCallback(
    (_event: React.MouseEvent, intensity: Intensity | null) => {
      if (intensity) onChange({ ...options, intensity });
    },
    [onChange, options],
  );

  const handleToggleLook = useCallback(
    (lookId: string) => {
      const lookIds = options.lookIds.includes(lookId)
        ? options.lookIds.filter((id) => id !== lookId)
        : [...options.lookIds, lookId];
      onChange({ ...options, lookIds });
    },
    [onChange, options],
  );

  return (
    <Stack spacing={2.5}>
      <TextField
        select
        label="Type de scène"
        size="small"
        value={options.sceneOverride ?? AUTO_SCENE}
        onChange={handleSceneChange}
      >
        <MenuItem value={AUTO_SCENE}>Détection automatique</MenuItem>
        {SCENE_TYPES.map((sceneType) => (
          <MenuItem key={sceneType} value={sceneType}>
            {SCENE_LABELS[sceneType]}
          </MenuItem>
        ))}
      </TextField>
      <Box>
        <Typography variant="h3" gutterBottom>
          Intensité du rendu
        </Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          color="primary"
          value={options.intensity}
          onChange={handleIntensityChange}
        >
          {INTENSITIES.map((intensity) => (
            <ToggleButton key={intensity} value={intensity}>
              {INTENSITY_LABELS[intensity]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
      <Box>
        <Typography variant="h3" gutterBottom>
          Rendus
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {options.lookIds.length === 0
            ? `Sans sélection, les ${AUTO_LOOK_COUNT} rendus les plus adaptés à la photo sont proposés.`
            : `${options.lookIds.length} / ${MAX_SELECTED_LOOKS} sélectionnés`}
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {LOOKS.map((look) => {
            const isSelected = options.lookIds.includes(look.id);
            return (
              <LookChip
                key={look.id}
                look={look}
                isSelected={isSelected}
                isDisabled={isSelectionFull && !isSelected}
                onToggle={handleToggleLook}
              />
            );
          })}
        </Box>
      </Box>
    </Stack>
  );
};

export default AnalysisControls;
