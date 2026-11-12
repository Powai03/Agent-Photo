"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useCallback, useMemo, useState } from "react";
import AnalysisControls from "@/components/AnalysisControls";
import AnalysisSummary from "@/components/AnalysisSummary";
import LookCard from "@/components/LookCard";
import PhotoDropzone from "@/components/PhotoDropzone";
import RecommendationCard from "@/components/RecommendationCard";
import { prepareImage } from "@/utils/image";
import type { PreparedImage } from "@/utils/image";
import { buildAnalysisResult } from "@/utils/lookEngine";
import type { EngineOptions } from "@/utils/lookEngine";

const PREPARE_ERROR = "Impossible de lire cette image. Essayez un JPEG, un HEIC ou un PNG.";
const DEFAULT_OPTIONS: EngineOptions = { sceneOverride: null, intensity: "balanced", lookIds: [] };

const PhotoAnalyzer: React.FC = () => {
  const [preparedImage, setPreparedImage] = useState<PreparedImage | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<EngineOptions>(DEFAULT_OPTIONS);

  const result = useMemo(
    () =>
      preparedImage ? buildAnalysisResult(preparedImage.features, preparedImage.exif, options) : null,
    [preparedImage, options],
  );

  const handleFileSelected = useCallback(async (file: File) => {
    setError(null);
    setIsPreparing(true);
    try {
      const nextImage = await prepareImage(file);
      setPreparedImage(nextImage);
      setOptions((current) => ({ ...current, sceneOverride: null }));
    } catch {
      setPreparedImage(null);
      setError(PREPARE_ERROR);
    } finally {
      setIsPreparing(false);
    }
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h1">Agent Photo</Typography>
        <Typography color="text.secondary">
          Une photo en entrée, des réglages iPhone et Lightroom à reproduire, déclinés par rendu. Tout est
          calculé dans le navigateur : la photo ne quitte pas l'appareil.
        </Typography>
      </Box>
      <Box
        sx={(theme) => ({
          display: "grid",
          alignItems: "start",
          gap: 4,
          gridTemplateColumns: { xs: "1fr", md: `${theme.spacing(48)} minmax(0, 1fr)` },
        })}
      >
        <Stack spacing={3}>
          <PhotoDropzone
            previewUrl={preparedImage?.previewUrl ?? null}
            isPreparing={isPreparing}
            onFileSelected={handleFileSelected}
          />
          <AnalysisControls options={options} onChange={setOptions} />
        </Stack>
        <Stack spacing={3}>
          {error && <Alert severity="error">{error}</Alert>}
          {!result && !error && (
            <Typography color="text.secondary">
              Les propositions de réglages s'afficheront ici dès qu'une photo sera chargée.
            </Typography>
          )}
          {result && preparedImage && (
            <>
              <AnalysisSummary analysis={result.analysis} />
              <RecommendationCard recommendation={result.recommendation} />
              {result.looks.map((look) => (
                <LookCard
                  key={look.lookId}
                  look={look}
                  previewSource={preparedImage.previewPixels}
                  beforeUrl={preparedImage.previewUrl}
                />
              ))}
            </>
          )}
        </Stack>
      </Box>
    </Container>
  );
};

export default PhotoAnalyzer;
