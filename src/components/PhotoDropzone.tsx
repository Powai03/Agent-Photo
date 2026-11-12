"use client";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { useCallback, useState } from "react";

interface PhotoDropzoneProps {
  previewUrl: string | null;
  isPreparing: boolean;
  onFileSelected: (file: File) => void;
}

const PhotoDropzone: React.FC<PhotoDropzoneProps> = ({ previewUrl, isPreparing, onFileSelected }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) onFileSelected(file);
      event.target.value = "";
    },
    [onFileSelected],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected],
  );

  return (
    <Box
      component="label"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      sx={(theme) => ({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: theme.spacing(28),
        overflow: "hidden",
        cursor: "pointer",
        textAlign: "center",
        borderRadius: 1,
        border: `1px dashed ${isDragging ? theme.palette.primary.main : theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
      })}
    >
      <Box
        component="input"
        type="file"
        accept="image/*,.heic,.heif"
        onChange={handleInputChange}
        sx={{ display: "none" }}
      />
      {isPreparing && <CircularProgress aria-label="Préparation de la photo" />}
      {!isPreparing && previewUrl && (
        <Box
          component="img"
          src={previewUrl}
          alt="Photo à analyser"
          sx={(theme) => ({ display: "block", width: "100%", maxHeight: theme.spacing(60), objectFit: "contain" })}
        />
      )}
      {!isPreparing && !previewUrl && (
        <Box sx={{ p: 3 }}>
          <Typography>Déposez une photo ou cliquez pour en choisir une</Typography>
          <Typography variant="body2" color="text.secondary">
            JPEG, HEIC, PNG ou WebP
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default PhotoDropzone;
