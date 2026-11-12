"use client";

import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import { useCallback } from "react";
import type { LookDefinition } from "@/utils/looks";

interface LookChipProps {
  look: LookDefinition;
  isSelected: boolean;
  isDisabled: boolean;
  onToggle: (lookId: string) => void;
}

const LookChip: React.FC<LookChipProps> = ({ look, isSelected, isDisabled, onToggle }) => {
  const handleClick = useCallback(() => onToggle(look.id), [onToggle, look.id]);

  return (
    <Tooltip title={look.signature} enterDelay={500}>
      <span>
        <Chip
          label={look.name}
          size="small"
          color={isSelected ? "primary" : "default"}
          variant={isSelected ? "filled" : "outlined"}
          disabled={isDisabled}
          onClick={handleClick}
        />
      </span>
    </Tooltip>
  );
};

export default LookChip;
